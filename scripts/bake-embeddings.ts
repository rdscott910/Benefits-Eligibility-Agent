/**
 * Builds `server/.embeddings-cache.json` so a Vercel deploy never pays
 * embedding latency on cold start. Requires OPENAI_API_KEY (build env).
 */
import { chunkCorpus } from '../server/src/corpus/chunker.ts';
import { loadCorpusDocuments } from '../server/src/corpus/loader.ts';
import { buildVectorStore } from '../server/src/retrieval/store.ts';

const documents = loadCorpusDocuments();
const chunks = chunkCorpus(documents);
const { source, latencyMs } = await buildVectorStore(chunks);
console.log(
  `[bake] embeddings ${source} in ${latencyMs}ms (${chunks.length} chunks)`,
);
