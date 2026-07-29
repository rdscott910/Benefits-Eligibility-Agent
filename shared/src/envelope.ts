import { z } from 'zod';
import type { UIMessage } from 'ai';
import {
  guardrailPartDataSchema,
  type GuardrailPartData,
} from './guardrails';
import type { RetrievalPartData } from './grounding';
import { caseFileSchema, type CaseFilePartData } from './casefile';
import type { VerdictPartData } from './verdict';
import type { TracePartData } from './trace';
import type { CivicReachUITools } from './tools';

/**
 * Envelope v4 — Slice 0 wire contract plus typed guardrail short-circuit
 * parts (v1), typed retrieval/citation parts (v2, Slice 2), the
 * CaseFile/verdict contract (v3, Slice 3), and the transparency contract
 * (v4, Slice 4): every turn carries a `data-trace` part, citations carry
 * the exact chunk content, and tool invocations are typed `tool-<name>`
 * parts the client renders as status labels and drawer I/O. Both the
 * client and the server import these schemas from here so the two sides
 * cannot drift.
 */
export const ENVELOPE_VERSION = 4;

export const chatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type ChatTextPart = z.infer<typeof chatTextPartSchema>;

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: chatRoleSchema,
  parts: z.array(chatTextPartSchema).min(1),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  envelopeVersion: z.literal(ENVELOPE_VERSION),
  messages: z.array(chatMessageSchema).min(1),
  /**
   * Session CaseFile from browser memory (v3). Optional so a fresh session
   * needs no state; unknown fields are dropped by Zod object stripping.
   */
  caseFile: caseFileSchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Custom stream parts the server may emit alongside model text.
 * v1: guardrail short-circuit verdicts (non-proceed only).
 * v2: retrieval outcome for proceed-path answers (citations / no-match).
 * v3: post-turn CaseFile state; structured likelihood verdict (tool-derived).
 * v4: per-turn glass-box trace, emitted on every response path.
 */
export type CivicReachDataParts = {
  guardrail: GuardrailPartData;
  retrieval: RetrievalPartData;
  casefile: CaseFilePartData;
  verdict: VerdictPartData;
  trace: TracePartData;
};

/**
 * The streamed response envelope with typed custom data parts and typed
 * tool parts (v4): tool invocations arrive as `tool-<name>` parts whose
 * input/output follow the shared tool I/O schemas.
 */
export type CivicReachUIMessage = UIMessage<
  never,
  CivicReachDataParts,
  CivicReachUITools
>;

export const apiErrorCodeSchema = z.enum(['invalid_request', 'internal_error']);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Shape of any non-streamed failure response, so the client never parses guesswork. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export { guardrailPartDataSchema };
