/**
 * Unit tests for the Slice 3 deterministic layer: income-limits resolution
 * (incl. the >8 each-additional arithmetic), the settled tier mapping
 * (deterministic-math.md, 2026-07-29 revision — boundaries inclusive),
 * CaseFile transitions (state-memory.md R5 — corrections replace,
 * contradictions flip to needs_confirmation), the CaseFile-gated threshold
 * check, and the envelope v3 request boundary (unknown fields dropped).
 * All figures come from the real corpus table via the boot parser — no
 * hardcoded fixture numbers that could drift from `server/corpus/`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ENVELOPE_VERSION,
  chatRequestSchema,
  type CaseFile,
  type UpdateCaseFileInput,
} from '@civicreach/shared';
import { parseIncomeLimitsTable, type IncomeLimitsTable } from '../corpus/income-table';
import { loadCorpusDocuments } from '../corpus/loader';
import { runIncomeThresholdCheck, selectTier } from './check-income-threshold';
import { resolveIncomeLimits } from './lookup-income-limits';
import { applyCaseFileUpdate } from './update-case-file';

let table: IncomeLimitsTable;

beforeAll(() => {
  const documents = loadCorpusDocuments();
  const incomeDoc = documents.find((doc) => doc.doc_id === 'income-limits');
  if (!incomeDoc) {
    throw new Error('Corpus is missing the income-limits document.');
  }
  table = parseIncomeLimitsTable(incomeDoc);
});

describe('resolveIncomeLimits', () => {
  it('returns the verbatim table row for a household of 3 (the tie-out row)', () => {
    const limits = resolveIncomeLimits(table, 3);
    expect(limits).toEqual({
      householdSize: 3,
      gross200: 4442,
      gross130: 2888,
      net100: 2221,
      extendedBeyondTable: false,
    });
  });

  it('returns the first and last explicit rows unchanged', () => {
    expect(resolveIncomeLimits(table, 1)).toMatchObject({
      gross200: 2610,
      gross130: 1696,
      net100: 1305,
    });
    expect(resolveIncomeLimits(table, 8)).toMatchObject({
      gross200: 9026,
      gross130: 5867,
      net100: 4513,
      extendedBeyondTable: false,
    });
  });

  it('extends beyond 8 with the each-additional increments from the corpus', () => {
    const limits = resolveIncomeLimits(table, 10);
    expect(limits).toEqual({
      householdSize: 10,
      gross200: table.rows[7]!.gross200 + 2 * table.eachAdditional.gross200,
      gross130: table.rows[7]!.gross130 + 2 * table.eachAdditional.gross130,
      net100: table.rows[7]!.net100 + 2 * table.eachAdditional.net100,
      extendedBeyondTable: true,
    });
  });

  it('rejects non-positive and non-integer sizes', () => {
    expect(() => resolveIncomeLimits(table, 0)).toThrow(/positive integer/);
    expect(() => resolveIncomeLimits(table, 2.5)).toThrow(/positive integer/);
  });
});

describe('selectTier (settled mapping, boundaries inclusive)', () => {
  const limitsFor3 = { gross130: 2888, gross200: 4442 };

  it('gross at or below the 130% limit → likely_qualify', () => {
    expect(selectTier(0, limitsFor3)).toBe('likely_qualify');
    expect(selectTier(2000, limitsFor3)).toBe('likely_qualify'); // the gate check
    expect(selectTier(2888, limitsFor3)).toBe('likely_qualify'); // inclusive
  });

  it('gross between the 130% and 200% limits → may_qualify', () => {
    expect(selectTier(2889, limitsFor3)).toBe('may_qualify');
    expect(selectTier(4442, limitsFor3)).toBe('may_qualify'); // inclusive
  });

  it('gross above the 200% limit → likely_not_qualify', () => {
    expect(selectTier(4443, limitsFor3)).toBe('likely_not_qualify');
  });
});

function incomeUpdate(overrides: Partial<UpdateCaseFileInput> = {}): UpdateCaseFileInput {
  return {
    fact: 'grossMonthlyIncome',
    numberValue: 2000,
    stringValue: null,
    expression: 'stated',
    ...overrides,
  };
}

describe('applyCaseFileUpdate transitions', () => {
  it('stores a newly stated fact with provenance', () => {
    const { caseFile, output } = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate(),
      sourceTurn: 2,
    });
    expect(output.outcome).toBe('stored');
    expect(caseFile.grossMonthlyIncome).toEqual({
      value: 2000,
      status: 'stated',
      sourceTurn: 2,
    });
  });

  it('marks an uncertain value needs_confirmation and demands one clarifying question', () => {
    const { caseFile, output } = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate({ numberValue: 2500, expression: 'uncertain' }),
      sourceTurn: 1,
    });
    expect(output.outcome).toBe('needs_confirmation');
    expect(caseFile.grossMonthlyIncome?.status).toBe('needs_confirmation');
    expect(output.instruction).toContain('exactly one clarifying question');
  });

  it('flags a contradiction when a stated fact gets a different value', () => {
    const first = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate({ numberValue: 2500, expression: 'uncertain' }),
      sourceTurn: 1,
    });
    const second = applyCaseFileUpdate({
      caseFile: first.caseFile,
      input: incomeUpdate({ numberValue: 1200 }),
      sourceTurn: 3,
    });
    expect(second.output.outcome).toBe('contradiction');
    expect(second.output.previousValue).toBe(2500);
    expect(second.caseFile.grossMonthlyIncome).toEqual({
      value: 1200,
      status: 'needs_confirmation',
      sourceTurn: 3,
    });
    expect(second.output.instruction).toContain('exactly one clarifying question');
  });

  it('replaces on explicit correction and acknowledges', () => {
    const first = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate(),
      sourceTurn: 2,
    });
    const corrected = applyCaseFileUpdate({
      caseFile: first.caseFile,
      input: incomeUpdate({ numberValue: 2400, expression: 'correction' }),
      sourceTurn: 4,
    });
    expect(corrected.output.outcome).toBe('replaced');
    expect(corrected.output.previousValue).toBe(2000);
    expect(corrected.caseFile.grossMonthlyIncome).toEqual({
      value: 2400,
      status: 'stated',
      sourceTurn: 4,
    });
  });

  it('confirms a pending value via confirmation, and via restating it', () => {
    const pending = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate({ numberValue: 1200, expression: 'uncertain' }),
      sourceTurn: 1,
    });

    const confirmed = applyCaseFileUpdate({
      caseFile: pending.caseFile,
      input: incomeUpdate({ numberValue: 1200, expression: 'confirmation' }),
      sourceTurn: 2,
    });
    expect(confirmed.output.outcome).toBe('confirmed');
    expect(confirmed.caseFile.grossMonthlyIncome?.status).toBe('confirmed');

    const restated = applyCaseFileUpdate({
      caseFile: pending.caseFile,
      input: incomeUpdate({ numberValue: 1200 }),
      sourceTurn: 2,
    });
    expect(restated.output.outcome).toBe('confirmed');
    expect(restated.caseFile.grossMonthlyIncome?.status).toBe('confirmed');
  });

  it('treats restating the same settled value as already on file', () => {
    const first = applyCaseFileUpdate({
      caseFile: {},
      input: incomeUpdate(),
      sourceTurn: 1,
    });
    const again = applyCaseFileUpdate({
      caseFile: first.caseFile,
      input: incomeUpdate(),
      sourceTurn: 5,
    });
    expect(again.output.outcome).toBe('stored');
    // Provenance keeps the original turn — the value did not change.
    expect(again.caseFile.grossMonthlyIncome?.sourceTurn).toBe(1);
  });

  it('compares county values case-insensitively', () => {
    const first = applyCaseFileUpdate({
      caseFile: {},
      input: {
        fact: 'county',
        numberValue: null,
        stringValue: 'Wake',
        expression: 'stated',
      },
      sourceTurn: 1,
    });
    const second = applyCaseFileUpdate({
      caseFile: first.caseFile,
      input: {
        fact: 'county',
        numberValue: null,
        stringValue: 'wake',
        expression: 'stated',
      },
      sourceTurn: 2,
    });
    expect(second.output.outcome).toBe('stored');
    expect(second.caseFile.county?.value).toBe('Wake');
  });

  it('rejects invalid values without touching the CaseFile', () => {
    const cases: UpdateCaseFileInput[] = [
      incomeUpdate({ numberValue: -5 }),
      incomeUpdate({ numberValue: null }),
      {
        fact: 'householdSize',
        numberValue: 2.5,
        stringValue: null,
        expression: 'stated',
      },
      { fact: 'county', numberValue: 3, stringValue: null, expression: 'stated' },
    ];
    for (const input of cases) {
      const { caseFile, output } = applyCaseFileUpdate({
        caseFile: {},
        input,
        sourceTurn: 1,
      });
      expect(output.outcome).toBe('invalid');
      expect(caseFile).toEqual({});
    }
  });
});

describe('runIncomeThresholdCheck (CaseFile-gated)', () => {
  it('refuses with both facts missing on an empty CaseFile', () => {
    const output = runIncomeThresholdCheck({ table, caseFile: {} });
    expect(output.ok).toBe(false);
    if (output.ok) return;
    expect(output.missingFacts).toEqual(['householdSize', 'grossMonthlyIncome']);
    expect(output.instruction).toContain('never guess');
  });

  it('refuses while a needed fact is pending confirmation', () => {
    const caseFile: CaseFile = {
      householdSize: { value: 3, status: 'stated', sourceTurn: 1 },
      grossMonthlyIncome: { value: 2500, status: 'needs_confirmation', sourceTurn: 1 },
    };
    const output = runIncomeThresholdCheck({ table, caseFile });
    expect(output.ok).toBe(false);
    if (output.ok) return;
    expect(output.missingFacts).toEqual([]);
    expect(output.pendingFacts).toEqual(['grossMonthlyIncome']);
    expect(output.instruction).toContain('exactly one clarifying question');
  });

  it('selects likely_qualify for the gate scenario ($2,000, household of 3)', () => {
    const caseFile: CaseFile = {
      householdSize: { value: 3, status: 'stated', sourceTurn: 2 },
      grossMonthlyIncome: { value: 2000, status: 'stated', sourceTurn: 2 },
    };
    const output = runIncomeThresholdCheck({ table, caseFile });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.tier).toBe('likely_qualify');
    expect(output.limits.gross130).toBe(2888);
    expect(output.limits.gross200).toBe(4442);
    expect(output.comparison).toContain('$2,000');
    expect(output.comparison).toContain('$2,888');
  });

  it('accepts confirmed values and follows the tier mapping', () => {
    const caseFile: CaseFile = {
      householdSize: { value: 3, status: 'confirmed', sourceTurn: 3 },
      grossMonthlyIncome: { value: 5000, status: 'confirmed', sourceTurn: 4 },
    };
    const output = runIncomeThresholdCheck({ table, caseFile });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.tier).toBe('likely_not_qualify');
  });
});

describe('envelope request boundary (current version)', () => {
  const baseRequest = {
    envelopeVersion: ENVELOPE_VERSION,
    messages: [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    ],
  };

  it('accepts a request without a CaseFile (fresh session)', () => {
    expect(chatRequestSchema.safeParse(baseRequest).success).toBe(true);
  });

  it('accepts a valid CaseFile and drops unknown fields', () => {
    const parsed = chatRequestSchema.safeParse({
      ...baseRequest,
      caseFile: {
        grossMonthlyIncome: {
          value: 2000,
          status: 'stated',
          sourceTurn: 2,
          extra: 'dropped',
        },
        notAFact: { value: 1, status: 'stated', sourceTurn: 1 },
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.caseFile).toEqual({
      grossMonthlyIncome: { value: 2000, status: 'stated', sourceTurn: 2 },
    });
    expect(JSON.stringify(parsed.data.caseFile)).not.toContain('notAFact');
  });

  it('rejects a stale envelope version and malformed facts', () => {
    expect(
      chatRequestSchema.safeParse({ ...baseRequest, envelopeVersion: 2 }).success,
    ).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        ...baseRequest,
        caseFile: {
          grossMonthlyIncome: { value: -10, status: 'stated', sourceTurn: 1 },
        },
      }).success,
    ).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        ...baseRequest,
        caseFile: {
          householdSize: { value: 3, status: 'guessed', sourceTurn: 1 },
        },
      }).success,
    ).toBe(false);
  });
});
