# Slice packet: Slice 2 — Grounded RAG

- Date opened: 2026-07-28
- Intent (one sentence, copied from roadmap.md): every benefit fact in an
  answer traces to the curated corpus.
- Gate (verbatim from roadmap.md): every benefit figure in an answer
  appears in a corpus document, and an out-of-corpus question gets "I
  don't have that in my documents" plus the official referral.

## Authority citations (read before working)

- Decisions in force for this slice: `corpus-scope.md`,
  `grounding-policy.md` (incl. 2026-07-23 threshold/citation revision),
  `stack-boundaries.md`; from `verdict-language.md` ONLY the
  no-match/refusal referral rule and the determination-language ban —
  likelihood tiers and the structured verdict part are Slice 3.
- Source-of-truth entries this slice depends on: streaming chat shell,
  envelope v1 validation, guardrail pipeline (sanitize → classify →
  short-circuit or proceed), pinned model ids, fail-fast env.
- Proof-script steps this slice must make pass:
  `live-review-script.md` §3 item 1 (South Carolina limits) and item 2
  (buying a car); from §2, only the Slice 2 checks — a grounded NC FNS
  answer whose benefit figures appear verbatim in `server/corpus/`, and
  no numbers cited without retrieval. The memory check, math tie-out,
  tool status, and verdict wording are Slice 3/4 and are NOT claimed.

## Files in play

- Expected to create: `prompts/packets/slice-2.md`; `server/corpus/`
  (six docs: `income-limits.md`, `household-composition.md`,
  `deductions.md`, `how-to-apply.md`, `resource-limits.md`,
  `work-requirements.md`); `shared/src/grounding.ts`;
  `server/src/corpus/` (loader, chunker, income-table parser + tests);
  `server/src/retrieval/` (embedding cache + cosine store + tests);
  `server/src/agent/` (system prompt builder, respond flow + tests);
  `server/src/eval/grounding.eval.ts`.
- Expected to modify: `shared/src/envelope.ts` (v2 `data-retrieval`
  part), `shared/src/index.ts`; `server/src/index.ts` (boot order),
  `server/src/config.ts` (embedding pin, retrieval constants),
  `server/src/routes/chat.ts` (proceed branch delegates to respond),
  `server/src/log.ts` (retrieval event), `server/src/eval/report.ts`
  (grounding bucket); `client/src/App.tsx`, `client/src/index.css`;
  `.gitignore` (embeddings cache); `README.md`;
  `docs/agent/source-of-truth.md`, `docs/agent/orientation.md`; the
  Slice 2 status marker on `docs/agent/roadmap.md` (nothing else there).
- Must NOT touch: guardrail middleware behavior
  (`sanitize.ts`/`classify.ts`/`pipeline.ts`), guardrail templates and
  precedence, crisis resources, PII policy; math tools, CaseFile/state
  memory, verdict tiers, tool-status streaming, glass-box drawer;
  proof-script content (except running it); decision docs (no
  divergence expected); no seventh corpus document.

## Done-when (all must hold)

- [x] Gate passes, demonstrated via the proof-script steps above
- [x] source-of-truth.md updated with evidence citations, in this slice
- [x] orientation.md status section updated
- [x] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [x] Any decision fork hit during work was settled as a decision doc,
      not by default

## Open questions / forks hit (planner fills, or "none")

- Embedding model pin (flagged for user confirmation per handoff §4) →
  settled 2026-07-28 with user: `text-embedding-3-small`, pinned in
  `server/src/config.ts` beside the agent/classifier pins; zero new
  dependencies.
- No-match / referral mechanism (product-semantics fork predicted by
  handoff §6) → settled 2026-07-28 with user: the system prompt mandates
  the exact sentence "I don't have that in my documents." whenever the
  excerpts cannot answer; the server deterministically detects that
  sentence in the finished reply and emits a typed `no_match` part; the
  UI renders the official ePASS/DSS referral from a `shared/` constant.
  The model never authors the referral (verdict-language R6). Rejected:
  below-threshold server template (breaks conversational turns; misses
  the other-state case, which retrieves NC docs with high similarity);
  model-authored referral (violates R6, unverifiable).

## Free choices recorded (do not contradict decision docs)

- Chunking: markdown heading sections, tables kept whole, stable ids
  `<doc_id>#<n>` in document order.
- Similarity threshold: 0.28 (top 4), settled 2026-07-28 by live
  calibration over the real 34-chunk corpus — on-topic phrasings score
  0.30–0.62, clear noise ≤ 0.134; full probe table in the
  `server/src/config.ts` comment.
- Embeddings cache: `server/.embeddings-cache.json` (gitignored), keyed
  by sha256 of embedding model id + chunk content; rebuilt on any corpus
  change; first boot may build it (README documents this).
- Citation surfacing for Slice 2: typed `data-retrieval` stream part
  with citation ids + scores rendered as minimal chips; no inline
  citation markers in model text; clickable chunk/score UX is Slice 4.
- Retrieval query is the latest sanitized user message only; carrying
  stated facts into later turns' retrieval is Slice 3 (CaseFile).

## Closed 2026-07-28 — GATE PASSED

Live-review §3 both items pass in the browser (South Carolina and
buying-a-car both answer "I don't have that in my documents." with the
UI-rendered ePASS/DSS referral and zero figures); grounded check quotes
$4,442 / $2,888 verbatim from `server/corpus/income-limits.md` with
income-limits citation chips; `npm run eval` 2026-07-28: attack classes
A–F and grounding R1–R4 all Pass (classifier prompt v3, agent prompt v3,
`text-embedding-3-small`, threshold 0.28). Fresh boot built embeddings
in 820ms; restart loaded them from cache in 5ms; a live crisis turn
showed the badge and 988 resources with no retrieval invoked.

Files touched beyond the original contract, with reasons:

- `server/src/middleware/classify.ts` + dated revision in
  `decisions/classifier-design.md` — classifier prompt v2 mislabeled the
  gate question "Does NC FNS cover buying a car?" as `off_topic`,
  short-circuiting the required no-match path. classifier-design.md
  already ruled that out_of_scope is topic-level only and on-topic
  out-of-corpus questions proceed; v3 states that boundary explicitly.
  Bug fix toward the settled decision (handoff allows guardrail changes
  when they block the Slice 2 gate); A–F re-verified green.
- `client/index.html` — page title still said "development shell";
  contradiction closure with the new UI/README story.

This packet is now `historical`.
