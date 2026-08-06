import express, { type Express } from 'express';
import { chunkCorpus } from './corpus/chunker';
import {
  parseIncomeLimitsTable,
  type IncomeLimitsTable,
} from './corpus/income-table';
import { loadCorpusDocuments } from './corpus/loader';
import { buildVectorStore, type VectorStore } from './retrieval/store';
import { createChatRouter } from './routes/chat';

export type Grounding = { store: VectorStore; incomeTable: IncomeLimitsTable };

/**
 * Grounding boots before the app serves traffic, and failure refuses to
 * start: there are no fallback numbers by design (roadmap Slice 2). The
 * embeddings cache is gitignored and keyed by corpus content, so only the
 * first boot (or a corpus edit) pays the embedding calls. The parsed
 * income-limits table feeds the Slice 3 deterministic tools.
 *
 * Throws on failure (serverless-safe). The local listener wraps this and
 * may `process.exit(1)` after printing fix instructions.
 */
export async function buildGrounding(): Promise<Grounding> {
  const documents = loadCorpusDocuments();

  const incomeDoc = documents.find((doc) => doc.doc_id === 'income-limits');
  if (!incomeDoc) {
    throw new Error('Corpus is missing the income-limits document.');
  }
  const incomeTable = parseIncomeLimitsTable(incomeDoc);

  const chunks = chunkCorpus(documents);
  const { store, source, latencyMs } = await buildVectorStore(chunks);

  console.log(
    `[server] corpus ready: ${documents.length} documents, ${chunks.length} chunks; ` +
      `income-limits table validated (${incomeTable.rows.length} rows); ` +
      `embeddings ${source === 'cache' ? 'loaded from cache' : 'built'} in ${latencyMs}ms`,
  );

  return { store, incomeTable };
}

/** Express app with `/api` chat routes — no listen (local and Vercel share this). */
export function createApp(grounding: Grounding): Express {
  const app = express();

  app.use(express.json({ limit: '256kb' }));
  app.use('/api', createChatRouter(grounding));

  return app;
}

/**
 * Build grounding then the Express app. Used by the Vercel entry (top-level
 * await) and by bake/test helpers.
 */
export async function createReadyApp(): Promise<Express> {
  const grounding = await buildGrounding();
  return createApp(grounding);
}
