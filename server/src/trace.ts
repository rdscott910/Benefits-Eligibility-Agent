import {
  tracePartDataSchema,
  type TracePartData,
  type TraceTokenUsage,
} from '@civicreach/shared';
import { PRICING_USD_PER_1M_TOKENS } from './config';
import type { PipelineOutcome } from './middleware/pipeline';

/**
 * Builders for the per-turn `data-trace` part (trace-transparency.md).
 * The trace only repackages metadata the pipeline already computed —
 * building it must never change what the pipeline does.
 */

/**
 * Estimated dollars for one turn from the pinned per-1M-token prices in
 * `config.ts`. Displayed as an ESTIMATE; unknown token counts contribute
 * zero rather than a guess.
 */
export function estimateCostUsd(usage: {
  classifier: TraceTokenUsage;
  agent: TraceTokenUsage | null;
  embeddingTokens: number | null;
}): number {
  const perToken = 1 / 1_000_000;
  let usd = 0;
  usd +=
    (usage.classifier.inputTokens ?? 0) *
    perToken *
    PRICING_USD_PER_1M_TOKENS.classifier.input;
  usd +=
    (usage.classifier.outputTokens ?? 0) *
    perToken *
    PRICING_USD_PER_1M_TOKENS.classifier.output;
  if (usage.agent) {
    usd +=
      (usage.agent.inputTokens ?? 0) *
      perToken *
      PRICING_USD_PER_1M_TOKENS.agent.input;
    usd +=
      (usage.agent.outputTokens ?? 0) *
      perToken *
      PRICING_USD_PER_1M_TOKENS.agent.output;
  }
  usd +=
    (usage.embeddingTokens ?? 0) *
    perToken *
    PRICING_USD_PER_1M_TOKENS.embedding.input;
  return usd;
}

function tokensOf(resolved: {
  inputTokens?: number;
  outputTokens?: number;
}): TraceTokenUsage {
  return {
    inputTokens: resolved.inputTokens ?? null,
    outputTokens: resolved.outputTokens ?? null,
  };
}

/**
 * The trace as the guardrail pipeline leaves it. Short-circuit and
 * fail-closed turns stream it unchanged (retrieval and agent never ran);
 * the proceed path completes those sections in `respondGrounded` before
 * writing.
 */
export function traceForOutcome(outcome: PipelineOutcome): TracePartData {
  const sanitize = { redactions: outcome.latestTurnRedactions };

  switch (outcome.kind) {
    case 'proceed': {
      const tokens = tokensOf(outcome.resolved);
      return tracePartDataSchema.parse({
        sanitize,
        guardrail: {
          verdict: 'proceed',
          source: outcome.resolved.source,
          latencyMs: outcome.resolved.latencyMs,
          tokens,
        },
        retrieval: null,
        agent: null,
        estimatedCostUsd: estimateCostUsd({
          classifier: tokens,
          agent: null,
          embeddingTokens: null,
        }),
      });
    }
    case 'short_circuit': {
      const tokens = tokensOf(outcome.resolved);
      return tracePartDataSchema.parse({
        sanitize,
        guardrail: {
          verdict: outcome.verdict,
          source: outcome.resolved.source,
          latencyMs: outcome.resolved.latencyMs,
          tokens,
        },
        retrieval: null,
        agent: null,
        estimatedCostUsd: estimateCostUsd({
          classifier: tokens,
          agent: null,
          embeddingTokens: null,
        }),
      });
    }
    case 'fail_closed':
      return tracePartDataSchema.parse({
        sanitize,
        guardrail: {
          verdict: 'fail_closed',
          source: null,
          latencyMs: outcome.resolved.latencyMs,
          tokens: { inputTokens: null, outputTokens: null },
        },
        retrieval: null,
        agent: null,
        estimatedCostUsd: 0,
      });
    default: {
      const unhandled: never = outcome;
      throw new Error(`Unhandled pipeline outcome: ${String(unhandled)}`);
    }
  }
}
