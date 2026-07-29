import { z } from 'zod';

/**
 * Grounding contracts for Slice 2 (decisions/grounding-policy.md).
 *
 * The no-match sentence and the referral are mandatory language: the model is
 * instructed to emit NO_MATCH_SENTENCE verbatim when the retrieved excerpts
 * cannot answer, the server detects it, and the UI renders REFERRAL_LINE from
 * this constant — the model never authors the referral (verdict-language.md,
 * revision R6). Settled with user 2026-07-28.
 */
export const NO_MATCH_SENTENCE = "I don't have that in my documents.";

/** Official referral for refusals and no-match answers (verdict-language.md). */
export const REFERRAL_LINE =
  'To apply or get an official decision, use ePASS at epass.nc.gov or contact your local county DSS office.';

/**
 * One retrieved corpus chunk surfaced as a citation on a grounded answer.
 * Since Slice 4 the citation carries the exact chunk content, so the UI's
 * clickable chips can reveal the chunk and its score without another
 * round-trip (grounding-policy.md, 2026-07-23 revision).
 */
export const citationSchema = z.object({
  /** Stable chunk id, e.g. "income-limits#1". */
  citationId: z.string().min(1),
  /** Corpus document id from front matter, e.g. "income-limits". */
  docId: z.string().min(1),
  /** Document title from front matter. */
  title: z.string().min(1),
  /** Section heading of the chunk (document title for the preamble chunk). */
  heading: z.string().min(1),
  /** The exact chunk markdown as retrieved — what the model was shown. */
  text: z.string().min(1),
  /** Cosine similarity of the chunk against the user's message. */
  score: z.number().min(-1).max(1),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * Payload on the `data-retrieval` stream part, emitted once per proceed-path
 * answer after the model text finishes:
 *
 * - `grounded`     — excerpts above the similarity threshold were provided and
 *                    the answer draws on them; citations listed.
 * - `no_match`     — the model declared it cannot answer from the documents
 *                    (exact NO_MATCH_SENTENCE detected). The UI must render
 *                    REFERRAL_LINE with the message.
 * - `conversational` — no excerpt cleared the threshold and the model did not
 *                    declare no-match (greetings, acknowledgements); nothing
 *                    benefit-related was allowed in the reply.
 */
export const retrievalPartDataSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('grounded'),
    citations: z.array(citationSchema).min(1),
  }),
  z.object({
    status: z.literal('no_match'),
    /** Best cosine score seen this turn, if any chunk was scored. */
    bestScore: z.number().min(-1).max(1).nullable(),
    /** The similarity threshold in force when the turn was answered. */
    threshold: z.number(),
  }),
  z.object({
    status: z.literal('conversational'),
  }),
]);
export type RetrievalPartData = z.infer<typeof retrievalPartDataSchema>;
