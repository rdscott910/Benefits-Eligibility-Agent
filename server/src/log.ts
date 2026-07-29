/**
 * Structured logging for guardrails. Carries verdicts, timings, and token
 * counts — never raw message content (decisions/classifier-design.md).
 */

export type GuardrailLogEvent = {
  stage: 'sanitize' | 'classify' | 'resolve' | 'short_circuit' | 'agent' | 'fail_closed';
  verdict?: string;
  outOfScopeKind?: string;
  piiKind?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  source?:
    | 'crisis_fast_path'
    | 'injection_fast_path'
    | 'classifier'
    | 'deterministic_pii'
    | 'fail_closed';
  errorCode?: string;
};

export function logGuardrail(event: GuardrailLogEvent): void {
  console.log(JSON.stringify({ type: 'guardrail', ...event }));
}

/**
 * Retrieval telemetry: scores, counts, latency, and stable citation ids —
 * never query text or chunk content (same policy as guardrail logs).
 */
export type RetrievalLogEvent = {
  latencyMs: number;
  hitCount: number;
  bestScore: number | null;
  threshold: number;
  citationIds: string[];
};

export function logRetrieval(event: RetrievalLogEvent): void {
  console.log(
    JSON.stringify({
      type: 'retrieval',
      ...event,
      bestScore: event.bestScore === null ? null : Number(event.bestScore.toFixed(4)),
    }),
  );
}

/**
 * Tool telemetry: which deterministic tool ran, how long it took, and its
 * outcome (a status word or tier, never a fact value) — same
 * never-log-content policy as guardrails and retrieval.
 */
export type ToolLogEvent = {
  tool: 'updateCaseFile' | 'lookupIncomeLimits' | 'checkIncomeThreshold';
  latencyMs: number;
  outcome: string;
};

export function logTool(event: ToolLogEvent): void {
  console.log(JSON.stringify({ type: 'tool', ...event }));
}

export function logError(scope: string, error: unknown): void {
  const message =
    error instanceof Error ? error.name + ': ' + error.message : 'unknown_error';
  // Never include request bodies or message text.
  console.error(JSON.stringify({ type: 'error', scope, message }));
}
