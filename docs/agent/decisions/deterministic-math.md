# Decision: deterministic math

**Decision.** All arithmetic — income threshold comparisons, household
size effects, deduction math — runs in deterministic TypeScript tools
with Zod input/output schemas. The model never computes, estimates,
rounds, or compares numbers itself; it narrates tool results.

**Rules (testable).**

- Tools live in `server/tools/`, one file per tool, schemas colocated;
  threshold constants are read from the corpus-derived data, not
  hardcoded into prompts.
- The likelihood tier (`verdict-language.md`) is selected by tool output,
  not by model judgment.
- If required inputs are missing, the tool is not called with guesses —
  the agent asks for the missing fact (once; see `state-memory.md`).
- The live-review math tie-out reproduces the tool result by hand from
  the corpus income-limits table.

**Rejected alternatives.** Model-side arithmetic with a checking tool —
still lets a wrong number stream to the user first; LLM-generated code
execution — needless execution surface with no correctness gain over
fixed, reviewable tools.

**Date.** 2026-07-22, recorded from PRD.

**Revision 2026-07-29** (Slice 3 planning; tier mapping settled with
user 2026-07-28). The income-threshold tool selects the tier by
comparing gross monthly income against the corpus-parsed limits row for
the FNS unit size:

- gross ≤ 130% limit → "you likely qualify"
- 130% limit < gross ≤ 200% limit → "you may qualify" — the narration
  explains, from corpus excerpts, that the county DSS determines which
  limit applies to a household (categorical eligibility)
- gross > 200% limit → "you likely do not qualify"

Boundaries are inclusive: income equal to a "maximum allowable" limit
counts as within it. Only the gross columns select tiers — net income is
unknowable without deduction math, which is out of scope (roadmap
Slice 3). Unit sizes above 8 extend the row deterministically inside the
tool using the table's "each additional member" increments. Rejected:
a 200%-only mapping (leaves a tier unreachable and ignores the corpus's
own two-limit framing).

Path clarification, same date: tools live at `server/src/tools/` — the
server typechecks `include: ["src"]` only, so a sibling `server/tools/`
would sit outside the build. The layout rule is otherwise unchanged: one
file per tool, Zod schemas colocated.

**Revision 2026-07-29 (Slice 4, schema location).** The trace drawer
renders real tool inputs/outputs in the client, which makes tool I/O a
cross-boundary contract — so the I/O Zod schemas moved to
`shared/src/tools.ts` (stack-boundaries R1: defined once, imported by
both sides). Executors and the `tool()` wiring stay one-file-per-tool in
`server/src/tools/`; tool behavior is unchanged.
