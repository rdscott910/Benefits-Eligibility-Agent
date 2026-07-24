# docs/agent/ — the truth stack

This directory is the harness that keeps agent sessions honest. Read
`orientation.md` first in every cold start.

## Index

| File | Role |
| --- | --- |
| `orientation.md` | Cold-start entry: authority model, status, conventions |
| `source-of-truth.md` | What is REAL in the code today, with evidence |
| `roadmap.md` | Gated slices, dependency order, scope-revision log |
| `decisions/` | One short doc per settled policy (<30 lines each) |
| `proof/live-review-script.md` | Demo/proof script for the CTO/CEO meeting |
| `proof/adversarial-script.md` | Guardrail attack and edge-case script |

## Rules for this directory

1. Docs here are claims, not truth. Code wins every disagreement; a doc
   that disagrees with code is a bug — fix the doc or file a Known Policy
   Exception in `orientation.md`.
2. `source-of-truth.md` is updated in the same slice that changes
   behavior, never later. Every claim cites a file path plus the proof
   step or test that exercised it.
3. Decision docs are settled policy. Reopening one requires a dated
   revision note inside it, not a new contradictory doc.
4. No doc here may exceed 80 lines except `roadmap.md` and the two proof
   scripts. Decision docs stay under 30 lines.
5. If a proposed new doc would not change what an agent does in the
   upcoming slices, do not create it.
