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

export function logError(scope: string, error: unknown): void {
  const message =
    error instanceof Error ? error.name + ': ' + error.message : 'unknown_error';
  // Never include request bodies or message text.
  console.error(JSON.stringify({ type: 'error', scope, message }));
}
