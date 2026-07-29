# Handoff: Slice 3 — Deterministic tools + multi-turn state (plan → build → prove)

You are the engineer taking over Slice 3 of the CivicReach NC FNS
Eligibility Agent. You own the full loop: plan it, build it, prove its
gate, and report back. You have no prior conversation context. You do
not need any — everything binding lives in this repository, and this
prompt tells you where. When anything here seems to conflict with a
repo document, the repo document wins; flag the conflict in your report.

## 1. Read first, in this order

1. `AGENTS.md` (repo root) — hard rules, integrity layer, operating
   principles, Learned User Preferences / Workspace Facts. Binding on
   every choice you make.
2. `docs/agent/orientation.md` — authority model, conventions, status
   (Slices 0–2 passed; Slice 3 is next).
3. `docs/agent/source-of-truth.md` — what is REAL today (shell +
   guardrails + grounded RAG; no tools, no CaseFile, no verdicts).
   Trust this over any chat memory that claims tools already exist.
4. `docs/agent/roadmap.md` — **Slice 3 only** is your work order. Later
   slices are context, never license. Slices 0–2 are done; do not
   reopen them.
5. Decisions in force for this slice (read all):
   - `docs/agent/decisions/deterministic-math.md` — all arithmetic in
     Zod-schema tools; tier selected by tool output; never call a tool
     with guessed inputs; the tie-out reproduces the tool result by
     hand from the corpus table.
   - `docs/agent/decisions/state-memory.md` — CaseFile in browser
     memory, sent with each request; facts `{value, status: stated |
     needs_confirmation | confirmed, sourceTurn}`; mutated only by the
     `updateCaseFile` tool; corrections replace; contradictions flip to
     `needs_confirmation` and trigger exactly one clarifying question;
     Zod-validated per request, unknown fields dropped; no persistence.
   - `docs/agent/decisions/verdict-language.md` — now in full force:
     exactly three tiers, mandatory suffix and ePASS/DSS referral,
     banned determination words, and (revision R6) all mandatory
     strings rendered by server/UI from `shared/` constants as
     structured stream parts — the model narrates around them and
     never authors them.
   - `docs/agent/decisions/grounding-policy.md` and
     `docs/agent/decisions/stack-boundaries.md` — still binding; Slice
     2's grounding and no-match behavior must not regress.
   - `docs/agent/decisions/crisis-escalation.md` and
     `docs/agent/decisions/pii-handling.md` — you do not change them,
     but Slice 3 finally makes two of their promises real: facts
     survive a crisis pause (adversarial A2's full check), and PII
     rejected by middleware never enters CaseFile state.
6. Proof steps this slice must make pass (verbatim expectations):
   - `docs/agent/proof/live-review-script.md` **section 2** items 2–5
     — facts acknowledged and stored; threshold figure verbatim from
     the corpus; the **memory check** (item 3); the **math tie-out**
     (item 4); the verdict wording check (item 5). Skip only the
     "visible tool status" display clause in item 2 — that label is
     Slice 4.
   - `live-review-script.md` **section 4** (correction handling) —
     marked Slice 3.
   - `docs/agent/proof/adversarial-script.md` **section G** (both
     items: vague income → one clarifying question, no tool call on a
     guess; contradiction → clarify, use only the confirmed value).
   - Section 3 (no-match) and sections A–F must still pass — you are
     changing the shared proceed path, so you re-prove them.
7. `prompts/slice-intake-template.md` — fill a new packet at
   `prompts/packets/slice-3.md` in Phase 1. Packets for Slices 0–2 are
   `historical`; do not treat them as product truth.
8. The three role prompts you will adopt in sequence:
   `prompts/slice-planner.prompt.md`,
   `prompts/slice-implementer.prompt.md`,
   `prompts/slice-prover.prompt.md`.

Conflict order: current code > source-of-truth/roadmap > decisions,
AGENTS.md, PRD > proof scripts > slice packet > anything historical.
The PRD (`AI-Eligibility-Case-Study-Description.md`, repo root) is the
supreme scope authority.

## 2. State of the world

Product code exists and works. Slices 0, 1, and 2 gates have passed
(Slice 2 on 2026-07-28).

What is already real (see `source-of-truth.md` for evidence citations):

- npm workspaces: `client/`, `server/`, `shared/`; `npm install &&
  npm run dev`; `.env` with `OPENAI_API_KEY`; fail-fast boot.
- Guardrail pipeline before everything: Stage 1 sanitize → Stage 2
  classify (fast-paths + `gpt-5.4-nano`, prompt v3) → templated
  short-circuit or proceed. Short-circuits never touch retrieval or
  the agent. Classifier v3 settled that program-coverage questions
  (`out_of_scope` is topic-level only) proceed to the RAG no-match
  path — do not re-litigate that boundary.
- Grounded RAG on the proceed path (`server/src/agent/respond.ts`):
  the latest sanitized user message is embedded
  (`text-embedding-3-small`), scored against a 34-chunk in-memory
  store built from `server/corpus/` at boot (cache gitignored), and
  only hits ≥ threshold 0.28 (`RETRIEVAL` in `server/src/config.ts`)
  are injected into the system prompt (`server/src/agent/prompt.ts`,
  `AGENT_PROMPT_VERSION` 3).
- Honest no-match: the model must emit the exact sentence "I don't
  have that in my documents." when excerpts cannot answer; the server
  detects it (`server/src/agent/no-match.ts`) and emits a typed
  `no_match` part; the UI renders `REFERRAL_LINE` from
  `shared/src/grounding.ts`. The model never authors the referral.
- Envelope **v2** (`shared/src/envelope.ts`): `data-guardrail` +
  `data-retrieval` parts; request schema is messages-only today.
- The income-limits table is parsed at boot into a Zod-validated typed
  table (`server/src/corpus/income-table.ts`, `IncomeLimitsTable`:
  rows 1–8 with `gross200`/`gross130`/`net100`, plus `eachAdditional`)
  and the server refuses to boot if parsing fails. **Nothing consumes
  it yet — your tools are its first consumer.**
- The chat route is a factory (`createChatRouter(store)` in
  `server/src/routes/chat.ts`) wired in `server/src/index.ts` after
  the corpus/store boot.
- Eval harness: `npm run eval` runs offline tests + live adversarial
  A–F + grounding R1–R4 and prints the README report
  (`server/src/eval/report.ts`). The `G` title prefix is already
  reserved for your section-G cases; `R` is grounding.
- Agent system prompt v3 currently **forbids** arithmetic, comparisons,
  and any qualification verdict (rules 5–6). That was correct for
  Slice 2 and is exactly what you now revise: the model still never
  computes — it calls your tools and narrates their results.

What is explicitly **not** built yet (honest gaps):

- No `server/tools/`, no math tools, no tool calls of any kind in
  `streamText`.
- No CaseFile: nothing extracts or stores facts; retrieval embeds only
  the latest user message; stated facts are re-asked today.
- No verdict tiers, no structured verdict part, no verdict rendering.
- No tool-status streaming, no glass-box drawer, no clickable citation
  chips, no GFM table rendering (agent prompt avoids pipe tables).

## 3. Mission and gate

Build exactly the Slice 3 in-scope list from `roadmap.md`:

- Zod tools for the income-threshold check and household size,
  consuming the corpus-parsed `IncomeLimitsTable` — never hardcoded
  numbers, never model math.
- `CaseFile` state with per-fact provenance, mutated only via the
  `updateCaseFile` tool (`state-memory.md` R5): facts carry
  `{value, status, sourceTurn}`; corrections replace and are
  acknowledged; contradictions flip to `needs_confirmation` and cost
  exactly one clarifying question; math tools accept only non-guessed
  (stated/confirmed) values.
- CaseFile lives in browser memory and travels with each request:
  extend the request envelope, Zod-validated, unknown fields dropped;
  PII-rejected messages never reach state (already enforced upstream —
  keep it that way).
- Verdict emitted as a structured stream part and rendered from
  `shared/` constants (tier phrase + "based on the current published
  limits — only NC DSS can determine eligibility" suffix + ePASS/DSS
  referral). The model narrates around the verdict; it never authors
  tier text, suffix, or referral.
- Bump the envelope intentionally (v2 → v3) for the new parts and the
  request-side CaseFile; both sides import from `shared/`.
- Never re-ask a stated fact — including after a crisis pause
  (adversarial A2's "income still remembered" is now fully checkable).

Gate, verbatim: "the live-review script's math tie-out passes and the
'I make $2,000/month' memory check passes."

Proven primarily by `live-review-script.md` §2 items 2–5 and §4, plus
adversarial §G — with §3 and A–F re-proven green. The gate — not
effort, not time spent — decides done.

## 4. Non-negotiables

- Integrity layer wins every conflict: all arithmetic in deterministic
  Zod tools; the model never computes, estimates, rounds, or compares;
  tier selection comes from tool output, never model judgment;
  likelihood language only — "eligible", "approved", "guaranteed",
  "will receive" never appear in a verdict; guardrails still run
  before everything; stated facts are never re-asked.
- Missing tool inputs are asked for (once), never guessed. A tool is
  never called with a `needs_confirmation` value.
- Slice 2 must not regress: grounding, citations, the no-match
  sentence + referral mechanism, and the 0.28 threshold stay intact.
  Benefit figures in verdict narration must still appear verbatim in
  `server/corpus/` (the tie-out and §2.2 check this; your tools read
  the parsed table, which comes from the same document — keep it that
  way).
- `decisions/deterministic-math.md` says tools live in `server/tools/`,
  one file per tool, schemas colocated. The server's `tsconfig.json`
  typechecks `include: ["src"]` only — if you place tools at
  `server/src/tools/` to fit the build, record a dated
  path-clarification note in that decision doc (never diverge
  silently).
- Zod at every new boundary: tool I/O, CaseFile facts, request
  envelope, verdict part, CaseFile-update part. Cross-boundary schemas
  and every mandatory string live in `shared/` — defined once,
  imported by both sides.
- State is session-only browser memory: no server-side storage, no
  localStorage, refresh clears everything (README says so honestly).
- Model/config pins stay in `server/src/config.ts`. New prompt versions
  bump `AGENT_PROMPT_VERSION` / `CLASSIFIER_PROMPT_VERSION` (only if
  you must touch the classifier — you should not need to).
- Code rules: imports at the top of the module only, never inline;
  exhaustive `switch` over unions/enums with a `never` default case.
- Every new runtime dependency gets a one-line justification in your
  report; expect zero — the AI SDK already does tool calling
  (`streamText` `tools:` + Zod schemas + `stopWhen`/step control).
- Do not commit or push unless the user explicitly asks.
- Do **not** add deliberate failure-demo beats or near-threshold
  verdict behavior unless the user reopens that decision (`AGENTS.md`
  Learned User Preferences).

## 5. Explicitly out of scope (do not build, stub, or "prepare")

- Tool-status streaming display ("Checking NC FNS income limits…"),
  glass-box trace drawer, clickable citation chips, "What I know so
  far" panel polish, markdown/GFM rendering, README tradeoffs section
  refresh (all Slice 4). Emit the typed parts your slice needs;
  leave display polish minimal and honest, like Slice 2's chips.
- Deduction / net-income calculators, utility-allowance math, benefit
  amount estimation. The roadmap scopes exactly two tools:
  income-threshold check and household size. "All arithmetic in tools"
  governs the arithmetic you ship, not an invitation to ship more.
- Changing guardrail precedence, templates, crisis resources, PII
  policy, or the classifier v3 boundary.
- Corpus changes or a seventh document; retrieval/threshold retuning
  beyond what regression-proving requires.
- External persistence of any kind.

An honest "I still need your household size" beats a verdict computed
from a guess.

## 6. Forks vs. free choices

- FORK — stop and escalate (settle as a decision doc before code
  decides): **the tier-mapping rule.** No decision doc yet maps table
  columns to the three tiers — e.g. gross ≤ 130% limit → "you likely
  qualify"; ≤ 200% → "you may qualify"; > 200% → "you likely do not
  qualify" is a plausible default, but which columns, and how
  categorical eligibility is worded, is product semantics. Present a
  recommendation, get it settled, record it (dated revision in
  `deterministic-math.md` or a new short decision doc) — then build.
  Also forks: adding fact kinds beyond income / household size /
  county (`state-memory.md` names those three); any change to
  mandatory verdict strings; any new user-visible refusal wording.
- FREE CHOICE — yours, record it: CaseFile Zod schema shape and the
  `data-casefile` part payload; how `updateCaseFile` is exposed to the
  model (it must be the only mutation path); verdict part payload
  design; whether retrieval queries are enriched with CaseFile facts
  (nice, not required — don't gold-plate); how the client displays
  acknowledged facts (minimal, honest); tool file layout under the
  (clarified) tools directory; eval-case wiring for G1/G2 (the
  `grounding`/`G` report buckets exist in
  `server/src/eval/report.ts`).

Likely trap to watch: the memory check ("what was that income limit
again?") must be answered from corpus-grounded content without
re-asking facts — CaseFile gives you the household size, the parsed
table/corpus gives you the figure. If you find yourself hardcoding a
number or letting the model recall one from prior turns unverified,
stop and re-read `grounding-policy.md`.

## 7. Workflow

- Phase 1 — Plan (adopt `slice-planner.prompt.md`): fill
  `prompts/packets/slice-3.md` from the intake template; produce an
  ordered list of small verifiable tasks ending with the gate run.
  Zero open forks before Phase 2 — the tier-mapping fork above must be
  settled with the user during planning.
- Phase 2 — Implement (adopt `slice-implementer.prompt.md`): build only
  the packet scope. Guardrails and `npm run dev` keep working after
  every step. Integrate tools into the existing
  `respondGrounded` flow in `server/src/agent/respond.ts` (or a clean
  evolution of it) — after `runGuardrailPipeline` returns `proceed`,
  never bypassing the pipeline, never invoking tools from guardrail
  paths. Revise agent prompt rules 5–6 to delegate math to tools;
  bump `AGENT_PROMPT_VERSION`.
- Phase 3 — Prove (adopt `slice-prover.prompt.md`): fresh state,
  README as setup instructions. Execute §2 items 2–5 (skipping only
  the Slice 4 tool-status display clause), §4, and adversarial §G
  exactly as written; reproduce the math tie-out by hand from
  `server/corpus/income-limits.md` (household of 3: $4,442 at 200%,
  $2,888 at 130%, $2,221 net — against $2,000/month). Re-run
  `npm run eval` in full: A–F and R1–R4 must stay green with your G
  cases added. Record Do / Expected / Observed per step.

Close the loop in the same session — not later:

- Update `docs/agent/source-of-truth.md`: one claim per new behavior,
  each citing file path(s) and the proof step that exercised it.
  Rewrite or remove the falsified non-capability entries (no tools /
  no CaseFile / no verdicts, re-asking facts, A2 deflection-only).
- Update the Current status section of `docs/agent/orientation.md`.
- Roadmap: the single sanctioned edit is the Slice 3 heading's status
  marker (NOT STARTED → gate outcome, dated). Definitions, scopes, and
  gates stay untouched.
- README: capability table rows for tools / memory / verdicts, the
  how-a-message-travels section, envelope version note, refreshed eval
  report (model + prompt versions). No claiming Slice 4 transparency
  features.
- Check every box of the packet's done-when honestly. If
  implementation must diverge from a decision doc: dated revision note
  in that doc, or a Known Policy Exception in `orientation.md` — same
  session, never silent.

## 8. Report back, in this shape

Gate verdict (PASS/FAIL); evidence per proof step (Do / Expected /
Observed), including the hand math of the tie-out; tree of files
created/modified; the settled tier-mapping rule and where it is
recorded; CaseFile schema summary; envelope version bump note; agent
prompt version; dependencies added (each with one-line justification —
expect none); free choices made; forks hit (and how settled);
source-of-truth entries added/removed; exceptions recorded (expect
none); confirmation that adversarial A–F and grounding R1–R4 still
pass.

## 9. Hard stop

Slice 3 ends at its gate verdict. Do not start Slice 4, do not build
tool-status UI, trace drawers, or chip polish, do not "improve"
guardrails or the corpus. If the gate fails, report the shortest list
of blocking items — never widen scope to compensate.
