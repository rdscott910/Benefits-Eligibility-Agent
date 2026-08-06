import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves data files under `server/` (corpus, embeddings cache).
 *
 * Locally, paths are derived from this module's location (`server/src`).
 * On Vercel the API is an esbuild bundle under `api/`, so `import.meta.url`
 * is useless — `includeFiles` places `server/` at the project cwd instead
 * (`decisions/portfolio-demo.md`).
 */
function serverRoot(): string {
  if (process.env.VERCEL) {
    return path.join(process.cwd(), 'server');
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function corpusDir(): string {
  return path.join(serverRoot(), 'corpus');
}

export function embeddingsCacheFile(): string {
  return path.join(serverRoot(), '.embeddings-cache.json');
}
