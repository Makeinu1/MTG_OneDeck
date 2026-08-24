# O4P-08D Implementer Brief

Milestone: `O4P-08D`
Base: `bfedd42099d1d315ba13d9ace7da2498f47909fe`

## Ownership

Implementer owns runtime source and ordinary tests needed for:

- `src/online/publicApp/**`
- `src/components/online/**` except every `review.*`
- `src/online/projection/**` except every `review.*`
- `src/online/browser/**` except every `review.*`
- `src/online/workbench/**`, `src/online/tableDisplay/**`,
  `src/online/displayPairing/**`, and `src/online/guidedActions/**`, except every
  `review.*`
- narrow `src/online/cloudflare/**` runtime/ordinary tests if the additive full
  variable projection requires it
- narrow `src/App.tsx`/CSS integration when required by the public selector.

The implementer is not alone in the codebase. Preserve concurrent Judge files,
do not revert others' edits, and accommodate them. Do not touch git,
`review.*`, `AGENTS.md`, `CLAUDE.md`, `docs/**`, ledger, loop-state, dependency
manifests, build configuration, or governance files.

## Required implementation

Implement the frozen D contract and make the Judge review tests pass. Prefer
additive versioned adapters over reinterpreting existing wire bytes. Keep
hidden-information checks, bounded parsing, secret scrubbing, deterministic
state, and exact-roster invariants intact. Add `data-testid` to principal new
controls and Japanese user-facing copy.

Run targeted non-review tests only. Report changed files, test commands/results,
deferred scope, and unresolved issues. Do not run full `npm run check` and do not
commit.
