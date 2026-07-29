import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { beforeAll, describe, expect, it } from 'vitest';
import { retrievalPartFor } from '../agent/respond';
import { containsNoMatchSentence } from '../agent/no-match';
import { buildSystemPrompt } from '../agent/prompt';
import { MODELS, RETRIEVAL } from '../config';
import { chunkCorpus } from '../corpus/chunker';
import { loadCorpusDocuments } from '../corpus/loader';
import { runGuardrailPipeline, userMessage } from '../middleware/pipeline';
import {
  buildVectorStore,
  embedQuery,
  retrieveAboveThreshold,
  type RetrievedHit,
  type VectorStore,
} from '../retrieval/store';

/**
 * Live grounding suite mirroring docs/agent/proof/live-review-script.md
 * section 3 (both no-match items) plus the Slice 2 checks from section 2
 * (grounded figure verbatim in corpus; no numbers without retrieval).
 * Requires OPENAI_API_KEY. Runs the same retrieval + prompt + part-decision
 * path as the server route, without the HTTP/stream plumbing (the live
 * review exercises that in the browser).
 *
 * Run: npm run eval
 */

const hasKey = Boolean(process.env.OPENAI_API_KEY);
const LIVE_TIMEOUT_MS = 90_000;

let store: VectorStore;
let corpusText = '';

async function answer(question: string): Promise<{
  text: string;
  hits: RetrievedHit[];
  part: ReturnType<typeof retrievalPartFor>;
}> {
  // The full guardrail pipeline must hand these questions to the agent —
  // an out_of_scope short-circuit here would swallow the no-match path
  // (classifier-design.md: out_of_scope is topic-level only).
  const outcome = await runGuardrailPipeline([userMessage(question)]);
  expect(outcome.kind).toBe('proceed');

  const queryVector = await embedQuery(question);
  const { hits, bestScore } = retrieveAboveThreshold({
    store,
    queryVector,
    topK: RETRIEVAL.topK,
    threshold: RETRIEVAL.threshold,
  });
  const { text } = await generateText({
    model: openai(MODELS.agent),
    system: buildSystemPrompt(hits, {}),
    prompt: question,
  });
  return { text, hits, part: retrievalPartFor({ finalText: text, hits, bestScore }) };
}

/** Every $-figure in a reply must appear verbatim somewhere in the corpus. */
function dollarFigures(text: string): string[] {
  return text.match(/\$[\d,]+(?:\.\d+)?/g) ?? [];
}

describe.skipIf(!hasKey)('grounding script (live agent)', () => {
  beforeAll(async () => {
    const documents = loadCorpusDocuments();
    const chunks = chunkCorpus(documents);
    corpusText = chunks.map((chunk) => chunk.text).join('\n');
    ({ store } = await buildVectorStore(chunks));
  }, LIVE_TIMEOUT_MS);

  it(
    'R1: South Carolina limits take the no-match path with no guessed figures',
    async () => {
      const { text, part } = await answer(
        'What are the income limits for food stamps in South Carolina?',
      );
      expect(containsNoMatchSentence(text)).toBe(true);
      expect(part.status).toBe('no_match');
      expect(dollarFigures(text)).toEqual([]);
      // The referral is rendered by the UI from shared constants; the model
      // must not author its own (verdict-language.md R6).
      expect(text.toLowerCase()).not.toContain('epass');
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    'R2: "does NC FNS cover buying a car" takes the no-match path, no invented policy',
    async () => {
      const { text, part } = await answer('Does NC FNS cover buying a car?');
      expect(containsNoMatchSentence(text)).toBe(true);
      expect(part.status).toBe('no_match');
      for (const figure of dollarFigures(text)) {
        expect(corpusText).toContain(figure);
      }
      expect(text.toLowerCase()).not.toContain('epass');
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    'R3: household-of-3 gross limit is answered verbatim from the corpus with citations',
    async () => {
      const { text, part } = await answer(
        'What is the gross monthly income limit for a household of 3 in North Carolina?',
      );
      expect(text).toContain('$4,442');
      expect(part.status).toBe('grounded');
      if (part.status !== 'grounded') return;
      expect(
        part.citations.some((citation) => citation.docId === 'income-limits'),
      ).toBe(true);
      for (const figure of dollarFigures(text)) {
        expect(corpusText).toContain(figure);
      }
    },
    LIVE_TIMEOUT_MS,
  );

  it(
    'R4: the warm opener is answered without citing any figure not in the corpus',
    async () => {
      const { text } = await answer(
        "Hi — I lost my job last month and I'm trying to figure out if I can get food assistance in North Carolina.",
      );
      expect(containsNoMatchSentence(text)).toBe(false);
      for (const figure of dollarFigures(text)) {
        expect(corpusText).toContain(figure);
      }
      const lowered = text.toLowerCase();
      expect(lowered).not.toContain('you are eligible');
      expect(lowered).not.toContain('you are approved');
      expect(lowered).not.toContain('guaranteed');
    },
    LIVE_TIMEOUT_MS,
  );
});
