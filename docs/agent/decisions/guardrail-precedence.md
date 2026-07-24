# Decision: guardrail precedence

**Decision.** Guardrail middleware runs pre-flight — before the agent
loop, retrieval, or any tool call — and classifies every inbound message
in this precedence order: crisis > prompt injection > PII > out-of-scope.
The first matching class wins and short-circuits the rest of the request.

**Rules (testable).**

- A message that is both a crisis signal and an injection attempt gets
  the crisis response.
- An injection attempt containing an SSN gets the injection deflection
  (the value still never enters state or logs).
- Verdicts are Zod-typed with a closed enum
  (`crisis | injection | pii | out_of_scope | proceed`); adding a class
  requires a dated revision note here.
- Only `proceed` reaches the agent loop; no guardrail path invokes the
  model agent, retrieval, or tools.

**Rejected alternatives.** In-loop (post-hoc) filtering — lets the model
see hostile input first; PII above injection — an injected message could
then manipulate the PII response path.

**Date.** 2026-07-22, recorded from PRD.

**Revision 2026-07-23** (review R2). Two stages: Stage 1 sanitize —
deterministic PII redaction before the classifier, logs, or state see
the raw value — then Stage 2 classify per the precedence above; `pii`
fires when PII was the only issue. Mechanism: `classifier-design.md`.
