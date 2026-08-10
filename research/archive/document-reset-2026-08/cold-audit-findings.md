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

## Post-commit CI gate correction

The first Pages workflow run for commit `cdad530267a7286d16454cf376a825378c6b4cdd` passed `npm run check` but failed the forbidden scan because the shallow checkout did not contain `github.event.before` (`fatal: bad object 7da637ba225cad8097686e261d1d1c92964ee16a`). The judge correction added `fetch-depth: 0` and passed the explicit `governance-reset` policy to the workflow scan; the Pages gate test was updated accordingly.

The next cold audit found and required closure of:

- HIGH: the governance-reset allowlist was too broad. It now enumerates the reset files and rejects non-script `package.json` changes.
- MEDIUM: `ACC-ONLINE-001` claimed a live API check through a static boundary test. It is now manual-only with no automatedBy claim.
- MEDIUM: contract `lastVerifiedCommit` values pointed to a pre-contract base. They now point to `cdad530267a7286d16454cf376a825378c6b4cdd`.
- MEDIUM: `AGENTS.md` referenced a removed engine-spec I-series. It now refers to active engine-contract invariants.
- MEDIUM: `ACC-TURN-001` used implementation/test agreement as its oracle despite the unresolved turn-one-draw conflict. It is now deferred/manual-only and names `CONFLICT-TURN-DRAW-001` as the blocking boundary.

## Final re-audit

The same independent cold auditor rechecked the updated frozen candidate and returned:

`AUDIT-OK-PENDING-FULL-CHECK`

Final candidate fingerprint: `43c0d655b0bb3f911e86a01f58cebbe26d36d7a1973aa5f52b7e63e9702ea259`. Target gates were 15/15 green, Solo preservation was 14/14 green, and both original monolith archives remained byte-identical. The release full check was the next required gate.

## Final release full check

On the same fingerprint, `npm run check -- --build-base=/MTG_OneDeck/` passed all 14 machine steps in `207.883s`: core 207 files / 1,837 tests, DOM 248 files / 1,739 tests, and one production build. The build produced the Pages base-path artifact and no further candidate files were changed afterward.
