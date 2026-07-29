import { z } from 'zod';
import type { CorpusDocument } from './loader';

/**
 * Splits corpus documents into retrieval chunks along `##` headings, keeping
 * markdown tables whole. Chunk ids are stable in document order
 * (`<doc_id>#<n>`) so citations stay meaningful across restarts as long as
 * the document structure is unchanged.
 */

export const corpusChunkSchema = z.object({
  /** Stable citation id, e.g. "income-limits#1". */
  citationId: z.string().min(1),
  docId: z.string().min(1),
  docTitle: z.string().min(1),
  sourceUrl: z.string().min(1),
  snapshotDate: z.string().min(1),
  /** Section heading, or the document title for the preamble chunk. */
  heading: z.string().min(1),
  /** Raw markdown of the section. */
  text: z.string().min(1),
});
export type CorpusChunk = z.infer<typeof corpusChunkSchema>;

/**
 * The text handed to the embedding model: document title and section heading
 * prefixed so a section keeps its document context when embedded alone.
 */
export function embeddingInput(chunk: CorpusChunk): string {
  return `${chunk.docTitle}\n${chunk.heading}\n\n${chunk.text}`;
}

export function chunkDocument(doc: CorpusDocument): CorpusChunk[] {
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } = {
    heading: doc.title,
    lines: [],
  };

  for (const line of doc.body.split('\n')) {
    if (line.startsWith('## ')) {
      sections.push(current);
      current = { heading: line.slice(3).trim(), lines: [] };
      continue;
    }
    // The H1 restates the title; it adds nothing to the preamble chunk.
    if (line.startsWith('# ')) {
      continue;
    }
    current.lines.push(line);
  }
  sections.push(current);

  const chunks: CorpusChunk[] = [];
  for (const section of sections) {
    const text = section.lines.join('\n').trim();
    if (!text) {
      continue;
    }
    chunks.push(
      corpusChunkSchema.parse({
        citationId: `${doc.doc_id}#${chunks.length}`,
        docId: doc.doc_id,
        docTitle: doc.title,
        sourceUrl: doc.source_url,
        snapshotDate: doc.snapshot_date,
        heading: section.heading,
        text,
      }),
    );
  }

  if (chunks.length === 0) {
    throw new Error(`Corpus document ${doc.doc_id} produced no chunks.`);
  }

  return chunks;
}

export function chunkCorpus(documents: CorpusDocument[]): CorpusChunk[] {
  return documents.flatMap((doc) => chunkDocument(doc));
}
