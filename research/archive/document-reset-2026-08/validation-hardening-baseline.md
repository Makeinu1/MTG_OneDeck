# VALIDATION-HARDENING-2026-08 baseline

## Identity and environment

- Base SHA: `502d5312d0bb8b59eb768c0e8c3ab5f015565861`
- Branch: `main`
- Worktree: clean before baseline capture
- Node: `v24.12.0`
- npm: `11.7.0`
- Product/runtime files were not edited during Phase 0.

## Baseline full check

`npm run check -- --build-base=/MTG_OneDeck/` passed before implementation edits.

- 14 machine steps passed
- core: 207 test files / 1,837 tests
- DOM: 248 test files / 1,739 tests
- one production build with Pages base path
- total: `203.514s`

## Baseline inventory

- `docs/contracts/manifest.json`: 14 entries, 13 active contracts, 1 generated entry
- `docs/acceptance/scenarios.json`: 18 scenarios; active 16, deferred 1, periodic 1
- active clause IDs matching `ENG-*` / `UI-*` / `AV-*`: 0
- `verifiedBy`: path-level arrays only; `check-docs.mjs` verifies file existence, not markers or clause coverage
- `lastVerifiedCommit`: 40-hex format check only; no `cat-file`, ancestor, or stale contract/test diff check
- migration map: 334 source entries, 334 unique headings, 33 legacy IDs, 2 source documents; no row/normative-item inventory
- old acceptance archive: 101,446 bytes, 72 headings, 614 table rows
- old engine archive: 514,532 bytes, 262 headings, 192 table rows
- `scripts/checks/domain-check.mjs`: 11 domains; each engine/UI domain selects 1–2 explicit test files, `--list` is ignored and runs tests

## Hypothesis reproduction

### H1 — confirmed

`.github/workflows/deploy-pages.yml` invokes:

```text
npm run check:forbidden -- --diff ${{ github.event.before || 'HEAD^' }} --policy governance-reset
```

In a temporary Git repository with an untracked `src/engine/changed.ts`, default policy exited 0 and emitted `NEEDS-REAUTH`; explicit `governance-reset` exited 1 with `DOC-GOV-RESET scope`.

### H2 — confirmed

`fast-check.mjs` reads only `git status --short`. It has no `--base`, `--head`, `git diff`, cached-diff, or untracked-file collection logic. A clean worktree with a committed change cannot be represented by the current detector.

### H3 — confirmed

The current fast selector has no unknown-path fallback, escalation level, mode output, JSON/dry-run output, or base validation. It only recognizes a small set of `src/*` and `scripts/*` prefixes; unknown/config paths can select no tests and still exit successfully.

### H4 — confirmed

Domain definitions are hard-coded in `domain-check.mjs` and select representative paths rather than all contract-area tests. `--list` is not parsed; it is ignored after the domain argument. There is no dependency expansion, zero-match failure, dry-run output, or duplicate-file resolver.

### H5 — confirmed

Manifest `verifiedBy` entries identify files such as `src/engine/__tests__/init.test.ts`, but no clause ID or marker is required. `check-docs.mjs` checks only that listed paths exist.

### H6 — confirmed

`check-docs.mjs` validates only `/^[0-9a-f]{40}$/` for `lastVerifiedCommit`. The current commit is an ancestor of the recorded `cdad530...`, but no implementation check enforces existence, ancestry, or contract/test staleness.

### H7 — confirmed

`migration-map.json` has one entry per former heading and no representation for legacy table rows, acceptance rows, normative sentences, text hashes, dispositions, or target clause IDs.

### H8 — partially confirmed; requires clause-level comparison

Active contracts are short prose documents without normative clause IDs. The archive retains substantially finer-grained acceptance/table and engine-spec material, but the current registry cannot prove which active behavior remains covered, deferred, or historical at item level. No runtime change is authorized to resolve any resulting semantic conflict.

## Baseline command evidence

- `npm run check:fast`: docs PASS, lint/typecheck executed, no affected tests selected on clean worktree
- `npm run check:domain <domain> --list`: executed tests instead of listing; representative counts ranged from 1 to 3 files
- temporary forbidden policy reproduction: default allowed ordinary `src/engine` with NEEDS-REAUTH; governance-reset rejected it; invalid diff ref failed nonzero with Git's bad-ref error
- `git cat-file`/ancestor probe: recorded commit exists and is an ancestor, but the repository checker does not perform these checks
