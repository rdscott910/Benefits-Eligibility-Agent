import type { ChatMessage, PiiKind } from '@civicreach/shared';

/**
 * Stage 1 — deterministic PII redaction. Runs before the classifier, logs,
 * or agent see raw values. Income amounts and household sizes are not PII
 * under decisions/pii-handling.md and must pass through untouched.
 */

const SSN_PATTERN = /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g;

/** 12+ digit runs that look like account numbers (not dollar amounts). */
const ACCOUNT_NUMBER_PATTERN = /\b\d(?:[\s-]?\d){11,}\b/g;

/** Full DOB patterns: MM/DD/YYYY, YYYY-MM-DD, Month DD, YYYY */
const FULL_DOB_PATTERN =
  /\b(?:(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-](?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\d|3[01])|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2})\b/gi;

/** US driver's license-ish numbers when explicitly labeled. */
const DRIVERS_LICENSE_PATTERN =
  /\b(?:DL|license|driver'?s?\s*license)[:\s#]*([A-Z]?\d{6,12})\b/gi;

export type SanitizeResult = {
  messages: ChatMessage[];
  detectedKinds: PiiKind[];
  /** True when Stage 1 found definitive SSN-shaped PII (joins at the pii slot). */
  hasDefinitiveSsn: boolean;
};

function uniqueKinds(kinds: PiiKind[]): PiiKind[] {
  return [...new Set(kinds)];
}

export function redactText(text: string): {
  text: string;
  kinds: PiiKind[];
  hasDefinitiveSsn: boolean;
} {
  const kinds: PiiKind[] = [];
  let next = text;

  const ssnMatches = next.match(SSN_PATTERN);
  const hasDefinitiveSsn = Boolean(ssnMatches?.length);
  if (hasDefinitiveSsn) {
    kinds.push('ssn');
    next = next.replace(SSN_PATTERN, '[redacted: ssn]');
  }

  if (FULL_DOB_PATTERN.test(next)) {
    kinds.push('full_dob');
  }
  FULL_DOB_PATTERN.lastIndex = 0;
  next = next.replace(FULL_DOB_PATTERN, '[redacted: full_dob]');

  if (DRIVERS_LICENSE_PATTERN.test(next)) {
    kinds.push('drivers_license');
  }
  DRIVERS_LICENSE_PATTERN.lastIndex = 0;
  next = next.replace(
    DRIVERS_LICENSE_PATTERN,
    "driver's license [redacted: drivers_license]",
  );

  if (ACCOUNT_NUMBER_PATTERN.test(next)) {
    kinds.push('account_number');
  }
  ACCOUNT_NUMBER_PATTERN.lastIndex = 0;
  next = next.replace(ACCOUNT_NUMBER_PATTERN, '[redacted: account_number]');

  return { text: next, kinds: uniqueKinds(kinds), hasDefinitiveSsn };
}

export function sanitizeMessages(messages: ChatMessage[]): SanitizeResult {
  const detectedKinds: PiiKind[] = [];
  let hasDefinitiveSsn = false;

  const sanitized = messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      const result = redactText(part.text);
      detectedKinds.push(...result.kinds);
      if (result.hasDefinitiveSsn) {
        hasDefinitiveSsn = true;
      }
      return { type: 'text' as const, text: result.text };
    }),
  }));

  return {
    messages: sanitized,
    detectedKinds: uniqueKinds(detectedKinds),
    hasDefinitiveSsn,
  };
}

/** Latest user message text after sanitization (what Stage 2 classifies). */
export function latestUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') {
      return message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
    }
  }
  return '';
}
