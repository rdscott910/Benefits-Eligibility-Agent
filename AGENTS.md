# AGENTS.md — CivicReach NC FNS Eligibility Agent

Hard rules and stable facts for every agent session in this repository.
Cold start: read this file, then `docs/agent/orientation.md`, before acting.

## What this project is

A text-based AI agent that helps North Carolina residents assess their
likelihood of qualifying for NC FNS (SNAP) food assistance. The release
gate is a live review in which CivicReach leadership (CTO, CEO) runs the
agent locally. `npm install && npm run dev` must be the entire setup.

## Hard constraints

- PRD guiding principle, binding on every decision: "Smaller scope done
  well beats broad scope half-baked, every time."
- Work happens in gated slices (`docs/agent/roadmap.md`), one at a time. A
  slice starts only after the previous gate passed. Gates, not time spent,
  decide when work is done: never cut functionality or reopen a settled
  decision because of time.
- The PRD (`AI-Eligibility-Case-Study-Description.md`, repo root) is the
  supreme scope authority. Nothing enters the roadmap that the PRD
  excludes; PRD must-haves are cut only through a dated entry in the
  roadmap's scope-revision log.

## Stack (settled — do not re-litigate)

- Frontend: React + Vite, markdown chat rendering, visible streaming and
  tool states. Lives in `client/`.
- Backend: Node.js + Express + TypeScript. Lives in `server/`.
- Model layer: Vercel AI SDK with `@ai-sdk/openai`.
- Zod at every boundary: tools, middleware verdicts, API payloads, state.
- Vector store: in-memory, built from `server/corpus/` at startup.

## Integrity layer (beats UI polish, smoothness, and demo appeal — always)

1. Every eligibility rule, figure, or threshold in an answer traces to a
   document in the curated corpus. No parametric benefit knowledge, ever.
2. All arithmetic comes from deterministic Zod-schema tools. The model
   never computes or estimates numbers itself.
3. Guardrail middleware runs before the agent loop. Crisis detection has
   top precedence over every other behavior, including helpfulness.
4. The agent expresses likelihood of qualifying, never an eligibility
   determination or a promise of approval.
5. Facts the user has stated are remembered across turns and never
   re-asked.

## Operating principles

1. Code is truth; docs are claims. When a document disagrees with current
   code, the code wins and the document is a bug. Decision docs constrain
   what should be built; they are NEVER evidence that something was built.
2. Grounding and safety own the stack: the integrity layer above wins
   every conflict.
3. Truth before breadth. Cut capability before cutting honesty; a graceful
   refusal beats an invented SNAP rule.
4. Finish loops, not fragments. A capability is complete only when a
   reviewer can exercise it end to end in the live demo, including its
   failure mode.
5. No silent divergence. If implementation diverges from a decision doc,
   revise the doc with a dated note or record a Known Policy Exception in
   `docs/agent/orientation.md`. Never both silent and shipped.
6. Decisions are settled explicitly, never accidentally. At any fork that
   changes product semantics, stop and settle it as a decision doc — don't
   let whichever code gets written first decide.
7. Contradiction closure is implementation. After every slice: README, UI,
   middleware behavior, agent behavior, and demo script must tell the same
   story, or the slice is not done.

## Explicitly out of scope (defended tradeoffs — do not build)

External databases; real agency submissions or live-government scraping;
voice; auth or persistence beyond browser memory. Rationale:
`docs/agent/decisions/out-of-scope-tradeoffs.md`.

## Where things live

- Truth stack: `docs/agent/` — orientation, source-of-truth, roadmap,
  decisions, proof scripts. Index: `docs/agent/README.md`.
- Role prompts and the shared slice intake packet: `prompts/`.
