# Slice intake packet — shared by planner, implementer, prover

Fill this once per slice; paste it into every session working that slice.
Authority: `approved-scope` — it defines the slice, never product truth
beyond it. Stale packets are `historical`: discard when the slice closes.

```
## Slice packet: <slice number and name from roadmap.md>

- Date opened: <YYYY-MM-DD>
- Intent (one sentence, copied from roadmap.md):
- Gate (verbatim from roadmap.md):

### Authority citations (read before working)

- Decisions in force for this slice: <list decisions/*.md that apply>
- Source-of-truth entries this slice depends on: <list, or "none">
- Proof-script steps this slice must make pass: <list step numbers>

### Files in play

- Expected to create: <paths>
- Expected to modify: <paths>
- Must NOT touch: <paths — e.g. other slices' territory>

### Done-when (all must hold)

- [ ] Gate passes, demonstrated via the proof-script steps above
- [ ] source-of-truth.md updated with evidence citations, in this slice
- [ ] orientation.md status section updated
- [ ] No contradiction across README / UI / middleware / agent / demo
      script (or exception logged)
- [ ] Any decision fork hit during work was settled as a decision doc,
      not by default

### Open questions / forks hit (planner fills, or "none")

- <question> → <settled how, date>
```
