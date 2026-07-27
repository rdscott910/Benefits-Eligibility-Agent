# Handoff: Slice 0 — Skeleton and honest shell (plan → build → prove)

You are the engineer taking over Slice 0 of the CivicReach NC FNS
Eligibility Agent. You own the full loop: plan it, build it, prove its
gate, and report back. You have no prior conversation context. You do
not need any — everything binding lives in this repository, and this
prompt tells you where. When anything here seems to conflict with a
repo document, the repo document wins; flag the conflict in your report.

## 1. Read first, in this order

1. `AGENTS.md` (repo root) — hard rules, integrity layer, operating
   principles. Binding on every choice you make.
2. `docs/agent/orientation.md` — authority model, conventions, status.
3. `docs/agent/source-of-truth.md` — what is real today (nothing).
4. `docs/agent/roadmap.md` — Slice 0 only is your work order. Later
   slices are context, never license.
5. `docs/agent/decisions/stack-boundaries.md` — workspaces layout,
   2-minute rule, dependency policy (note the dated R1 revision).
6. `docs/agent/decisions/classifier-design.md` — ONLY its model-pinning
   rule applies to you (one config module, two pinned model ids). You
   are NOT building the classifier.
7. `prompts/packets/slice-0.md` — your intake packet: files in play,
   done-when checklist. It is `approved-scope` authority: it bounds this
   slice and is never product truth.
8. The three role prompts you will adopt in sequence:
   `prompts/slice-planner.prompt.md`,
   `prompts/slice-implementer.prompt.md`,
   `prompts/slice-prover.prompt.md`.

Conflict order: current code > source-of-truth/roadmap > decisions,
AGENTS.md, PRD > proof scripts > slice packet > anything historical.
The PRD (`AI-Eligibility-Case-Study-Description.md`, repo root) is the
supreme scope authority.

## 2. State of the world

No product code exists — no `package.json`, no `client/`, no `server/`.
Docs and prompts only. Slice 0 is marked NOT STARTED; you start it.

## 3. Mission and gate

Build exactly the Slice 0 in-scope list from `roadmap.md`: npm
workspaces scaffold (`client/`, `server/`, `shared/`); Vite + Express +
AI SDK wiring; envelope schema v0 in `shared/`; a chat UI that streams
a plain model reply; README with exact run steps; a root `dev` script
so `npm install && npm run dev` is the entire setup.

Gate, verbatim: "fresh clone runs in under 2 minutes and streams a
reply." Proven by `docs/agent/proof/live-review-script.md` section 1,
steps 1–2. The gate — not effort, not time spent — decides done.

## 4. Non-negotiables

- `npm install && npm run dev` from the repo root is the ENTIRE setup,
  plus `OPENAI_API_KEY` in `.env` (ship `.env.example`; the README
  documents it). A missing key fails at startup with a clear message.
- Nothing from later slices: no guardrails, no middleware stubs, no
  RAG, no tools, no conversation state, no FNS content anywhere — not
  even placeholders. An empty honest shell beats a preview of Slice 1.
- Zod validates every boundary you create (request body, stream
  envelope v0), with schemas defined once in `shared/` and imported by
  both sides. No `any` crossing a boundary.
- One config module in `server/` pins BOTH model ids: the agent model
  (used now) and the classifier model (reserved for Slice 1). Choose
  sensible current defaults, comment the choice, and flag both ids in
  your report for the user to confirm.
- Code rules: imports at the top of the module only, never inline;
  exhaustive `switch` over unions/enums with a `never` default case.
- Every new runtime dependency gets a one-line justification in your
  report. The dependency list stays demo-explainable.
- Do not commit or push unless the user explicitly asks.

## 5. Forks vs. free choices

- FORK — stop and escalate: anything that changes product semantics
  (user-visible wording, guardrail behavior, what counts as PII, corpus
  content, verdict language, envelope semantics beyond v0). Record it
  under "Open questions / forks hit" in the packet and STOP. Never let
  the first code written settle a decision.
- FREE CHOICE — yours, just record it: ports, folder layout inside each
  workspace, dev tooling (e.g. tsx vs nodemon, concurrently), Vite
  config, markdown renderer. Free choices must not contradict any
  decision doc; note them in the README or your report.

## 6. Workflow

- Phase 1 — Plan (adopt `slice-planner.prompt.md`): confirm the packet,
  produce an ordered list of small verifiable tasks ending with the
  gate run. Zero open forks before Phase 2.
- Phase 2 — Implement (adopt `slice-implementer.prompt.md`): build only
  the packet scope. `npm run dev` works after every step.
- Phase 3 — Prove (adopt `slice-prover.prompt.md`): act as the
  reviewer. Pristine copy, timer on, README as the only instructions:
  `npm install && npm run dev`, open the app, send "hello", watch the
  reply stream progressively. Record Do / Expected / Observed for
  live-review section 1, steps 1–2.

Close the loop in the same session — not later:

- Update `docs/agent/source-of-truth.md`: one claim per new behavior,
  each citing file path(s) and the proof step that exercised it.
- Update the Current status section of `docs/agent/orientation.md`.
- The packet forbids touching `docs/agent/roadmap.md`; the single
  sanctioned exception is the Slice 0 heading's status marker
  (NOT STARTED → gate outcome, dated). Definitions, scopes, and gates
  stay untouched.
- Check every box of the packet's done-when honestly.

## 7. Report back, in this shape

Gate verdict (PASS/FAIL, with the measured setup time); evidence per
proof step (Do / Expected / Observed); tree of files created;
dependencies added, each with its one-line justification; the two model
ids chosen; free choices made; forks hit (expect none); source-of-truth
entries added; exceptions recorded (expect none).

## 8. Hard stop

Slice 0 ends at its gate verdict. Do not start Slice 1, do not scaffold
its files, do not "prepare" middleware. If the gate fails, report the
shortest list of blocking items — never widen scope to compensate.
