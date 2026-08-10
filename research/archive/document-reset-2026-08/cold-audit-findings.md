# DOC-GOV-RESET-2026-08 cold-audit record

Auditor: independent agent `019fec72-a153-7790-8059-e31a38ffe593`

## First audit

Verdict: `NOT AUDIT-OK-PENDING-FULL-CHECK`

- BLOCKER: the brief fingerprint method did not match the auditor's recomputation.
- HIGH: the active UX-MANA heading did not yet have active scenario destinations.
- HIGH: fast/domain lanes did not expose Solo preservation or store tests.
- HIGH: diff forbidden scanning did not include untracked files.
- MEDIUM: two active contracts mentioned archive/process material.

## Corrections

- Added `scripts/checks/fingerprint.mjs` as the canonical changed-file fingerprint helper.
- Added `ACC-MANA-002` through `ACC-MANA-007`, mapped from UX-MANA-1 through UX-MANA-6.
- Added the `solo-preservation` domain, store test selection, and fast-lane Solo preservation execution.
- Included non-ignored untracked files in explicit-base forbidden scans.
- Removed archive/process references from active contract bodies.

## Re-audit

The same independent auditor rechecked the five affected claims on the updated frozen candidate and returned:

`AUDIT-OK-PENDING-FULL-CHECK`

No findings remained. This is a semantic audit verdict, not release approval. The release full check is the next required gate.

## Release gate closure

On the same fingerprint, the single post-audit `npm run check` passed all 14 machine steps in `222.859s`: core 207 files / 1,837 tests, DOM 248 files / 1,739 tests, and one production build. No push, merge, release, or Pages publication was performed.
