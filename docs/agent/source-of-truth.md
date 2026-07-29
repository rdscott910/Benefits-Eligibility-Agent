# Source of truth — what is REAL in the code today

This file lists only behavior that exists in code and has been exercised.
Every entry cites a file path AND the proof-script step or test that
verified it. Update this file in the same slice that changes behavior.

## Verified capabilities

- Fresh-copy setup: `npm install && npm run dev` opens the chat UI —
  evidence: `package.json`, `client/vite.config.ts`, `server/src/index.ts`;
  verified by: `live-review-script.md` §1 steps 1–2 (4s to first reply).
- Streaming chat UI — evidence: `client/src/App.tsx`,
  `server/src/routes/chat.ts`; verified by: §1 step 2 progressive render.
- Envelope v1 Zod validation before any model call — evidence:
  `shared/src/envelope.ts`; verified by: malformed body → HTTP 400.
- Fail-fast missing `OPENAI_API_KEY` with auto-restart — evidence:
  `server/src/config.ts`; verified by: no `.env` → clear exit; add key →
  tsx reruns and listens.
- Pinned models — evidence: `server/src/config.ts` (`gpt-5.6-terra` /
  `gpt-5.4-nano`); verified by: agent streamed reply; classifier eval.
- Pre-flight Stage 1 sanitize (SSN/account redaction; income untouched)
  — evidence: `server/src/middleware/sanitize.ts`; verified by:
  `npm test` + adversarial C1/E2 (raw SSN absent from sanitized payload
  and stream).
- Pre-flight Stage 2 classify with crisis/injection fast-paths, nano
  model, fail-closed — evidence: `server/src/middleware/classify.ts`,
  `server/src/middleware/pipeline.ts`; verified by: `npm run eval` and
  live API gate for A–F (all pass; prompt v2, `gpt-5.4-nano`).
- Templated short-circuits + UI badges from `shared/` constants —
  evidence: `shared/src/guardrails.ts`, `client/src/App.tsx`; verified
  by: browser crisis turn shows "Support resources" badge and 988/211/
  Feeding the Carolinas; C1 PII template names kind without echoing.
- Precedence crisis > injection > pii > out_of_scope — evidence:
  `resolvePrecedence` + injection fast-path; verified by: E1 crisis wins,
  E2 injection wins with SSN still redacted.
- Eval report in README — evidence: `README.md`, `server/src/eval/`;
  verified by: `npm run eval` 2026-07-28, all attack classes and
  grounding items Pass (classifier prompt v3, agent prompt v3).
- Six-document corpus as dated markdown with Zod-validated front matter
  (source URL + snapshot date), exactly the six settled doc ids enforced
  at load — evidence: `server/corpus/*.md`, `server/src/corpus/loader.ts`;
  verified by: `npm test` corpus suite + boot log "corpus ready: 6
  documents, 34 chunks".
- Income-limits table parsed at boot into a Zod-validated typed table;
  unparseable table refuses to boot, no fallback numbers — evidence:
  `server/src/corpus/income-table.ts`, `server/src/index.ts`; verified
  by: `npm test` malformed-fixture cases + boot log "income-limits table
  validated (8 rows)".
- In-memory vector store rebuilt from corpus at startup; embeddings
  cached gitignored, keyed by sha256 of model id + chunk content —
  evidence: `server/src/retrieval/store.ts`, `.gitignore`; verified by:
  fresh boot "embeddings built in 820ms" then restart "loaded from cache
  in 5ms" (live-review §1-style timed run, 2026-07-28).
- Cosine retrieval with an explicit similarity threshold (0.28, top 4);
  below-bar matches are never shown to the model — evidence:
  `server/src/config.ts` (calibration notes), `server/src/retrieval/store.ts`;
  verified by: `npm test` threshold cases + live calibration probes
  (on-topic 0.30–0.62 vs noise ≤ 0.134, recorded in config comment).
- Grounded answering on the proceed path only: retrieval → excerpts with
  citation ids in the system prompt → typed `data-retrieval` part
  (envelope v2) rendered as source chips with scores — evidence:
  `server/src/agent/respond.ts`, `server/src/agent/prompt.ts`,
  `shared/src/grounding.ts`, `shared/src/envelope.ts`,
  `client/src/App.tsx`; verified by: live UI 2026-07-28 — household-of-3
  answer quotes $4,442/$2,888 verbatim from
  `server/corpus/income-limits.md` with income-limits chips; eval R3.
- Honest no-match path: model must emit "I don't have that in my
  documents." when excerpts cannot answer; server detects the sentence
  and emits a `no_match` part; the UI renders the official ePASS/DSS
  referral from `shared/` constants (never model-authored) — evidence:
  `server/src/agent/no-match.ts`, `shared/src/grounding.ts`,
  `client/src/App.tsx`; verified by: live-review §3 items 1 and 2 in the
  browser (South Carolina; buying a car), eval R1/R2.
- Agent system prompt forbids parametric benefit knowledge, arithmetic,
  verdicts, and determination language — evidence:
  `server/src/agent/prompt.ts` (v3); verified by: eval R1–R4 (no
  ungrounded figures; warm opener stays conversational).
- Guardrail short-circuits never invoke retrieval or the agent —
  evidence: `server/src/routes/chat.ts` (retrieval only in the `proceed`
  branch); verified by: live crisis turn 2026-07-28 shows the badge and
  988 resources with no retrieval footer and no retrieval log line.
- Classifier prompt v3 makes the settled out_of_scope boundary explicit
  (program-coverage questions proceed to the RAG no-match path) —
  evidence: `server/src/middleware/classify.ts`, dated revision in
  `decisions/classifier-design.md`; verified by: `npm run eval`
  2026-07-28 — attack classes A–F all Pass, R1/R2 assert `proceed`
  through the full pipeline.

## Verified non-capabilities (honest gaps worth naming)

- No deterministic math tools and no likelihood verdicts: the agent may
  quote published limits but never computes or compares them; the
  parsed income table is consumed by nothing yet (Slice 3) — evidence:
  `server/src/agent/prompt.ts` rules 5–6.
- No CaseFile / multi-turn fact memory; retrieval embeds only the latest
  sanitized user message, so stated facts are not carried into later
  retrieval (Slice 3). Crisis "facts still remembered" across resume is
  deflection-only until Slice 3; A2 verifies resume proceeds, not recall.
- No tool-status streaming, no glass-box trace drawer, no clickable
  citation chips (chunk + score inspection), and no GFM table rendering
  in the client — the agent prompt avoids pipe tables instead (Slice 4).
- Nothing persisted server-side; refresh clears the transcript. Rejected
  PII user messages are dropped from client state so they are not re-sent.
  The only file written is the gitignored embeddings cache (public
  corpus vectors, never user input).
