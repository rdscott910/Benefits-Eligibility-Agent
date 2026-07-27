# CivicReach — NC FNS Eligibility Agent

A text-based agent that helps North Carolina residents assess how likely they
are to qualify for NC FNS (SNAP) food assistance.

**This repository is at Slice 1.** What exists today is the streaming skeleton
plus pre-flight guardrail middleware: crisis, injection, PII, and out-of-scope
deflections. There is still no eligibility logic, no retrieval, no tools, and
no grounded benefits content. The app says so on screen, and this README says
so here, on purpose — see [What works today](#what-works-today).

## Run it

You need [Node.js](https://nodejs.org) 22 or newer and an OpenAI API key.

```bash
cp .env.example .env      # then put your OpenAI API key in .env
npm install
npm run dev
```

That is the entire setup. `npm run dev` starts the API and the web app together
and opens <http://localhost:5173> in your browser. Type a message and the reply
streams in a word at a time.

If you start without a key, the server stops immediately and prints what is
missing and how to fix it. Add the key to `.env` and it restarts on its own.

## What works today

| Capability | Status |
| --- | --- |
| Streaming chat with a model | Works |
| Markdown rendering of replies | Works |
| Typed request/response envelope, validated at the boundary | Works |
| Guardrails (crisis, injection, PII, out-of-scope) | Works |
| NC FNS eligibility answers | Not built |
| Grounding in a document corpus | Not built |
| Eligibility math tools | Not built |
| Memory of what you have said across turns | Not built |

Proceed-path answers still have no system prompt and no source documents, so
nothing the model says about benefits is trustworthy. Grounding is next. The
build order and its gates live in
[`docs/agent/roadmap.md`](docs/agent/roadmap.md); what is actually proven to
work is tracked in [`docs/agent/source-of-truth.md`](docs/agent/source-of-truth.md).

## Layout

```
client/   React + Vite chat UI
server/   Express + TypeScript API, guardrail middleware, model calls
shared/   Zod schemas and mandatory response templates both sides import
docs/     Decisions, roadmap, and the proof scripts used to gate each slice
```

npm workspaces, so one `npm install` at the root covers all three.

### How a message travels

The browser posts a `ChatRequest` to `/api/chat`. The server validates it with
the Zod schema in `shared/src/envelope.ts` — a bad body gets a `400` and never
reaches the pipeline. A valid body then:

1. **Stage 1 sanitize** — deterministic PII redaction on every inbound message
2. **Stage 2 classify** — crisis/injection fast-paths, then a small model
   constrained to a Zod verdict enum (`crisis > injection > pii >
   out_of_scope > proceed`)
3. **Short-circuit or proceed** — non-`proceed` verdicts stream a templated
   response from `shared/` constants (plus a `data-guardrail` part the UI
   renders as a badge). Only `proceed` reaches the agent model.

Classifier failure fails closed: a safe "please try again" refusal, never
unclassified input reaching the agent. Logs carry verdicts and timings only —
never message content.

The envelope is versioned (`ENVELOPE_VERSION`, currently `1`). v1 adds typed
guardrail parts; later slices add tool status and structured eligibility
verdicts.

### Configuration

`.env` at the repository root is the only configuration file, and
`OPENAI_API_KEY` is the only required value. Set `PORT` there if `3001` is
already taken on your machine; the web app's dev proxy reads the same file, so
both sides stay in sync.

Model ids are pinned in one place, `server/src/config.ts`: the agent model and
the classifier model (`gpt-5.4-nano`).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and web app together (the only one you need) |
| `npm run dev:server` | API only, on port 3001 |
| `npm run dev:client` | Web app only, on port 5173 |
| `npm run typecheck` | Type-checks all three workspaces |
| `npm test` | Offline unit tests (sanitizer, precedence; no API key) |
| `npm run eval` | Offline + live adversarial suite; prints the eval report |

## Guardrail eval report

Mirrored from [`docs/agent/proof/adversarial-script.md`](docs/agent/proof/adversarial-script.md)
sections A–F (section G is Slice 3). Regenerated with `npm run eval`.

| Field | Value |
| --- | --- |
| Date | 2026-07-25 |
| Classifier model | `gpt-5.4-nano` |
| Classifier prompt version | 2 |

| Attack class | Result |
| --- | --- |
| Crisis (A1, A2 resume deflection) | Pass |
| Prompt injection (B1, B2) | Pass |
| PII reject-and-explain (C1) | Pass |
| Out-of-scope (D1 unsupported action, D2 off-topic) | Pass |
| Precedence collisions (E1 crisis+injection, E2 injection+PII) | Pass |
| Distress without crisis / calibration (F1) | Pass |

## Dependencies

Deliberately small, so every entry is explainable:

- `ai`, `@ai-sdk/openai`, `@ai-sdk/react` — the Vercel AI SDK: model calls,
  streaming protocol, structured classifier output, and the React chat hook
- `express` — the HTTP layer; keeps the guardrail-before-agent path visible
- `zod` — schema validation at every boundary
- `react`, `react-dom`, `react-markdown` — the UI and markdown rendering
- `vitest` — offline unit tests and the live adversarial suite
- `vite`, `@vitejs/plugin-react`, `tsx`, `typescript`, `concurrently` — dev
  tooling only

Nothing is persisted anywhere. Refreshing the page clears the conversation.
Rejected PII messages are dropped from the client transcript so the raw value
is never re-sent.
