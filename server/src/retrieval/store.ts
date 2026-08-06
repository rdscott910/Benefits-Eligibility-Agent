import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { openai } from '@ai-sdk/openai';
import { cosineSimilarity, embed, embedMany } from 'ai';
import { z } from 'zod';
import { MODELS } from '../config';
import { embeddingInput, type CorpusChunk } from '../corpus/chunker';
import { embeddingsCacheFile } from '../paths';

/**
 * In-memory vector store, rebuilt from `server/corpus/` markdown at every
 * startup (stack-boundaries.md: no store files committed, no external vector
 * DB). Embeddings are cached in a gitignored JSON file keyed by a hash of
 * the embedding model id and every chunk's identity and text, so a boot with
 * an unchanged corpus makes no embedding calls, and any corpus edit rebuilds.
 */

/** Resolved at call time so Vercel bundles see the cache via project cwd. */
export function getEmbeddingsCacheFile(): string {
  return embeddingsCacheFile();
}

/** @deprecated Prefer getEmbeddingsCacheFile() — kept for existing imports. */
export const EMBEDDINGS_CACHE_FILE = embeddingsCacheFile();

const cacheFileSchema = z.object({
  key: z.string().min(1),
  model: z.string().min(1),
  vectors: z.array(z.array(z.number()).min(1)).min(1),
});

export type VectorStore = {
  chunks: CorpusChunk[];
  vectors: number[][];
};

export type RetrievedHit = {
  chunk: CorpusChunk;
  /** Cosine similarity against the query. */
  score: number;
};

/** Content hash that keys the embeddings cache. */
export function corpusCacheKey(chunks: CorpusChunk[], modelId: string): string {
  const hash = createHash('sha256');
  hash.update(modelId);
  for (const chunk of chunks) {
    hash.update('\u0000');
    hash.update(chunk.citationId);
    hash.update('\u0000');
    hash.update(embeddingInput(chunk));
  }
  return hash.digest('hex');
}

function readCachedVectors(key: string, chunkCount: number): number[][] | null {
  const cachePath = getEmbeddingsCacheFile();
  if (!existsSync(cachePath)) {
    return null;
  }
  try {
    const parsed = cacheFileSchema.safeParse(
      JSON.parse(readFileSync(cachePath, 'utf8')),
    );
    if (
      !parsed.success ||
      parsed.data.key !== key ||
      parsed.data.vectors.length !== chunkCount
    ) {
      return null;
    }
    return parsed.data.vectors;
  } catch {
    // A corrupt cache is not an error: re-embed and overwrite it.
    return null;
  }
}

/**
 * Builds the store, embedding all chunks unless the gitignored cache already
 * holds vectors for this exact corpus content and model.
 */
export async function buildVectorStore(
  chunks: CorpusChunk[],
): Promise<{ store: VectorStore; source: 'cache' | 'embedded'; latencyMs: number }> {
  const started = Date.now();
  const key = corpusCacheKey(chunks, MODELS.embedding);

  const cached = readCachedVectors(key, chunks.length);
  if (cached) {
    return {
      store: { chunks, vectors: cached },
      source: 'cache',
      latencyMs: Date.now() - started,
    };
  }

  const { embeddings } = await embedMany({
    model: openai.embeddingModel(MODELS.embedding),
    values: chunks.map((chunk) => embeddingInput(chunk)),
  });

  writeFileSync(
    getEmbeddingsCacheFile(),
    JSON.stringify({ key, model: MODELS.embedding, vectors: embeddings }),
  );

  return {
    store: { chunks, vectors: embeddings },
    source: 'embedded',
    latencyMs: Date.now() - started,
  };
}

/**
 * Embeds the user's latest sanitized message for retrieval. Token usage is
 * returned for the per-turn trace (trace-transparency.md running cost).
 */
export async function embedQuery(
  text: string,
): Promise<{ vector: number[]; tokens: number }> {
  const { embedding, usage } = await embed({
    model: openai.embeddingModel(MODELS.embedding),
    value: text,
  });
  return { vector: embedding, tokens: usage.tokens };
}

/** All chunks scored against the query, best first. */
export function scoreChunks(store: VectorStore, queryVector: number[]): RetrievedHit[] {
  return store.chunks
    .map((chunk, index) => {
      const vector = store.vectors[index];
      if (!vector) {
        throw new Error(`Vector store is misaligned at index ${index}.`);
      }
      return { chunk, score: cosineSimilarity(queryVector, vector) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * The hits shown to the model: the top-k results at or above the explicit
 * similarity threshold. Below-bar matches are dropped entirely — a weak
 * best match must lead to the no-match path, never a weak-evidence answer
 * (grounding-policy.md, 2026-07-23 revision).
 */
export function retrieveAboveThreshold(options: {
  store: VectorStore;
  queryVector: number[];
  topK: number;
  threshold: number;
}): { hits: RetrievedHit[]; bestScore: number | null } {
  const scored = scoreChunks(options.store, options.queryVector);
  const bestScore = scored[0]?.score ?? null;
  const hits = scored
    .slice(0, options.topK)
    .filter((hit) => hit.score >= options.threshold);
  return { hits, bestScore };
}
