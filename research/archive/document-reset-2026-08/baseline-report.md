# DOC-GOV-RESET-2026-08 Phase 0 baseline

- Base SHA: `7da637ba225cad8097686e261d1d1c92964ee16a`
- Branch: `main`
- Worktree: clean before migration
- Runtime: Node `v24.12.0`, npm `11.7.0`
- Dependency install: `npm ci` passed in about 4 seconds (`244 packages`)

## Existing validation

Command: `/usr/bin/time -p npm run check -- --continue-on-error`

- Wall time: `625.98s` (`TOTAL 625771 ms`)
- CR verifier: PASS
- Solo preservation: PASS, 3 files / 14 tests
- lint: PASS
- core Vitest: PASS, 207 files / 1,837 tests / 60.51s
- dom Vitest: PASS, 248 files / 1,738 tests / 468.13s
- build: PASS, `tsc -b` plus Vite build in 34.74s
- 11 TypeScript verifier steps: FAIL in this sandbox with `tsx` IPC pipe `listen EPERM`; this is an execution-environment failure, not a product assertion failure

The current check therefore has a reproducible environment limitation and a very large DOM-test bottleneck. No product source or test was changed to accommodate it.

## Document shape

- `docs/acceptance.md`: 855 lines / 101,446 bytes, 72 headings, 261 identifier-like tokens, 238 unique, 21 duplicated tokens under the initial extractor.
- `docs/engine-spec.md`: 3,501 lines / 514,532 bytes, 262 headings.
- Root `docs/*.md`: 17 documents / 10,008 lines / 1,095,? bytes before archive restructuring (the two principal monoliths are measured above).
- Existing check scripts: CR, contract versions, Solo preservation, Online state, Core identity/runtime/zone/registry/stack/turn/rule verifiers, lint, full Vitest, build.
- No `check:docs`, `check:fast`, or `check:domain` existed.
- No contract manifest, scenario registry, migration map, or docs linter existed.

## Hypothesis results

| Hypothesis | Result | Evidence |
|---|---|---|
| H1 | confirmed | `docs/engine-spec.md` is 514,532 bytes / 3,501 lines and mixes API, meaning, milestone history, audit evidence, and old/new turn-draw language. |
| H2 | confirmed | `docs/acceptance.md` has 72 headings, milestone sections, manual AV material, implementation references, live Scryfall preconditions, and duplicate identifiers. |
| H3 | confirmed | `docs/README.md` contains dated state, implementation status, historical/superseded labels, deleted-file references, and re-ownership notes alongside the document index. |
| H4 | confirmed | `machine-checks.mjs` runs Solo-preservation files and then full Vitest; Pages runs `npm run check` and a second production build; default forbidden scan reads only `git status --short`. |
| H5 | confirmed | AGENTS, cycle, token-economy, and codex-autoloop repeat role, freeze, audit, and full-check workflow guidance. |
| H6 | confirmed | `scripts/checks/` had no manifest, status, link, ID, authority, supersedes, or verifiedBy linter. |

## Baseline command record

The required structure, file, size, heading, term, package-script, workflow, and link probes were run from the base SHA. The raw output is intentionally not committed; this summary and `conflict-register.json` are the Phase 0 record.

