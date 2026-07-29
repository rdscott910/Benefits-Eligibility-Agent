import {
  FAIL_CLOSED_RESPONSE,
  shortCircuitResponse,
  type ChatMessage,
  type OutOfScopeKind,
  type PiiKind,
  type ShortCircuitVerdict,
  type TraceRedaction,
} from '@civicreach/shared';
import { classifyInbound, type ResolvedGuardrail } from './classify';
import { latestUserText, redactionSummary, sanitizeMessages } from './sanitize';

export type PipelineOutcome =
  | {
      kind: 'proceed';
      sanitizedMessages: ChatMessage[];
      sanitizedUserText: string;
      /** Stage 1 kinds/counts for the latest user turn (trace display only). */
      latestTurnRedactions: TraceRedaction[];
      resolved: Extract<ResolvedGuardrail, { action: 'proceed' }>;
    }
  | {
      kind: 'short_circuit';
      verdict: ShortCircuitVerdict;
      outOfScopeKind?: OutOfScopeKind;
      piiKind?: PiiKind;
      responseText: string;
      sanitizedUserText: string;
      sanitizedMessages: ChatMessage[];
      rawUserText: string;
      latestTurnRedactions: TraceRedaction[];
      resolved: Extract<ResolvedGuardrail, { action: 'short_circuit' }>;
    }
  | {
      kind: 'fail_closed';
      responseText: string;
      sanitizedUserText: string;
      sanitizedMessages: ChatMessage[];
      latestTurnRedactions: TraceRedaction[];
      resolved: Extract<ResolvedGuardrail, { action: 'fail_closed' }>;
    };

function latestUserMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') {
      return message;
    }
  }
  return null;
}

function rawLatestUserText(messages: ChatMessage[]): string {
  const message = latestUserMessage(messages);
  if (!message) {
    return '';
  }
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

export async function runGuardrailPipeline(
  messages: ChatMessage[],
): Promise<PipelineOutcome> {
  const rawUserText = rawLatestUserText(messages);
  const sanitized = sanitizeMessages(messages);
  const sanitizedUserText = latestUserText(sanitized.messages);
  const latestMessage = latestUserMessage(messages);
  const latestTurnRedactions = latestMessage
    ? redactionSummary(latestMessage)
    : [];
  const resolved = await classifyInbound({
    sanitizedUserText,
    hasDefinitiveSsn: sanitized.hasDefinitiveSsn,
    detectedPiiKinds: sanitized.detectedKinds,
  });

  switch (resolved.action) {
    case 'proceed':
      return {
        kind: 'proceed',
        sanitizedMessages: sanitized.messages,
        sanitizedUserText,
        latestTurnRedactions,
        resolved,
      };
    case 'fail_closed':
      return {
        kind: 'fail_closed',
        responseText: FAIL_CLOSED_RESPONSE,
        sanitizedUserText,
        sanitizedMessages: sanitized.messages,
        latestTurnRedactions,
        resolved,
      };
    case 'short_circuit':
      return {
        kind: 'short_circuit',
        verdict: resolved.verdict,
        outOfScopeKind: resolved.outOfScopeKind,
        piiKind: resolved.piiKind,
        responseText: shortCircuitResponse({
          verdict: resolved.verdict,
          outOfScopeKind: resolved.outOfScopeKind,
          piiKind: resolved.piiKind,
        }),
        sanitizedUserText,
        sanitizedMessages: sanitized.messages,
        rawUserText,
        latestTurnRedactions,
        resolved,
      };
    default: {
      const unhandled: never = resolved;
      throw new Error(`Unhandled pipeline action: ${String(unhandled)}`);
    }
  }
}

export function userMessage(text: string, id = 'u1'): ChatMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}
