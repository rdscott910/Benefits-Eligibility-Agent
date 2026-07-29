import { randomUUID } from 'node:crypto';
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
} from 'ai';
import { Router, type Response } from 'express';
import {
  ENVELOPE_VERSION,
  chatRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type ChatMessage,
  type CivicReachUIMessage,
  type ShortCircuitVerdict,
} from '@civicreach/shared';
import { respondGrounded } from '../agent/respond';
import type { IncomeLimitsTable } from '../corpus/income-table';
import { logError, logGuardrail } from '../log';
import { runGuardrailPipeline } from '../middleware/pipeline';
import type { VectorStore } from '../retrieval/store';

function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'internal_error':
      return 500;
    default: {
      const unhandled: never = code;
      throw new Error(`Unhandled API error code: ${String(unhandled)}`);
    }
  }
}

function sendError(res: Response, code: ApiErrorCode, message: string): void {
  const body: ApiError = { error: { code, message } };
  res.status(httpStatusFor(code)).json(body);
}

function streamTemplatedReply(
  res: Response,
  options: {
    text: string;
    verdict?: ShortCircuitVerdict;
  },
): void {
  const textId = randomUUID();
  const stream = createUIMessageStream<CivicReachUIMessage>({
    execute: ({ writer }) => {
      if (options.verdict) {
        writer.write({
          type: 'data-guardrail',
          data: { verdict: options.verdict },
        });
      }
      writer.write({ type: 'text-start', id: textId });
      writer.write({ type: 'text-delta', id: textId, delta: options.text });
      writer.write({ type: 'text-end', id: textId });
    },
  });

  void pipeUIMessageStreamToResponse({
    response: res,
    stream,
  });
}

/** 1-based index of the current user turn (facts carry this as provenance). */
function currentUserTurn(messages: ChatMessage[]): number {
  return Math.max(
    1,
    messages.filter((message) => message.role === 'user').length,
  );
}

/**
 * The chat route needs the boot-built vector store and the parsed
 * income-limits table (the tools' only source of figures), so it is 
 * written as a factory function so the entry point can build those 
 * dependencies first (fail-fast) and wires them in:
 * 
 * `index.ts` builds both first (fail-fast) and wires them in.
 * Guardrail short-circuits never touch the store, the tools, or the
 * CaseFile — those run only on the `proceed` path.
 */
export function createChatRouter(grounding: {
  store: VectorStore;
  incomeTable: IncomeLimitsTable;
}): Router {
  const chatRouter = Router();

  chatRouter.post('/chat', async (req, res) => {
    const request = chatRequestSchema.safeParse(req.body);

    if (!request.success) {
      sendError(
        res,
        'invalid_request',
        `Body does not match chat envelope v${ENVELOPE_VERSION}: ${request.error.issues
          .map((issue) => `${issue.path.join('.') || 'body'} ${issue.message}`)
          .join('; ')}`,
      );
      return;
    }

    try {
      const outcome = await runGuardrailPipeline(request.data.messages);

      switch (outcome.kind) {
        case 'fail_closed': {
          logGuardrail({
            stage: 'fail_closed',
            latencyMs: outcome.resolved.latencyMs,
          });
          streamTemplatedReply(res, { text: outcome.responseText });
          return;
        }
        case 'short_circuit': {
          logGuardrail({
            stage: 'short_circuit',
            verdict: outcome.verdict,
            outOfScopeKind: outcome.outOfScopeKind,
            piiKind: outcome.piiKind,
            latencyMs: outcome.resolved.latencyMs,
            source: outcome.resolved.source,
          });
          streamTemplatedReply(res, {
            text: outcome.responseText,
            verdict: outcome.verdict,
          });
          return;
        }
        case 'proceed': {
          logGuardrail({
            stage: 'agent',
            verdict: 'proceed',
            latencyMs: outcome.resolved.latencyMs,
            inputTokens: outcome.resolved.inputTokens,
            outputTokens: outcome.resolved.outputTokens,
          });

          await respondGrounded({
            res,
            store: grounding.store,
            incomeTable: grounding.incomeTable,
            caseFile: request.data.caseFile ?? {},
            sourceTurn: currentUserTurn(request.data.messages),
            sanitizedMessages: outcome.sanitizedMessages,
            sanitizedUserText: outcome.sanitizedUserText,
          });
          return;
        }
        default: {
          const unhandled: never = outcome;
          throw new Error(`Unhandled pipeline outcome: ${String(unhandled)}`);
        }
      }
    } catch (error) {
      logError('chat', error);

      if (!res.headersSent) {
        sendError(res, 'internal_error', 'The request could not be completed.');
      }
    }
  });

  return chatRouter;
}
