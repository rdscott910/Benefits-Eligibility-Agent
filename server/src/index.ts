import express from 'express';
import { requireEnv } from './config';
import { chunkCorpus } from './corpus/chunker';
import {
  parseIncomeLimitsTable,
  type IncomeLimitsTable,
} from './corpus/income-table';
import { loadCorpusDocuments } from './corpus/loader';
import { buildVectorStore, type VectorStore } from './retrieval/store';
import { createChatRouter } from './routes/chat';

const env = requireEnv();

type Grounding = { store: VectorStore; incomeTable: IncomeLimitsTable };

/**
 * Grounding boots before the server listens, and failure refuses to boot:
 * there are no fallback numbers by design (roadmap Slice 2). The embeddings
 * cache is gitignored and keyed by corpus content, so only the first boot
 * (or a corpus edit) pays the embedding calls. The parsed income-limits
 * table feeds the Slice 3 deterministic tools.
 */
async function buildGrounding(): Promise<Grounding> {
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

let grounding: Grounding;
try {
  grounding = await buildGrounding();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    [
      '',
      'Cannot start the server — the grounding corpus failed to load:',
      `  ${message}`,
      '',
      'This server refuses to boot without a valid corpus: answers must be',
      'grounded and there are no fallback numbers by design. Fix the file(s)',
      'in server/corpus/ and the watcher will restart automatically.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use('/api', createChatRouter(grounding));

app.listen(env.PORT, () => {
  console.log(`[server] API listening on http://localhost:${env.PORT}`);
});
