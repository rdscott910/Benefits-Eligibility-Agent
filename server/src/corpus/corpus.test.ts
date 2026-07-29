import { describe, expect, it } from 'vitest';
import { chunkCorpus, chunkDocument, embeddingInput } from './chunker';
import { parseIncomeLimitsTable } from './income-table';
import {
  EXPECTED_DOC_IDS,
  loadCorpusDocuments,
  parseFrontMatter,
  type CorpusDocument,
} from './loader';

describe('corpus loader', () => {
  it('loads exactly the six settled documents with valid front matter', () => {
    const documents = loadCorpusDocuments();
    expect(documents.map((doc) => doc.doc_id).sort()).toEqual(
      [...EXPECTED_DOC_IDS].sort(),
    );
    for (const doc of documents) {
      expect(doc.source_url).toMatch(/^https:\/\//);
      expect(doc.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.body.length).toBeGreaterThan(0);
    }
  });

  it('rejects a file without front matter', () => {
    expect(() => parseFrontMatter('# no front matter\n', 'x.md')).toThrow(
      /missing front matter/,
    );
  });

  it('rejects front matter with missing or invalid fields', () => {
    const raw = [
      '---',
      'doc_id: Bad Slug!',
      'title: t',
      'source_url: not-a-url',
      'snapshot_date: yesterday',
      '---',
      'body',
    ].join('\n');
    expect(() => parseFrontMatter(raw, 'x.md')).toThrow(/invalid front matter/);
  });
});

describe('chunker', () => {
  it('produces stable ids in document order and keeps tables whole', () => {
    const documents = loadCorpusDocuments();
    const chunks = chunkCorpus(documents);

    for (const doc of documents) {
      const docChunks = chunks.filter((chunk) => chunk.docId === doc.doc_id);
      expect(docChunks.length).toBeGreaterThan(0);
      docChunks.forEach((chunk, index) => {
        expect(chunk.citationId).toBe(`${doc.doc_id}#${index}`);
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      });
    }

    // The income-limits table must land inside a single chunk, header to
    // final row, so a citation always carries the whole table.
    const tableChunk = chunks.find(
      (chunk) =>
        chunk.docId === 'income-limits' && chunk.text.includes('| 1 | $2,610 |'),
    );
    expect(tableChunk).toBeDefined();
    expect(tableChunk?.text).toContain('| 8 | $9,026 |');
    expect(tableChunk?.text).toContain('Each additional member');
  });

  it('prefixes embedding input with document title and heading', () => {
    const doc: CorpusDocument = {
      doc_id: 'income-limits',
      title: 'Title Here',
      source_url: 'https://example.org/a',
      snapshot_date: '2026-07-28',
      body: '# H1\n\nintro text\n\n## Section A\n\ncontent here\n',
    };
    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.heading).toBe('Title Here');
    expect(chunks[1]?.heading).toBe('Section A');
    expect(embeddingInput(chunks[1]!)).toBe('Title Here\nSection A\n\ncontent here');
  });
});

function incomeDoc(body: string): CorpusDocument {
  return {
    doc_id: 'income-limits',
    title: 'NC FNS income limits',
    source_url: 'https://example.org/limits',
    snapshot_date: '2026-07-28',
    body,
  };
}

describe('income-limits table parser (fail-fast boot contract)', () => {
  it('parses the real corpus document into the validated table', () => {
    const documents = loadCorpusDocuments();
    const doc = documents.find((entry) => entry.doc_id === 'income-limits');
    expect(doc).toBeDefined();
    const table = parseIncomeLimitsTable(doc!);

    expect(table.rows).toHaveLength(8);
    // Spot-check against the official FNS 360 figures (effective 2025-10-01).
    expect(table.rows[0]).toEqual({
      unitSize: 1,
      gross200: 2610,
      gross130: 1696,
      net100: 1305,
    });
    expect(table.rows[2]).toEqual({
      unitSize: 3,
      gross200: 4442,
      gross130: 2888,
      net100: 2221,
    });
    expect(table.eachAdditional).toEqual({
      gross200: 918,
      gross130: 596,
      net100: 459,
    });
  });

  it('throws when the income section is missing', () => {
    expect(() => parseIncomeLimitsTable(incomeDoc('## Something else\n'))).toThrow(
      /missing the/,
    );
  });

  const tableHeader = [
    '## Maximum monthly income limits by household size',
    '',
    '| FNS unit size | 200% limit | 130% limit | 100% limit |',
    '| --- | --- | --- | --- |',
  ];

  it('throws on an unparseable dollar cell', () => {
    const body = [
      ...tableHeader,
      '| 1 | $2,610 | $1,696 | about $1,305 |',
    ].join('\n');
    expect(() => parseIncomeLimitsTable(incomeDoc(body))).toThrow(
      /cannot parse dollar amount/,
    );
  });

  it('throws when the each-additional row is missing', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (size) => `| ${size} | $${size},000 | $${size},000 | $${size} |`,
    );
    // Values are structurally valid but the trailer row is absent.
    const body = [...tableHeader, ...rows].join('\n');
    expect(() => parseIncomeLimitsTable(incomeDoc(body))).toThrow(
      /Each additional member/,
    );
  });

  it('throws when rows do not cover unit sizes 1-8', () => {
    const body = [
      ...tableHeader,
      '| 1 | $2,610 | $1,696 | $1,305 |',
      '| Each additional member | +$918 | +$596 | +$459 |',
    ].join('\n');
    expect(() => parseIncomeLimitsTable(incomeDoc(body))).toThrow(/failed validation/);
  });

  it('throws when a row violates 200% > 130% > 100%', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (size) => `| ${size} | $100 | $200 | $300 |`,
    );
    const body = [
      ...tableHeader,
      ...rows,
      '| Each additional member | +$918 | +$596 | +$459 |',
    ].join('\n');
    expect(() => parseIncomeLimitsTable(incomeDoc(body))).toThrow(
      /200% > 130% > 100%/,
    );
  });
});
