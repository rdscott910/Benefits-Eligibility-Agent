import { describe, expect, it } from 'vitest';
import { redactText, sanitizeMessages } from './sanitize';
import { userMessage } from './pipeline';

describe('Stage 1 sanitize', () => {
  it('redacts hyphenated and bare SSNs', () => {
    const hyphenated = redactText('My SSN is 123-45-6789, does that help?');
    expect(hyphenated.hasDefinitiveSsn).toBe(true);
    expect(hyphenated.kinds).toContain('ssn');
    expect(hyphenated.text).toContain('[redacted: ssn]');
    expect(hyphenated.text).not.toContain('123-45-6789');

    const bare = redactText('SSN 123456789 please');
    expect(bare.hasDefinitiveSsn).toBe(true);
    expect(bare.text).not.toContain('123456789');
  });

  it('leaves income amounts and household sizes untouched', () => {
    const text = 'There are 3 of us. I make $2,000 a month before taxes.';
    const result = redactText(text);
    expect(result.kinds).toEqual([]);
    expect(result.hasDefinitiveSsn).toBe(false);
    expect(result.text).toBe(text);
  });

  it('redacts long account-number digit runs', () => {
    const result = redactText('Account 12345678901234 for deposit');
    expect(result.kinds).toContain('account_number');
    expect(result.text).toContain('[redacted: account_number]');
    expect(result.text).not.toContain('12345678901234');
  });

  it('sanitizes every inbound message, not only the latest', () => {
    const result = sanitizeMessages([
      userMessage('My SSN is 123-45-6789', 'u1'),
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'ok' }],
      },
      userMessage('actually never mind', 'u2'),
    ]);
    expect(result.hasDefinitiveSsn).toBe(true);
    expect(result.messages[0]?.parts[0]?.text).toContain('[redacted: ssn]');
    expect(result.messages[0]?.parts[0]?.text).not.toContain('123-45-6789');
  });
});
