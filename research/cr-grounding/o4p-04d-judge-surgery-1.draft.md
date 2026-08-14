# O4P-04D Judge surgery 1

Milestone: `O4P-04D`

Owner: Sol Judge

Independent auditor: `/root/o4p04d_cold_auditor`

## Sustained MEDIUM

The O4P-04D architecture gate scanned only production `.ts` files under
`src/online/guidedActions` while the candidate-path gate accepted any file
below that directory. An adversarial `ambient.tsx` containing `window` and
`fetch` therefore false-greened. The frozen product candidate contains no such
file or ambient effect, but the gate was vacuous for that extension.

## Bounded Judge correction

Change only the Judge-owned
`src/test/architecture/review.o4p-04d-guided-actions-boundary.test.ts` so the
pure-module assertion scans both `.ts` and `.tsx` and requires the exact four
approved production files: `errors.ts`, `index.ts`, `model.ts`, and `types.ts`.
An added production `.ts` or `.tsx` must fail even when its contents otherwise
look harmless.

Do not change runtime, ordinary tests, contracts, Projection, Core, protocol,
Room, root integration, dependencies, config, version, or DEFERs. Re-run the
complete 14-file Judge/model/component/predecessor/architecture set, scoped
ESLint, `npx tsc -b`, and `git diff --check`; then freeze new fingerprints for
independent re-audit. Do not run the release full check before that re-audit.
