import { z } from 'zod';
import type { CorpusDocument } from './loader';

/**
 * Parses the income-limits corpus document's markdown table into a typed,
 * Zod-validated table at boot. There are NO hardcoded fallback numbers: if
 * the table cannot be parsed and validated, the caller must refuse to boot
 * (roadmap Slice 2; orientation.md architecture conventions). Slice 3 tools
 * will consume this table; in Slice 2 it exists to fail fast.
 *
 * This is a server-only boot schema, so it lives next to the parser rather
 * than in `shared/` (slice-2 handoff §4).
 */

const monthlyDollarsSchema = z.number().int().positive();

export const incomeLimitRowSchema = z.object({
  unitSize: z.number().int().min(1).max(8),
  /** 200% maximum allowable gross monthly income limit, whole dollars. */
  gross200: monthlyDollarsSchema,
  /** 130% maximum allowable gross monthly income limit, whole dollars. */
  gross130: monthlyDollarsSchema,
  /** 100% maximum allowable net monthly income limit, whole dollars. */
  net100: monthlyDollarsSchema,
});
export type IncomeLimitRow = z.infer<typeof incomeLimitRowSchema>;

export const incomeLimitsTableSchema = z
  .object({
    rows: z.array(incomeLimitRowSchema).length(8),
    /** Added per additional member beyond a unit size of 8. */
    eachAdditional: z.object({
      gross200: monthlyDollarsSchema,
      gross130: monthlyDollarsSchema,
      net100: monthlyDollarsSchema,
    }),
  })
  .refine(
    (table) => table.rows.every((row, index) => row.unitSize === index + 1),
    { error: 'rows must cover unit sizes 1 through 8 in order' },
  )
  .refine(
    (table) =>
      table.rows.every(
        (row) => row.gross200 > row.gross130 && row.gross130 > row.net100,
      ),
    { error: 'each row must satisfy 200% > 130% > 100%' },
  );
export type IncomeLimitsTable = z.infer<typeof incomeLimitsTableSchema>;

const INCOME_SECTION_HEADING = '## Maximum monthly income limits by household size';

function parseDollars(cell: string, context: string): number {
  const match = cell.trim().match(/^\+?\$([\d,]+)$/);
  if (!match || match[1] === undefined) {
    throw new Error(
      `Income-limits table: cannot parse dollar amount "${cell.trim()}" (${context}).`,
    );
  }
  return Number(match[1].replaceAll(',', ''));
}

function tableCells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * Extracts and validates the income-limits table from the income-limits
 * corpus document. Throws (never falls back) on any structural problem.
 */
export function parseIncomeLimitsTable(doc: CorpusDocument): IncomeLimitsTable {
  if (doc.doc_id !== 'income-limits') {
    throw new Error(
      `parseIncomeLimitsTable expects the income-limits document, got "${doc.doc_id}".`,
    );
  }

  const sectionStart = doc.body.indexOf(INCOME_SECTION_HEADING);
  if (sectionStart === -1) {
    throw new Error(
      `Income-limits document is missing the "${INCOME_SECTION_HEADING}" section.`,
    );
  }
  const nextHeading = doc.body.indexOf('\n## ', sectionStart + INCOME_SECTION_HEADING.length);
  const section = doc.body.slice(
    sectionStart,
    nextHeading === -1 ? undefined : nextHeading,
  );

  const tableLines = section
    .split('\n')
    .filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 3) {
    throw new Error('Income-limits table: no markdown table found in the section.');
  }

  const header = tableCells(tableLines[0] ?? '');
  const expectedMarkers = ['unit size', '200%', '130%', '100%'];
  expectedMarkers.forEach((marker, column) => {
    if (!header[column]?.toLowerCase().includes(marker)) {
      throw new Error(
        `Income-limits table: header column ${column + 1} should mention "${marker}", got "${header[column] ?? ''}".`,
      );
    }
  });

  const rows: IncomeLimitRow[] = [];
  let eachAdditional: IncomeLimitsTable['eachAdditional'] | undefined;

  // Skip the header and the |---| separator row.
  for (const line of tableLines.slice(2)) {
    const cells = tableCells(line);
    if (cells.length !== 4) {
      throw new Error(`Income-limits table: row "${line.trim()}" does not have 4 cells.`);
    }
    const [label, gross200Cell, gross130Cell, net100Cell] = cells as [
      string,
      string,
      string,
      string,
    ];

    if (/^\d+$/.test(label)) {
      rows.push({
        unitSize: Number(label),
        gross200: parseDollars(gross200Cell, `unit size ${label}, 200% column`),
        gross130: parseDollars(gross130Cell, `unit size ${label}, 130% column`),
        net100: parseDollars(net100Cell, `unit size ${label}, 100% column`),
      });
      continue;
    }

    if (label.toLowerCase().includes('each additional')) {
      eachAdditional = {
        gross200: parseDollars(gross200Cell, 'each additional, 200% column'),
        gross130: parseDollars(gross130Cell, 'each additional, 130% column'),
        net100: parseDollars(net100Cell, 'each additional, 100% column'),
      };
      continue;
    }

    throw new Error(`Income-limits table: unrecognized row label "${label}".`);
  }

  if (!eachAdditional) {
    throw new Error('Income-limits table: missing the "Each additional member" row.');
  }

  const parsed = incomeLimitsTableSchema.safeParse({ rows, eachAdditional });
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'table'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Income-limits table failed validation: ${problems}`);
  }

  return parsed.data;
}
