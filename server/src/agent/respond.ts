import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
} from 'ai';
import type { Response } from 'express';
import {
  tracePartDataSchema,
  type CaseFile,
  type ChatMessage,
  type CivicReachUIMessage,
  type RetrievalPartData,
  type TracePartData,
  type TraceTokenUsage,
  type VerdictPartData,
} from '@civicreach/shared';
import { MODELS, RETRIEVAL } from '../config';
import type { IncomeLimitsTable } from '../corpus/income-table';
import { logError, logRetrieval } from '../log';
import { estimateCostUsd } from '../trace';
import {
  embedQuery,
  retrieveAboveThreshold,
  type RetrievedHit,
  type VectorStore,
} from '../retrieval/store';
import { createCheckIncomeThresholdTool } from '../tools/check-income-threshold';
import { createLookupIncomeLimitsTool } from '../tools/lookup-income-limits';
import {
  createUpdateCaseFileTool,
  type CaseFileHolder,
} from '../tools/update-case-file';
import { containsNoMatchSentence } from './no-match';
import { buildSystemPrompt } from './prompt';

/**
 * The grounded proceed path (Slice 2 retrieval + Slice 3 tools): retrieve
 * above the explicit threshold, answer with excerpts injected into the
 * system prompt, and let the model call the deterministic tools —
 * `updateCaseFile` (the only mutation path for the working CaseFile),
 * `lookupIncomeLimits`, and `checkIncomeThreshold` (which reads only
 * stated/confirmed CaseFile facts). After the text completes the server
 * emits typed parts: `data-retrieval` (grounded / no-match / conversational),
 * `data-verdict` (only when the threshold tool ran — derived from tool
 * output, never model text), and `data-casefile` (the post-turn state the
 * client stores for the next request).
 */

export function retrievalPartFor(options: {
  finalText: string;
  hits: RetrievedHit[];
  bestScore: number | null;
}): RetrievalPartData {
  if (options.finalText && containsNoMatchSentence(options.finalText)) {
    return {
      status: 'no_match',
      bestScore: options.bestScore,
      threshold: RETRIEVAL.threshold,
    };
  }
  if (options.finalText && options.hits.length > 0) {
    return {
      status: 'grounded',
      citations: options.hits.map((hit) => ({
        citationId: hit.chunk.citationId,
        docId: hit.chunk.docId,
        title: hit.chunk.docTitle,
        // The exact retrieved chunk rides along so the UI's clickable chips
        // can reveal it without another round-trip (grounding-policy.md).
        heading: hit.chunk.heading,
        text: hit.chunk.text,
        score: hit.score,
      })),
    };
  }
  return { status: 'conversational' };
}

/**
 * Agent-loop step budget per turn: enough for a few `updateCaseFile` calls,
 * a lookup or threshold check, and the closing narration — bounded so a
 * confused loop cannot spin.
 */
const MAX_AGENT_STEPS = 6;

export async function respondGrounded(options: {
  res: Response;
  store: VectorStore;
  incomeTable: IncomeLimitsTable;
  caseFile: CaseFile;
  sourceTurn: number;
  sanitizedMessages: ChatMessage[];
  sanitizedUserText: string;
  /**
   * Sanitize + guardrail trace sections from the pipeline outcome; this
   * function completes the retrieval/agent/cost sections and writes the
   * turn's `data-trace` part.
   */
  baseTrace: TracePartData;
}): Promise<void> {
  const retrievalStarted = Date.now();
  const { vector: queryVector, tokens: embeddingTokens } = await embedQuery(
    options.sanitizedUserText,
  );
  const { hits, bestScore } = retrieveAboveThreshold({
    store: options.store,
    queryVector,
    topK: RETRIEVAL.topK,
    threshold: RETRIEVAL.threshold,
  });
  const retrievalLatencyMs = Date.now() - retrievalStarted;

  logRetrieval({
    latencyMs: retrievalLatencyMs,
    hitCount: hits.length,
    bestScore,
    threshold: RETRIEVAL.threshold,
    citationIds: hits.map((hit) => hit.chunk.citationId),
  });

  // The request CaseFile becomes this turn's working copy; only the
  // updateCaseFile tool mutates it (state-memory.md R5).
  const holder: CaseFileHolder = { current: options.caseFile };
  const verdictHolder: { current: VerdictPartData | null } = { current: null };

  const result = streamText({
    model: openai(MODELS.agent),
    system: buildSystemPrompt(hits, options.caseFile),
    messages: await convertToModelMessages(options.sanitizedMessages),
    tools: {
      updateCaseFile: createUpdateCaseFileTool({
        holder,
        sourceTurn: options.sourceTurn,
      }),
      lookupIncomeLimits: createLookupIncomeLimitsTool({
        table: options.incomeTable,
      }),
      checkIncomeThreshold: createCheckIncomeThresholdTool({
        table: options.incomeTable,
        holder,
        onVerdict: (verdict) => {
          verdictHolder.current = verdict;
        },
      }),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  const stream = createUIMessageStream<CivicReachUIMessage>({
    execute: async ({ writer }) => {
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          onError: (error) => {
            logError('agent_stream', error);
            return 'The model call failed.';
          },
        }),
      );

      // The visible reply is the concatenation of every step's text (tool
      // calls may sit between segments), so no-match detection runs over
      // all of it.
      let finalText = '';
      // The agent DID run on this path; null token fields mean usage was
      // unavailable (e.g. the stream failed), never that no call happened.
      let agentTokens: TraceTokenUsage = {
        inputTokens: null,
        outputTokens: null,
      };
      try {
        const steps = await result.steps;
        finalText = steps.map((step) => step.text).join('');
        const totalUsage = await result.totalUsage;
        agentTokens = {
          inputTokens: totalUsage.inputTokens ?? null,
          outputTokens: totalUsage.outputTokens ?? null,
        };
      } catch {
        // The stream error was already surfaced to the client via onError;
        // fall through so the parts below report honestly (no citations,
        // no verdict, unchanged-or-partial CaseFile).
      }

      writer.write({
        type: 'data-retrieval',
        data: retrievalPartFor({ finalText, hits, bestScore }),
      });

      const verdict = verdictHolder.current;
      if (verdict) {
        writer.write({ type: 'data-verdict', data: verdict });
      }

      writer.write({
        type: 'data-casefile',
        data: { caseFile: holder.current },
      });

      // The turn's glass-box trace: pipeline sections as handed in, plus
      // the proceed-path sections this function owns (trace-transparency.md).
      writer.write({
        type: 'data-trace',
        data: tracePartDataSchema.parse({
          sanitize: options.baseTrace.sanitize,
          guardrail: options.baseTrace.guardrail,
          retrieval: { latencyMs: retrievalLatencyMs, embeddingTokens },
          agent: { tokens: agentTokens },
          estimatedCostUsd: estimateCostUsd({
            classifier: options.baseTrace.guardrail.tokens,
            agent: agentTokens,
            embeddingTokens,
          }),
        } satisfies TracePartData),
      });
    },
  });

  await pipeUIMessageStreamToResponse({ response: options.res, stream });
}
