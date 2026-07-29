# Handoff: Slice 2 — Grounded RAG (plan → build → prove)

You are the engineer taking over Slice 2 of the CivicReach NC FNS
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
   (Slice 1 passed; Slice 2 is next).
3. `docs/agent/source-of-truth.md` — what is REAL today (shell +
   guardrails only; no corpus, no retrieval). Trust this over any chat
   memory that claims RAG already exists.
4. `docs/agent/roadmap.md` — **Slice 2 only** is your work order. Later
   slices are context, never license. Slice 0 and Slice 1 are done;
   do not reopen them.
5. Decisions in force for this slice (read all):
   - `docs/agent/decisions/corpus-scope.md` — exactly six documents;
     front matter rules; no live fetching.
   - `docs/agent/decisions/grounding-policy.md` — no parametric benefit
     knowledge; similarity threshold; no-match wording + referral;
     citation ids on grounded answers.
   - `docs/agent/decisions/stack-boundaries.md` — in-memory store,
     embeddings not committed, dependency policy, 2-minute setup.
   - `docs/agent/decisions/verdict-language.md` — ONLY the no-match /
     refusal referral rule and the ban on determination language apply
     now. You are **not** building the three likelihood tiers or the
     structured verdict part (Slice 3).
6. Proof steps this slice must make pass (verbatim expectations):
   - `docs/agent/proof/live-review-script.md` **section 3** (both
     no-match items).
   - From section 2, only what Slice 2 can prove without tools/memory:
     a grounded NC FNS answer whose benefit figures appear verbatim in
     `server/corpus/`, and no numbers cited without retrieval. Do **not**
     claim the memory check, math tie-out, tool-status streaming, or
     structured verdict wording — those are Slice 3 / 4.
7. `prompts/slice-intake-template.md` — fill a new packet at
   `prompts/packets/slice-2.md` in Phase 1. Packets for Slice 0 and
   Slice 1 are `historical`; do not treat them as product truth.
8. The three role prompts you will adopt in sequence:
   `prompts/slice-planner.prompt.md`,
   `prompts/slice-implementer.prompt.md`,
   `prompts/slice-prover.prompt.md`.

Conflict order: current code > source-of-truth/roadmap > decisions,
AGENTS.md, PRD > proof scripts > slice packet > anything historical.
The PRD (`AI-Eligibility-Case-Study-Description.md`, repo root) is the
supreme scope authority.

## 2. State of the world

Product code exists and works. Slice 0 and Slice 1 gates have passed.

What is already real (see `source-of-truth.md` for evidence citations):

- npm workspaces: `client/`, `server/`, `shared/`.
- `npm install && npm run dev` from repo root; `.env` with
  `OPENAI_API_KEY`; missing key fails at startup with a clear message.
- Envelope **v1** in `shared/src/envelope.ts` with `data-guardrail` parts.
- Guardrail pipeline before the agent: Stage 1 sanitize → Stage 2
  classify (crisis/injection fast-paths + `gpt-5.4-nano`) → templated
  short-circuit or proceed. Wired in `server/src/middleware/` and
  `server/src/routes/chat.ts` via `runGuardrailPipeline`.
- UI renders guardrail badges; PII-rejected user messages are dropped
  from client history.
- Models pinned in `server/src/config.ts`: `MODELS.agent` =
  `gpt-5.6-terra`, `MODELS.classifier` = `gpt-5.4-nano`.
- Adversarial eval: `npm run eval` / `npm test`.

What is explicitly **not** built yet (honest gaps):

- No `server/corpus/`, no vector store, no embeddings cache.
- Proceed path still calls `streamText` with messages only — no system
  prompt with grounding rules, no retrieval, no citation parts.
- No math tools, no CaseFile / multi-turn fact memory, no structured
  likelihood verdict part, no tool-status streaming, no glass-box drawer.

Slice 2 is marked **NOT STARTED** on the roadmap; you start it. Do not
re-litigate Slice 0/1 or "improve" guardrails unless a regression blocks
the Slice 2 gate.

## 3. Mission and gate

Build exactly the Slice 2 in-scope list from `roadmap.md`:

- The six corpus documents (`corpus-scope.md`) as dated markdown in
  `server/corpus/` with citation ids and front matter (source URL +
  snapshot date).
- Chunking into an in-memory vector store built at startup.
- Cosine retrieval with an **explicit** similarity threshold; below-bar
  best matches take the no-match path (never a weak-evidence answer).
- Embeddings cached (gitignored), keyed by corpus content hash; no
  store files committed; no network fetch of corpus at answer time.
- Income-limits table **parsed at boot** into a Zod-validated typed
  table; if parsing fails the server **refuses to boot** — no hardcoded
  fallback numbers. (Tools that *consume* the table are Slice 3; the
  parse-and-fail-fast table itself is Slice 2.)
- Grounded answering with citation ids (stream/UI must surface them
  enough to prove figures come from corpus; polished clickable chips
  with exact chunk + score UI is Slice 4 — ship the ids/parts now,
  not the glass-box polish).
- Honest no-match path: "I don't have that in my documents" (or close
  paraphrase) plus the official ePASS / local DSS referral from
  `shared/` constants (`grounding-policy.md`, `verdict-language.md`).
- Agent system prompt that forbids parametric SNAP/FNS knowledge and
  requires grounding / no-match behavior.

Gate, verbatim: "every benefit figure in an answer appears in a corpus
document, and an out-of-corpus question gets 'I don't have that in my
documents' plus the official referral."

Proven primarily by `live-review-script.md` section 3 (both items) and
a grounded in-corpus figure check. The gate — not effort, not time
spent — decides done.

## 4. Non-negotiables

- Integrity layer wins every conflict: no parametric benefit knowledge;
  no model-invented thresholds or rules; guardrails still run before
  the agent; likelihood language only (no "approved" / "eligible" as
  determination); do not build CaseFile memory in this slice.
- Guardrail short-circuits must still never invoke retrieval or the
  agent. Wiring retrieval only on the `proceed` path.
- `npm install && npm run dev` remains the entire setup. Embedding
  cache may be built on first boot (document that in README); do not
  add external vector DBs, new services, or auth. Cache files stay
  gitignored.
- Zod at every new boundary (corpus front matter / chunk records,
  retrieved-hit schema, income-limits table, any new envelope parts).
  Schemas live in `shared/` when crossed by client+server; server-only
  boot schemas may live next to the parser — do not duplicate.
- Bump or extend the stream envelope when you add citation / no-match
  parts (today `ENVELOPE_VERSION` is `1`). Version intentionally; both
  sides import from `shared/`.
- Pin any embedding model id next to the existing agent/classifier pins
  in `server/src/config.ts`. Comment the choice; flag it in your report
  for user confirmation.
- Code rules: imports at the top of the module only, never inline;
  exhaustive `switch` over unions/enums with a `never` default case.
- Every new runtime dependency gets a one-line justification in your
  report. The dependency list stays demo-explainable.
- Do not commit or push unless the user explicitly asks.
- Do **not** add deliberate failure-demo beats or near-threshold verdict
  behavior unless the user reopens that decision (`AGENTS.md` Learned
  User Preferences).

## 5. Explicitly out of scope (do not build, stub, or "prepare")

- Deterministic eligibility math tools and tool-status streaming
  (Slice 3 / 4).
- `CaseFile` / `updateCaseFile` / multi-turn fact memory (Slice 3).
- Structured three-tier likelihood verdict part (Slice 3).
- Glass-box trace drawer, polished clickable citation chip UX beyond
  what the gate needs, README tradeoffs section refresh for Slice 4
  (Slice 4).
- Changing guardrail precedence, crisis resources, or PII policy.
- A seventh corpus document (requires roadmap scope-revision log +
  dated note in `corpus-scope.md`).
- External databases, live government scraping, agency submission.

An honest grounded answerer without tools beats a half-built eligibility
calculator.

## 6. Forks vs. free choices

- FORK — stop and escalate: anything that changes product semantics
  (no-match wording beyond settled paraphrase, referral strings,
  which six documents / their substantive content policy, similarity
  threshold as a user-visible behavior change after settlement,
  envelope semantics that alter guardrail contracts, verdict tier
  language). Record under "Open questions / forks hit" in the packet
  and STOP. Never let the first code written settle a decision.
- FREE CHOICE — yours, record it: chunking strategy, embedding model
  id (pin + justify), similarity threshold numeric value (pick one,
  document it, test it), cache directory layout under a gitignored
  path, whether citation ids are custom data parts and/or inline
  markers for Slice 2, folder layout under `server/corpus/` and
  retrieval modules. Free choices must not contradict any decision
  doc; note them in the README or your report.

Likely fork to watch: `grounding-policy.md` says citation chips show
chunk + score, while Slice 4 lists polished clickable chips. Default
recommendation if unclear: emit typed citation parts with id + score
now; keep UI minimal but honest; leave polish to Slice 4. If that still
feels like a product-semantics fork, escalate rather than guessing.

## 7. Workflow

- Phase 1 — Plan (adopt `slice-planner.prompt.md`): fill
  `prompts/packets/slice-2.md` from the intake template; produce an
  ordered list of small verifiable tasks ending with the gate run.
  Zero open forks before Phase 2.
- Phase 2 — Implement (adopt `slice-implementer.prompt.md`): build only
  the packet scope. Guardrails and `npm run dev` keep working after
  every step. Prefer integrating retrieval on the existing proceed path
  in `server/src/routes/chat.ts` after `runGuardrailPipeline` returns
  `proceed` — do not bypass the pipeline.
- Phase 3 — Prove (adopt `slice-prover.prompt.md`): act as the
  reviewer. Fresh app state, README as setup instructions. Execute
  section 3 of the live-review script exactly; also verify at least one
  in-corpus NC FNS figure in an answer appears verbatim in
  `server/corpus/`. Record Do / Expected / Observed per step. Re-run
  `npm run eval` (or a focused subset) if you touched shared middleware
  / logging paths — Slice 1 must not regress.

Close the loop in the same session — not later:

- Update `docs/agent/source-of-truth.md`: one claim per new behavior,
  each citing file path(s) and the proof step that exercised it.
  Rewrite or remove the "no retrieval/corpus" non-capability entries
  that this slice falsifies.
- Update the Current status section of `docs/agent/orientation.md`.
- The packet should forbid broad edits to `docs/agent/roadmap.md`; the
  single sanctioned exception is the Slice 2 heading's status marker
  (NOT STARTED → gate outcome, dated). Definitions, scopes, and gates
  stay untouched.
- Update README capability table / honesty about grounding (no
  claiming tools or memory). Keep the guardrail eval report accurate.
- Check every box of the packet's done-when honestly.
- If implementation must diverge from a decision doc: dated revision
  note in that doc, or a Known Policy Exception in `orientation.md` —
  same session, never silent.

## 8. Report back, in this shape

Gate verdict (PASS/FAIL); evidence per proof step (Do / Expected /
Observed); tree of files created/modified; corpus document list with
snapshot dates; similarity threshold chosen; embedding model id pinned;
dependencies added (each with one-line justification); free choices
made; forks hit (and how settled); source-of-truth entries added;
exceptions recorded (expect none); confirmation that Slice 1 adversarial
eval still passes if you touched the shared request path.

## 9. Hard stop

Slice 2 ends at its gate verdict. Do not start Slice 3, do not scaffold
tools or CaseFile, do not "prepare" verdict tiers. If the gate fails,
report the shortest list of blocking items — never widen scope to
compensate.
