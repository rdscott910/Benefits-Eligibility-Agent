# Decision: corpus scope

**Decision.** The curated corpus is exactly six NC FNS source documents,
snapshotted as dated markdown in `server/corpus/`: (1) income limits
table, (2) household composition / deeming rules, (3) allowable
deductions, (4) official "how to apply" page, (5) resource/asset limits,
(6) work requirements. No live fetching, ever.

**Rules (testable).**

- Each corpus file's front matter records source URL and snapshot date.
- Retrieval draws only from `server/corpus/`; no network calls at answer
  time.
- Questions outside these six documents take the honest no-match path
  (`grounding-policy.md`) — they are not answered from model memory.
- Adding a seventh document is a scope revision: dated roadmap log entry
  plus a dated revision note here.

**Rejected alternatives.** Minimal 4-doc set (left common asset/work
questions ungrounded); full policy-manual excerpts (dilutes the corpus
with content we cannot verify line by line, weakening auditability).

**Date.** 2026-07-21, settled with user.
