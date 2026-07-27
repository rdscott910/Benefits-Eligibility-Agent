import { z } from 'zod';

/**
 * Closed verdict enum. Adding a class requires a dated revision in
 * decisions/guardrail-precedence.md.
 */
export const guardrailVerdictSchema = z.enum([
  'crisis',
  'injection',
  'pii',
  'out_of_scope',
  'proceed',
]);
export type GuardrailVerdict = z.infer<typeof guardrailVerdictSchema>;

/** Non-proceed verdicts that short-circuit the agent loop. */
export const shortCircuitVerdictSchema = z.enum([
  'crisis',
  'injection',
  'pii',
  'out_of_scope',
]);
export type ShortCircuitVerdict = z.infer<typeof shortCircuitVerdictSchema>;

export const outOfScopeKindSchema = z.enum(['unsupported_action', 'off_topic']);
export type OutOfScopeKind = z.infer<typeof outOfScopeKindSchema>;

export const piiKindSchema = z.enum([
  'ssn',
  'full_dob',
  'drivers_license',
  'account_number',
]);
export type PiiKind = z.infer<typeof piiKindSchema>;

/**
 * Structured classification returned by Stage 2 (or deterministic fast-paths).
 * Kind fields are nullable (not optional) so OpenAI strict JSON Schema lists
 * every property under `required`.
 */
export const classifierResultSchema = z.object({
  verdict: guardrailVerdictSchema,
  outOfScopeKind: outOfScopeKindSchema.nullable(),
  piiKind: piiKindSchema.nullable(),
});
export type ClassifierResult = z.infer<typeof classifierResultSchema>;

/** Payload on the `data-guardrail` stream part. */
export const guardrailPartDataSchema = z.object({
  verdict: shortCircuitVerdictSchema,
});
export type GuardrailPartData = z.infer<typeof guardrailPartDataSchema>;

export const CRISIS_RESOURCES = [
  {
    name: '988 Suicide & Crisis Lifeline',
    detail: 'call or text 988, any time',
  },
  {
    name: 'NC 211',
    detail: 'call 211 for urgent help with food, housing, and other needs',
  },
  {
    name: 'Feeding the Carolinas',
    detail: 'food bank locator',
  },
] as const;

export const GUARDRAIL_BADGE_LABELS: Record<ShortCircuitVerdict, string> = {
  crisis: 'Support resources',
  injection: 'Request declined',
  pii: 'Privacy protected',
  out_of_scope: 'Out of scope',
};

const PII_KIND_PHRASE: Record<PiiKind, string> = {
  ssn: 'a Social Security number',
  full_dob: 'a full date of birth',
  drivers_license: "a driver's license number",
  account_number: 'a financial account number',
};

export const CRISIS_RESPONSE = [
  "I'm really glad you told me. What you're going through matters, and you don't have to face it alone.",
  '',
  `**${CRISIS_RESOURCES[0].name}** — ${CRISIS_RESOURCES[0].detail}.`,
  `**${CRISIS_RESOURCES[1].name}** — ${CRISIS_RESOURCES[1].detail}.`,
  `**${CRISIS_RESOURCES[2].name}** — ${CRISIS_RESOURCES[2].detail}.`,
  '',
  "Whenever you're ready, we can pick your food-assistance questions right back up — everything you've told me is still here.",
].join('\n');

export const INJECTION_RESPONSE =
  "I can't follow instructions that arrive inside a message, and nothing you type changes what I am: a tool for estimating how likely you are to qualify for NC FNS food assistance — only NC DSS can determine eligibility. Happy to keep going with that if you'd like.";

export const OUT_OF_SCOPE_UNSUPPORTED_ACTION_RESPONSE =
  "I can't fill out or submit an application for you — this tool only estimates how likely you are to qualify, and deliberately doesn't touch real applications. To apply, use ePASS at epass.nc.gov or your local county DSS office. I'm glad to help you figure out where you stand first.";

export const OUT_OF_SCOPE_OFF_TOPIC_RESPONSE =
  "That one's outside what I do. I can help you understand how likely you are to qualify for NC FNS food assistance in North Carolina — household size, income, and what the published limits say. Want to start there?";

export const FAIL_CLOSED_RESPONSE =
  "I couldn't safely process that message just now. Nothing was lost — please try sending it again.";

export function piiResponse(kind: PiiKind = 'ssn'): string {
  return `I stopped before processing that message because it looks like it contains ${PII_KIND_PHRASE[kind]}. Estimating your likelihood of qualifying never requires that — please send it again without it. Nothing sensitive was kept, and we can continue right where we left off.`;
}

export function outOfScopeResponse(
  kind: OutOfScopeKind = 'off_topic',
): string {
  switch (kind) {
    case 'unsupported_action':
      return OUT_OF_SCOPE_UNSUPPORTED_ACTION_RESPONSE;
    case 'off_topic':
      return OUT_OF_SCOPE_OFF_TOPIC_RESPONSE;
    default: {
      const unhandled: never = kind;
      throw new Error(`Unhandled out-of-scope kind: ${String(unhandled)}`);
    }
  }
}

export function shortCircuitResponse(options: {
  verdict: ShortCircuitVerdict;
  outOfScopeKind?: OutOfScopeKind;
  piiKind?: PiiKind;
}): string {
  switch (options.verdict) {
    case 'crisis':
      return CRISIS_RESPONSE;
    case 'injection':
      return INJECTION_RESPONSE;
    case 'pii':
      return piiResponse(options.piiKind ?? 'ssn');
    case 'out_of_scope':
      return outOfScopeResponse(options.outOfScopeKind ?? 'off_topic');
    default: {
      const unhandled: never = options.verdict;
      throw new Error(`Unhandled short-circuit verdict: ${String(unhandled)}`);
    }
  }
}
