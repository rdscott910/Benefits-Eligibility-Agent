# Decision — Public portfolio demo (post-roadmap)

**Status:** settled 2026-08-06  
**Authority:** policy (post-roadmap; does not reopen Slice 0–4)

## Decisions

1. **Hosted public demo** may ship (planned: `demo.dev-ron.com`) for
   portfolio review. Local `npm install && npm run dev` must keep working.
2. **Neutral public branding** in the hosted UI and portfolio copy:
   "NC SNAP Benefits Eligibility Agent". System prompt uses a nameless
   identity. Internal type names and the README title may keep the
   interview case-study name.
3. **Cost/abuse controls** required for public deploy: envelope caps,
   per-IP rate limit on `/api/chat`, graceful provider-quota messaging,
   demo disclaimer. Dedicated OpenAI key + monthly budget is the hard
   backstop (operator, not code).
4. **Production scaffolding is additive** — must not replace the local
   Express + Vite path. No port into the Next.js portfolio monolith
   (`stack-boundaries.md`).

## Non-goals

Naming the interview company in portfolio copy; server-side persistence.
