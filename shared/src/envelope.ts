import { z } from 'zod';
import type { UIMessage } from 'ai';
import {
  guardrailPartDataSchema,
  type GuardrailPartData,
} from './guardrails';
import type { RetrievalPartData } from './grounding';

/**
 * Envelope v2 — Slice 0 wire contract plus typed guardrail short-circuit
 * parts (v1) plus typed retrieval/citation parts (v2, Slice 2). Both the
 * client and the server import these schemas from here so the two sides
 * cannot drift.
 */
export const ENVELOPE_VERSION = 2;

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
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Custom stream parts the server may emit alongside model text.
 * v1: guardrail short-circuit verdicts (non-proceed only).
 * v2: retrieval outcome for proceed-path answers (citations / no-match).
 */
export type CivicReachDataParts = {
  guardrail: GuardrailPartData;
  retrieval: RetrievalPartData;
};

/** The streamed response envelope with typed custom data parts. */
export type CivicReachUIMessage = UIMessage<never, CivicReachDataParts>;

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
