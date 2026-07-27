/**
 * Runs the offline + live adversarial suites and prints a pass/fail table
 * for the README eval report.
 *
 * Usage: npm run eval  (from repo root or server workspace)
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../config';
import { CLASSIFIER_PROMPT_VERSION } from '../middleware/classify';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Ensure root .env is visible to the child vitest process.
try {
  process.loadEnvFile(path.resolve(serverRoot, '../.env'));
} catch {
  // Live suite will skip if the key is absent.
}

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--reporter=json', '--outputFile=src/eval/last-run.json'],
  {
    cwd: serverRoot,
    env: process.env,
    encoding: 'utf8',
  },
);

type VitestJson = {
  testResults?: Array<{
    name: string;
    status: string;
    assertionResults?: Array<{
      title: string;
      status: string;
      fullName?: string;
    }>;
  }>;
};

const reportPath = path.join(serverRoot, 'src/eval/last-run.json');
if (!existsSync(reportPath)) {
  console.error('Eval failed to produce JSON output.');
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}

const json = JSON.parse(readFileSync(reportPath, 'utf8')) as VitestJson;

type ClassKey =
  | 'crisis'
  | 'injection'
  | 'pii'
  | 'out_of_scope'
  | 'precedence'
  | 'calibration'
  | 'offline';

function classFor(title: string): ClassKey {
  if (/^A\d/.test(title) || title.toLowerCase().includes('crisis phrase')) {
    return 'crisis';
  }
  if (/^B\d/.test(title) || title.toLowerCase().includes('injection') || title.toLowerCase().includes('system-prompt')) {
    return 'injection';
  }
  if (/^C\d/.test(title) || title.includes('SSN') || title.toLowerCase().includes('pii')) {
    return 'pii';
  }
  if (/^D\d/.test(title) || title.includes('submit') || title.includes('off-topic') || title.includes('recipe')) {
    return 'out_of_scope';
  }
  if (/^E\d/.test(title) || title.includes('crisis +') || title.includes('injection +')) {
    return 'precedence';
  }
  if (/^F\d/.test(title) || title.includes('money stress')) {
    return 'calibration';
  }
  return 'offline';
}

const buckets: Record<
  ClassKey,
  { pass: number; fail: number; skip: number; titles: string[] }
> = {
  crisis: { pass: 0, fail: 0, skip: 0, titles: [] },
  injection: { pass: 0, fail: 0, skip: 0, titles: [] },
  pii: { pass: 0, fail: 0, skip: 0, titles: [] },
  out_of_scope: { pass: 0, fail: 0, skip: 0, titles: [] },
  precedence: { pass: 0, fail: 0, skip: 0, titles: [] },
  calibration: { pass: 0, fail: 0, skip: 0, titles: [] },
  offline: { pass: 0, fail: 0, skip: 0, titles: [] },
};

for (const file of json.testResults ?? []) {
  for (const assertion of file.assertionResults ?? []) {
    const key = classFor(assertion.title);
    const bucket = buckets[key];
    bucket.titles.push(`${assertion.status.toUpperCase()}  ${assertion.title}`);
    if (assertion.status === 'passed') bucket.pass += 1;
    else if (assertion.status === 'failed') bucket.fail += 1;
    else bucket.skip += 1;
  }
}

const date = new Date().toISOString().slice(0, 10);
console.log('');
console.log('CivicReach guardrail eval report');
console.log(`Date: ${date}`);
console.log(`Classifier model: ${MODELS.classifier}`);
console.log(`Classifier prompt version: ${CLASSIFIER_PROMPT_VERSION}`);
console.log('');
console.log('| Class | Pass | Fail | Skip |');
console.log('| --- | ---: | ---: | ---: |');
for (const [key, bucket] of Object.entries(buckets)) {
  console.log(`| ${key} | ${bucket.pass} | ${bucket.fail} | ${bucket.skip} |`);
}
console.log('');
for (const [key, bucket] of Object.entries(buckets)) {
  if (bucket.titles.length === 0) continue;
  console.log(`### ${key}`);
  for (const line of bucket.titles) console.log(`- ${line}`);
  console.log('');
}

const anyFail = Object.values(buckets).some((b) => b.fail > 0);
process.exit(anyFail || result.status === 1 ? 1 : 0);
