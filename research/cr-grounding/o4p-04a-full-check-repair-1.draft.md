# O4P-04A full-check architecture repair 1

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Trigger: the first candidate-inspecting release `npm run check` passed all
verifiers, docs, lint, and Core 226 files / 2,086 tests. DOM passed 284 of 289
files and 2,026 of 2,031 tests, with exactly five architecture fixed-list or
Solo/Online-classification failures. Build was skipped.

The new additive `src/online/workbench` and
`src/components/online/PersonalWorkbench.tsx` were already accepted by the
O4P-04A contract and independent semantic audit. The five older architecture
gates still encoded the pre-O4P-04A six-module topology or classified every
`src/components/**` file as Solo UI.

## Authorized Judge surgery

1. Add only `workbench` to the two exact Online module-kind lists and the
   O4P-01I allowed root-name set; update the pinned expected order and the one
   stale six-to-seven title.
2. In each of the two Solo/Online dependency gates, carve out exactly
   `src/components/online/PersonalWorkbench.tsx` importing exactly the public
   `src/online/workbench/index.ts`. All other Solo-to-Online imports remain
   violations; engine/store/snapshot/server/runtime rules remain unchanged.
3. Do not change production source, ordinary tests, O4P-04A Judge review,
   dependencies, workflow, or any other architecture assertion.

## Required evidence

- The five failed architecture files pass together and scoped ESLint passes.
- Synthetic negative fixtures in both Solo/Online gates remain green.
- `git diff --check` passes.
- The same independent cold auditor verifies the repair is exact and reports
  BLOCKER/HIGH 0 before the governance-permitted final full-check rerun.
