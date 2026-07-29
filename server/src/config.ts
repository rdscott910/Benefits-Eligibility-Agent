import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// One `.env` at the repository root configures every workspace, so the whole
// setup stays `npm install && npm run dev` plus a single key.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(repoRoot, '.env');

try {
  process.loadEnvFile(envFile);
} catch {
  // No `.env` yet. Callers that need the key validate via requireEnv().
}

const envSchema = z.object({
  OPENAI_API_KEY: z
    .string({ error: 'is not set' })
    .min(1, { error: 'is empty' }),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;

/**
 * All model ids live here, pinned separately: the agent model answers, the
 * classifier model powers Slice 1 guardrails, the embedding model powers
 * Slice 2 retrieval.
 *
 * - agent: current-generation balanced model — capable enough for a warm
 *   multi-turn conversation with tool calling, without flagship pricing.
 * - classifier: OpenAI's smallest current model, built for classification and
 *   extraction. Every message pays this hop, so speed and cost dominate.
 * - embedding: small embedding model — strong retrieval quality on short
 *   English policy text at the lowest cost tier; the six-document corpus is
 *   far below the scale where the large model would pay off. Settled with
 *   user 2026-07-28 (slice-2 packet).
 */
export const MODELS = {
  agent: 'gpt-5.6-terra',
  classifier: 'gpt-5.4-nano',
  embedding: 'text-embedding-3-small',
} as const;

/** Hard timeout for the Stage 2 classifier call. Failure fails closed. */
export const CLASSIFIER_TIMEOUT_MS = 8_000;

/**
 * Retrieval tuning (decisions/grounding-policy.md: an explicit similarity
 * threshold; below-bar best matches take the no-match path).
 *
 * threshold: cosine floor a chunk must clear before it is shown to the model.
 * Calibrated 2026-07-28 with live text-embedding-3-small scores over the
 * real 34-chunk corpus: direct NC FNS questions score 0.46-0.62 against
 * their chunk, casually-phrased on-topic turns 0.30-0.33 ("How much money
 * can I have in the bank?" → resource-limits 0.332; "There are 3 of us. I
 * make $2,000 a month" → income-limits 0.297), while clearly unrelated chat
 * tops out at 0.134 ("thanks so much!"; weather 0.098). 0.28 sits above the
 * noise floor with 2x margin and keeps every observed on-topic phrasing.
 * Out-of-corpus questions that are topically close (another state's limits
 * at 0.56, "does FNS cover buying a car" at 0.556) intentionally clear this
 * bar — the system prompt's no-match rule handles those (slice-2 packet).
 *
 * topK: excerpts passed to the model per turn. Six documents chunk to 34
 * sections; 4 covers multi-facet questions without drowning the prompt.
 */
export const RETRIEVAL = {
  threshold: 0.28,
  topK: 4,
} as const;

/** Validate and return env. Exits the process when required values are missing. */
export function requireEnv(): Env {
  const parsedEnv = envSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    const problems = parsedEnv.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      [
        '',
        'Cannot start the server — configuration is incomplete:',
        problems,
        '',
        'Fix it with:',
        '  1. cp .env.example .env',
        '  2. put your OpenAI API key in .env',
        '',
        `Looked for: ${envFile}`,
        'See README.md for the full run steps.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  return parsedEnv.data;
}
