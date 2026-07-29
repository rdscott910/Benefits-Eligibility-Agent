/**
 * Unit tests for the Slice 4 transparency layer (trace-transparency.md):
 * every pipeline outcome builds a schema-valid `data-trace` payload, the
 * cost estimate follows the pinned pricing constants exactly, and the
 * Stage 1 sanitize summary is kinds + counts only — never a value.
 */
import { describe, expect, it } from 'vitest';
import { tracePartDataSchema, type TraceRedaction } from '@civicreach/shared';
import { PRICING_USD_PER_1M_TOKENS } from './config';
import { userMessage, type PipelineOutcome } from './middleware/pipeline';
import { redactText, redactionSummary } from './middleware/sanitize';
import { estimateCostUsd, traceForOutcome } from './trace';

function proceedOutcome(): PipelineOutcome {
  return {
    kind: 'proceed',
    sanitizedMessages: [userMessage('how do the income limits work?')],
    sanitizedUserText: 'how do the income limits work?',
    latestTurnRedactions: [],
    resolved: {
      action: 'proceed',
      source: 'classifier',
      latencyMs: 412,
      inputTokens: 148,
      outputTokens: 6,
    },
  };
}

function crisisOutcome(): PipelineOutcome {
  return {
    kind: 'short_circuit',
    verdict: 'crisis',
    responseText: 'templated crisis response',
    sanitizedUserText: 'crisis text',
    sanitizedMessages: [userMessage('crisis text')],
    rawUserText: 'crisis text',
    latestTurnRedactions: [],
    resolved: {
      action: 'short_circuit',
      verdict: 'crisis',
      source: 'crisis_fast_path',
      latencyMs: 0,
    },
  };
}

function piiOutcome(redactions: TraceRedaction[]): PipelineOutcome {
  return {
    kind: 'short_circuit',
    verdict: 'pii',
    piiKind: 'ssn',
    responseText: 'templated pii response',
    sanitizedUserText: 'my ssn is [redacted: ssn]',
    sanitizedMessages: [userMessage('my ssn is [redacted: ssn]')],
    rawUserText: 'raw',
    latestTurnRedactions: redactions,
    resolved: {
      action: 'short_circuit',
      verdict: 'pii',
      piiKind: 'ssn',
      source: 'deterministic_pii',
      latencyMs: 250,
      inputTokens: 90,
      outputTokens: 5,
    },
  };
}

function failClosedOutcome(): PipelineOutcome {
  return {
    kind: 'fail_closed',
    responseText: 'templated fail-closed response',
    sanitizedUserText: 'anything',
    sanitizedMessages: [userMessage('anything')],
    latestTurnRedactions: [],
    resolved: { action: 'fail_closed', latencyMs: 8000 },
  };
}

describe('traceForOutcome', () => {
  it('builds a schema-valid proceed trace with classifier-only cost', () => {
    const trace = tracePartDataSchema.parse(traceForOutcome(proceedOutcome()));
    expect(trace.guardrail).toEqual({
      verdict: 'proceed',
      source: 'classifier',
      latencyMs: 412,
      tokens: { inputTokens: 148, outputTokens: 6 },
    });
    expect(trace.retrieval).toBeNull();
    expect(trace.agent).toBeNull();
    const expectedUsd =
      (148 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.classifier.input +
      (6 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.classifier.output;
    expect(trace.estimatedCostUsd).toBeCloseTo(expectedUsd, 12);
  });

  it('reports a fast-path short-circuit honestly: no tokens, zero cost', () => {
    const trace = tracePartDataSchema.parse(traceForOutcome(crisisOutcome()));
    expect(trace.guardrail.verdict).toBe('crisis');
    expect(trace.guardrail.source).toBe('crisis_fast_path');
    expect(trace.guardrail.tokens).toEqual({
      inputTokens: null,
      outputTokens: null,
    });
    expect(trace.estimatedCostUsd).toBe(0);
    expect(trace.retrieval).toBeNull();
    expect(trace.agent).toBeNull();
  });

  it('carries the sanitize summary through as kinds + counts only', () => {
    const trace = tracePartDataSchema.parse(
      traceForOutcome(piiOutcome([{ kind: 'ssn', count: 2 }])),
    );
    expect(trace.sanitize.redactions).toEqual([{ kind: 'ssn', count: 2 }]);
    expect(JSON.stringify(trace)).not.toContain('raw');
  });

  it('maps the fail-closed path to its own displayed verdict', () => {
    const trace = tracePartDataSchema.parse(
      traceForOutcome(failClosedOutcome()),
    );
    expect(trace.guardrail.verdict).toBe('fail_closed');
    expect(trace.guardrail.source).toBeNull();
    expect(trace.guardrail.latencyMs).toBe(8000);
    expect(trace.estimatedCostUsd).toBe(0);
  });
});

describe('estimateCostUsd', () => {
  it('sums classifier, agent, and embedding costs from the pinned prices', () => {
    const usd = estimateCostUsd({
      classifier: { inputTokens: 100, outputTokens: 10 },
      agent: { inputTokens: 2_000, outputTokens: 400 },
      embeddingTokens: 30,
    });
    const expected =
      (100 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.classifier.input +
      (10 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.classifier.output +
      (2_000 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.agent.input +
      (400 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.agent.output +
      (30 / 1_000_000) * PRICING_USD_PER_1M_TOKENS.embedding.input;
    expect(usd).toBeCloseTo(expected, 12);
  });

  it('treats unknown token counts as zero, never a guess', () => {
    expect(
      estimateCostUsd({
        classifier: { inputTokens: null, outputTokens: null },
        agent: { inputTokens: null, outputTokens: null },
        embeddingTokens: null,
      }),
    ).toBe(0);
  });
});

describe('redaction counting (sanitize summary)', () => {
  it('counts multiple values of the same kind', () => {
    const result = redactText(
      'My SSN is 123-45-6789 and my spouse is 234-56-7890.',
    );
    expect(result.counts).toEqual([{ kind: 'ssn', count: 2 }]);
    expect(result.text).not.toContain('123-45-6789');
    expect(result.text).not.toContain('234-56-7890');
  });

  it('reports each detected kind once with its count', () => {
    const result = redactText('DOB 01/02/1990, SSN 123-45-6789.');
    expect(result.counts).toEqual(
      expect.arrayContaining([
        { kind: 'ssn', count: 1 },
        { kind: 'full_dob', count: 1 },
      ]),
    );
    expect(result.counts).toHaveLength(2);
  });

  it('returns no counts for clean text', () => {
    const result = redactText('I make $2,000 a month and there are 3 of us.');
    expect(result.counts).toEqual([]);
  });

  it('sums counts across the parts of one message', () => {
    const summary = redactionSummary({
      id: 'u1',
      role: 'user',
      parts: [
        { type: 'text', text: 'SSN 123-45-6789' },
        { type: 'text', text: 'and again 234-56-7890' },
      ],
    });
    expect(summary).toEqual([{ kind: 'ssn', count: 2 }]);
  });
});
