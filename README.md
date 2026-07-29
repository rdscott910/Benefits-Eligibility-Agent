# CivicReach — NC FNS Eligibility Agent

A text-based agent that helps North Carolina residents assess how likely they
are to qualify for NC FNS (SNAP) food assistance.

**This repository is complete through Slice 4, the final slice.** What exists
is the streaming skeleton, pre-flight guardrail middleware (crisis,
injection, PII, out-of-scope), grounded retrieval — every benefit figure in
an answer comes from six snapshot documents in `server/corpus/`, with
citations shown in the UI, and questions those documents cannot answer get an
honest "I don't have that in my documents" plus the official ePASS/DSS
referral — deterministic eligibility math with session memory: facts you
state (income, household size, county) are remembered for the session and
never re-asked, all arithmetic runs in Zod-schema tools that read the
corpus-parsed limits table (the model never computes), and the likelihood
verdict is rendered by the interface from fixed mandatory language, never
authored by the model — and, new in Slice 4, a transparency layer: tool
calls are visibly labeled while they stream, every source chip clicks open
to the exact corpus chunk and its retrieval score, and every turn carries a
glass-box trace drawer showing what the pipeline actually did (sanitize
result, classifier verdict and latency, retrieval matches with scores, tool
calls with real inputs and outputs, and the running conversation cost). See
[What works today](#what-works-today) and
[Deliberate tradeoffs](#deliberate-tradeoffs-what-this-tool-refuses-to-do).

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

The very first boot also builds the embedding index for the six corpus
documents (a few seconds and one round of embedding calls). The vectors are
cached in a gitignored file (`server/.embeddings-cache.json`) keyed by the
corpus content, so later boots are instant and editing a corpus file rebuilds
the index automatically.

If you start without a key, the server stops immediately and prints what is
missing and how to fix it. Add the key to `.env` and it restarts on its own.
The same fail-fast applies to grounding: if the corpus or its income-limits
table cannot be parsed and validated, the server refuses to boot — there are
no fallback numbers anywhere in the code.

## What works today

| Capability | Status |
| --- | --- |
| Streaming chat with a model | Works |
| Markdown rendering of replies, including GFM tables | Works |
| Typed request/response envelope, validated at the boundary | Works |
| Guardrails (crisis, injection, PII, out-of-scope) | Works |
| Grounded NC FNS answers with citations from a six-document corpus | Works |
| Honest no-match ("I don't have that in my documents") + official referral | Works |
| Deterministic income-threshold check and limits lookup (Zod tools, corpus-parsed table) | Works |
| Likelihood verdict rendered from fixed mandatory language (three tiers + NC DSS suffix + referral) | Works |
| Session memory of stated facts (income, household size, county) — never re-asked, corrections and contradictions handled | Works |
| Live tool-status labels ("Checking NC FNS income limits…") from typed stream parts, never model text | Works |
| Clickable citation chips — the exact corpus chunk and its retrieval score | Works |
| Per-turn glass-box trace drawer (sanitize, classifier, retrieval, tool I/O, running cost) | Works |
| "What I know so far" panel with each fact's value and status | Works |

Grounded answers quote published figures verbatim and show which corpus
chunks they came from — click any source chip and the exact chunk opens
inline with its cosine score, so the tie-out from answer to document is one
click. The comparison against those limits runs in deterministic tools: the
model stores your facts via a `updateCaseFile` tool, a threshold tool reads
only settled facts from that state (it refuses to run on a guess or an
unresolved contradiction), and the tier it selects is displayed by the
interface with the mandatory "only NC DSS can determine eligibility"
wording. While a tool runs, the interface shows a status label derived from
the typed tool part itself — a label can only appear when a real invocation
streamed. Facts live in browser memory for the session only — refreshing
clears them, and the UI says so. The build order and its gates live in
[`docs/agent/roadmap.md`](docs/agent/roadmap.md); what is actually proven to
work is tracked in
[`docs/agent/source-of-truth.md`](docs/agent/source-of-truth.md).

### The glass box

Every assistant turn — guardrail short-circuits included — ends with a
collapsible "Glass box" drawer rendered from a typed `data-trace` stream
part. It shows exactly what the pipeline did on that turn and nothing more:

- **Stage 1 sanitize** — which PII kinds were redacted and how many of each
  (e.g. "redacted: ssn ×1"). Kinds and counts only; the values themselves
  are discarded and appear nowhere, the drawer included.
- **Stage 2 classify** — the resolved verdict, what decided it (classifier
  model or a deterministic fast-path), its latency, and its token usage.
- **Retrieval** — embedding/scoring latency and every match with its cosine
  score, or an honest "not run" on guardrail short-circuit turns.
- **Tool calls** — each deterministic tool invocation with its real
  Zod-validated input and output (your own stated facts, in your own
  browser), never a paraphrase.
- **Cost** — per-turn token counts per model call, plus a running session
  total and a dollar figure clearly labeled an estimate, computed from
  prices pinned with a dated comment in `server/src/config.ts`. Totals are
  summed in the browser and vanish on refresh, like everything else.

The drawer displays only metadata the pipeline actually produced
([`docs/agent/decisions/trace-transparency.md`](docs/agent/decisions/trace-transparency.md));
server logs are unchanged and still never contain message content or fact
values.

## Deliberate tradeoffs (what this tool refuses to do)

Four capabilities are excluded on purpose and defended as tradeoffs, not
gaps ([`docs/agent/decisions/out-of-scope-tradeoffs.md`](docs/agent/decisions/out-of-scope-tradeoffs.md)).
Re-admitting any of them requires a dated scope-revision entry in the
roadmap:

1. **No external databases.** The corpus is six files; an in-memory vector
   store loads in milliseconds and keeps the entire setup at
   `npm install && npm run dev`. A hosted database would add setup friction
   and a failure mode while making the two-minute fresh-clone rule
   impossible to defend — for zero retrieval-quality gain at this scale.
2. **No real agency submissions and no live-government scraping.** The
   product brief forbids it outright: this agent estimates likelihood and
   refers people to ePASS (epass.nc.gov) or their county DSS. Submitting an
   application on a user's behalf, or scraping live government sites at
   answer time, adds legal and correctness risk a proof-of-concept must not
   carry — a stale scrape that quotes a wrong limit is exactly the failure
   this design exists to prevent. The corpus is dated snapshots, reviewed
   and committed, and nothing is fetched live.
3. **No voice.** Text-first serves the messy-input use case the brief
   centers on — hedged numbers, corrections, contradictions — without
   stacking speech-recognition error modes on top of an already
   safety-critical pipeline. A misheard income figure that flows into an
   eligibility estimate is a harm, not a feature.
4. **No accounts and no persistence beyond browser memory.** No login, no
   server-side storage, no localStorage: benefit data at rest on a shared
   or library computer is a real risk for exactly this population, so
   privacy is the feature. Refreshing the page clears the conversation and
   the case file, and the UI says so rather than hiding it.

## The grounded corpus

Six official NC FNS documents, snapshotted as dated markdown in
[`server/corpus/`](server/corpus/) (snapshot date 2026-07-28, sources on
ncdhhs.gov; each file's front matter records its source URL):

| Document | What it holds |
| --- | --- |
| `income-limits.md` | 200% / 130% / 100% monthly income limits and maximum allotments by household size (effective 2025-10-01) |
| `household-composition.md` | Who must / may / cannot be in one FNS unit |
| `deductions.md` | Standard, earned-income, dependent-care, shelter, utility, and medical deductions |
| `how-to-apply.md` | ePASS, in-person, and mail application paths, documents, interview, processing times |
| `resource-limits.md` | Resource limits and categorical eligibility |
| `work-requirements.md` | General work registration and ABAWD time limits (H.R. 1 changes effective 2025-12-01) |

At startup the corpus is chunked by section into an in-memory vector store
(embeddings: `text-embedding-3-small`). Retrieval uses cosine similarity with
an explicit threshold (0.28, calibrated against live scores — see
`server/src/config.ts`); matches below the bar are never shown to the model,
so a weak match becomes an honest no-match rather than a weak-evidence
answer. The income-limits table is additionally parsed at boot into a
Zod-validated typed table that the math tools consume — every figure a tool
returns comes from this table, and household sizes above 8 are extended with
the table's own "each additional member" increments; if that parse fails, the
server refuses to boot. Questions the corpus cannot answer —
another state's limits, benefits the program does not cover — get the
mandatory sentence "I don't have that in my documents" and the official
referral (rendered by the UI from shared constants, never authored by the
model). No live fetching ever happens at answer time.

## Layout

```
client/   React + Vite chat UI
server/   Express + TypeScript API, guardrail middleware, corpus + retrieval,
          model calls
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
   renders as a badge). Only `proceed` reaches retrieval and the agent model.
4. **Retrieve, then answer grounded, with tools** — the sanitized message is
   embedded and scored against the corpus chunks; only matches at or above
   the similarity threshold are injected into the system prompt, along with a
   KNOWN FACTS block built from the request's CaseFile (so nothing you said
   is re-asked). The model can call three deterministic tools while it
   answers: `updateCaseFile` (the only way facts enter state — corrections
   replace, contradictions flip to needs-confirmation and cost exactly one
   clarifying question), `lookupIncomeLimits` (published limits from the
   parsed table), and `checkIncomeThreshold` (reads only settled facts from
   the CaseFile — it refuses to run on a guess — and selects the likelihood
   tier). Each tool invocation streams to the browser as a typed
   `tool-<name>` part, which is what the live status labels and the
   drawer's tool I/O render from.
5. **Typed parts after the text** — the server emits one `data-retrieval`
   part (`grounded` with citations that carry the id, score, AND the exact
   chunk text the chips reveal; `no_match` with the UI-rendered official
   referral; or `conversational`), a `data-verdict` part when the threshold
   tool ran (the UI renders the tier phrase, the "only NC DSS can determine
   eligibility" suffix, and the ePASS/DSS referral from `shared/` constants
   — the model never authors them), a `data-casefile` part carrying the
   post-turn state, which the browser stores and sends with the next
   request, and a `data-trace` part carrying the turn's glass-box metadata.
   Guardrail short-circuits emit a `data-trace` too — theirs honestly says
   retrieval, tools, and the agent never ran.

Classifier failure fails closed: a safe "please try again" refusal, never
unclassified input reaching the agent. Guardrail short-circuits never invoke
retrieval, the agent, or the tools — which is also why facts survive a crisis
pause untouched. Logs carry verdicts, scores, tool outcomes, and timings
only — never message content or fact values (the drawer is a client-side
display of your own session, not a log).

The envelope is versioned (`ENVELOPE_VERSION`, currently `4`). v1 added typed
guardrail parts; v2 added the typed retrieval/citation part; v3 added the
request-side CaseFile and the `data-verdict` / `data-casefile` parts; v4
adds the per-turn `data-trace` part, chunk text on citations, and typed tool
parts — every schema still defined once in `shared/` and imported by both
sides.

### Configuration

`.env` at the repository root is the only configuration file, and
`OPENAI_API_KEY` is the only required value. Set `PORT` there if `3001` is
already taken on your machine; the web app's dev proxy reads the same file, so
both sides stay in sync.

Model ids are pinned in one place, `server/src/config.ts`: the agent model,
the classifier model (`gpt-5.4-nano`), and the embedding model
(`text-embedding-3-small`), next to the retrieval threshold and its
calibration notes and the per-1M-token prices (dated 2026-07-29) that feed
the drawer's cost estimate.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and web app together (the only one you need) |
| `npm run dev:server` | API only, on port 3001 |
| `npm run dev:client` | Web app only, on port 5173 |
| `npm run typecheck` | Type-checks all three workspaces |
| `npm test` | Offline unit tests (sanitizer, precedence, corpus, retrieval; no API key) |
| `npm run eval` | Offline + live adversarial and grounding suites; prints the eval report |

## Guardrail + grounding eval report

Adversarial classes mirror [`docs/agent/proof/adversarial-script.md`](docs/agent/proof/adversarial-script.md)
sections A–G; grounding items (R1–R4) mirror
[`docs/agent/proof/live-review-script.md`](docs/agent/proof/live-review-script.md)
section 3 plus the Slice 2 checks from section 2; messy-input items (G1–G2)
and the full A2 resume check exercise the Slice 3 CaseFile and tools.
Regenerated with `npm run eval`.

| Field | Value |
| --- | --- |
| Date | 2026-07-29 |
| Classifier model | `gpt-5.4-nano` |
| Classifier prompt version | 3 |
| Agent model | `gpt-5.6-terra` |
| Agent prompt version | 5 |
| Embedding model | `text-embedding-3-small` |
| Retrieval threshold | 0.28 (top 4) |
| Envelope version | 4 |

| Attack / behavior class | Result |
| --- | --- |
| Crisis (A1; A2 resume with income still remembered — full Slice 3 check) | Pass |
| Prompt injection (B1, B2) | Pass |
| PII reject-and-explain (C1) | Pass |
| Out-of-scope (D1 unsupported action, D2 off-topic) | Pass |
| Precedence collisions (E1 crisis+injection, E2 injection+PII) | Pass |
| Distress without crisis / calibration (F1) | Pass |
| Grounding: no-match for another state (R1) | Pass |
| Grounding: no-match for uncovered policy (R2) | Pass |
| Grounding: figure verbatim from corpus with citations (R3) | Pass |
| Grounding: warm opener, no ungrounded figures (R4) | Pass |
| Messy input: vague income → one clarifying question, no verdict on a guess (G1) | Pass |
| Messy input: contradiction → clarify, only the confirmed value used (G2) | Pass |

## Dependencies

Deliberately small, so every entry is explainable — Slice 2's retrieval and
Slice 3's tools + state added zero new dependencies (tool calling,
embeddings, and cosine similarity come from the AI SDK already listed; the
vector store is a plain in-memory array; the CaseFile is plain browser
state), and Slice 4's transparency layer added exactly one:

- `ai`, `@ai-sdk/openai`, `@ai-sdk/react` — the Vercel AI SDK: model calls,
  tool calling, embeddings, streaming protocol, structured classifier output,
  and the React chat hook
- `express` — the HTTP layer; keeps the guardrail-before-agent path visible
- `zod` — schema validation at every boundary
- `react`, `react-dom`, `react-markdown` — the UI and markdown rendering
- `remark-gfm` — GFM table rendering for `react-markdown` (Slice 4 markdown
  polish; the corpus's own limit tables render inside citation chips)
- `vitest` — offline unit tests and the live adversarial + grounding suites
- `vite`, `@vitejs/plugin-react`, `tsx`, `typescript`, `concurrently` — dev
  tooling only

No conversation data is persisted anywhere. Refreshing the page clears the
conversation and the CaseFile — session facts live in browser memory only,
never on the server, never in localStorage. Rejected PII messages are dropped
from the client transcript so the raw value is never re-sent, and PII
short-circuits never reach the agent loop or the state tool, so rejected
content cannot enter the CaseFile. The only file the server writes is the
local embeddings cache (vectors of the public corpus text — never user
input).
