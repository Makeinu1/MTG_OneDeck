# O4P-04B implementer correction 1

Milestone: `O4P-04B`

Owner: same bounded implementer

Authority:
`research/cr-grounding/o4p-04b-table-display.contract.draft.md`

## HIGH O4P-04B-JR-H001: same-reference projection retention

`src/components/online/TableDisplay.tsx` memoizes validation by projection
reference. If the caller mutates the same object and renders again, the
component keeps the previously validated view and does not observe role or
content drift. This violates the contract requirement to retain no previous
projection and can display stale public information after an invalid update.

Remove reference-identity memoization. Rebuild/validate the `unknown`
projection on every component render and preserve the generic fail-closed UI.
Do not add local state, transport, polling, a digest, or another cache.

Run the full four-file O4P-04B targeted suite, scoped ESLint, and `tsc -b`.
Return changed files and exact outcomes. Do not edit Judge-owned evidence or
perform git operations.
