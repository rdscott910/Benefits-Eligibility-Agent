import { tool } from 'ai';
import {
  lookupIncomeLimitsInputSchema,
  resolvedLimitsSchema,
  type LookupIncomeLimitsInput,
  type ResolvedLimits,
} from '@civicreach/shared';
import type { IncomeLimitsTable } from '../corpus/income-table';
import { logTool } from '../log';

/**
 * Deterministic lookup of the published NC FNS income limits for a household
 * (FNS unit) size, from the boot-parsed corpus table
 * (decisions/deterministic-math.md, 2026-07-29 revision). No hardcoded
 * numbers: every figure comes from `server/corpus/income-limits.md` via the
 * Zod-validated table, and unit sizes above 8 extend the table with the
 * corpus's own "each additional member" increments — arithmetic that lives
 * here, never in the model. I/O schemas live in `shared/src/tools.ts` since
 * Slice 4 (the client renders tool I/O in the trace drawer).
 */

/** Resolve the limits row for a unit size (rows 1–8, extended beyond 8). */
export function resolveIncomeLimits(
  table: IncomeLimitsTable,
  householdSize: number,
): ResolvedLimits {
  if (!Number.isInteger(householdSize) || householdSize < 1) {
    throw new Error(
      `resolveIncomeLimits: householdSize must be a positive integer, got ${householdSize}.`,
    );
  }

  const baseRow = table.rows[Math.min(householdSize, 8) - 1];
  if (!baseRow) {
    throw new Error(
      `resolveIncomeLimits: no table row for unit size ${householdSize}.`,
    );
  }
  const additionalMembers = Math.max(0, householdSize - 8);

  return resolvedLimitsSchema.parse({
    householdSize,
    gross200: baseRow.gross200 + additionalMembers * table.eachAdditional.gross200,
    gross130: baseRow.gross130 + additionalMembers * table.eachAdditional.gross130,
    net100: baseRow.net100 + additionalMembers * table.eachAdditional.net100,
    extendedBeyondTable: additionalMembers > 0,
  });
}

/**
 * The AI SDK tool. Accepts an explicit household size so published-figure
 * questions ("what's the limit for a family of 5?") can be answered without
 * a stored CaseFile fact; it returns published limits only, never a tier —
 * tier selection is `checkIncomeThreshold`'s job and is CaseFile-gated.
 */
export function createLookupIncomeLimitsTool(options: { table: IncomeLimitsTable }) {
  return tool({
    description:
      'Look up the published NC FNS maximum monthly income limits (200% gross, ' +
      '130% gross, 100% net) for a given household size, from the official ' +
      'parsed table. Use this whenever you need to quote a published limit. ' +
      'It returns published figures only — it does not say whether anyone qualifies.',
    inputSchema: lookupIncomeLimitsInputSchema,
    execute: ({ householdSize }: LookupIncomeLimitsInput): ResolvedLimits => {
      const started = Date.now();
      const limits = resolveIncomeLimits(options.table, householdSize);
      logTool({
        tool: 'lookupIncomeLimits',
        latencyMs: Date.now() - started,
        outcome: 'ok',
      });
      return limits;
    },
  });
}
