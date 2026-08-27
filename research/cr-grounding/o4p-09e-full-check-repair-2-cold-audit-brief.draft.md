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
