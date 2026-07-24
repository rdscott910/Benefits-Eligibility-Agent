# Decision: grounding policy

**Decision.** Every eligibility rule, figure, or threshold in an answer
must trace to a retrieved chunk of the curated corpus. The model
contributes phrasing and empathy, never benefit knowledge. When retrieval
finds no adequate match, the agent says so plainly and refers out.

**Rules (testable).**

- Every benefit figure in an answer appears verbatim in a corpus
  document (live-review script checks this).
- No-match wording: "I don't have that in my documents" (or close
  paraphrase), never a guess — followed by the ePASS/local DSS referral
  per `verdict-language.md`.
- The system prompt forbids parametric SNAP/FNS knowledge even when the
  model "knows" the answer; an out-of-corpus question about another
  state's limits must take the no-match path.
- Corpus content changes only via `corpus-scope.md` rules.

**Rejected alternatives.** Letting the model fill gaps with general SNAP
knowledge — plausible-sounding stale numbers are the exact failure this
product exists to avoid ("truth before breadth").

**Date.** 2026-07-22, recorded from PRD.

**Revision 2026-07-23** (mentor review). Retrieval enforces an explicit
similarity threshold: a best match below the bar takes the no-match
path — never a weak-evidence answer. Grounded answers carry citation
ids, rendered in the UI as chips showing the chunk and its score.
