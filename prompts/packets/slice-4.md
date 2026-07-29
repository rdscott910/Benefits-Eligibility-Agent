# Slice packet: Slice 4 — Transparency UX + proof hardening

- Date opened: 2026-07-29
- Intent (one sentence, copied from roadmap.md): the live review passes end
  to end on a fresh clone.
- Gate (verbatim from roadmap.md): `proof/live-review-script.md` passes end
  to end on a fresh clone.

## Authority citations (read before working)

- Decisions in force for this slice: `out-of-scope-tradeoffs.md` (README
  tradeoffs section must state all four exclusions with rationale);
  `grounding-policy.md` (the 2026-07-23 revision promises citation chips
  showing the chunk and its score — this slice completes it);
  `verdict-language.md` incl. R6 (new transparency surfaces are UI chrome
  and never introduce model-authored mandatory text); `state-memory.md`
  (the panel shows the session CaseFile honestly; browser memory only,
  refresh clears); `deterministic-math.md` incl. the 2026-07-29 revision
  (the drawer shows real tool inputs/outputs, never a paraphrase);
  `classifier-design.md` (server logging policy does not change);
  `crisis-escalation.md` and `pii-handling.md` (transparency must not
  undermine them: crisis turns stay resources-only in the message body;
  nothing PII-rejected is echoed anywhere, drawer included);
  `stack-boundaries.md` (Zod at every boundary; every new runtime
  dependency gets a one-line justification); `trace-transparency.md`
  (NEW — drawer content and cost semantics, settled with user 2026-07-29).
- Source-of-truth entries this slice depends on: the guardrail pipeline
  with short-circuit-only `data-guardrail` parts; grounded RAG on the
  proceed path (threshold 0.28, top 4); the three deterministic tools and
  the CaseFile round-trip (envelope v3); structured `data-verdict` parts;
  the eval harness (A–G, R1–R4, offline) and its README report; tool
  telemetry logging (names/timings/outcomes only).
- Proof-script steps this slice must make pass: `live-review-script.md`
  §1–§6 in full on a fresh clone (the gate) — §1's timed two-minute setup,
  §2 item 2's "visible tool status" clause (skipped by Slice 3), §2 items
  3–5 and §3–§4 re-proven, all five §5 items, the §6 contradiction
  review; `adversarial-script.md` sections A–G live in the browser (incl.
  A2's full facts-survive-crisis check); `npm run eval` (A–G, R1–R4,
  offline) green after every change.

## Files in play

- Expected to create: `prompts/packets/slice-4.md` (this packet);
  `docs/agent/decisions/trace-transparency.md`; `shared/src/trace.ts`;
  `shared/src/tools.ts` (cross-boundary tool I/O schemas).
- Expected to modify: `shared/src/envelope.ts` (v4: `data-trace`, typed
  tool parts), `shared/src/grounding.ts` (chunk heading/text on
  citations), `shared/src/index.ts`; `server/src/middleware/sanitize.ts`
  (redaction counts), `server/src/middleware/pipeline.ts` (latest-turn
  sanitize summary on every outcome), `server/src/routes/chat.ts` (build
  + emit the trace part), `server/src/agent/respond.ts` (trace + usage +
  chunk text), `server/src/agent/prompt.ts` (v5 STYLE),
  `server/src/config.ts` (pinned pricing constants, dated),
  `server/src/tools/*.ts` (I/O schemas imported from `shared/`), server
  test files as needed; `client/src/App.tsx`, `client/src/index.css`,
  `client/package.json` (remark-gfm); `README.md`;
  `docs/agent/source-of-truth.md`, `docs/agent/orientation.md`,
  `docs/agent/roadmap.md` (Slice 4 status marker only),
  `docs/agent/decisions/deterministic-math.md` (dated schema-location
  note), `docs/technical-decisions.md` (refresh if stale).
- Must NOT touch: guardrail BEHAVIOR — verdicts, templates, precedence,
  crisis resources, PII policy, classifier prompt v3, fail-closed policy
  (only already-computed metadata may be exposed through outcomes);
  `server/corpus/` content; retrieval threshold/topK and the no-match
  mechanism; tier mapping and tool semantics; mandatory strings in
  `shared/`; proof-script content (except running them); any persistence,
  export, or analytics; no deliberate failure-demo beats or
  near-threshold verdict behavior (AGENTS.md Learned User Preferences).

## Done-when (all must hold)

- [x] Gate passes, demonstrated via the proof-script steps above
- [x] source-of-truth.md updated with evidence citations, in this slice
- [x] orientation.md status section updated
- [x] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [x] Any decision fork hit during work was settled as a decision doc,
      not by default

## Open questions / forks hit (planner fills, or "none")

- Drawer content (predicted by handoff §6) → settled 2026-07-29 with
  user: sanitize result metadata-only (kinds + counts, never a value);
  tool I/O shown in full including fact values the user themselves
  stated; drawer on every turn including guardrail short-circuits (the
  crisis/PII message body stays exactly the templated response — the
  drawer is chrome). Recorded in `decisions/trace-transparency.md`.
- Running-cost semantics (predicted by handoff §6) → settled 2026-07-29
  with user: per-turn token counts + running session total, plus a
  clearly-labeled dollar ESTIMATE computed from pricing constants pinned
  in `server/src/config.ts` with a dated comment. Same decision doc.

## Free choices recorded (do not contradict decision docs)

- One `data-trace` part per turn (not several), written by both response
  paths — `streamTemplatedReply` (short-circuit + fail-closed) and
  `respondGrounded` (proceed). Schema in `shared/src/trace.ts`, parsed by
  the client before rendering (the `data-retrieval` pattern).
- Chunk text reaches the chips embedded in the `data-retrieval` citations
  (`heading` + `text` added to `citationSchema`); no new endpoint — the
  chunks are small and the payload stays a single stream.
- Tool-status display renders the AI SDK's native tool parts (verified
  live against the real stream before building); no server-authored
  status part. Labels are client-side chrome keyed by tool name (e.g.
  "Checking NC FNS income limits…" for `checkIncomeThreshold`), rendered
  only when a typed tool part for a real invocation exists (R6-safe).
- Tool I/O Zod schemas move to `shared/src/tools.ts` so the client parses
  exactly what it renders (stack-boundaries R1: shared owns every
  cross-boundary schema); executors and `tool()` wiring stay in
  `server/src/tools/` (dated note in `deterministic-math.md`).
- The trace's sanitize summary covers the latest user turn only (earlier
  turns already carry their own traces).
- Running totals (tokens, estimated dollars) accumulate client-side by
  summing per-turn trace parts — the server stays stateless and nothing
  survives refresh (state-memory.md).
- The §1 fresh-clone timing is recorded in this packet's close-out note
  and as the source-of-truth evidence line.
- New unit tests: new/changed part schemas round-trip through Zod;
  redaction counting; cost estimation math.

## Mid-proof fix (in scope, 2026-07-29)

Running adversarial sections in strict script order on the fresh clone
exposed a pre-existing defect: after E2 (injection+SSN — injection wins
the verdict per settled precedence), the SSN-bearing user message stayed
in client history because only pii-verdict messages were dropped. Stage 1
sanitizes the FULL history each request and its definitive-SSN rule then
forced every later clean turn (F1) into a PII rejection — the
conversation could never recover, contradicting pii-handling.md's "the
conversation survives the refusal". Fix is client-only and implements
the decision's existing rule ("the rejected message is not stored in
conversation state") completely: any short-circuited turn whose trace
sanitize summary shows redactions drops the prior user message
(`mustDropPriorUserMessage` in `client/src/App.tsx`). Guardrail
middleware untouched. E2→F1 re-proven in sequence after the fix.

## Closed 2026-07-29 — GATE PASSED

Gate run on a TRUE fresh clone (`git clone` of the committed repo into a
temp dir, README-only setup). §1 timed: clone → `cp .env.example .env` +
key → `npm install && npm run dev` → first streamed reply in the browser
= 49 seconds total; the first boot built embeddings in 1188 ms (a fresh
clone has no cache). §2: warm likelihood-only opener; both facts stored
with VISIBLE tool status — "Updating your case file…" and "Checking NC
FNS income limits…" observed in their running state, rendered from typed
tool parts (the clause Slice 3 skipped); threshold figures verbatim from
the corpus; §2.3 memory check answered without re-asking; §2.4 hand
tie-out (corpus row 3: $2,888 / $4,442; $2,000 ≤ $2,888 → likely
qualify) matches the tool; §2.5 exactly one tier + suffix + referral,
UI-rendered. §3 both no-match items re-proven; §4 correction to $2,400
re-ran the check with the old figure gone. §5 all five items: labels +
clean markdown incl. GFM tables; README tradeoffs states all four
exclusions; drawer shows sanitize/classify/retrieval/tool-I/O/cost with
real values (crisis turn honestly "not run", PII turn "ssn ×1" with the
value nowhere); chip click opened income-limits#1 with score 0.297 and
the corpus table rendered; README eval report carries model + prompt
versions. §6: one story. Adversarial A–G live in the browser in strict
script order — E2→F1 exposed the pre-existing history-PII defect fixed
mid-proof (see above), after which the full sequence passes; G1/G2:
uncertain → one clarifying question, contradiction → clarify, verdict
only on the confirmed value. `npm run eval` on the clone: crisis 3
(incl. A2 full), injection 6, pii 4, out-of-scope 2, calibration 2,
grounding R1–R4, messy-input G1–G2, offline 71 — all Pass (classifier
prompt v3, agent prompt v5, envelope v4). One new dependency
(`remark-gfm`, GFM table rendering). This packet is now `historical`.
