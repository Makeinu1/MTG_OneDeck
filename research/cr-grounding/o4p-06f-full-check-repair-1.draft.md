# O4P-06F full-check repair 1

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `8810ed2e6db69fdc93c131f6abc195af6a763066`
Failed audited fingerprint:
`be0db461c1eb2770dc0a385b071395a66d1795a95728710b0b4c8d90746aa002`

The sole local `npm run check` reached Core 227 files / 2,093 tests and DOM
321 passing files before three historical Judge-owned architecture reviews
rejected the new dependency-free package command `evidence:o4p-06f` from their
exact changed-script allowlists. No product, harness, protocol, dependency,
lockfile, configuration, or runtime assertion failed.

Authorized repair: in exactly
`review.o4p-04b-table-display-boundary.test.ts`,
`review.o4p-04c-display-pairing-boundary.test.ts`, and
`review.o4p-04d-guided-actions-boundary.test.ts`, add the exact command name to
the sorted changed-script list and assert its exact value
`tsx scripts/online/o4p-06f-four-browser-evidence.ts`. Do not widen a regex,
path, prefix, dependency, or production boundary. Reauthorize those three exact
Judge review paths in the O4P-06F review's closed `changedSrc` list; no other
source path is added.

Run only the three invalidated reviews, the O4P-06F ordinary/Judge review,
affected ESLint, TypeScript, docs, and diff checks. Prove non-vacuity from the
recorded full-check failures and byte-normalize each repair file back to HEAD.
Then obtain a context-free Luna xhigh repair audit. Only a clean repair audit
authorizes the final local `npm run check`.
