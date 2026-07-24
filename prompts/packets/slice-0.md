# Slice packet: Slice 0 — Skeleton and honest shell

- Date opened: 2026-07-23 (prepared; build session not yet started)
- Intent (one sentence, copied from roadmap.md): a reviewer can clone,
  install, and talk to a streaming model in under 2 minutes.
- Gate (verbatim from roadmap.md): fresh clone runs in under 2 minutes
  and streams a reply.

## Authority citations (read before working)

- Decisions in force for this slice: `stack-boundaries.md` (workspaces,
  2-minute rule, dependency policy, dated R1 revision);
  `classifier-design.md` applies only to the config module (both model
  ids pinned there from day one — no classifier is built in this slice).
- Source-of-truth entries this slice depends on: none (nothing is
  built).
- Proof-script steps this slice must make pass:
  `live-review-script.md` section 1, steps 1–2 (two-minute setup).

## Files in play

- Expected to create: root `package.json` (npm workspaces + `dev`
  script), `.env.example`, `.gitignore`, `README.md`; `client/` (Vite
  React chat UI rendering a streamed reply); `server/` (Express + TS,
  `/api/chat` route, AI SDK `streamText`, config module with pinned
  model ids); `shared/` (envelope schema v0: `ChatRequest` +
  stream-part types).
- Expected to modify: `docs/agent/source-of-truth.md` and
  `docs/agent/orientation.md` status section (in-slice, not after).
- Must NOT touch: `docs/agent/decisions/*`, `docs/agent/roadmap.md`,
  proof scripts, `prompts/*`; no corpus content, no middleware, no
  tools, no FNS content anywhere in this slice.

## Done-when (all must hold)

- [ ] Gate passes, demonstrated via the proof-script steps above
- [ ] source-of-truth.md updated with evidence citations, in this slice
- [ ] orientation.md status section updated
- [ ] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [ ] Any decision fork hit during work was settled as a decision doc,
      not by default

## Open questions / forks hit (planner fills, or "none")

- none
