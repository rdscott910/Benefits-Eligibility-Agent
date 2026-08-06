import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '@civicreach/shared';

/**
 * In-memory sliding-window rate limit for the public demo
 * (`decisions/portfolio-demo.md`). Approximate under serverless instance
 * reuse — the OpenAI monthly budget is the hard backstop.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

export function rateLimitChat(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = clientKey(req);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter(
    (stamp) => now - stamp < WINDOW_MS,
  );

  if (bucket.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const body: ApiError = {
      error: {
        code: 'rate_limited',
        message:
          'Too many requests from this network. Wait a minute, then try again — or refresh later.',
      },
    };
    res.status(429).json(body);
    return;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  next();
}
