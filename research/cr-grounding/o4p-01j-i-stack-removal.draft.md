# O4P-01J-I Atomic Stack Removal Transaction V1

Status: implemented-not-integrated
Base SHA: `ae6184a`
Lane: O4P-01J-I

Implemented only `removeCoreStackObjectV1` and its exact lane-local types in
`src/engine/core/stack/transaction/stackRemovalV1.ts`.

The operation validates the complete input bundle before strict operation
inspection. Card exits remove the requested stack entry and announcement,
preserve physical card identity and owner, advance incarnation once, route
the new card to the requested non-stack destination, and reset Runtime. A
library destination preserves top/bottom/index placement. Synthetic cease
removes Registry/Stack/Announcement together, preserves Runtime, and returns
`nextObjectId: null`.

Both paths build fresh Registry, Runtime, and Announcement candidates through
the existing factories, validate the complete candidate bundle, then expose a
deep-frozen result. Invalid card/cease pairings, stack destinations, tokens,
non-stack objects, collisions, hostile descriptors, and invalid candidates
fail with `CoreStackTransactionErrorV1` and no partial result.

Targeted verification added in:

- `stackRemovalV1.test.ts`
- `stackRemovalPropertyV1.test.ts`

Barrel exports, review tests, ledger, docs, and integration remain deferred to
the judge/integration lane.
