# Source of truth — what is REAL in the code today

This file lists only behavior that exists in code and has been exercised.
Every entry cites a file path AND the proof-script step or test that
verified it. Update this file in the same slice that changes behavior.

## Verified capabilities

- Fresh-copy setup: `npm install && npm run dev` opens the chat UI —
  evidence: `package.json`, `client/vite.config.ts`, `server/src/index.ts`;
  verified by: `live-review-script.md` §1 on a TRUE fresh clone
  (2026-07-29 gate run): `git clone` → first streamed reply in the
  browser in 49 s total; the first boot built embeddings in 1188 ms (a
  fresh clone has no cache).
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
- Three deterministic Zod tools at `server/src/tools/` (path clarified in
  `decisions/deterministic-math.md`, 2026-07-29), all consuming the
  boot-parsed income-limits table — no hardcoded figures: `lookupIncomeLimits`
  (published limits by unit size, sizes above 8 extended with the corpus's
  each-additional increments), `checkIncomeThreshold`, `updateCaseFile` —
  evidence: `server/src/tools/*.ts`; verified by: `npm test` tools suite
  (verbatim row for household of 3, >8 arithmetic, boundary tiers) + live
  browser §2 2026-07-29.
- The threshold check reads income and household size only from the
  working CaseFile and returns a typed refusal when either is missing or
  `needs_confirmation` — it cannot be called with guessed inputs —
  evidence: `server/src/tools/check-income-threshold.ts` (empty input
  schema); verified by: `npm test` refusal cases + eval G1 (vague income
  → no verdict).
- Tier selection is the settled mapping (gross ≤ 130% limit → likely
  qualify; ≤ 200% → may qualify; above → likely do not qualify;
  boundaries inclusive) implemented in `selectTier`, never model
  judgment — evidence: `server/src/tools/check-income-threshold.ts`,
  dated revision in `decisions/deterministic-math.md`; verified by:
  `npm test` boundary cases + live-review §2.4 hand tie-out 2026-07-29
  ($2,000 vs $2,888/$4,442 → "you likely qualify" matches hand math).
- CaseFile state round-trip (envelope v3): the browser holds the
  session CaseFile, sends it with each request (`caseFile` in
  `chatRequestSchema`, Zod-validated, unknown fields dropped), the
  `updateCaseFile` tool is the only mutation path
  (`{value, status: stated|needs_confirmation|confirmed, sourceTurn}`),
  and the server returns the post-turn state as a `data-casefile` part
  the client stores wholesale — evidence: `shared/src/casefile.ts`,
  `shared/src/envelope.ts`, `server/src/tools/update-case-file.ts`,
  `server/src/agent/respond.ts`, `client/src/App.tsx`; verified by:
  `npm test` transition + envelope suites, live browser "What I know so
  far" strip 2026-07-29.
- Stated facts are never re-asked — the system prompt (v4) injects a
  KNOWN FACTS block from the request CaseFile — and facts survive a
  crisis pause (short-circuits never touch tools or state) — evidence:
  `server/src/agent/prompt.ts`, `server/src/routes/chat.ts`; verified
  by: live-review §2.3 memory check in the browser 2026-07-29 (limits
  answered without re-asking) and adversarial A2 full check (browser +
  eval "A2 full": income still on file after the crisis turn, not
  re-asked on resume).
- Corrections replace and are acknowledged; contradictions flip the fact
  to `needs_confirmation` and cost exactly one clarifying question; only
  settled values reach the math tools — evidence:
  `server/src/tools/update-case-file.ts` (deterministic transition
  table); verified by: live-review §4 2026-07-29 ($2,400 correction
  re-ran the check, old figure gone) and eval G2 (plain contradicting
  figure → clarifying question, verdict only after confirmation).
- Likelihood verdicts are structured stream parts, never model text: the
  server emits `data-verdict` from the threshold tool's output only, and
  the UI renders the tier phrase, the "based on the current published
  limits — only NC DSS can determine eligibility" suffix, and the
  ePASS/DSS referral from `shared/` constants; the model is forbidden to
  author them (prompt v4 rule 8) — evidence: `shared/src/verdict.ts`,
  `server/src/agent/respond.ts`, `client/src/App.tsx`; verified by:
  live-review §2.5 in the browser 2026-07-29 (verdict block wording) +
  `npm test` prompt check (tier phrases appear only inside the
  do-not-write rule).
- Tool telemetry logs tool name, latency, and outcome (a status word or
  tier) — never fact values or message content — evidence:
  `server/src/log.ts` (`logTool`), tool executors; verified by: dev-log
  inspection during the 2026-07-29 live run (e.g.
  `{"type":"tool","tool":"checkIncomeThreshold","outcome":"ok:likely_qualify"}`).
- Envelope v4: every response path — proceed, guardrail short-circuit,
  and fail-closed — emits a per-turn `data-trace` part built only from
  metadata the pipeline already computed (sanitize kinds/counts,
  resolved verdict + deciding source + latency + classifier tokens,
  retrieval latency + embedding tokens, agent token usage, estimated
  cost) — evidence: `shared/src/trace.ts`, `shared/src/envelope.ts`,
  `server/src/trace.ts` (`traceForOutcome`), `server/src/routes/chat.ts`,
  `server/src/agent/respond.ts`; verified by: `npm test` trace suite +
  raw-stream probes 2026-07-29 (proceed, crisis fast-path, and PII turns
  each carried a schema-valid `data-trace`).
- Streaming tool-status labels render from the AI SDK's typed
  `tool-<name>` parts — a label can only appear for a real invocation,
  never from model text, and shows a running state while the call is in
  flight — evidence: `client/src/App.tsx` (`ToolStatusStrip`,
  `TOOL_STATUS_LABELS`), `shared/src/tools.ts` (`CivicReachUITools`);
  verified by: browser MutationObserver log 2026-07-29 ("Updating your
  case file…" and "Checking NC FNS income limits…" observed in running
  state, flipping to done when the tool output part arrived) —
  live-review §2 item 2's visible-tool-status clause.
- Clickable citation chips: citations carry the chunk's heading and
  exact markdown text, and clicking a chip opens the chunk with its
  cosine score inline — evidence: `shared/src/grounding.ts`
  (`citationSchema`), `server/src/agent/respond.ts` (`retrievalPartFor`),
  `client/src/App.tsx` (`CitationDetail`); verified by: live browser
  2026-07-29 (income-limits#1 opened to the exact corpus section, score
  0.297, its pipe table rendered) — live-review §5 item 4; `npm test`
  schema round-trip.
- Per-turn glass-box trace drawer on every assistant turn, following
  `decisions/trace-transparency.md`: sanitize shown metadata-only
  ("redacted: ssn ×1", never a value), classifier verdict + latency +
  tokens, retrieval matches with scores (or an honest "not run" on
  short-circuits), tool calls with their real Zod-parsed inputs/outputs,
  and per-turn + running-session cost — evidence: `client/src/App.tsx`
  (`TraceDrawer`), `docs/agent/decisions/trace-transparency.md`; verified
  by: live browser 2026-07-29 — proceed drawer showed all five sections
  with real values; crisis drawer showed fast-path verdict, no model
  call, retrieval/tools not run, $0; PII drawer showed `ssn ×1` with the
  raw value absent from the entire page — live-review §5 item 3.
- Running-cost display: token counts are per-model facts from API usage;
  the dollar figure is an estimate from per-1M-token prices pinned with a
  dated comment (2026-07-29), and the UI labels it an estimate; session
  totals are summed client-side and die on refresh — evidence:
  `server/src/config.ts` (`PRICING_USD_PER_1M_TOKENS`),
  `server/src/trace.ts` (`estimateCostUsd`), `client/src/App.tsx`
  (`totalsFromTraces`); verified by: `npm test` cost-math cases + live
  browser cost section accumulating across four turns.
- GFM table rendering with agent prompt v5: `remark-gfm` renders tables
  in replies and in citation-chip chunk details, and prompt v5 lifts the
  v4 "do not write pipe tables" STYLE rule in the same change —
  evidence: `client/src/App.tsx` (`ChatMarkdown`),
  `server/src/agent/prompt.ts` (v5); verified by: live browser
  2026-07-29 (corpus limits table rendered as a real table inside a
  chip) + `npm run eval` fully green on prompt v5.
- "What I know so far" panel shows each stored fact's value AND status
  (stated / needs confirmation / confirmed) with the session-only
  notice, and an honest empty state — evidence: `client/src/App.tsx`
  (`CaseFilePanel`); verified by: live browser 2026-07-29 (both facts
  listed with status chips; panel intact after a crisis pause and a PII
  rejection).
- Tool I/O schemas are cross-boundary contracts in
  `shared/src/tools.ts` (client Zod-parses tool payloads before
  rendering them); executors stay one-file-per-tool in
  `server/src/tools/` — evidence: `shared/src/tools.ts`,
  `server/src/tools/*.ts`, dated note in
  `decisions/deterministic-math.md`; verified by: `npm run typecheck`
  all workspaces + `npm test` tools suite unchanged.

## Verified non-capabilities (honest gaps worth naming)

- Retrieval still embeds only the latest sanitized user message —
  CaseFile facts are remembered and fed to the prompt/tools but do not
  enrich the retrieval query (recorded free choice, slice-3 packet;
  the memory check passes without it).
- Only gross-income screening exists: no deduction/net-income
  calculators, no utility-allowance math, no benefit-amount estimation
  (roadmap scopes exactly the income-threshold and household-size
  tools). The 100% net limit is displayed as published, never computed
  against.
- The trace drawer's sanitize summary covers the latest user turn only
  (each earlier turn already carries its own trace), and the dollar
  figure it shows is an estimate from dated pinned prices — token
  counts are the durable fact.
- Nothing persisted server-side; refresh clears the transcript AND the
  CaseFile (browser memory only, stated in the UI panel and README).
  Any short-circuited user message that contained detected PII is
  dropped from client state so it is never re-sent — pii-verdict turns
  and collisions where another class won (e.g. injection+SSN) alike;
  the trace part's sanitize summary is what tells the client a
  redaction occurred (Slice 4 mid-proof fix, 2026-07-29: previously
  only pii-verdict messages were dropped, so an injection+SSN message
  lingered in history and Stage 1's definitive-SSN rule rejected every
  later clean turn — adversarial E2→F1 in sequence now passes;
  evidence: `client/src/App.tsx` `mustDropPriorUserMessage`). PII
  short-circuits never reach the agent loop or the `updateCaseFile`
  tool, so rejected content cannot enter state. The only file written
  is the gitignored embeddings cache (public corpus vectors, never
  user input).
