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
  verified by: `npm run eval` 2026-07-25, all attack classes Pass.

## Verified non-capabilities (honest gaps worth naming)

- No retrieval/corpus, tools, CaseFile memory, or grounded FNS content.
  Proceed still uses `streamText` with messages only — evidence:
  `server/src/routes/chat.ts`.
- Crisis "facts still remembered" across resume is deflection-only until
  Slice 3; A2 verifies resume proceeds, not CaseFile recall.
- Nothing persisted server-side; refresh clears the transcript. Rejected
  PII user messages are dropped from client state so they are not re-sent.
