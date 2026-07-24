# Decision: state and memory

**Decision.** Conversation state (stated facts: income, household size,
county, etc.) lives in browser memory for the session and is sent with
each request. Facts the user has stated are never re-asked. There is no
persistence beyond the browser session and no server-side storage.

**Rules (testable).**

- After "I make $2,000/month", no later turn asks for monthly income;
  the value is visible in the request state (live-review memory check).
- A user may correct a fact ("actually it's $2,400"); the correction
  replaces the old value and is acknowledged.
- Refreshing the page clears everything — by design, stated in the
  README, not hidden.
- State is Zod-validated on every request; unknown fields are dropped.
- PII rejected by middleware (`pii-handling.md`) never enters state.

**Rejected alternatives.** Server-side sessions or a database — PRD
excludes persistence beyond browser memory; localStorage — benefit data
lingering on shared/library computers is a harm, not a feature.

**Date.** 2026-07-22, recorded from PRD.

**Revision 2026-07-23** (review R5). State is a Zod `CaseFile`: each
fact is `{value, status: stated | needs_confirmation | confirmed,
sourceTurn}`, mutated only by the `updateCaseFile` tool. Math tools
accept only non-guessed values; a contradiction flips the fact to
`needs_confirmation` and triggers exactly one clarifying question.
