# Orientation — cold-start entry point

## Authority model (classify context before acting)

| Authority | Examples | Never use for |
| --- | --- | --- |
| `canonical` | source-of-truth.md, roadmap.md | proof without code evidence |
| `policy` | decisions/*, AGENTS.md, the PRD | claiming a feature exists |
| `proof` | proof/*.md | silently defining new scope |
| `approved-scope` | the active slice packet | product truth beyond the slice |
| `historical` | old chat context, stale packets | current behavior |

Conflict order: current code > canonical > policy > proof > slice packet >
historical. The PRD (`AI-Eligibility-Case-Study-Description.md`, repo
root) is the supreme scope authority: nothing enters the roadmap that the
PRD excludes, and PRD must-haves cannot be cut without a dated entry in
the roadmap's scope-revision log.

## Reading order

1. `AGENTS.md` (repo root) — hard rules, stack, integrity layer
2. This file — authority model, status, conventions
3. `source-of-truth.md` — what actually exists today
4. `roadmap.md` — the active slice and its gate
5. `decisions/` docs relevant to the active slice

## Current status

- Active slice: Slice 4 (Transparency UX + proof hardening) — the FINAL
  slice. Implementation complete 2026-07-29; the fresh-clone gate run
  (live-review §1–§6 end to end) is pending. After its gate verdict the
  roadmap ends: there is no Slice 5, only the live review itself.
- Built so far: Slice 0 shell, Slice 1 guardrails, Slice 2 grounded RAG,
  Slice 3 deterministic tools + multi-turn state — three Zod tools
  consuming the boot-parsed income-limits table (`lookupIncomeLimits`,
  CaseFile-gated `checkIncomeThreshold`, `updateCaseFile` as the only
  state mutation path), session CaseFile in browser memory traveling
  with each request, likelihood verdicts as structured `data-verdict`
  parts rendered from `shared/` constants, KNOWN FACTS injected into the
  agent prompt so stated facts are never re-asked — and Slice 4
  transparency (envelope v4, agent prompt v5): per-turn `data-trace`
  glass-box drawer on every response path, tool-status labels from typed
  tool parts, clickable citation chips revealing the exact chunk +
  score, GFM tables, the "What I know so far" panel with fact statuses,
  README tradeoffs section, and pinned pricing for the cost estimate
  (`decisions/trace-transparency.md`).
- Last gate passed: Slice 3, 2026-07-29 — live-review §2 items 2–5
  (memory check answered without re-asking; math tie-out reproduced by
  hand: household of 3, $2,000 ≤ $2,888 at 130% → "you likely qualify")
  and §4 correction in the browser; §3 re-proven; `npm run eval` all
  attack classes A–F, grounding R1–R4, and messy-input G1–G2 Pass
  (agent prompt v4, envelope v3). Evidence in `source-of-truth.md`.

Update this section when a slice starts, passes its gate, or is blocked.

## Architecture conventions

- Express layering: request → Zod envelope validation (shared schemas) →
  Stage 1 sanitize (deterministic PII redaction) → Stage 2 classify
  (`decisions/guardrail-precedence.md`, `decisions/classifier-design.md`)
  → templated short-circuit or agent loop → single stream envelope. A
  non-`proceed` verdict never invokes the agent, retrieval, or tools.
- npm workspaces: `client/` (React + Vite), `server/`
  (Express + TypeScript), `shared/` (cross-boundary Zod schemas and all
  mandatory-language constants — defined once, imported by both sides).
- Deterministic tools live in `server/src/tools/` (path clarified
  2026-07-29 in `decisions/deterministic-math.md` — the server build
  typechecks `src` only), one file per tool. Since Slice 4 the tool I/O
  Zod schemas live in `shared/src/tools.ts` (the client renders tool
  I/O, making it a cross-boundary contract; dated note in the same
  decision doc). Threshold constants are parsed from corpus markdown at
  boot into a Zod-validated table; if parsing fails, the server refuses
  to boot — no hardcoded fallback numbers.
- Corpus lives in `server/corpus/` as dated markdown snapshots with
  citation ids; the in-memory vector store is built from it at startup
  (embeddings cached gitignored, keyed by content hash). No live
  fetching.
- Zod at every boundary: tool I/O, middleware classifications, API
  payloads, conversation state.
- Streaming: every response path — guardrail short-circuits included —
  emits the same Vercel AI SDK stream envelope with typed parts
  (guardrail verdict, verdict block, CaseFile update, per-turn trace,
  typed tool parts). The UI renders tool status (e.g. "Checking NC FNS
  income limits…"), guardrail badges, and the glass-box drawer from
  parts, never from model text.

## Known Policy Exceptions

None recorded. When implementation must diverge from a decision doc, add a
dated entry here (what diverged, why, which doc) — never diverge silently.
