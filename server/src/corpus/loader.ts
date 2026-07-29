import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Loads the curated corpus from `server/corpus/` (decisions/corpus-scope.md):
 * exactly six dated markdown snapshots, each with front matter recording the
 * source URL and snapshot date. Any violation throws so the boot path can
 * refuse to start — a wrong corpus must never silently serve answers.
 */

export const CORPUS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../corpus',
);

/** The six settled documents. Adding one is a scope revision (corpus-scope.md). */
export const EXPECTED_DOC_IDS = [
  'deductions',
  'household-composition',
  'how-to-apply',
  'income-limits',
  'resource-limits',
  'work-requirements',
] as const;

export const frontMatterSchema = z.object({
  doc_id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'doc_id must be a lowercase slug'),
  title: z.string().min(1),
  source_url: z.url(),
  snapshot_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'snapshot_date must be YYYY-MM-DD'),
});
export type CorpusFrontMatter = z.infer<typeof frontMatterSchema>;

export type CorpusDocument = CorpusFrontMatter & {
  /** Markdown body without the front matter block. */
  body: string;
};

/**
 * Parses the `---`-delimited `key: value` front matter block. Deliberately
 * hand-rolled (four known string keys, no nesting) so the dependency list
 * stays demo-explainable; Zod does the actual validation.
 */
export function parseFrontMatter(raw: string, fileName: string): CorpusDocument {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match || match[1] === undefined) {
    throw new Error(`Corpus file ${fileName} is missing front matter (--- block).`);
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(
        `Corpus file ${fileName} has a malformed front matter line: "${line}"`,
      );
    }
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  const parsed = frontMatterSchema.safeParse(fields);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'front matter'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Corpus file ${fileName} has invalid front matter: ${problems}`);
  }

  return { ...parsed.data, body: raw.slice(match[0].length) };
}

/** Reads and validates all corpus documents, enforcing the six-document scope. */
export function loadCorpusDocuments(corpusDir: string = CORPUS_DIR): CorpusDocument[] {
  const files = readdirSync(corpusDir)
    .filter((file) => file.endsWith('.md'))
    .sort();

  const documents = files.map((file) =>
    parseFrontMatter(readFileSync(path.join(corpusDir, file), 'utf8'), file),
  );

  const foundIds = documents.map((doc) => doc.doc_id).sort();
  const expectedIds = [...EXPECTED_DOC_IDS].sort();
  if (JSON.stringify(foundIds) !== JSON.stringify(expectedIds)) {
    throw new Error(
      `Corpus must contain exactly the six settled documents (corpus-scope.md). ` +
        `Expected [${expectedIds.join(', ')}], found [${foundIds.join(', ')}].`,
    );
  }

  return documents;
}
