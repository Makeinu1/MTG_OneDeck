# O4P-04D contract verification reanchor 1

Milestone: `O4P-04D`

Owner: Sol Judge

Candidate commit: `3e87dd25b5e218669645f40a9e8a2096b5c9051c`

## Trigger

O4P-04D registers the exact additive `OnlineGuidedActions.tsx` public import in
`src/test/architecture/soloOnlineBoundary.test.ts`. The active
`CONTRACT-ENGINE-MULTIPLAYER` manifest entry names that architecture test as
verification evidence, so its O4P-04C verification commit is stale by
construction.

## Authorized metadata-only reanchor

Change `CONTRACT-ENGINE-MULTIPLAYER.lastVerifiedCommit` from the prior O4P-04C
candidate to the O4P-04D candidate commit above. Register only this exact
manifest path in the Judge-owned O4P-04D candidate-path assertion so the
metadata reanchor itself remains inspectable. Do not broaden that registration
to another docs path or change the contract path, status, owner, authority,
dependencies, clauses, traceability, verification paths, product source,
versions, dependencies, or workflows.

`npm run check:docs`, the complete 14-file O4P-04D targeted set, scoped
ESLint, `npx tsc -b`, and `git diff --check` must pass. The same cold auditor
must confirm that the candidate commit exists, is an ancestor, contains the
exact architecture evidence blob, and that this uncommitted reanchor diff
contains only the one manifest field, the exact Judge allowlist registration,
and this reanchor record before the release tree is frozen.
