/**
 * Pre-bundles the Express app into `api/index.mjs` so Vercel does not have
 * to trace TypeScript across npm workspaces (portfolio-demo.md).
 */
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await esbuild.build({
  entryPoints: [path.join(root, 'server/src/vercel-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.join(root, 'api/index.mjs'),
  // Keep packages that ship native/optional bits external? Bundle all JS.
  packages: 'bundle',
  banner: {
    // Node ESM named-export interop for a few CJS-only deps.
    js: `import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
  },
  logLevel: 'info',
});

console.log('[build-api] wrote api/index.mjs');
