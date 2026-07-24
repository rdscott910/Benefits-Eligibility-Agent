# Decision: PII handling

**Decision.** Unnecessary PII (SSN, full DOB, driver's license, financial
account numbers) is rejected-and-explained: the middleware declines to
process the message, explains that a likelihood estimate never requires
this information, and asks the user to resend without it.

**Rules (testable).**

- A message containing an SSN is never forwarded to the agent loop; the
  rejected message is not stored in conversation state.
- The rejection names what was detected in kind ("a Social Security
  number"), never echoes the value back.
- Necessary facts (income amounts, household size, county) are NOT PII
  under this policy and pass through freely.
- The rejection includes one line of reassurance and the invitation to
  continue, so the conversation survives the refusal.

**Rejected alternatives.** Accept-and-ignore — silently holding data the
user should never have sent is a worse posture and an invisible demo
story; reject-and-explain is auditable in the adversarial script.

**Date.** 2026-07-21, settled with user.
