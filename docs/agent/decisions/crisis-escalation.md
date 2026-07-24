# Decision: crisis escalation

**Decision.** Crisis input pauses, not ends, the eligibility
conversation. The crisis response fully replaces that turn and surfaces:
988 Suicide & Crisis Lifeline (call/text 988), NC 211 (food, housing,
urgent needs — call 211), and Feeding the Carolinas food bank locator.
Conversation state survives; the user may resume and previously stated
facts are still remembered.

**Rules (testable).**

- Crisis detection outranks every other classification and every
  capability, including helpfulness (`guardrail-precedence.md`).
- A crisis turn produces no eligibility content, no tool calls, and no
  retrieval — resources and a compassionate handoff only.
- The resource list is exactly the three above; changes require a dated
  revision note here.
- After a crisis turn, a follow-up eligibility question works without
  re-asking previously stated facts.

**Rejected alternatives.** Ending the session (punishes a user in
distress who still needs food assistance); listing many resources (dilutes
the three that matter).

**Date.** 2026-07-21, settled with user.
