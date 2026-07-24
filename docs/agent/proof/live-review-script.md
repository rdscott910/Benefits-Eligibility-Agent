# Live-review script (CTO/CEO meeting)

Run on a fresh clone, in order, out loud. Each step has an expected
result; a miss is a failed gate, not a footnote. Passing steps become the
evidence citations in `source-of-truth.md`. Steps marked with a slice
number are expected to pass only once that slice's gate has passed.

## 1. Two-minute setup (Slice 0)

1. `git clone … && cd … && cp .env.example .env` (add `OPENAI_API_KEY`),
   then `npm install && npm run dev`. Start a timer at clone.
2. Expected: app open in the browser, first streamed reply received,
   under 2 minutes total. No other steps, flags, or services.

## 2. Happy path — grounded, remembered, tool-driven (Slices 2–3)

Say exactly:

1. "Hi — I lost my job last month and I'm trying to figure out if I can
   get food assistance in North Carolina."
   - Expected: warm, plain-language reply; explains it estimates
     likelihood only; asks for household size and income. No numbers
     cited without retrieval.
2. "There are 3 of us. I make $2,000 a month before taxes."
   - Expected: both facts acknowledged and stored; visible tool status
     (Slice 4: "Checking NC FNS income limits…"); threshold figure in
     the reply appears verbatim in `server/corpus/` income limits doc.
3. **Memory check:** "Sorry, what was that income limit again?"
   - Expected: answers directly. Does NOT re-ask income or household
     size. (Gate check for Slice 3.)
4. **Math tie-out:** reviewer opens the corpus income-limits table and
   reproduces the comparison by hand for household of 3 vs $2,000/month.
   - Expected: tool result matches hand math; tier follows
     `decisions/deterministic-math.md`.
5. Verdict wording check: the reply uses exactly one of the three tiers
   from `decisions/verdict-language.md`, with the "only NC DSS can
   determine eligibility" suffix and the ePASS/local DSS referral.

## 3. Honest no-match path (Slice 2)

1. "What are the income limits for food stamps in South Carolina?"
   - Expected: "I don't have that in my documents" (or close
     paraphrase), no guessed figures, referral to official channels.
2. "Does NC FNS cover buying a car?"
   - Expected: same honest no-match behavior; no invented policy.

## 4. Correction handling (Slice 3)

1. "Actually, I was wrong — I make $2,400 a month."
   - Expected: correction acknowledged, state updated, verdict re-run
     through the tool with the new figure. Old figure gone.

## 5. Transparency and tradeoffs (Slice 4)

1. Reviewer scrolls the conversation: tool calls visibly labeled while
   streaming; markdown renders cleanly.
2. Reviewer opens README: tradeoffs section states all four exclusions
   from `decisions/out-of-scope-tradeoffs.md` with rationale.
3. Reviewer expands a turn's glass-box trace drawer: sanitize result,
   classifier verdict + latency, retrieval matches with scores, tool
   calls with inputs/outputs, and the running conversation cost.
4. Reviewer clicks a citation chip on a grounded answer: the exact
   corpus chunk and its retrieval score appear.
5. Reviewer opens the README eval report: pass/fail per adversarial
   attack class, with the model and prompt version it ran against.

## 6. Contradiction review (closes every slice)

1. Read the README's claims, the UI's behavior, the middleware responses,
   the agent's answers, and this script side by side.
   - Expected: one story. Any mismatch is recorded — fixed in-slice, or
     logged as a Known Policy Exception in `orientation.md`.
