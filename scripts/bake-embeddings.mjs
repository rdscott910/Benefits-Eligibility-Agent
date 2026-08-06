import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync(
  'npx',
  ['tsx', path.join(root, 'scripts/bake-embeddings.ts')],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
