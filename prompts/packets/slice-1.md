# Slice packet: Slice 1 — Guardrail middleware

- Date opened: 2026-07-25
- Intent (one sentence, copied from roadmap.md): safety owns the front
  door before any capability is added.
- Gate (verbatim from roadmap.md): all four attack classes in
  `proof/adversarial-script.md` are deflected with the approved
  responses.

## Authority citations (read before working)

- Decisions in force for this slice: `guardrail-precedence.md`,
  `classifier-design.md`, `crisis-escalation.md`, `pii-handling.md`,
  banned-language rule from `verdict-language.md`, `stack-boundaries.md`.
- Source-of-truth entries this slice depends on: streaming chat shell,
  envelope validation, pinned model ids, fail-fast env (Slice 0).
- Proof-script steps this slice must make pass:
  `adversarial-script.md` sections A–F (items A1, A2 deflection+resume
  only, B1, B2, C1, D1, D2, E1, E2, F1). Section G is Slice 3.

## Files in play

- Expected to create: `prompts/packets/slice-1.md`;
  `shared/src/guardrails.ts`; `server/src/middleware/sanitize.ts`;
  `server/src/middleware/classify.ts`; `server/src/middleware/pipeline.ts`;
  `server/src/log.ts`; offline tests and `server/src/eval/`.
- Expected to modify: `shared/src/envelope.ts`, `shared/src/index.ts`;
  `server/src/routes/chat.ts`, `server/src/config.ts`,
  `server/package.json`; `client/src/App.tsx`, `client/src/index.css`;
  root `package.json`; `README.md`; `docs/agent/source-of-truth.md`,
  `docs/agent/orientation.md`; Slice 1 status marker on
  `docs/agent/roadmap.md`; dated mechanism note in
  `docs/agent/decisions/classifier-design.md`.
- Must NOT touch: corpus content, tools, RAG, CaseFile/state memory,
  agent system prompt with FNS knowledge, proof script content (except
  running it), other decision docs beyond the dated classifier note.

## Done-when (all must hold)

- [x] Gate passes, demonstrated via the proof-script steps above
- [x] source-of-truth.md updated with evidence citations, in this slice
- [x] orientation.md status section updated
- [x] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [x] Any decision fork hit during work was settled as a decision doc,
      not by default

## Open questions / forks hit (planner fills, or "none")

- Dual out-of-scope responses (unsupported action vs off-topic) with a
  closed five-value verdict enum → settled 2026-07-25: classifier returns
  `out_of_scope` plus `outOfScopeKind: unsupported_action | off_topic`
  selecting between two templates; enum stays closed.

## Closed 2026-07-25 — GATE PASSED

`npm run eval` (classifier `gpt-5.4-nano`, prompt v2) and live API/UI
runs of adversarial A–F: all Pass. Evidence in
`docs/agent/source-of-truth.md`. Dated SDK-mechanism note in
`classifier-design.md`. This packet is now `historical`.
