# Source of truth — what is REAL in the code today

This file lists only behavior that exists in code and has been exercised.
Every entry cites a file path AND the proof-script step or test that
verified it. No entry may cite a decision doc, the roadmap, or a plan as
evidence — those are claims about what should exist, not proof that it
does. Update this file in the same slice that changes behavior, never
later.

Entry format:

```
- <capability, one line> — evidence: <file path(s)>; verified by:
  <proof script step / test / command>
```

## Verified capabilities

Nothing is built. This repository contains no product code. The emptiness
of this section is accurate and intentional — do not add entries without
code evidence and a verification step.

## Verified non-capabilities (honest gaps worth naming)

- There is no runnable app: `npm install && npm run dev` does not work yet
  (no `package.json` exists). Slice 0 changes this.
