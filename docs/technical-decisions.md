# Technical decisions — what we chose, why, and the tradeoffs

Narrative summary of every technical decision settled so far, for human
readers (and the live review). The binding versions live in
`docs/agent/decisions/` — one short doc per decision, with testable
rules. If this summary ever disagrees with those docs or with code, this
summary is the bug.

One constraint shapes everything below: the PRD's guiding principle —
"smaller scope done well beats broad scope half-baked, every time."
Every tradeoff was decided by asking which option protects honesty and
safety at demo time, not which is more capable.

## 1. Stack: React + Vite, Express + TypeScript, Vercel AI SDK, Zod

- **Chose:** npm workspaces — `client/` (React + Vite), `server/`
  (Express + TS), and `shared/` — using the Vercel AI SDK
  (`@ai-sdk/openai`), Zod schemas at every boundary. `shared/` owns the
  cross-boundary schemas and every mandatory string (verdict tiers,
  suffix, referral, crisis resources), defined once and imported by both
  sides. Setup must be exactly `npm install && npm run dev`.
- **Why:** the live review inspects architecture. A separate Express
  backend makes the guardrail-middleware-before-agent-loop layering
  visible and explainable; the AI SDK gives streaming and tool calling
  without custom plumbing; a shared package makes schema and wording
  drift a compile error instead of a review finding.
- **Tradeoff:** a Next.js monolith would be less wiring, but it hides
  the middleware-first request path we most want to show. We accepted
  slightly more boilerplate for legibility. (`stack-boundaries.md`)

## 2. In-memory vector store, no external database

- **Chose:** build the vector store from `server/corpus/` markdown at
  startup; nothing persisted, nothing external.
- **Why:** the corpus is six documents — milliseconds to embed and load.
  Any external store adds setup friction that breaks the 2-minute rule
  and an operational dependency that adds nothing at this corpus size.
- **Tradeoff:** no scale story and re-embedding on every boot. Both are
  irrelevant at this corpus size; we say so rather than pretend
  otherwise. (`stack-boundaries.md`, `out-of-scope-tradeoffs.md`)

## 3. Corpus: six dated markdown snapshots, no live fetching

- **Chose:** income limits, household/deeming rules, allowable
  deductions, how-to-apply, resource/asset limits, work requirements —
  each snapshotted with source URL and date in front matter.
- **Why:** a curated, dated corpus makes every answer auditable in the
  demo: a reviewer can open the file and find the figure. Live fetching
  adds fragility, legal risk, and non-reproducible demos.
- **Tradeoff:** the data can go stale. We chose visible staleness (dated
  snapshots, "current published limits" phrasing) over invisible
  wrongness. We also cut the broader policy-manual corpus — more
  coverage wasn't worth diluting a corpus we can verify line by line.
  (`corpus-scope.md`)

## 4. Grounding: no parametric benefit knowledge, ever

- **Chose:** every rule, figure, or threshold in an answer must trace to
  a retrieved corpus chunk. Retrieval enforces an explicit similarity
  threshold — a weak best match takes the no-match path, never a
  weak-evidence answer — and grounded answers carry clickable citation
  chips showing the exact chunk and its score. No match → "I don't have
  that in my documents" plus referral to official channels.
- **Why:** the model "knows" SNAP rules — stale, blended across states,
  confidently wrong. Plausible-sounding wrong benefit numbers are the
  exact harm this product exists to avoid.
- **Tradeoff:** the agent answers fewer questions than the model could.
  That is the point: truth before breadth — a graceful refusal beats an
  invented rule. (`grounding-policy.md`)

## 5. All arithmetic in deterministic Zod tools

- **Chose:** income-threshold comparisons, household-size effects, and
  deduction math run in typed TypeScript tools; the model narrates tool
  results and never computes numbers itself. The verdict tier is
  selected by tool output.
- **Why:** LLM arithmetic is unreliable, and a benefits estimate is the
  worst place to discover that. Deterministic tools make the demo's math
  tie-out possible: a reviewer reproduces the result by hand from the
  corpus table.
- **Tradeoff:** more code than letting the model "just answer," and the
  agent must ask for missing inputs instead of guessing. Slower
  conversations, checkable answers. (`deterministic-math.md`)

## 6. Guardrails pre-flight: sanitize, then classify

- **Chose:** two stages before the agent loop ever sees a message.
  Stage 1 sanitizes — deterministic PII redaction so the raw value never
  reaches the classifier, logs, or state. Stage 2 classifies into a
  closed Zod enum ordered crisis > injection > PII > out-of-scope >
  proceed; the first matching class short-circuits everything
  downstream.
- **Why:** post-hoc filtering lets the model see hostile input first and
  react unpredictably. Pre-flight ordering makes precedence a testable
  property, not an emergent behavior. Crisis outranks all because a user
  in danger is not an eligibility conversation; injection outranks PII
  so an injected message can't manipulate the PII response path — and
  the sanitize stage makes "PII never leaks" structural even when a
  higher class wins.
- **Tradeoff:** every message pays a classification hop (latency), and
  over-triggering is a real risk — the adversarial script explicitly
  tests that ordinary money stress does NOT trip the crisis path.
  (`guardrail-precedence.md`)

## 7. Crisis pauses the conversation, never ends it

- **Chose:** a crisis turn is fully replaced by resources (988, NC 211,
  Feeding the Carolinas) and a compassionate handoff — no eligibility
  content, no tools, no retrieval. State survives; the user can resume
  without re-stating facts.
- **Why:** the person in distress still needs food assistance. Ending
  the session punishes them at their worst moment; pausing takes the
  moment seriously without abandoning the task.
- **Tradeoff:** resuming demands the crisis response coexist with intact
  conversation state — slightly more state care than a hard reset.
  Worth it. (`crisis-escalation.md`)

## 8. PII: reject-and-explain, not accept-and-ignore

- **Chose:** unnecessary PII (SSN, full DOB, license, account numbers)
  is refused before the agent loop: we explain it's never needed for a
  likelihood estimate and ask the user to resend without it. The value
  never enters state or logs and is never echoed back.
- **Why:** silently holding data the user should never have sent is the
  worse posture — and invisible in a demo. An explicit, kind refusal is
  auditable and teaches the user something true about the system.
- **Tradeoff:** one extra turn of friction for the user who pasted an
  SSN. Acceptable. (`pii-handling.md`)

## 9. Verdict language: three tiers, always suffixed, always referred

- **Chose:** exactly "you likely qualify" / "you may qualify" / "you
  likely do not qualify," always followed by "based on the current
  published limits — only NC DSS can determine eligibility" and a
  referral to ePASS (epass.nc.gov) or the local county DSS office.
  Words like "eligible," "approved," "guaranteed" are banned.
- **Why:** the agent estimates likelihood; only the agency determines
  eligibility. Fixed phrasing makes the boundary verifiable in the demo
  instead of hoping the model stays humble. The mandatory strings are
  rendered by the server/UI from `shared/` constants as structured
  parts — the model narrates around them and never authors them, so it
  cannot paraphrase its way into "approved."
- **Tradeoff:** two-tier (never affirming upward) was safer but less
  useful; free-form phrasing was more natural but unverifiable. Three
  fixed tiers with a mandatory suffix keeps both usefulness and
  humility. (`verdict-language.md`)

## 10. State: browser memory only, never re-ask, corrections win

- **Chose:** stated facts (income, household size, county) live in
  browser memory for the session and ride along with each request as a
  Zod `CaseFile` — per fact `{value, status, sourceTurn}`, mutated only
  by an explicit `updateCaseFile` tool. Nothing is stored server-side; a
  refresh clears everything, and the README says so. Facts are never
  re-asked; corrections replace old values; contradictions flip the fact
  to needs-confirmation and get one clarifying question, not a guess.
- **Why:** re-asking is the fastest way to lose a user with messy input;
  and no data at rest means nothing to breach — privacy is the feature,
  especially on shared or library computers.
- **Tradeoff:** no resuming after refresh. We rejected localStorage
  deliberately: benefit data lingering on a shared machine is a harm,
  not a feature. (`state-memory.md`)

## 11. Deliberate cuts: databases, submissions/scraping, voice, auth

- **Chose:** no external databases; no real agency submissions or
  live-government scraping; no voice; no auth or persistence beyond
  browser memory.
- **Why, per cut:** databases — six files don't need one (see #2);
  submissions/scraping — the PRD forbids it, and it carries legal and
  correctness risk a proof-of-concept must not take on; voice — text
  serves the messy-input use
  case without stacking ASR errors on a safety-critical pipeline; auth —
  no accounts means no benefit data at rest.
- **Tradeoff:** these are defended cuts, not gaps. Re-admitting any of
  them requires a dated entry in the roadmap's scope-revision log.
  (`out-of-scope-tradeoffs.md`)

## 12. Classifier: hybrid, fail-closed, topic-level scope

- **Chose:** deterministic fast-paths first (SSN regex is definitive; a
  short high-precision crisis phrase list short-circuits immediately),
  then a small fast model constrained to the Zod verdict enum, with the
  user message passed as delimited data — never as instructions.
  Classifier failure fails closed: a safe "please try again" refusal,
  never unclassified input reaching the agent. Logs carry verdicts and
  timings only, never message content.
- **Why:** pure regex is brittle on paraphrase ("I want to disappear");
  LLM-only has no deterministic floor for the definitive cases. The
  scope boundary is topic-level on purpose: "not about food assistance
  at all" is refused pre-flight, while on-topic but out-of-corpus
  questions proceed to the honest RAG no-match path.
- **Tradeoff:** fail-closed means a model-provider hiccup pauses all
  traffic — acceptable and defensible for a live demo; the alternative
  breaks the integrity layer. (`classifier-design.md`)

## 13. Transparency: a glass box, not a marketing claim

- **Chose:** every assistant turn — guardrail short-circuits included —
  carries a typed trace the UI renders as a per-turn drawer: sanitize
  result as kinds and counts only ("redacted: ssn ×1", never a value),
  classifier verdict + latency + tokens, retrieval matches with scores,
  tool calls with their real Zod-validated inputs and outputs, and a
  running conversation cost (token counts plus a dollar figure labeled
  an estimate, from prices pinned with a dated comment). Tool-status
  labels while streaming come from the typed tool parts themselves, and
  citation chips click open to the exact corpus chunk and score.
- **Why:** the integrity layer is only credible if a reviewer can see it
  operating. A drawer that shows the real pipeline — including "not
  run" on a crisis turn and a redaction the user can verify — turns
  every claim in this document into something checkable in the demo.
- **Tradeoff:** the drawer shows less than it could — no message text,
  no redacted values, nothing the pipeline didn't actually produce. A
  drawer that honestly shows less beats one that fabricates detail; and
  dollar costs will drift as providers reprice, which is why tokens are
  the durable fact and the dollars say "estimate."
  (`trace-transparency.md`)

## 14. Process: gated slices, one at a time

- **Chose:** five roadmap slices (skeleton → guardrails → RAG → tools +
  state → transparency + proof), each with an explicit gate; the next
  starts only when the current gate passes. Guardrails deliberately
  precede RAG.
- **Why:** safety is foundational truth here — it precedes capability
  the way a ledger precedes reports. Gates force finished loops
  (including failure modes) instead of five half-built features.
- **Tradeoff:** the impressive demo moments (grounded answers, tool
  math) land later in the build. Accepted: a half-safe agent that demos
  well is exactly the failure the PRD warns against. (`roadmap.md`)
