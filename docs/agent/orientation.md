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

- Active slice: none. Slice 0 (Skeleton and honest shell) is next.
- Nothing is built. There is no product code in this repository yet.
- Last gate passed: none.

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
- Deterministic tools live in `server/tools/`, one file per tool, Zod
  input/output schemas colocated. Threshold constants are parsed from
  corpus markdown at boot into a Zod-validated table; if parsing fails,
  the server refuses to boot — no hardcoded fallback numbers.
- Corpus lives in `server/corpus/` as dated markdown snapshots with
  citation ids; the in-memory vector store is built from it at startup
  (embeddings cached gitignored, keyed by content hash). No live
  fetching.
- Zod at every boundary: tool I/O, middleware classifications, API
  payloads, conversation state.
- Streaming: every response path — guardrail short-circuits included —
  emits the same Vercel AI SDK stream envelope with typed parts
  (guardrail verdict, verdict block, CaseFile update, tool status). The
  UI renders tool status (e.g. "Checking NC FNS income limits…") and
  guardrail badges from parts, never from model text.

## Known Policy Exceptions

None recorded. When implementation must diverge from a decision doc, add a
dated entry here (what diverged, why, which doc) — never diverge silently.
