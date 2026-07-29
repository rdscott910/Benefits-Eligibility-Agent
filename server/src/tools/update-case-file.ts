import { tool } from 'ai';
import {
  caseFileSchema,
  updateCaseFileInputSchema,
  updateCaseFileOutputSchema,
  type CaseFile,
  type CaseFileFactKey,
  type UpdateCaseFileInput,
  type UpdateCaseFileOutput,
} from '@civicreach/shared';
import { logTool } from '../log';

/**
 * The `updateCaseFile` tool (decisions/state-memory.md, revision R5): the
 * ONLY code path that mutates the working CaseFile. The model reports what
 * the user expressed; the status transitions below are deterministic:
 *
 * - `uncertain`      → needs_confirmation + ask exactly one clarifying question
 * - `stated`, new fact → stated
 * - `stated`, same value as a pending fact → confirmed (restating confirms)
 * - `stated`, different value than a fact on file → needs_confirmation
 *   (contradiction) + ask exactly one clarifying question
 * - `correction`     → replaces the old value, stated, acknowledged
 * - `confirmation`   → confirmed
 *
 * Math tools accept only stated/confirmed values, so nothing downstream can
 * run on a guess or an unresolved contradiction. The I/O schemas live in
 * `shared/src/tools.ts` since Slice 4 (the client renders tool I/O in the
 * trace drawer); the executor and transition table stay here.
 */

export type CaseFileHolder = { current: CaseFile };

type FactValue = number | string;

function extractValue(
  input: UpdateCaseFileInput,
): { ok: true; value: FactValue } | { ok: false; problem: string } {
  switch (input.fact) {
    case 'grossMonthlyIncome': {
      if (input.numberValue === null || !Number.isFinite(input.numberValue)) {
        return { ok: false, problem: 'grossMonthlyIncome needs numberValue (dollars per month).' };
      }
      if (input.numberValue < 0) {
        return { ok: false, problem: 'grossMonthlyIncome cannot be negative.' };
      }
      return { ok: true, value: input.numberValue };
    }
    case 'householdSize': {
      if (input.numberValue === null || !Number.isInteger(input.numberValue)) {
        return { ok: false, problem: 'householdSize needs an integer numberValue (people in the household).' };
      }
      if (input.numberValue < 1) {
        return { ok: false, problem: 'householdSize must be at least 1.' };
      }
      return { ok: true, value: input.numberValue };
    }
    case 'county': {
      const trimmed = input.stringValue?.trim() ?? '';
      if (!trimmed) {
        return { ok: false, problem: 'county needs a non-empty stringValue.' };
      }
      return { ok: true, value: trimmed };
    }
    default: {
      const unhandled: never = input.fact;
      throw new Error(`Unhandled CaseFile fact: ${String(unhandled)}`);
    }
  }
}

function valuesEqual(a: FactValue, b: FactValue): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}

function withFact(
  caseFile: CaseFile,
  fact: CaseFileFactKey,
  entry: { value: FactValue; status: 'stated' | 'needs_confirmation' | 'confirmed'; sourceTurn: number },
): CaseFile {
  // Parse keeps the stored state honest: a mismatched value type for the
  // fact key fails loudly here instead of corrupting the CaseFile.
  return caseFileSchema.parse({ ...caseFile, [fact]: entry });
}

const ASK_ONE_CLARIFYING_QUESTION =
  'Ask the user exactly one clarifying question to settle this value, then ' +
  'record their answer with expression "confirmation". Do not call ' +
  'checkIncomeThreshold until it is settled.';

/** Pure transition function — exported for unit tests. */
export function applyCaseFileUpdate(options: {
  caseFile: CaseFile;
  input: UpdateCaseFileInput;
  sourceTurn: number;
}): { caseFile: CaseFile; output: UpdateCaseFileOutput } {
  const { caseFile, input, sourceTurn } = options;
  const extracted = extractValue(input);

  if (!extracted.ok) {
    return {
      caseFile,
      output: updateCaseFileOutputSchema.parse({
        outcome: 'invalid',
        fact: input.fact,
        value: null,
        previousValue: null,
        status: null,
        instruction: `Nothing was stored: ${extracted.problem} Call the tool again with a valid value.`,
      }),
    };
  }

  const value = extracted.value;
  const existing = caseFile[input.fact];

  const finish = (
    next: CaseFile,
    outcome: UpdateCaseFileOutput['outcome'],
    instruction: string,
  ): { caseFile: CaseFile; output: UpdateCaseFileOutput } => ({
    caseFile: next,
    output: updateCaseFileOutputSchema.parse({
      outcome,
      fact: input.fact,
      value,
      previousValue: existing?.value ?? null,
      status: next[input.fact]?.status ?? null,
      instruction,
    }),
  });

  switch (input.expression) {
    case 'uncertain':
      return finish(
        withFact(caseFile, input.fact, { value, status: 'needs_confirmation', sourceTurn }),
        'needs_confirmation',
        `Noted as uncertain. ${ASK_ONE_CLARIFYING_QUESTION}`,
      );
    case 'correction':
      return finish(
        withFact(caseFile, input.fact, { value, status: 'stated', sourceTurn }),
        existing ? 'replaced' : 'stored',
        existing
          ? 'Correction applied — the old value is gone. Acknowledge it briefly.'
          : 'Stored. Acknowledge it briefly.',
      );
    case 'confirmation':
      return finish(
        withFact(caseFile, input.fact, { value, status: 'confirmed', sourceTurn }),
        'confirmed',
        'Confirmed. You may now use this value.',
      );
    case 'stated': {
      if (!existing) {
        return finish(
          withFact(caseFile, input.fact, { value, status: 'stated', sourceTurn }),
          'stored',
          'Stored. Acknowledge it briefly and never ask for it again.',
        );
      }
      if (valuesEqual(existing.value, value)) {
        if (existing.status === 'needs_confirmation') {
          return finish(
            withFact(caseFile, input.fact, { value, status: 'confirmed', sourceTurn }),
            'confirmed',
            'The user restated the pending value, which confirms it. You may now use it.',
          );
        }
        return finish(caseFile, 'stored', 'Already on file with the same value.');
      }
      return finish(
        withFact(caseFile, input.fact, { value, status: 'needs_confirmation', sourceTurn }),
        'contradiction',
        `This contradicts the earlier value (${String(existing.value)}). ` +
          ASK_ONE_CLARIFYING_QUESTION,
      );
    }
    default: {
      const unhandled: never = input.expression;
      throw new Error(`Unhandled updateCaseFile expression: ${String(unhandled)}`);
    }
  }
}

/** The AI SDK tool, closing over the request's working CaseFile holder. */
export function createUpdateCaseFileTool(options: {
  holder: CaseFileHolder;
  sourceTurn: number;
}) {
  return tool({
    description:
      'Record a fact the user shared about their situation (gross monthly ' +
      'income, household size, or county). Call it whenever the user states, ' +
      'corrects, hedges, or confirms one of these facts — it is the only way ' +
      'facts are remembered. The result tells you what to do next.',
    inputSchema: updateCaseFileInputSchema,
    execute: (input: UpdateCaseFileInput): UpdateCaseFileOutput => {
      const started = Date.now();
      const applied = applyCaseFileUpdate({
        caseFile: options.holder.current,
        input,
        sourceTurn: options.sourceTurn,
      });
      options.holder.current = applied.caseFile;
      logTool({
        tool: 'updateCaseFile',
        latencyMs: Date.now() - started,
        outcome: applied.output.outcome,
      });
      return applied.output;
    },
  });
}
