import { describe, expect, it } from 'vitest';
import type { CorpusChunk } from '../corpus/chunker';
import {
  corpusCacheKey,
  retrieveAboveThreshold,
  scoreChunks,
  type VectorStore,
} from './store';

function chunk(citationId: string): CorpusChunk {
  return {
    citationId,
    docId: citationId.split('#')[0] ?? citationId,
    docTitle: `Title of ${citationId}`,
    sourceUrl: 'https://example.org',
    snapshotDate: '2026-07-28',
    heading: 'Heading',
    text: `Text for ${citationId}`,
  };
}

// Orthogonal-ish unit vectors make hand-computable cosine scores.
const store: VectorStore = {
  chunks: [chunk('a#0'), chunk('b#0'), chunk('c#0')],
  vectors: [
    [1, 0, 0],
    [0, 1, 0],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
  ],
};

describe('vector store search', () => {
  it('scores all chunks against the query, best first', () => {
    const hits = scoreChunks(store, [1, 0, 0]);
    expect(hits.map((hit) => hit.chunk.citationId)).toEqual(['a#0', 'c#0', 'b#0']);
    expect(hits[0]?.score).toBeCloseTo(1, 5);
    expect(hits[1]?.score).toBeCloseTo(Math.SQRT1_2, 5);
    expect(hits[2]?.score).toBeCloseTo(0, 5);
  });

  it('drops below-threshold matches entirely (no weak-evidence answers)', () => {
    const { hits, bestScore } = retrieveAboveThreshold({
      store,
      queryVector: [1, 0, 0],
      topK: 3,
      threshold: 0.9,
    });
    expect(hits.map((hit) => hit.chunk.citationId)).toEqual(['a#0']);
    expect(bestScore).toBeCloseTo(1, 5);
  });

  it('reports bestScore even when nothing clears the threshold', () => {
    const { hits, bestScore } = retrieveAboveThreshold({
      store,
      queryVector: [0, 0, 1],
      topK: 3,
      threshold: 0.35,
    });
    expect(hits).toEqual([]);
    expect(bestScore).toBeCloseTo(0, 5);
  });

  it('respects topK before thresholding', () => {
    const { hits } = retrieveAboveThreshold({
      store,
      queryVector: [1, 1, 0],
      topK: 1,
      threshold: 0,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.chunk.citationId).toBe('c#0');
  });
});

describe('embeddings cache key', () => {
  const chunks = [chunk('a#0'), chunk('b#0')];

  it('is stable for identical corpus content and model', () => {
    expect(corpusCacheKey(chunks, 'model-x')).toBe(corpusCacheKey(chunks, 'model-x'));
  });

  it('changes when the model, text, or chunk identity changes', () => {
    const base = corpusCacheKey(chunks, 'model-x');
    expect(corpusCacheKey(chunks, 'model-y')).not.toBe(base);

    const editedText = [chunks[0]!, { ...chunks[1]!, text: 'edited' }];
    expect(corpusCacheKey(editedText, 'model-x')).not.toBe(base);

    const editedId = [chunks[0]!, { ...chunks[1]!, citationId: 'b#1' }];
    expect(corpusCacheKey(editedId, 'model-x')).not.toBe(base);
  });
});
