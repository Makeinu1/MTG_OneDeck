# O4P-09E Full-Check Repair 2 Cold-Audit Brief

Date: 2026-08-27
Base SHA: `cb686d93ff6e05a10e95a7f55799112480d3b2cb`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-09e-full-check-repair-2.draft.md`

Read only. Do not edit files, run the release full check, commit, push, deploy,
or publish records. Return BLOCKER/HIGH/MEDIUM/LOW findings and the canonical
candidate fingerprint supplied by the Judge.

Verify that:

1. The only executable test change adds a 15-second timeout to the one named
   deterministic Core boundary test; its body, assertions, fixtures, and all
   runner defaults are byte-identical to base.
2. The timeout is test-local, bounded, and justified by the recorded 5.168s
   full-suite timeout plus immediate 187ms isolated pass; it does not conceal an
   assertion failure or production defect.
3. The historical O4P-09C change adds exactly the two repair records and one
   test path to the explicit O4P-09E successor set, with no wildcard or negative
   guard weakening.
4. No production, generated API, manifest, contract, dependency, review
   assertion meaning, or player acceptance byte changed.
5. Target test, complete Core project, O4P-09C guard, complete architecture
   suite, check:docs, affected ESLint, and diff-check are green.
6. The predecessor receives no third full-check invocation. The derived
   candidate retains cumulative counter evidence and uses the same acceptance
   and original user release authority.

## Targeted commands

```sh
npx vitest run --project core src/engine/core/turn/__tests__/turnPriorityBundleValidationV1.test.ts --maxWorkers=1
npx vitest run --project core --maxWorkers=1
npx vitest run --project dom src/test/architecture --maxWorkers=1
npm run check:docs
npx eslint src/engine/core/turn/__tests__/turnPriorityBundleValidationV1.test.ts src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts
git diff --check
```

Return `O4P-09E-FULL-CHECK-REPAIR-2-AUDIT-OK` only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Full check and live release evidence
remain out of scope.

## CI reauthorization audit addendum

Read only. Audit the `Exact-head CI ownership stop and Judge reauthorization`
section in the paired authority record against Actions run `33087655508`, job
`98571631262`, base `b8f851794ce8051811093093adc8b22196f3d4c2`, and head
`f9f1f961b318a0498691b454d1d4d9592cb461d7`.

Verify:

1. The exact-head CI full check passed and the sole failing step was
   `check:forbidden`; Pages was skipped.
2. The NEEDS-REAUTH 12 and FORBIDDEN 29 lists equal the CI log byte-for-byte,
   with no omitted, additional, wildcard, renamed, or secret-bearing path.
3. Every reowned path belongs to the already audited O4P-09E product,
   evidence, guard repair, manifest reanchor, or timeout repair bytes at the
   exact head. Prior 0/0/0/0 fingerprints and local/CI full-check evidence are
   not overstated.
4. The replacement diff contains only this authority record and audit addendum;
   it changes no product, review, generated API, manifest, contract, dependency,
   workflow, or acceptance byte.
5. With diff base `f9f1f961b318a0498691b454d1d4d9592cb461d7`, local
   `check:forbidden` exits successfully and release preflight passes with only
   the two research-record paths. Those paths are outside the terminal-only
   allowlist, so the successor uses the semantic CI/build/Pages lane without
   suppressing any gate.

Return `O4P-09E-CI-REAUTH-AUDIT-OK` only when
BLOCKER/HIGH/MEDIUM/LOW are all zero. Do not edit, commit, push, deploy, publish,
or run the release full check.
