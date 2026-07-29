# Slice packet: Slice 3 — Deterministic tools + multi-turn state

- Date opened: 2026-07-29
- Intent (one sentence, copied from roadmap.md): tool results, not model
  math, drive the likelihood verdict, and stated facts are never re-asked.
- Gate (verbatim from roadmap.md): the live-review script's math tie-out
  passes and the "I make $2,000/month" memory check passes.

## Authority citations (read before working)

- Decisions in force for this slice: `deterministic-math.md` (incl. the
  2026-07-29 tier-mapping + tools-path revision recorded for this
  slice), `state-memory.md` (incl. R5 CaseFile revision),
  `verdict-language.md` (now in full force, incl. R6 structured-part
  rendering), `grounding-policy.md` and `stack-boundaries.md` (Slice 2
  behavior must not regress), `crisis-escalation.md` and
  `pii-handling.md` (unchanged, but their promises become fully real:
  facts survive a crisis pause; PII-rejected messages never reach state).
- Source-of-truth entries this slice depends on: guardrail pipeline
  (sanitize → classify → short-circuit or proceed); grounded answering on
  the proceed path with the 0.28 threshold; honest no-match detection +
  UI-rendered referral; boot-parsed Zod-validated income-limits table
  (consumed by nothing yet — these tools are its first consumer); chat
  route factory wired after corpus boot; envelope v2; eval harness with
  the `G` title prefix reserved.
- Proof-script steps this slice must make pass:
  `live-review-script.md` §2 items 2–5 (skipping only the Slice 4
  "visible tool status" display clause in item 2) — facts acknowledged
  and stored, threshold figure verbatim from the corpus, the memory
  check, the math tie-out, the verdict wording check; §4 (correction
  handling); §3 re-proven (both no-match items);
  `adversarial-script.md` §G both items (vague income → one clarifying
  question, no tool call on a guess; contradiction → clarify, use only
  the confirmed value); §A–F re-proven green, including A2's now-full
  resume check (income still remembered after a crisis pause).

## Files in play

- Expected to create: `prompts/packets/slice-3.md` (this packet);
  `shared/src/casefile.ts`; `shared/src/verdict.ts`;
  `server/src/tools/lookup-income-limits.ts`;
  `server/src/tools/check-income-threshold.ts`;
  `server/src/tools/update-case-file.ts`;
  `server/src/tools/tools.test.ts`; `server/src/eval/state.eval.ts`.
- Expected to modify: `shared/src/envelope.ts` (v3: request `caseFile`,
  `data-casefile` + `data-verdict` parts), `shared/src/index.ts`;
  `server/src/index.ts` (pass the parsed income table to the router),
  `server/src/routes/chat.ts` (envelope v3, CaseFile into the proceed
  path), `server/src/agent/respond.ts` (tools + new stream parts),
  `server/src/agent/prompt.ts` (v4), `server/src/agent/agent.test.ts`,
  `server/src/log.ts` (tool event, names/timings only),
  `server/src/eval/report.ts` (G bucket); `client/src/App.tsx`,
  `client/src/index.css`; `README.md`;
  `docs/agent/decisions/deterministic-math.md` (dated revision),
  `docs/agent/source-of-truth.md`, `docs/agent/orientation.md` (status +
  tools-path convention line); the Slice 3 status marker on
  `docs/agent/roadmap.md` (nothing else there).
- Must NOT touch: guardrail middleware behavior
  (`sanitize.ts`/`classify.ts`/`pipeline.ts`), guardrail templates,
  precedence, crisis resources, PII policy, classifier prompt/boundary;
  `server/corpus/` (no content changes, no seventh document); retrieval
  store, threshold, or the no-match mechanism; proof-script content
  (except running it); tool-status streaming UI, glass-box drawer,
  clickable chips, GFM rendering (Slice 4); any persistence.

## Done-when (all must hold)

- [x] Gate passes, demonstrated via the proof-script steps above
- [x] source-of-truth.md updated with evidence citations, in this slice
- [x] orientation.md status section updated
- [x] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [x] Any decision fork hit during work was settled as a decision doc,
      not by default

## Open questions / forks hit (planner fills, or "none")

- Tier-mapping rule (predicted by handoff §6: no decision doc mapped
  table columns to the three tiers) → settled 2026-07-28 with user:
  gross ≤ 130% limit → "you likely qualify"; 130% < gross ≤ 200% limit →
  "you may qualify" (narration explains categorical eligibility from
  corpus excerpts: county DSS determines which limit applies); gross >
  200% limit → "you likely do not qualify". Boundaries inclusive;
  household sizes above 8 extend the table via the "each additional
  member" row inside the tool; only the gross columns select tiers (net
  and deduction math are out of scope). Recorded as a dated revision in
  `decisions/deterministic-math.md` (user chose revision over a new doc).
- Tools directory (`server/tools/` per the decision doc vs the server
  build's `include: ["src"]`) → settled 2026-07-29 via the handoff §4
  pre-authorization: tools live at `server/src/tools/`, recorded as a
  dated path clarification in the same `deterministic-math.md` revision.

## Free choices recorded (do not contradict decision docs)

- CaseFile Zod shape: exactly the three fact kinds `state-memory.md`
  names — `grossMonthlyIncome`, `householdSize`, `county` — each
  optional, each `{value, status: stated | needs_confirmation |
  confirmed, sourceTurn}`; unknown fields dropped by Zod object
  stripping; schema lives in `shared/src/casefile.ts`, imported by both
  sides.
- `updateCaseFile` exposure: an AI SDK tool whose input is
  `{fact, numberValue | stringValue, expression: stated | uncertain |
  correction | confirmation}`; the executor applies a deterministic
  transition table (uncertain → needs_confirmation + exactly one
  clarifying question; differing value vs a stated/confirmed fact →
  needs_confirmation + contradiction signal; correction → replace as
  stated; confirmation → confirmed; restating the pending value →
  confirmed) and stamps `sourceTurn` server-side. It is the only code
  path that mutates the working CaseFile.
- `checkIncomeThreshold` takes no numeric inputs from the model: it
  reads household size and gross income from the working CaseFile and
  returns a typed refusal when either is missing or pending
  confirmation — "never called with guessed inputs" is structural, not
  prompt-dependent. `lookupIncomeLimits` accepts an explicit household
  size for published-figure questions (published limits only, no tier).
- Verdict part payload: `{tier, grossMonthlyIncome, limits:
  {householdSize, gross200, gross130, net100}}`, derived only from the
  threshold tool's output; the UI renders tier phrase + suffix +
  referral from `shared/` constants.
- `data-casefile` part carries the full post-turn CaseFile and is
  emitted on every proceed turn; the client replaces its session copy.
- Retrieval queries stay latest-sanitized-message-only (CaseFile
  enrichment was optional; not needed for the gate — don't gold-plate).
- Client display: minimal honest "What I know so far" facts line plus a
  verdict block; tool-status streaming display and panel polish remain
  Slice 4.
- `sourceTurn` = 1-based count of user messages in the request.
- Eval wiring: G cases live in `server/src/eval/state.eval.ts` following
  the `grounding.eval.ts` pattern (same building blocks as the server
  route, without HTTP/stream plumbing); `report.ts` gains the reserved
  `G` prefix bucket (`messy_input`), plus an A2-titled full resume case
  that buckets to crisis.

## Closed 2026-07-29 — GATE PASSED

Both gate checks passed live in the browser on final code: the §2.3
memory check ("what was that income limit again?" answered with $4,442 /
$2,888 verbatim from the stored household size, nothing re-asked) and
the §2.4 math tie-out (household of 3 vs $2,000/month: $2,000 ≤ $2,888
at 130% → tool tier "you likely qualify", reproduced by hand from
`server/corpus/income-limits.md`). §2.2 stored and acknowledged both
facts with verbatim threshold figures; §2.5 verdict block rendered
exactly one tier + suffix + referral from `shared/` constants (model
text authors none of them); §3 both no-match items re-proven; §4
correction replaced $2,000 → $2,400 and re-ran the check (may-qualify
middle tier also exercised live at $2,400 vs household of 2). §G in the
browser: vague income → one clarifying question, fact pending, no
verdict; contradiction → "should I use $1,200 instead of $2,500?" with
the fact flipped to needs-confirmation; verdict only after
confirmation, using only the confirmed value. A2 full: income survived
the crisis pause and was not re-asked on resume. `npm run eval`
2026-07-29: crisis 3 (incl. A2 full), injection 6, pii 4, out-of-scope
2, calibration 2, grounding R1–R4, messy-input G1–G2, offline 60 — all
Pass (classifier prompt v3, agent prompt v4, envelope v3). Zero new
dependencies.

One mid-proof fix, in scope: the first G2 run showed the model treating
any differing income statement as an explicit "correction" (silent
replacement). Fixed by sharpening the `expression` guidance in the
`updateCaseFile` schema and prompt v4 rule 5 (plain statements are
"stated" even when they conflict; "correction" reserved for explicit
admissions). The deterministic transition table was already correct;
§4's explicit-correction behavior re-proven after the change.

This packet is now `historical`.
