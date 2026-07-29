/**
 * Unit tests for Slice 2 grounding integrity — the pieces that decide whether
 * a turn is grounded, no-match (with mandatory sentence → UI referral), or
 * conversational. Covers: no-match sentence detection, system-prompt excerpt
 * injection (and that referral text is never offered for the model to copy),
 * and retrievalPartFor status selection from final text + hits.
 */
import { describe, expect, it } from 'vitest';
import { NO_MATCH_SENTENCE, REFERRAL_LINE } from '@civicreach/shared';
import type { RetrievedHit } from '../retrieval/store';
import { containsNoMatchSentence } from './no-match';
import { buildSystemPrompt } from './prompt';
import { retrievalPartFor } from './respond';

function hit(citationId: string, score: number): RetrievedHit {
  return {
    chunk: {
      citationId,
      docId: citationId.split('#')[0] ?? citationId,
      docTitle: `Doc ${citationId}`,
      sourceUrl: 'https://example.org',
      snapshotDate: '2026-07-28',
      heading: 'Section',
      text: 'The limit is $4,442.',
    },
    score,
  };
}

describe('no-match sentence detector', () => {
  it('detects the exact mandatory sentence', () => {
    expect(containsNoMatchSentence(NO_MATCH_SENTENCE)).toBe(true);
  });

  it('detects it inside a longer reply, case-insensitively', () => {
    expect(
      containsNoMatchSentence(
        "I'm sorry — I DON'T have that in my documents. Let's look at NC instead.",
      ),
    ).toBe(true);
  });

  it('tolerates curly apostrophes, extra whitespace, and "do not"', () => {
    expect(containsNoMatchSentence('I don\u2019t have that in  my documents.')).toBe(
      true,
    );
    expect(containsNoMatchSentence('I do not have that in my documents.')).toBe(true);
  });

  it('does not fire on ordinary grounded answers', () => {
    expect(
      containsNoMatchSentence(
        'For a household of 3 the gross monthly limit is $4,442. I found that in my documents.',
      ),
    ).toBe(false);
  });
});

describe('system prompt builder', () => {
  it('embeds the mandatory no-match sentence verbatim', () => {
    expect(buildSystemPrompt([], {})).toContain(`"${NO_MATCH_SENTENCE}"`);
  });

  it('injects excerpts with citation ids when there are hits', () => {
    const prompt = buildSystemPrompt([hit('income-limits#1', 0.61)], {});
    expect(prompt).toContain('[income-limits#1]');
    expect(prompt).toContain('The limit is $4,442.');
    expect(prompt).not.toContain('none were retrieved');
  });

  it('declares zero document excerpts when nothing cleared the threshold', () => {
    const prompt = buildSystemPrompt([], {});
    expect(prompt).toContain('none were retrieved');
  });

  it('never embeds the referral text for the model to copy', () => {
    // The referral is rendered by the UI from shared constants; the model
    // must not author it (verdict-language.md R6).
    expect(buildSystemPrompt([hit('a#0', 0.5)], {})).not.toContain(REFERRAL_LINE);
    expect(buildSystemPrompt([], {})).not.toContain(REFERRAL_LINE);
  });

  it('lists stored facts in the KNOWN FACTS block and flags pending ones', () => {
    const prompt = buildSystemPrompt([], {
      grossMonthlyIncome: { value: 2000, status: 'stated', sourceTurn: 2 },
      householdSize: { value: 3, status: 'needs_confirmation', sourceTurn: 3 },
    });
    expect(prompt).toContain('gross monthly income: $2,000 per month (stated, turn 2)');
    expect(prompt).toContain('household size: 3 people (NEEDS CONFIRMATION');
    expect(prompt).toContain('never ask for these again');
  });

  it('says no facts are stored for an empty CaseFile', () => {
    expect(buildSystemPrompt([], {})).toContain('KNOWN FACTS: none stored yet');
  });

  it('never embeds the tier phrases for the model to copy', () => {
    // Tier phrases are mandatory strings rendered by the UI from shared
    // constants (verdict-language.md R6); the prompt names them only inside
    // the do-NOT-write rule.
    const prompt = buildSystemPrompt([], {});
    const ruleLine = prompt
      .split('\n')
      .filter((line) => line.includes('you likely qualify'));
    expect(ruleLine).toHaveLength(1);
    expect(ruleLine[0]).toContain('Do NOT write the tier phrases');
  });
});

describe('retrieval part decision', () => {
  it('reports no_match when the model declared the sentence, even with hits', () => {
    const part = retrievalPartFor({
      finalText: `South Carolina is outside my documents. ${NO_MATCH_SENTENCE}`,
      hits: [hit('income-limits#1', 0.72)],
      bestScore: 0.72,
    });
    expect(part.status).toBe('no_match');
    if (part.status !== 'no_match') return;
    expect(part.bestScore).toBeCloseTo(0.72, 5);
  });

  it('reports grounded citations when hits were used without a declaration', () => {
    const part = retrievalPartFor({
      finalText: 'For 3 people the limit is $4,442.',
      hits: [hit('income-limits#1', 0.61), hit('deductions#2', 0.42)],
      bestScore: 0.61,
    });
    expect(part.status).toBe('grounded');
    if (part.status !== 'grounded') return;
    expect(part.citations.map((citation) => citation.citationId)).toEqual([
      'income-limits#1',
      'deductions#2',
    ]);
  });

  it('reports conversational when there were no hits and no declaration', () => {
    const part = retrievalPartFor({
      finalText: 'Hi! How can I help with NC FNS today?',
      hits: [],
      bestScore: 0.21,
    });
    expect(part.status).toBe('conversational');
  });

  it('never claims grounding for an empty (failed) reply', () => {
    const part = retrievalPartFor({
      finalText: '',
      hits: [hit('income-limits#1', 0.61)],
      bestScore: 0.61,
    });
    expect(part.status).toBe('conversational');
  });
});
