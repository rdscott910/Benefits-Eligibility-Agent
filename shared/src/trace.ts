import { z } from 'zod';
import { piiKindSchema } from './guardrails';

/**
 * Per-turn glass-box trace (decisions/trace-transparency.md, settled with
 * user 2026-07-29). Emitted once per assistant turn as a `data-trace` part
 * on EVERY response path — proceed, guardrail short-circuit, and
 * fail-closed — and rendered by the client as the trace drawer.
 *
 * It carries only metadata the pipeline actually produced: sanitize kinds
 * and counts (never values, never message text), the resolved guardrail
 * outcome with latency and classifier token usage, proceed-path stage
 * timings and agent usage, and a per-turn dollar ESTIMATE computed from the
 * pricing constants pinned in `server/src/config.ts`. Retrieval matches
 * with scores travel in `data-retrieval`, and tool calls with I/O travel as
 * native typed tool parts — the drawer combines all three surfaces.
 */

export const traceRedactionSchema = z.object({
  kind: piiKindSchema,
  count: z.number().int().min(1),
});
export type TraceRedaction = z.infer<typeof traceRedactionSchema>;

/** The displayed Stage 2 outcome, including the templated fail-closed path. */
export const traceGuardrailVerdictSchema = z.enum([
  'crisis',
  'injection',
  'pii',
  'out_of_scope',
  'proceed',
  'fail_closed',
]);
export type TraceGuardrailVerdict = z.infer<typeof traceGuardrailVerdictSchema>;

/** What decided the verdict (fail-closed has no deciding source). */
export const traceGuardrailSourceSchema = z.enum([
  'crisis_fast_path',
  'injection_fast_path',
  'classifier',
  'deterministic_pii',
]);
export type TraceGuardrailSource = z.infer<typeof traceGuardrailSourceSchema>;

export const traceTokenUsageSchema = z.object({
  /** Null when the stage made no model call (fast-paths) or usage was unavailable. */
  inputTokens: z.number().int().min(0).nullable(),
  outputTokens: z.number().int().min(0).nullable(),
});
export type TraceTokenUsage = z.infer<typeof traceTokenUsageSchema>;

export const tracePartDataSchema = z.object({
  /** Stage 1 result for the latest user message: kinds and counts only, never values. */
  sanitize: z.object({
    redactions: z.array(traceRedactionSchema),
  }),
  /** Stage 2 resolved outcome for the turn. */
  guardrail: z.object({
    verdict: traceGuardrailVerdictSchema,
    source: traceGuardrailSourceSchema.nullable(),
    latencyMs: z.number().min(0),
    tokens: traceTokenUsageSchema,
  }),
  /** Proceed-path retrieval stage; null when a short-circuit skipped it. */
  retrieval: z
    .object({
      latencyMs: z.number().min(0),
      embeddingTokens: z.number().int().min(0).nullable(),
    })
    .nullable(),
  /** Agent model usage for the turn; null when the agent never ran. */
  agent: z
    .object({
      tokens: traceTokenUsageSchema,
    })
    .nullable(),
  /** Estimated dollars for this turn from pinned pricing — an estimate, not a bill. */
  estimatedCostUsd: z.number().min(0),
});
export type TracePartData = z.infer<typeof tracePartDataSchema>;
