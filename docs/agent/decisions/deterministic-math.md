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
