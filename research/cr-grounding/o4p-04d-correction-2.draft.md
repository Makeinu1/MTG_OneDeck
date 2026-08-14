# O4P-04D implementer correction 2 (final bounded return)

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Authority:
`research/cr-grounding/o4p-04d-guided-manual-actions.contract.draft.md`

Cold audit: `/root/o4p04d_cold_auditor`

## Sustained HIGH — stale same-revision confirmation

The component key currently uses only actor and revision. Open a confirmed
`apply-control` candidate for `PC1:0`, mutate the same projection reference to
remove `PC1:0` while retaining revision 12, and re-render. The rebuilt view no
longer contains the target, but the confirmation remains and can emit the stale
action. Runtime binding/server validation would reject it, but the UI violates
the frozen stale-choice/confirmation invalidation clause.

Required correction: reset all form and confirmation state whenever the
complete freshly rebuilt safe view changes, including same-reference/
same-revision drift. Also revalidate a confirmed action against the current
projection immediately before `onAction` as defense in depth; on failure,
clear confirmation and emit nothing. Do not add a second legality engine.

## Sustained MEDIUM — public binding-input type

`OnlineGuidedCommandBindingInputV1` accepts an unclosed `unknown` action and
nullable/unbranded command ID. Change only its public TypeScript fields to
`action: OnlineGuidedActionV1` and
`commandId: OnlineProtocolCommandIdV1`. Keep the exported binder input as
hostile `unknown` and preserve complete runtime validation.

## Ownership and checks

Implementer write scope is only:

- `src/components/online/OnlineGuidedActions.tsx`;
- `src/online/guidedActions/types.ts`;
- ordinary tests for the corrected behavior/types if needed.

The Judge separately owns the stale-confirmation `review.*` regression and the
architecture fixture allowlist/vacuity correction. Do not edit them, contracts,
ledgers, loop-state, governance, or git state. Do not change Projection, Core,
protocol, Room, binder behavior, action algebra, visual values, or DEFERs.

Run the complete O4P-04D ordinary seven-file / 18-test suite plus any added
ordinary tests, scoped ESLint, and `npx tsc -b`. Do not run `npm run check`.
Return exact changes/results and unresolved issues.
