import { NO_MATCH_SENTENCE } from '@civicreach/shared';

/**
 * Deterministic detector for the mandatory no-match sentence (slice-2
 * packet, settled 2026-07-28): the system prompt requires the model to emit
 * NO_MATCH_SENTENCE verbatim whenever the excerpts cannot answer, the server
 * detects it here after the stream finishes, and the typed `no_match` part
 * makes the UI render the official referral. Matching is tolerant of case,
 * curly apostrophes, whitespace, and the "do not" expansion so ordinary
 * model formatting cannot dodge the referral.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/\s+/g, ' ');
}

const CANONICAL = normalize(NO_MATCH_SENTENCE).replace(/\.$/, '');
const EXPANDED = CANONICAL.replace("don't", 'do not');

export function containsNoMatchSentence(text: string): boolean {
  const normalized = normalize(text);
  return normalized.includes(CANONICAL) || normalized.includes(EXPANDED);
}
