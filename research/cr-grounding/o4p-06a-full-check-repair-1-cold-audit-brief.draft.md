# O4P-06A Full-Check Repair 1 Cold-Audit Brief

Milestone: `O4P-06A`
Base candidate commit: `e134e46444a33e5629d9d4c12f83e1bf7831e139`
Repaired release fingerprint: `88ffe26e5728f93db79d15132d99b1228489da271d6ee5acc84ed13a6d93bf2b`
Profile: `STANDARD` (Judge-owned historical gate semantics)

Read `research/cr-grounding/o4p-06a-full-check-repair-1.draft.md` and audit only
the bounded repair paths:

- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`;
- `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`;
- `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts`;
- `src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts`;
- `src/test/architecture/review.o4p-05d-production-release-closure.test.ts`;
- `src/test/architecture/review.o4p-06-roadmap-registration.test.ts`.

Audit priorities:

1. Confirm every historical scope comparison is pinned to the exact terminal
   commit for the milestone it claims to freeze, not broadened to allow
   arbitrary current files.
2. Confirm current protection remains non-vacuous: O4P-04 reverse production
   reachability still scans the live source tree; O4P-05C frozen production
   roots and hash chain remain enforced; O4P-05D current untracked protected
   drift remains empty; and O4P-06 live projection still selects the first
   pending program parent.
3. Verify the O4P-06 registration assertions read the exact registration
   closure while live selection advances A to B after A is shipped. Reject any
   path that silently permits skipping a pending parent or weakens active
   program order.
4. Confirm hash re-anchoring is exact and limited to the five changed Judge
   reviews and the O4P-05C verifier; no production/runtime/dependency/version/
   workflow/UI byte changed.
5. Perform a bounded vacuity check without leaving mutations: a wrong closure
   SHA or an injected untracked protected file must make the relevant guard
   red, while a legitimate tracked successor outside the historical snapshot
   must not be misclassified.

Reproduce the repaired fingerprint over the complete cached-plus-untracked tree
while excluding O4P-06A audit/repair evidence files:

```sh
node --input-type=module -e "import {execFileSync} from 'node:child_process'; import {computeTreeFingerprint} from './scripts/codex-context.mjs'; const excluded=new Set(['research/cr-grounding/o4p-06a-cold-audit-brief.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-1.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-2.draft.md','research/cr-grounding/o4p-06a-cold-reaudit-brief-3.draft.md','research/cr-grounding/archive/o4p-06a-cold-audit-record-2026-08-20.md','research/cr-grounding/o4p-06a-full-check-repair-1.draft.md','research/cr-grounding/o4p-06a-full-check-repair-1-cold-audit-brief.draft.md']); const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\\0').filter(Boolean).filter((path)=>!excluded.has(path)); console.log(computeTreeFingerprint(process.cwd(),paths));"
```

Required evidence (do not run `npm run check`):

```sh
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx vitest run --project dom src/test/architecture/review.o4p-04b-table-display-boundary.test.ts src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts src/test/architecture/review.o4p-05c-release-gates.test.ts src/test/architecture/review.o4p-05d-production-release-closure.test.ts src/test/architecture/review.o4p-06-roadmap-registration.test.ts src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts
npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs
npx eslint scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts src/test/architecture/review.o4p-04b-table-display-boundary.test.ts src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts src/test/architecture/review.o4p-05d-production-release-closure.test.ts src/test/architecture/review.o4p-06-roadmap-registration.test.ts
npx tsc -b
git diff --check
```

Return findings only with `BLOCKER/HIGH/MEDIUM/LOW` totals. Return
`AUDIT-OK-PENDING-FINAL-FULL-CHECK` only when BLOCKER/HIGH are zero. Do not edit
candidate files, create records, delegate, or run `npm run check`.
