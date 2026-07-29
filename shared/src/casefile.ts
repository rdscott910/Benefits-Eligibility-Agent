import { z } from 'zod';

/**
 * CaseFile contracts for Slice 3 (decisions/state-memory.md, revision R5).
 *
 * The CaseFile is session-only conversation state: it lives in browser
 * memory, travels with every chat request, and is Zod-validated on arrival
 * (unknown fields dropped by object stripping). Exactly the three fact kinds
 * the decision names exist — adding a kind is a decision-doc fork, not a
 * code change. Facts are mutated only by the server-side `updateCaseFile`
 * tool; the client just stores what the `data-casefile` stream part returns.
 */

export const caseFileFactStatusSchema = z.enum([
  'stated',
  'needs_confirmation',
  'confirmed',
]);
export type CaseFileFactStatus = z.infer<typeof caseFileFactStatusSchema>;

const factShape = {
  status: caseFileFactStatusSchema,
  /** 1-based index of the user turn that set the current value. */
  sourceTurn: z.number().int().min(1),
} as const;

export const grossMonthlyIncomeFactSchema = z.object({
  /** Whole gross dollars per month before taxes; zero income is valid. */
  value: z.number().min(0),
  ...factShape,
});
export type GrossMonthlyIncomeFact = z.infer<typeof grossMonthlyIncomeFactSchema>;

export const householdSizeFactSchema = z.object({
  /** People in the FNS unit. */
  value: z.number().int().min(1),
  ...factShape,
});
export type HouseholdSizeFact = z.infer<typeof householdSizeFactSchema>;

export const countyFactSchema = z.object({
  /** North Carolina county of residence, as the user stated it. */
  value: z.string().min(1),
  ...factShape,
});
export type CountyFact = z.infer<typeof countyFactSchema>;

/** The closed set of fact kinds (state-memory.md names exactly these). */
export const caseFileFactKeySchema = z.enum([
  'grossMonthlyIncome',
  'householdSize',
  'county',
]);
export type CaseFileFactKey = z.infer<typeof caseFileFactKeySchema>;

export const caseFileSchema = z.object({
  grossMonthlyIncome: grossMonthlyIncomeFactSchema.optional(),
  householdSize: householdSizeFactSchema.optional(),
  county: countyFactSchema.optional(),
});
export type CaseFile = z.infer<typeof caseFileSchema>;

export const EMPTY_CASE_FILE: CaseFile = {};

/**
 * Payload on the `data-casefile` stream part (envelope v3), emitted once per
 * proceed-path turn after the reply finishes. It carries the full post-turn
 * CaseFile; the client replaces its session copy wholesale, so the two sides
 * cannot drift.
 */
export const caseFilePartDataSchema = z.object({
  caseFile: caseFileSchema,
});
export type CaseFilePartData = z.infer<typeof caseFilePartDataSchema>;
