import { z } from 'zod';
import { caseFileFactKeySchema, caseFileFactStatusSchema } from './casefile';
import { verdictLimitsSchema, verdictTierSchema } from './verdict';

/**
 * Deterministic-tool I/O contracts (decisions/deterministic-math.md).
 *
 * Slice 4 renders real tool inputs/outputs in the client — as streaming tool
 * status and inside the glass-box trace drawer (trace-transparency.md) — so
 * tool I/O is a cross-boundary contract and its Zod schemas live here,
 * defined once and imported by both sides (stack-boundaries.md R1; dated
 * location note 2026-07-29 in deterministic-math.md). The executors and the
 * AI SDK `tool()` wiring stay in `server/src/tools/`, one file per tool.
 */

// ---------------------------------------------------------------------------
// updateCaseFile — the only mutation path for the working CaseFile.
// ---------------------------------------------------------------------------

export const updateCaseFileInputSchema = z.object({
  fact: caseFileFactKeySchema,
  /** For grossMonthlyIncome (dollars/month, ≥ 0) and householdSize (people); null for county. */
  numberValue: z.number().nullable(),
  /** For county; null for the numeric facts. */
  stringValue: z.string().nullable(),
  /**
   * How the user expressed it. "stated": a plain statement — use this even
   * when the new value conflicts with what is on file (the tool detects the
   * conflict and tells you what to ask; never silently pick a side).
   * "uncertain": vague or hedged ("about", "I think", "it varies").
   * "correction": ONLY when the user explicitly says the earlier value was
   * wrong ("actually, I was wrong — it's $2,400"). "confirmation": the
   * direct answer to your clarifying question about which value is right.
   */
  expression: z.enum(['stated', 'uncertain', 'correction', 'confirmation']),
});
export type UpdateCaseFileInput = z.infer<typeof updateCaseFileInputSchema>;

export const updateCaseFileOutputSchema = z.object({
  outcome: z.enum([
    'stored',
    'replaced',
    'confirmed',
    'needs_confirmation',
    'contradiction',
    'invalid',
  ]),
  fact: caseFileFactKeySchema,
  value: z.union([z.number(), z.string()]).nullable(),
  previousValue: z.union([z.number(), z.string()]).nullable(),
  status: caseFileFactStatusSchema.nullable(),
  /** What the model must do next; deterministic, from the transition table. */
  instruction: z.string(),
});
export type UpdateCaseFileOutput = z.infer<typeof updateCaseFileOutputSchema>;

// ---------------------------------------------------------------------------
// lookupIncomeLimits — published limits by household (FNS unit) size.
// ---------------------------------------------------------------------------

export const lookupIncomeLimitsInputSchema = z.object({
  /** Number of people in the FNS household (unit size). */
  householdSize: z.number().int().min(1),
});
export type LookupIncomeLimitsInput = z.infer<typeof lookupIncomeLimitsInputSchema>;

export const resolvedLimitsSchema = verdictLimitsSchema.extend({
  /**
   * True when the unit size is above the table's 8 explicit rows and the
   * limits were extended with the "each additional member" increments —
   * such figures are corpus-derived but not verbatim table cells.
   */
  extendedBeyondTable: z.boolean(),
});
export type ResolvedLimits = z.infer<typeof resolvedLimitsSchema>;

// ---------------------------------------------------------------------------
// checkIncomeThreshold — CaseFile-gated tier selection (no model inputs).
// ---------------------------------------------------------------------------

export const checkIncomeThresholdInputSchema = z.object({});
export type CheckIncomeThresholdInput = z.infer<typeof checkIncomeThresholdInputSchema>;

const requiredFactSchema = z.enum(['householdSize', 'grossMonthlyIncome']);

export const checkIncomeThresholdOutputSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    /** Selected by the tool's comparison, never by model judgment. */
    tier: verdictTierSchema,
    grossMonthlyIncome: z.number().min(0),
    limits: resolvedLimitsSchema,
    /** Plain-language comparison for the model to narrate verbatim figures from. */
    comparison: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    /** Facts absent from the CaseFile. */
    missingFacts: z.array(requiredFactSchema),
    /** Facts on file but awaiting the user's confirmation. */
    pendingFacts: z.array(requiredFactSchema),
    instruction: z.string(),
  }),
]);
export type CheckIncomeThresholdOutput = z.infer<typeof checkIncomeThresholdOutputSchema>;

// ---------------------------------------------------------------------------
// Typed tool parts for the UI message stream.
// ---------------------------------------------------------------------------

/**
 * The AI SDK `TOOLS` generic for `CivicReachUIMessage`: tool invocations
 * stream as typed `tool-<name>` parts, which the client renders as status
 * labels and drawer I/O — only ever for real invocations (verdict-language
 * R6: labels are UI chrome tied to typed parts, never model text).
 */
export type CivicReachUITools = {
  updateCaseFile: { input: UpdateCaseFileInput; output: UpdateCaseFileOutput };
  lookupIncomeLimits: { input: LookupIncomeLimitsInput; output: ResolvedLimits };
  checkIncomeThreshold: {
    input: CheckIncomeThresholdInput;
    output: CheckIncomeThresholdOutput;
  };
};
