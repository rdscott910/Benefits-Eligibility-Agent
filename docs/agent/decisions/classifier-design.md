# Decision: classifier design

**Decision.** The guardrail classifier is hybrid. Deterministic
fast-paths run first (an SSN regex is definitive; short high-precision
crisis and injection phrase lists short-circuit immediately). Everything
else goes to a small, fast model via `generateText` + `Output.object`
(AI SDK v7; same constrained-schema role as the formerly named
`generateObject`), constrained to the Zod verdict enum, with the user
message passed as delimited data — never as instructions. Classifier and
agent models are pinned separately in one config module.

**Rules (testable).**

- Classifier failure or timeout fails closed: a safe "please try again"
  refusal streams back; unclassified input never reaches the agent.
- `out_of_scope` is topic-level only ("not about food assistance at
  all"). On-topic but out-of-corpus questions classify `proceed` and
  take the RAG no-match path (`grounding-policy.md`).
- The classifier prompt contains no benefit knowledge; it only labels.
- Logging: structured logs carry verdicts, timings, and token counts —
  never raw message content. Anything log-bound passes through the
  Stage 1 sanitizer first (`guardrail-precedence.md`).

**Rejected alternatives.** Pure regex/keywords — brittle on paraphrase
("I want to disappear"); LLM-only — no deterministic floor for the
definitive cases; fail-open on classifier error — unclassified input
reaching the agent breaks the integrity layer.

**Date.** 2026-07-23 (R3, R10). **Revision 2026-07-25:** v7
`Output.object` + injection fast-path for injection+PII; policy unchanged.
