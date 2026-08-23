# O4P-07C Full-Check Repair 2 Cold-Audit Brief

Date: 2026-08-23
Base SHA: `3a0f615b1702560634ae5f4f32dac72d732e8a5d`
Risk: R3 / BROAD correction audit
Authority: `research/cr-grounding/o4p-07c-full-check-repair-2.draft.md`

Read only. Do not edit, stage, commit, push, run full `npm run check`, deploy, or
browse. Return BLOCKER/HIGH/MEDIUM/LOW findings and the frozen staged
fingerprint supplied by the Judge.

Verify that the complete delta contains only the seven exact review
supersessions and these two repair briefs. Confirm each import admission matches
the audited runtime import and is present exactly once. Confirm each package
script inventory adds only the exact O4P-07C verifier key and command. Confirm
no assertion, candidate-path allowlist, dependency, viewport, source boundary,
ownership rule, or release requirement was weakened.

Run only:

```sh
npx vitest run --project dom \
  src/test/architecture/review.o4p-03a-cloudflare-runtime-persistence-boundary.test.ts \
  src/test/architecture/review.o4p-03b-websocket-recovery-boundary.test.ts \
  src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts \
  src/test/architecture/review.o4p-04b-table-display-boundary.test.ts \
  src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts \
  src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts \
  src/test/architecture/review.o4p-07a-dynamic-card-resolution-boundary.test.ts
npx eslint <the same seven review files>
git diff --check
```

Return `O4P-07C-FULL-CHECK-REPAIR-2-AUDIT-OK` only when all findings are zero.
Do not start a third full check; user exception remains required.
