import { requireEnv } from './config';
import { createReadyApp } from './app';

/**
 * Vercel Fluid/serverless entry. Top-level await builds grounding once per
 * warm instance; the baked embeddings cache keeps that near-instant.
 * Failures throw (never process.exit) so the platform can surface them.
 */
requireEnv();

const app = await createReadyApp();

export default app;
