# O4P-04C implementer correction 1

Milestone: `O4P-04C`

Owner: same bounded Luna xhigh implementer

Authority:
`research/cr-grounding/o4p-04c-display-pairing.contract.draft.md`

## Exact root regression

The Judge review initially used local helper names `personal` and `table`
instead of the frozen public input names `personalProjection` and
`tableProjection`. The implementation added an unauthorized legacy-alias branch
to satisfy that erroneous probe.

Remove only the legacy `{ personal, table, focusedPlayerId }` acceptance from
`buildPairingView`. Accept exactly
`{ personalProjection, tableProjection, focusedPlayerId }`; missing, legacy, or
unknown root fields must fail with the fixed generic error. Do not change any
valid pair, focus, frame-binding, UI, or DEFER behavior.

Judge separately repaired the exact architecture registrations exposed by the
wider target suite. Do not edit Judge-owned tests or evidence.

Run the complete O4P-04C targeted suite, scoped ESLint, `npx tsc -b`, and
`git diff --check`. Return exact outcomes and changed paths. Do not run the
release full check or perform git operations.
