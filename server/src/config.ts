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
 * Both model ids live here from day one, pinned separately: the agent model is
 * used now, the classifier model is used by Slice 1 guardrails.
 *
 * - agent: current-generation balanced model — capable enough for a warm
 *   multi-turn conversation with tool calling, without flagship pricing.
 * - classifier: OpenAI's smallest current model, built for classification and
 *   extraction. Every message pays this hop, so speed and cost dominate.
 */
export const MODELS = {
  agent: 'gpt-5.6-terra',
  classifier: 'gpt-5.4-nano',
} as const;

/** Hard timeout for the Stage 2 classifier call. Failure fails closed. */
export const CLASSIFIER_TIMEOUT_MS = 8_000;

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
