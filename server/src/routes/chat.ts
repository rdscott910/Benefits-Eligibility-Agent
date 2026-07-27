import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
import { Router, type Response } from 'express';
import {
  ENVELOPE_VERSION,
  chatRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type CivicReachUIMessage,
  type ShortCircuitVerdict,
} from '@civicreach/shared';
import { MODELS } from '../config';
import { logError, logGuardrail } from '../log';
import { runGuardrailPipeline } from '../middleware/pipeline';

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

export const chatRouter = Router();

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

        // No system instructions yet: proceed stays the plain Slice 0 shell.
        const result = streamText({
          model: openai(MODELS.agent),
          messages: await convertToModelMessages(outcome.sanitizedMessages),
        });

        await pipeUIMessageStreamToResponse({
          response: res,
          stream: toUIMessageStream({
            stream: result.stream,
            onError: (error) => {
              logError('agent_stream', error);
              return 'The model call failed.';
            },
          }),
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
