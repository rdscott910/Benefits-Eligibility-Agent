# Decision: out-of-scope tradeoffs (defended, not gaps)

**Decision.** Four capabilities are deliberately excluded and defended as
tradeoffs in the README and live review: external databases; real agency
submissions or live-government scraping; voice; auth or persistence
beyond browser memory.

**Rules (testable).**

- External databases: the corpus is six files; an in-memory store loads
  in milliseconds and keeps setup at `npm install && npm run dev`.
- Agency submissions / live scraping: the PRD forbids it outright; the
  agent estimates likelihood and refers to ePASS. Submitting on a user's
  behalf or scraping live sites adds legal and correctness risk this
  proof-of-concept must not carry.
- Voice: text-first serves the messy-input use case; voice adds ASR
  error modes on top of an already safety-critical pipeline.
- Auth/persistence: no accounts means no benefit data at rest; privacy
  is the feature (`state-memory.md`).
- Re-admitting any of these requires a dated roadmap scope-revision
  entry; the README tradeoffs section must state all four with rationale.

**Rejected alternatives.** Treating these as "future work" without
rationale — the live review explicitly evaluates defended tradeoffs.

**Date.** 2026-07-22, recorded from PRD.
