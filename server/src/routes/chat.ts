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
  type TracePartData,
} from '@civicreach/shared';
import { respondGrounded } from '../agent/respond';
import type { IncomeLimitsTable } from '../corpus/income-table';
import { logError, logGuardrail } from '../log';
import { runGuardrailPipeline } from '../middleware/pipeline';
import { rateLimitChat } from '../middleware/rate-limit';
import type { VectorStore } from '../retrieval/store';
import { traceForOutcome } from '../trace';

function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'rate_limited':
      return 429;
    case 'provider_unavailable':
      return 503;
    case 'internal_error':
      return 500;
    default: {
      const unhandled: never = code;
      throw new Error(`Unhandled API error code: ${String(unhandled)}`);
    }
  }
}

/** Friendly copy when Zod rejects oversize sessions or message bodies. */
function envelopeValidationMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string; code?: string }>;
}): string {
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.');
    if (path === 'messages' && /too big|at most|maximum/i.test(issue.message)) {
      return 'Session limit reached — refresh the page to start a fresh conversation.';
    }
    if (
      path.endsWith('text') &&
      /too big|at most|maximum|max/i.test(issue.message)
    ) {
      return 'That message is too long. Shorten it (under 2,000 characters) and try again.';
    }
  }
  return `Body does not match chat envelope v${ENVELOPE_VERSION}: ${error.issues
    .map((issue) => `${issue.path.join('.') || 'body'} ${issue.message}`)
    .join('; ')}`;
}

function isProviderQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as {
    statusCode?: number;
    status?: number;
    code?: string;
    message?: string;
    data?: { error?: { code?: string; type?: string } };
  };
  const status = record.statusCode ?? record.status;
  const code =
    record.code ?? record.data?.error?.code ?? record.data?.error?.type ?? '';
  const message = typeof record.message === 'string' ? record.message : '';
  if (status === 429) {
    return true;
  }
  return (
    /insufficient_quota|rate_limit|billing/i.test(code) ||
    /insufficient_quota|rate limit|billing/i.test(message)
  );
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
    /** Per-turn glass-box trace — every response path carries one (v4). */
    trace: TracePartData;
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
      writer.write({ type: 'data-trace', data: options.trace });
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

  chatRouter.post('/chat', rateLimitChat, async (req, res) => {
    const request = chatRequestSchema.safeParse(req.body);

    if (!request.success) {
      sendError(res, 'invalid_request', envelopeValidationMessage(request.error));
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
          streamTemplatedReply(res, {
            text: outcome.responseText,
            trace: traceForOutcome(outcome),
          });
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
            trace: traceForOutcome(outcome),
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
            baseTrace: traceForOutcome(outcome),
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
        if (isProviderQuotaError(error)) {
          sendError(
            res,
            'provider_unavailable',
            'The demo is resting — the model provider is temporarily unavailable. Try again later.',
          );
          return;
        }
        sendError(res, 'internal_error', 'The request could not be completed.');
      }
    }
  });

  return chatRouter;
}
