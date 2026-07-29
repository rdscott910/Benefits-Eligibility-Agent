import { tool } from 'ai';
import {
  checkIncomeThresholdInputSchema,
  checkIncomeThresholdOutputSchema,
  verdictPartDataSchema,
  type CheckIncomeThresholdInput,
  type CheckIncomeThresholdOutput,
  type VerdictPartData,
  type VerdictTier,
} from '@civicreach/shared';
import type { IncomeLimitsTable } from '../corpus/income-table';
import { logTool } from '../log';
import { resolveIncomeLimits } from './lookup-income-limits';
import type { CaseFileHolder } from './update-case-file';

/**
 * The income-threshold check (decisions/deterministic-math.md, 2026-07-29
 * revision): compares the CaseFile's gross monthly income against the
 * corpus-parsed limits for the CaseFile's household size and selects the
 * likelihood tier. It takes NO inputs from the model — values come only from
 * the working CaseFile, and anything missing or pending confirmation gets a
 * typed refusal. "Never called with guessed inputs" is structural here, not
 * a prompt instruction. I/O schemas live in `shared/src/tools.ts` since
 * Slice 4 (the client renders tool I/O in the trace drawer).
 */

/** The settled tier mapping — boundaries inclusive, gross columns only. */
export function selectTier(
  grossMonthlyIncome: number,
  limits: { gross130: number; gross200: number },
): VerdictTier {
  if (grossMonthlyIncome <= limits.gross130) {
    return 'likely_qualify';
  }
  if (grossMonthlyIncome <= limits.gross200) {
    return 'may_qualify';
  }
  return 'likely_not_qualify';
}

/** Pure check over a CaseFile — exported for unit tests and eval cases. */
export function runIncomeThresholdCheck(options: {
  table: IncomeLimitsTable;
  caseFile: CaseFileHolder['current'];
}): CheckIncomeThresholdOutput {
  const { table, caseFile } = options;
  const missingFacts: Array<'householdSize' | 'grossMonthlyIncome'> = [];
  const pendingFacts: Array<'householdSize' | 'grossMonthlyIncome'> = [];

  for (const fact of ['householdSize', 'grossMonthlyIncome'] as const) {
    const entry = caseFile[fact];
    if (!entry) {
      missingFacts.push(fact);
    } else if (entry.status === 'needs_confirmation') {
      pendingFacts.push(fact);
    }
  }

  if (missingFacts.length > 0 || pendingFacts.length > 0) {
    const asks: string[] = [];
    if (missingFacts.length > 0) {
      asks.push(
        `ask the user for: ${missingFacts.join(' and ')} (never guess or assume a value)`,
      );
    }
    if (pendingFacts.length > 0) {
      asks.push(
        `${pendingFacts.join(' and ')} still need${pendingFacts.length === 1 ? 's' : ''} the user's confirmation — ask exactly one clarifying question, then record the answer with updateCaseFile expression "confirmation"`,
      );
    }
    return checkIncomeThresholdOutputSchema.parse({
      ok: false,
      missingFacts,
      pendingFacts,
      instruction: `No check was run. Before checking: ${asks.join('; ')}.`,
    });
  }

  // Both facts exist with status stated or confirmed (the only other status
  // was filtered into pendingFacts above).
  const householdSize = caseFile.householdSize;
  const income = caseFile.grossMonthlyIncome;
  if (!householdSize || !income) {
    throw new Error('runIncomeThresholdCheck: facts vanished after validation.');
  }

  const limits = resolveIncomeLimits(table, householdSize.value);
  const tier = selectTier(income.value, limits);

  return checkIncomeThresholdOutputSchema.parse({
    ok: true,
    tier,
    grossMonthlyIncome: income.value,
    limits,
    comparison:
      `Gross monthly income $${income.value.toLocaleString('en-US')} for a household of ` +
      `${limits.householdSize}, against the published limits: $${limits.gross130.toLocaleString('en-US')} ` +
      `(130% gross) and $${limits.gross200.toLocaleString('en-US')} (200% gross).`,
  });
}

/**
 * The AI SDK tool. On success it also hands the verdict payload to the
 * server (`onVerdict`) so the `data-verdict` stream part is derived from
 * tool output alone — never from model text.
 */
export function createCheckIncomeThresholdTool(options: {
  table: IncomeLimitsTable;
  holder: CaseFileHolder;
  onVerdict: (verdict: VerdictPartData) => void;
}) {
  return tool({
    description:
      "Check how the user's gross monthly income compares with the published " +
      'NC FNS income limits for their household size and select the likelihood ' +
      'tier. Takes no inputs: it reads income and household size from the case ' +
      'file (store them first with updateCaseFile). Call it once both facts ' +
      'are on file — and again after any correction.',
    inputSchema: checkIncomeThresholdInputSchema,
    execute: (_input: CheckIncomeThresholdInput): CheckIncomeThresholdOutput => {
      const started = Date.now();
      const output = runIncomeThresholdCheck({
        table: options.table,
        caseFile: options.holder.current,
      });

      if (output.ok) {
        options.onVerdict(
          verdictPartDataSchema.parse({
            tier: output.tier,
            grossMonthlyIncome: output.grossMonthlyIncome,
            limits: {
              householdSize: output.limits.householdSize,
              gross200: output.limits.gross200,
              gross130: output.limits.gross130,
              net100: output.limits.net100,
            },
          }),
        );
      }

      logTool({
        tool: 'checkIncomeThreshold',
        latencyMs: Date.now() - started,
        outcome: output.ok ? `ok:${output.tier}` : 'refused',
      });
      return output;
    },
  });
}
