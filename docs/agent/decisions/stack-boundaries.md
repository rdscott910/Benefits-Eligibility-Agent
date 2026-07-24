# Decision: stack and boundaries

**Decision.** Frontend: React + Vite in `client/`, markdown chat
rendering, visible streaming and tool states. Backend: Node.js + Express
+ TypeScript in `server/`. Model layer: Vercel AI SDK with
`@ai-sdk/openai`. Zod at every boundary. In-memory vector store built
from `server/corpus/` at startup.

**Rules (testable).**

- `npm install && npm run dev` from the repo root is the entire setup
  (plus an `OPENAI_API_KEY` in `.env`, documented in the README).
- Every Express boundary — request bodies, middleware verdicts, tool
  I/O, streamed events — has a Zod schema; no `any` crossing a boundary.
- No new runtime dependency without a one-line justification in the PR
  or slice notes; the dependency list stays demo-explainable.
- The vector store rebuilds from markdown at startup; no store files are
  committed.

**Rejected alternatives.** Next.js monolith (hides the middleware-first
architecture the review is meant to inspect); external vector DB
(excluded by PRD; setup friction breaks the 2-minute rule).

**Date.** 2026-07-22, recorded from PRD.

**Revision 2026-07-23** (review R1). The repo is npm workspaces:
`client/`, `server/`, `shared/`. `shared/` owns every cross-boundary
Zod schema and all mandatory-language constants — defined once,
imported by both sides, never duplicated.
