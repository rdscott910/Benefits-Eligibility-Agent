# Decision: trace transparency (glass-box drawer + cost)

**Decision.** Every assistant turn — guardrail short-circuits included —
carries a per-turn glass-box trace the UI renders as a drawer: sanitize
result, classifier verdict + latency, retrieval matches with scores, tool
calls with real I/O, and running conversation cost. The drawer shows only
what the pipeline actually did; a datum it did not produce is not shown.

**Rules (testable).**

- Sanitize is metadata-only: redacted kinds and counts ("redacted:
  ssn ×1"), never a value, never message text.
- Tool I/O is the real Zod-validated input/output, including fact values
  the user themselves stated. PII-rejected turns never reach tools, so
  nothing rejected can appear anywhere in a trace.
- The drawer appears on short-circuit turns too; the message body stays
  exactly the templated response — the drawer is UI chrome.
- Cost = per-turn token counts plus a running session total, and a dollar
  figure labeled an estimate, from pricing constants pinned in
  `server/src/config.ts` with a dated comment. Totals accumulate
  client-side only and vanish on refresh (state-memory.md).
- Server logging policy is unchanged (classifier-design.md): the drawer
  is a client display of the user's own session, not a log.

**Rejected alternatives.** Echoing sanitized message text into the trace
(reopens the PII surface for zero demo value); hiding user-stated values
from tool I/O (false opacity — the user typed them); dollars without
tokens (pricing goes stale; token counts are the durable fact).

**Date.** 2026-07-29, settled with user during Slice 4 planning.
