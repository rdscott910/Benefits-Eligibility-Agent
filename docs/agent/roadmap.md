# Roadmap — gated slices

One slice at a time. The next slice starts only when the current gate
passes (verified via the proof scripts, recorded in `source-of-truth.md`).
Gates, not time spent, decide when a slice is done: never cut scope or
change a decision because of time. The PRD is the supreme scope
authority — see the scope-revision log rules at the bottom.

## Slice 0 — Skeleton and honest shell — GATE PASSED 2026-07-24

- Intent: a reviewer can clone, install, and talk to a streaming model in
  under 2 minutes.
- In scope: npm workspaces scaffold (`client/`, `server/`, `shared/`);
  Vite + Express + AI SDK wiring; envelope schema v0 in `shared/`; chat
  UI streams a plain model reply; README with exact run steps; root
  `dev` script so `npm install && npm run dev` is the entire setup.
- Out of scope: guardrails, RAG, tools, state, any FNS content.
- Gate: fresh clone runs in under 2 minutes and streams a reply.

## Slice 1 — Guardrail middleware — GATE PASSED 2026-07-25

- Intent: safety owns the front door before any capability is added.
- In scope: Stage 1 sanitize (deterministic PII redaction) then Stage 2
  pre-flight classification (crisis / injection / out-of-scope / PII)
  with Zod-typed verdicts, ordered per
  `decisions/guardrail-precedence.md`, mechanism and fail-closed policy
  per `decisions/classifier-design.md`, running BEFORE the agent loop;
  templated short-circuit responses from `shared/` constants streamed in
  the single envelope; approved responses per
  `decisions/crisis-escalation.md` and `decisions/pii-handling.md`;
  vitest adversarial suite mirroring the attack script, its results
  recorded as a README eval report (pass/fail per attack class, model
  and prompt version); logging policy (verdicts and timings only, never
  message content).
- Out of scope: RAG, tools, multi-turn memory.
- Gate: all four attack classes in `proof/adversarial-script.md` are
  deflected with the approved responses.

## Slice 2 — Grounded RAG — GATE PASSED 2026-07-28

- Intent: every benefit fact in an answer traces to the curated corpus.
- In scope: the six corpus documents (`decisions/corpus-scope.md`) as
  dated markdown with citation ids; chunking into the in-memory store;
  cosine retrieval with an explicit similarity threshold (below-bar
  matches take the no-match path); embeddings cached (gitignored, keyed
  by corpus content hash); the income-limits table parsed at boot into a
  Zod-validated typed table, fail-fast if unparseable; grounded
  answering with citation ids; the honest no-match path with official
  referral (`decisions/grounding-policy.md`).
- Out of scope: math tools, verdict rendering, conversation memory.
- Gate: every benefit figure in an answer appears in a corpus document,
  and an out-of-corpus question gets "I don't have that in my documents"
  plus the official referral.

## Slice 3 — Deterministic tools + multi-turn state — GATE PASSED 2026-07-29

- Intent: tool results, not model math, drive the likelihood verdict, and
  stated facts are never re-asked.
- In scope: Zod tools for income-threshold check and household size,
  consuming the corpus-parsed table; `CaseFile` state with per-fact
  provenance via the `updateCaseFile` tool per
  `decisions/state-memory.md`; verdict emitted as a structured part
  rendered from `shared/` constants per `decisions/verdict-language.md`.
- Out of scope: UI polish, tool-status streaming display.
- Gate: the live-review script's math tie-out passes and the
  "I make $2,000/month" memory check passes.

## Slice 4 — Transparency UX + proof hardening — NOT STARTED

- Intent: the live review passes end to end on a fresh clone.
- In scope: streaming tool status ("Checking NC FNS income limits…"),
  the "What I know so far" CaseFile panel polish, per-turn glass-box
  trace drawer (sanitize result, classifier verdict + latency, retrieval
  matches with scores, tool calls with I/O, running conversation cost),
  clickable citation chips (exact corpus chunk + score), markdown
  rendering polish, README tradeoffs section and refreshed eval report,
  full run of both proof scripts, contradiction review (README / UI /
  middleware / agent / demo script all tell the same story).
- Out of scope: any new capability.
- Gate: `proof/live-review-script.md` passes end to end on a fresh clone.

## Scope-revision log

Rules: PRD must-haves may be cut, and out-of-scope items admitted, only
via a dated entry here stating what changed, why, and what was given up.
Silent scope drift is a defect.

- 2026-07-22: Hour estimates and time-budget tracking removed from the
  harness at the project owner's direction. Slices are bounded by their
  gates and scope lists only. Agents must never cut functionality or
  reopen a settled decision on time grounds; nothing else changed.
