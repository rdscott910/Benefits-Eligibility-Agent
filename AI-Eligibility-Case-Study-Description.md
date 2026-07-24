# **AI Eligibility Agent for Social Services**

## **Overview**

You are building a proof-of-concept text-based AI agent that helps a resident determine whether they likely qualify for a public benefits program. We'll use NC FNS (North Carolina’s SNAP food-assistance program) as our example, but you are welcome to pick any comparable program with public eligibility rules. The agent should hold a natural, multi-turn conversation with the user, ask the questions it needs, ground its answers in a small knowledge base of public eligibility documents, and return a useful, honest assessment.

<aside>

🔔 Note - we reference public programs as examples only. Please do not build anything that submits real applications, contacts a real agency, or scrapes any government system. Use only public eligibility documents you assemble yourself.

</aside>

**What we're testing:** We want to see four things at this stage: (1) architectural judgment for AI agent design, (2) guardrail thinking, (3) failure-mode reasoning, and (4) reasoning about tradeoffs. We care much more about how you think through these than about volume of features shipped.

**Our expectations:**

- You spend ~20 hours working on this case study
- We pay you $200 to start the case study (*to cover any/all development/LLM costs*)
- We pay you $800 after submitting a case study solution (*to compensate you for your time*)
- **You submit your solution and attend a review meeting 7 days after beginning** (after receiving this case study)
- We strongly prefer **smaller scope done well over broad scope half-baked**. 15–20 hours is short on purpose: it should force you to make meaningful tradeoffs about what a demo-quality agent needs. Tell us what you cut and why.

**At a high level, the agent must:**

1. **Hold a multi-turn text conversation** with a user who wants to know if they qualify for the program.
2. **Ground its answers in a knowledge base** of public eligibility documents (RAG, embeddings, or any retrieval approach you prefer) rather than relying on the model's parametric memory.
3. **Use tools / structured logic** where appropriate (e.g., an eligibility calculation, income thresholds, household-size lookups) instead of hand-waving the rules.
4. **Track conversation state** across turns - remembering what the user has already told it and asking only for what it still needs.

**You'll impress us, if the agent can:**

1. **Handle guardrails gracefully** - refusals for out-of-scope asks, crisis escalation if a user discloses distress, and sensible handling of PII.
2. **Survive adversarial and messy input** - prompt-injection attempts ("ignore previous instructions"), ambiguous answers ("I make about $2,500/month"), off-topic detours, and self-contradictions across turns.