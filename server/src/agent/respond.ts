import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import type { Response } from 'express';
import type {
  ChatMessage,
  CivicReachUIMessage,
  RetrievalPartData,
} from '@civicreach/shared';
import { MODELS, RETRIEVAL } from '../config';
import { logError, logRetrieval } from '../log';
import {
  embedQuery,
  retrieveAboveThreshold,
  type RetrievedHit,
  type VectorStore,
} from '../retrieval/store';
import { containsNoMatchSentence } from './no-match';
import { buildSystemPrompt } from './prompt';

/**
 * The grounded proceed path (Slice 2): retrieve above the explicit
 * threshold, answer with excerpts injected into the system prompt, then emit
 * one typed `data-retrieval` part once the text is complete — `grounded`
 * with citations, `no_match` when the model declared the mandatory no-match
 * sentence (the UI renders the official referral from shared constants), or
 * `conversational` when a turn needed no benefit facts.
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
        score: hit.score,
      })),
    };
  }
  return { status: 'conversational' };
}

export async function respondGrounded(options: {
  res: Response;
  store: VectorStore;
  sanitizedMessages: ChatMessage[];
  sanitizedUserText: string;
}): Promise<void> {
  const retrievalStarted = Date.now();
  const queryVector = await embedQuery(options.sanitizedUserText);
  const { hits, bestScore } = retrieveAboveThreshold({
    store: options.store,
    queryVector,
    topK: RETRIEVAL.topK,
    threshold: RETRIEVAL.threshold,
  });

  logRetrieval({
    latencyMs: Date.now() - retrievalStarted,
    hitCount: hits.length,
    bestScore,
    threshold: RETRIEVAL.threshold,
    citationIds: hits.map((hit) => hit.chunk.citationId),
  });

  const result = streamText({
    model: openai(MODELS.agent),
    system: buildSystemPrompt(hits),
    messages: await convertToModelMessages(options.sanitizedMessages),
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

      let finalText = '';
      try {
        finalText = await result.text;
      } catch {
        // The stream error was already surfaced to the client via onError;
        // fall through so the part below reports no grounded citations.
      }

      writer.write({
        type: 'data-retrieval',
        data: retrievalPartFor({ finalText, hits, bestScore }),
      });
    },
  });

  await pipeUIMessageStreamToResponse({ response: options.res, stream });
}
