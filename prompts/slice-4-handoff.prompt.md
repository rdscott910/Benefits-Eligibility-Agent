# Handoff: Slice 4 — Transparency UX + proof hardening (plan → build → prove)

You are the engineer taking over Slice 4 of the CivicReach NC FNS
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
   (Slices 0–3 passed; Slice 4 is next and is the last slice).
3. `docs/agent/source-of-truth.md` — what is REAL today (guardrails +
   grounded RAG + deterministic tools + CaseFile memory + structured
   verdicts; no transparency UX). Trust this over any chat memory.
4. `docs/agent/roadmap.md` — **Slice 4 only** is your work order. There
   is no Slice 5: after this gate the roadmap ends at the live review.
   Slices 0–3 are done; do not reopen them.
5. Decisions in force for this slice (read all):
   - `docs/agent/decisions/out-of-scope-tradeoffs.md` — the four
     defended exclusions (external databases; agency submissions / live
     scraping; voice; auth/persistence). Your README tradeoffs section
     must state all four with rationale — live-review §5 item 2 checks
     it against this doc.
   - `docs/agent/decisions/grounding-policy.md` — its 2026-07-23
     revision literally promises "citation ids, rendered in the UI as
     chips showing the chunk and its score." Slice 4 completes that
     promise (clickable chips → exact corpus chunk + score).
   - `docs/agent/decisions/verdict-language.md` (incl. R6) — every
     mandatory string stays UI-rendered from `shared/` constants. The
     new transparency surfaces (tool-status labels, drawer, panel) are
     UI chrome and must never introduce model-authored mandatory text.
   - `docs/agent/decisions/state-memory.md` — the "What I know so far"
     panel shows the session CaseFile honestly (statuses included);
     state stays browser-memory-only, refresh clears.
   - `docs/agent/decisions/deterministic-math.md` (incl. the 2026-07-29
     tier-mapping + tools-path revision) — the drawer's "tool calls with
     I/O" must display the real tool inputs/outputs, not a paraphrase.
   - `docs/agent/decisions/classifier-design.md` — the logging policy
     (verdicts, scores, timings; never message content) governs SERVER
     LOGS and does not change. The user-facing drawer is a different
     surface — see the fork in §6 before deciding what it may show.
   - `docs/agent/decisions/crisis-escalation.md` and
     `docs/agent/decisions/pii-handling.md` — unchanged. Transparency
     must not undermine them: a crisis turn stays resources-only in its
     message body, and nothing PII-rejected may be echoed back anywhere,
     drawer included.
   - `docs/agent/decisions/stack-boundaries.md` — Zod at every boundary;
     every new runtime dependency needs a one-line justification.
6. Proof steps this slice must make pass (verbatim expectations):
   - `docs/agent/proof/live-review-script.md` — **the entire script,
     sections 1–6, end to end on a fresh clone. That is the gate.**
     This includes §1's timed two-minute setup, the §2 item 2 "visible
     tool status" clause that Slice 3 explicitly skipped, all five §5
     items (tool labels + markdown, README tradeoffs, glass-box drawer,
     clickable citation chips, README eval report), and the §6
     contradiction review.
   - `docs/agent/proof/adversarial-script.md` — full re-run (the
     roadmap's "proof hardening"): sections A–G live, including A2's
     full facts-survive-crisis check. `npm run eval` automates A–G and
     R1–R4 and must stay green after every change you make.
7. `prompts/slice-intake-template.md` — fill a new packet at
   `prompts/packets/slice-4.md` in Phase 1. Packets for Slices 0–3 are
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

Product code exists, works, and **the Slice 0–3 baseline is committed**
— a fresh `git clone` of this repository is a faithful starting point.
Slices 0–3 gates have passed (Slice 3 on 2026-07-29). Versions as of
this handoff: envelope **v3**, agent prompt **v4**, classifier prompt
**v3**, models pinned in `server/src/config.ts` (`gpt-5.6-terra` agent
/ `gpt-5.4-nano` classifier / `text-embedding-3-small` embeddings,
retrieval threshold 0.28, top 4).

What is already real (see `source-of-truth.md` for evidence citations):

- Guardrail pipeline before everything (`server/src/middleware/`):
  Stage 1 sanitize → Stage 2 classify → templated short-circuit or
  proceed. Short-circuits never touch retrieval, tools, or state.
- Grounded RAG on the proceed path (`server/src/agent/respond.ts`):
  latest sanitized message embedded, scored against the 34-chunk
  in-memory store (built from `server/corpus/` at boot; cache
  gitignored), hits ≥ 0.28 injected into prompt v4
  (`server/src/agent/prompt.ts`) together with a KNOWN FACTS block
  built from the request CaseFile.
- Three deterministic tools in `server/src/tools/` (path clarified in
  `deterministic-math.md`): `updateCaseFile` (only state mutation path;
  deterministic transition table; corrections replace, contradictions
  flip to needs_confirmation and cost exactly one clarifying question),
  `lookupIncomeLimits` (published limits, unit sizes >8 extended via
  each-additional), `checkIncomeThreshold` (reads ONLY settled CaseFile
  facts — empty input schema — and selects the settled tier mapping:
  ≤130% likely / ≤200% may / above likely-not, boundaries inclusive).
- Envelope v3 (`shared/src/envelope.ts`): request carries the session
  `caseFile`; stream parts are `data-guardrail` (short-circuits only),
  `data-retrieval` (grounded / no_match / conversational),
  `data-verdict` (from tool output only), `data-casefile` (post-turn
  state; client stores wholesale). All schemas and mandatory strings in
  `shared/` (`casefile.ts`, `verdict.ts`, `grounding.ts`,
  `guardrails.ts`), imported by both sides.
- Client (`client/src/App.tsx`): streaming chat, guardrail badges,
  minimal source chips (citation id + score, title tooltip — NOT
  clickable), verdict block rendered from constants, a one-line "What I
  know so far" strip, CaseFile held in React state + a ref (the chat
  transport closure reads the ref — keep that pattern if you touch it),
  PII-rejected user messages dropped from history. `react-markdown`
  without GFM.
- Eval harness: `npm run eval` = offline suites + live adversarial A–F
  (`adversarial.eval.ts`) + grounding R1–R4 (`grounding.eval.ts`) +
  the Slice 3 state suite (`state.eval.ts`: G1, G2, "A2 full") and
  prints the README report (`report.ts`, buckets include
  `messy_input`). `npm test` = 65 offline tests. `npm run typecheck`
  covers all three workspaces.
- Logging (`server/src/log.ts`): guardrail (verdict, latency, tokens),
  retrieval (scores, ids, latency), tool (name, latency, outcome) —
  never message content, never fact values. This policy does not
  change.
- Boot: `server/src/index.ts` builds corpus + validated income table +
  vector store fail-fast, then `createChatRouter({ store, incomeTable })`.

Load-bearing facts for exactly your scope (verify in code before
building on them):

- **Tool events likely already reach the client.** `respondGrounded`
  merges `toUIMessageStream({ stream: result.stream })`, and the AI SDK
  UI stream carries typed tool-call/result parts; the client renders
  only `text` and `data-*` parts today. Inspect what actually arrives
  in `message.parts` before inventing a server-authored status part —
  the streaming tool-status display may be mostly client rendering.
- **Proceed turns emit no guardrail/trace data.** `data-guardrail` is
  written only on short-circuits (`streamTemplatedReply` in
  `server/src/routes/chat.ts`). The drawer's per-turn sanitize result,
  classifier verdict + latency, and token usage exist server-side
  (`PipelineOutcome.resolved` carries latency and tokens; sanitize
  detected kinds live inside `runGuardrailPipeline`'s internals and are
  not on the proceed outcome) but are not exposed to the stream.
  Threading that metadata out is plumbing you own; guardrail BEHAVIOR
  (verdicts, templates, precedence, fail-closed) must not change.
- **`data-retrieval` does not carry chunk text.** Citations have
  id/docId/title/score only. Clickable chips need the chunk content
  delivered somehow (see free choices).
- **Prompt v4 forbids pipe tables** (STYLE rule: "the interface does
  not render them yet"). Adding GFM rendering and relaxing that line is
  a behavior-relevant prompt change → bump `AGENT_PROMPT_VERSION` to 5
  and re-run `npm run eval`.
- **Model usage/cost is nowhere surfaced.** `streamText` results and
  the classifier call expose token usage; embedding calls are cheap and
  cached. There are no pricing constants anywhere yet.
- **Your own changes and the fresh-clone gate.** The baseline is
  committed, but you must never commit without the user's explicit
  go-ahead — which means YOUR Slice 4 work will be sitting uncommitted
  when it is time to prove the gate. Plan for one explicit exchange at
  the start of Phase 3: ask the user to commit (or to approve your
  commit), then run the timed gate on a true fresh clone (a local
  `git clone <repo-path> <tmp-dir>` is fine). Never prove against the
  dirty working tree and call it a fresh clone.

What is explicitly **not** built yet (honest gaps, from
`source-of-truth.md`):

- No tool-status streaming display ("Checking NC FNS income limits…").
- No per-turn glass-box trace drawer, and no per-turn trace data parts.
- No clickable citation chips (chunk + score inspection).
- No GFM table rendering; markdown polish not done.
- No README tradeoffs section yet (live-review §5 item 2 would fail
  today).
- No running-cost display; token usage is not exposed to the client.

## 3. Mission and gate

Build exactly the Slice 4 in-scope list from `roadmap.md`:

- Streaming tool status ("Checking NC FNS income limits…") rendered
  from typed parts, never from model text.
- "What I know so far" CaseFile panel polish (values + statuses,
  session-only honesty preserved).
- Per-turn glass-box trace drawer: sanitize result, classifier verdict
  + latency, retrieval matches with scores, tool calls with
  inputs/outputs, running conversation cost.
- Clickable citation chips: exact corpus chunk + its retrieval score.
- Markdown rendering polish (GFM tables; prompt STYLE updated to
  match; `AGENT_PROMPT_VERSION` bumped alongside).
- README tradeoffs section (all four exclusions from
  `out-of-scope-tradeoffs.md`, with rationale) and a refreshed eval
  report (model + prompt versions it ran against).
- Full run of BOTH proof scripts; §6 contradiction review — README, UI,
  middleware behavior, agent behavior, and demo script tell one story.
- Bump the envelope intentionally (v3 → v4) for the new trace/status
  parts; both sides import every new schema from `shared/`.

Gate, verbatim: "`proof/live-review-script.md` passes end to end on a
fresh clone."

The gate — not effort, not time spent — decides done. §1's two-minute
timer is part of the gate: the fresh clone must reach a first streamed
reply in under 2 minutes. A fresh clone has no embeddings cache, so the
first boot pays the embedding build (measured under a second on this
corpus — it fits, but time it honestly and record the number).

## 4. Non-negotiables

- **No new capability.** The roadmap says so explicitly. Transparency
  renders what already happens; it must not change what happens. No new
  tools, no new fact kinds, no retrieval enrichment, no corpus changes,
  no threshold retuning, no new eligibility math.
- Integrity layer wins every conflict: guardrails before everything;
  all arithmetic stays in the deterministic tools; tier selection stays
  tool-owned; likelihood language only; stated facts never re-asked.
  Slice 3 behavior must not regress — you are changing the shared
  proceed path's plumbing and the client, so you re-prove A–G and
  R1–R4, not assume them.
- Mandatory strings (tier phrases, suffix, referral, crisis resources,
  PII rejection, no-match referral) stay defined once in `shared/` and
  rendered by server/UI. New UI labels (drawer headings, tool-status
  text) are UI chrome — fine — but they must be honest: a label may
  only say a tool ran if that tool's part actually streamed.
- Guardrail middleware behavior is frozen: verdicts, templates,
  precedence, crisis resources, PII policy, classifier prompt v3 and
  its fail-closed policy. Exposing already-computed metadata (latency,
  verdict, detected-kind counts) through the outcome/stream is allowed
  plumbing; changing any decision or wording is not.
- Server logging policy unchanged: verdicts, scores, timings, tool
  outcomes — never message content, never fact values. The drawer is a
  client display of the user's own session and is governed by the fork
  in §6, not by loosening the log policy.
- Zod at every new boundary: every new stream part gets a schema in
  `shared/`, parsed by the client before rendering (follow the existing
  `data-retrieval` pattern).
- State stays session-only browser memory. The drawer/panel must not
  introduce persistence, exports, or copies that outlive refresh.
- Model/config pins stay in `server/src/config.ts`; if the settled cost
  display needs pricing constants, pin them there with a dated comment
  and label the display an estimate.
- Code rules: imports at the top of the module only, never inline;
  exhaustive `switch` over unions/enums with a `never` default case.
- Every new runtime dependency gets a one-line justification in your
  report; expect at most one (`remark-gfm` for tables). The dependency
  list must stay demo-explainable.
- Do not commit or push unless the user explicitly asks. The one
  sanctioned ask is the Phase 3 fresh-clone exchange described in §2.
- Do **not** add deliberate failure-demo beats or near-threshold verdict
  behavior (`AGENTS.md` Learned User Preferences).

## 5. Explicitly out of scope (do not build, stub, or "prepare")

- Any new capability, per the roadmap: deduction/net-income math,
  benefit-amount estimation, CaseFile-enriched retrieval, new corpus
  documents, new guardrail classes, new fact kinds.
- External databases, agency submissions, live scraping, voice,
  auth/persistence (`out-of-scope-tradeoffs.md` — your README section
  DEFENDS these; it does not soften them).
- Conversation export/share features, analytics, telemetry beyond the
  existing logs.
- Re-litigating settled decisions: tier mapping, guardrail precedence,
  corpus scope, no-match mechanism, envelope part semantics from
  Slices 1–3.

A drawer that honestly shows less beats one that fabricates detail —
if a datum is not produced by the real pipeline, the drawer does not
show it.

## 6. Forks vs. free choices

- FORK — stop and escalate (settle as a decision doc before code
  decides): **what the glass-box drawer may display.** The roadmap
  fixes the category list (sanitize result, classifier verdict +
  latency, retrieval matches with scores, tool calls with I/O, running
  cost), but no decision doc says whether "sanitize result" may include
  message text or must stay metadata-only (kinds/counts), whether tool
  I/O shows the user's stated fact values (their own data, in their own
  browser), or whether the drawer appears on guardrail short-circuit
  turns. Recommend: metadata-only for sanitize (e.g. "redacted: ssn ×1",
  never the value); yes to real tool I/O including fact values the user
  themselves stated; drawer on every turn including short-circuits
  (crisis message body stays resources-only; the drawer is chrome).
  Present it, settle it, record it (a short decision doc, e.g.
  `decisions/trace-transparency.md`, under 30 lines per
  `docs/agent/README.md`) — then build.
- FORK — **running-cost semantics.** Token counts are facts; dollar
  costs require pricing constants that will go stale. Recommend: show
  tokens per turn plus a clearly-labeled dollar estimate from pinned
  constants in `config.ts` (dated comment). Tokens-only also satisfies
  the roadmap line. Settle before building the display.
- FORK — any change to mandatory strings, refusal wording, or verdict
  presentation (standing rule; none is expected in this slice).
- FREE CHOICE — yours, record each in the packet: trace-part payload
  design (one `data-trace` part vs. several; which write sites emit it —
  `respondGrounded` and `streamTemplatedReply` are the two); how chunk
  text reaches the chips (embed it in the retrieval part vs. a tiny
  read-only endpoint — embedding is simpler and the chunks are small,
  but it grows every response; either is fine — don't gold-plate);
  whether tool-status display renders the AI SDK's already-streamed
  tool parts or a new server-authored status part (prefer whichever the
  verified stream contents make simpler and honest); label wording
  ("Checking NC FNS income limits…" etc., keyed by tool name,
  client-side); drawer/panel UX and styling; GFM plugin wiring; how the
  §1 fresh-clone timing is recorded; any new eval or unit cases (e.g.
  every new part schema round-trips through Zod).

Likely trap to watch: the §2 item 2 "visible tool status" clause plus
verdict-language R6 together mean a status label must derive from a
typed part tied to a real tool invocation — never from model text, and
never shown speculatively. A second trap: adding GFM without updating
prompt v4's "do not write pipe tables" line (or relaxing the prompt
without shipping the renderer) is exactly the contradiction live-review
§6 exists to catch — change both together, bump the prompt version,
re-run the eval.

## 7. Workflow

- Phase 1 — Plan (adopt `slice-planner.prompt.md`): fill
  `prompts/packets/slice-4.md` from the intake template; produce an
  ordered list of small verifiable tasks ending with the gate run.
  Zero open forks before Phase 2 — the drawer-content and cost forks
  above must be settled with the user during planning.
- Phase 2 — Implement (adopt `slice-implementer.prompt.md`): build only
  the packet scope. Guardrails and `npm run dev` keep working after
  every step; `npm test` and `npm run typecheck` stay green. New parts
  flow through the existing `respondGrounded` / `streamTemplatedReply`
  structure — never bypass the pipeline, never invoke tools from
  guardrail paths.
- Phase 3 — Prove (adopt `slice-prover.prompt.md`): ask the user to
  commit (or approve committing) your Slice 4 work, then on a true
  fresh clone: README-only setup, §1 timed, the ENTIRE live-review
  script §2–§6 in order (tool-status clause now claimed, §5 all five
  items), the full adversarial script A–G in the browser, and
  `npm run eval` (A–G, R1–R4, offline all green — with the new prompt
  version recorded). Record Do / Expected / Observed per step.

Close the loop in the same session — not later:

- Update `docs/agent/source-of-truth.md`: one claim per new behavior
  with file paths + the proof step that exercised it; rewrite or remove
  the falsified gap entries (tool-status display, drawer, clickable
  chips, GFM — and the README-tradeoffs gap this handoff names).
- Update the Current status section of `docs/agent/orientation.md`
  (this is the final slice — say what that means for status).
- Roadmap: the single sanctioned edit is the Slice 4 heading's status
  marker (NOT STARTED → gate outcome, dated).
- README: tradeoffs section (all four, with rationale), transparency
  features in the capability table, how-a-message-travels update,
  envelope v4 note, refreshed eval report (model + prompt versions),
  dependency list update with justification for anything added.
- `docs/technical-decisions.md` is a claims-only human narrative — if
  your changes make it stale, refresh it to match
  `docs/agent/decisions/` (which stays authoritative).
- Check every box of the packet's done-when honestly. Divergence from
  a decision doc gets a dated revision note or a Known Policy Exception
  in `orientation.md` — same session, never silent.

## 8. Report back, in this shape

Gate verdict (PASS/FAIL); the fresh-clone §1 timing; evidence per proof
step (Do / Expected / Observed) for §2–§6 and adversarial A–G; tree of
files created/modified; the settled drawer-content and cost decisions
and where they are recorded; new stream parts and the envelope version
bump note; agent prompt version (and why it did or did not bump);
dependencies added (each with one-line justification); free choices
made; forks hit (and how settled); source-of-truth entries
added/removed; exceptions recorded (expect none); confirmation that
`npm run eval` is fully green (A–G, R1–R4, offline) on the final code.

## 9. Hard stop

Slice 4 ends at its gate verdict, and the roadmap ends at Slice 4 —
there is no Slice 5 to start, so do not invent one, do not add
capabilities "while you're in there," and do not touch the corpus or
the guardrails except as this handoff allows. If the gate fails, report
the shortest list of blocking items — never widen scope to compensate.
