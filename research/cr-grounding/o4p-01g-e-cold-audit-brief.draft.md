# O4P-01G-E cold-audit brief

- Parent milestone: `O4P-01G`
- Candidate base: `ca4abbffb6e4c6dcc49925c744190984aab2cf40`
- Candidate worktree: `/Users/shumpeiabe/Desktop/MTG_OneDeck-O4P-01G-E`
- Role: independent cold auditor, findings only
- Candidate status: implemented-not-integrated; not yet committed

Read `.claude/audit-standing.md` first. Do not edit, stage, commit, push, or
run the release full `npm run check`. Do not rely on the implementer's report.
Recompute the candidate file set and inspect the actual files in the candidate
worktree. Return findings only with BLOCKER/HIGH/MEDIUM/LOW counts and an
explicit verdict. Do not edit or mutate git state.

Audit the complete O4P-01G candidate against the user-supplied A/B/C/R/D/E
briefs and the fixed repository CR. Check exact public types and validation
contracts, immutable zone-order semantics, reincarnation/ObjectId helper use,
runtime reset, atomic transition invariants, owner/controller derivation,
library placement, same-zone and out-of-scope boundaries, CR matrix coverage,
fixture independence, property-test non-vacuity, verifier fail-closed behavior,
machine-check ten-step order and fail-fast behavior, TypeScript coverage,
scope leakage, test weakening, and forbidden/protected-file changes.

Required audit evidence:

- `npm run verify:mode-neutral-core-zone-transition`
- targeted A/B/C/D/E tests and the machine-check order test as needed
- `npm run lint`
- `npm run build`
- `npm run check:forbidden`
- static review of all changed bytes

Do not run the release full `npm run check`; it is a judge-owned post-audit
gate. Do not claim Pages, CI, or shipment. If a finding is correctable, state
the exact path and required correction without editing it.

Frozen candidate paths to inspect (relative to the candidate worktree):

```text
package.json
tsconfig.node.json
scripts/checks/machine-checks.mjs
scripts/__tests__/machine-checks.test.mjs
scripts/checks/verify-mode-neutral-core-zone-transition.ts
src/test/architecture/modeNeutralCoreBoundary.test.ts
src/engine/core/transition/zoneDestination.ts
src/engine/core/transition/__tests__/zoneDestination.test.ts
src/engine/core/transition/cardReincarnation.ts
src/engine/core/transition/__tests__/cardReincarnation.test.ts
src/engine/core/transition/zoneOrder.ts
src/engine/core/transition/__tests__/zoneOrder.test.ts
src/engine/core/transition/__tests__/zoneOrderProperty.test.ts
src/engine/core/transition/cardZoneTransition.ts
src/engine/core/transition/__tests__/cardZoneTransition.test.ts
src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts
src/engine/core/fixtures/card-zone-transition-slice-v1.json
research/cr-grounding/o4p-01g-a-zone-destination.draft.md
research/cr-grounding/o4p-01g-b-card-reincarnation.draft.md
research/cr-grounding/o4p-01g-c-zone-order.draft.md
research/cr-grounding/o4p-01g-r-zone-transition-rule-matrix.draft.md
research/cr-grounding/o4p-01g-d-card-zone-transition-integration.draft.md
research/cr-grounding/o4p-01g-e-fixture-gate-audit-closure.draft.md
```

The cold-audit brief itself is judge-owned process material and must not be
treated as an implementer acceptance claim.
