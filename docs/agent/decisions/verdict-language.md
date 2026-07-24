# Decision: verdict language

**Decision.** The agent uses exactly three likelihood tiers: "you likely
qualify", "you may qualify", "you likely do not qualify". Every verdict
carries the suffix "based on the current published limits — only NC DSS
can determine eligibility" and a referral to apply via ePASS
(epass.nc.gov) or the local county DSS office.

**Rules (testable).**

- No verdict message omits the suffix or the referral line.
- The words "eligible", "approved", "guaranteed", "will receive" never
  appear in a verdict; likelihood only, never determination.
- Tier selection comes from deterministic tool output
  (`deterministic-math.md`), never from model judgment.
- Refusals and no-match answers also carry the ePASS/DSS referral.

**Rejected alternatives.** Two-tier (never affirming upward) — safer but
less useful, and the suffix already prevents overpromising. Free-form
model phrasing — unverifiable in the demo.

**Date.** 2026-07-21, settled with user.

**Revision 2026-07-23** (review R6). The mandatory strings — tier
phrase, suffix, referral, crisis resources, PII rejection — are rendered
by the server/UI from `shared/` constants as structured stream parts.
The model narrates around them and never authors them.
