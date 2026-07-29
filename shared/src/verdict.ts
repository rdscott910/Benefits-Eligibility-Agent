import { z } from 'zod';

/**
 * Verdict contracts for Slice 3 (decisions/verdict-language.md, incl. R6;
 * tier mapping per the 2026-07-29 revision of decisions/deterministic-math.md).
 *
 * Exactly three likelihood tiers exist. The tier is selected by the
 * deterministic income-threshold tool, never by model judgment, and every
 * mandatory string below is rendered by the UI from these constants as part
 * of the structured `data-verdict` stream part — the model narrates around
 * the verdict and never authors tier text, suffix, or referral.
 */

export const verdictTierSchema = z.enum([
  'likely_qualify',
  'may_qualify',
  'likely_not_qualify',
]);
export type VerdictTier = z.infer<typeof verdictTierSchema>;

/** The three exact tier phrases (verdict-language.md — likelihood, never determination). */
export const VERDICT_TIER_PHRASES: Record<VerdictTier, string> = {
  likely_qualify: 'you likely qualify',
  may_qualify: 'you may qualify',
  likely_not_qualify: 'you likely do not qualify',
};

/** Mandatory suffix carried by every verdict (verdict-language.md). */
export const VERDICT_SUFFIX =
  'based on the current published limits — only NC DSS can determine eligibility';

/** The published limits row the tool compared against (corpus-parsed, never hardcoded). */
export const verdictLimitsSchema = z.object({
  householdSize: z.number().int().min(1),
  /** 200% maximum allowable gross monthly income limit, whole dollars. */
  gross200: z.number().int().positive(),
  /** 130% maximum allowable gross monthly income limit, whole dollars. */
  gross130: z.number().int().positive(),
  /** 100% maximum allowable net monthly income limit, whole dollars. */
  net100: z.number().int().positive(),
});
export type VerdictLimits = z.infer<typeof verdictLimitsSchema>;

/**
 * Payload on the `data-verdict` stream part (envelope v3), emitted only when
 * the income-threshold tool ran this turn — derived from the tool's output,
 * never from model text. The UI renders VERDICT_TIER_PHRASES[tier],
 * VERDICT_SUFFIX, and the official referral (REFERRAL_LINE) from constants.
 */
export const verdictPartDataSchema = z.object({
  tier: verdictTierSchema,
  /** The gross monthly income the tool compared, from the CaseFile. */
  grossMonthlyIncome: z.number().min(0),
  limits: verdictLimitsSchema,
});
export type VerdictPartData = z.infer<typeof verdictPartDataSchema>;
