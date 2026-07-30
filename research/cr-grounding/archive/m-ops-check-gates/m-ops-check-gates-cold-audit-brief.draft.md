# M-OPS-CHECK-GATES pre-release cold-audit brief

Read `AGENTS.md` and `.claude/audit-standing.md` first.

- Base SHA: `0c1a824e0f0dac28319c421a0261116c2218964b`
- Claimed status: `implemented-not-audited`
- Audit target: the working tree identified by `baseSha` and
  `treeFingerprint` in `.claude/loop-state.md`
- Full-check state: intentionally pending under the standard pre-release
  semantic-audit mode; do not run `npm run check`
- Archived: `2026-07-30`

Adversarially test the claims below. Do not confirm a desired promotion and do
not use implementer self-report as pass evidence.

## Claims to test

1. Governance now closes cold-audit findings before the release full check,
   while retaining BLOCKER/HIGH 0, relevant `review.*`, full `npm run check`, CI,
   Pages, role separation, and the two-run emergency ceiling.
2. `npm run check` remains the canonical green release command. Its default is
   fail-fast; `--continue-on-error` runs all top-level diagnostic steps; each
   executed step and total have monotonic elapsed time; missing spawn status and
   unknown arguments fail closed; importing the module launches nothing.
3. Vitest selection is a disjoint exhaustive union: every `src/engine/**` test
   belongs only to `core` (Node, file-parallel), and every other current test
   belongs only to `dom` (jsdom, serial). No prior test, assertion, timeout, or
   dependency was removed or weakened.
4. Canonical local and CI testing use `npm test`, whose import-safe runner waits
   for `core` to finish before spawning `dom`. A core failure or null status must
   skip DOM, preventing the visual lane from competing with core workers.
5. No game/UI behavior, public API, engine implementation, dependency version,
   ledger domain, or CR boundary changed.

## Judge evidence to challenge

- Targeted: 4 files / 25 tests PASS
  (`machine-checks`, `vitest-projects`, `review.check-gates`,
  `review.codex-ops`).
- Changed-file ESLint PASS; `npx tsc -b` PASS; `git diff --check` PASS.
- Collection comparison: core 100 + dom 209 = repository 309; overlap,
  missing, extra, wrong-core, and engine-in-dom are all zero.
- Engine A/B on the same pre-split tree: control median 56.85 s versus Node
  parallel treatment median 7.63 s; all six measured runs passed 100 files /
  1048 tests. One warm-up per arm also passed.
- The first combined-project design was rejected after a reproduced
  102-file/1059-test stress run took 64.10 s. Correction 1 routes canonical
  execution sequentially through `scripts/checks/vitest-projects.mjs`.
- DOM visual fixture target passed 2 files / 11 tests under the retained serial
  project. Treat timing as non-comparable because other checks shared the host.

## Required audit procedure

1. Verify `npm run codex:context` reports health OK and current loop-state for
   the candidate fingerprint.
2. Inspect every changed and untracked path against the base SHA. Check
   protected-file authorship, scope, package dependency blocks, and
   `git diff --check`.
3. Run only:
   `npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs scripts/__tests__/vitest-projects.test.mjs scripts/__tests__/review.check-gates.test.mjs scripts/__tests__/review.codex-ops.test.mjs`.
4. Independently list `core` and `dom` collections and compare their union with
   current repository test files. Require overlap/missing/extra = 0.
5. Run one core-only project and the two `src/dev/visualFixtures` files under
   dom. Do not run both projects in one Vitest process and do not run the full
   DOM lane.
6. Adversarially inspect or temporarily mutate injected spawn results to prove
   fail-fast, first-status preservation, null-status failure, import safety,
   and core-before-dom ordering. Restore byte-identically and report the check.
7. Verify `.github/workflows/deploy-pages.yml` reaches the sequential runner via
   `npm test`; ensure no release path still calls an unsafe direct all-project
   Vitest command.
8. Run `npm run check:forbidden`. Judge-authored governance, audit packet, and
   `review.check-gates` are expected protected findings; inspect them rather
   than treating the scanner result as automatic failure or pass.

## Constraints and output

- Findings only. Do not edit, stage, commit, push, or change the contract.
- Do not run `npm run check`, full DOM, combined-project stress, browser, or
  network commands.
- Each finding: BLOCKER/HIGH/MEDIUM/LOW + exact path/line or deterministic
  reproduction + impact on the claimed status.
- If BLOCKER/HIGH = 0, return exactly
  `AUDIT-OK-PENDING-FULL-CHECK` and list the evidence actually executed. This is
  not ship approval.
