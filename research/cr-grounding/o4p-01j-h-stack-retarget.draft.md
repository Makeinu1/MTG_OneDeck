# O4P-01J-H Immutable Retarget Transaction V1

- Milestone: `O4P-01J`
- Lane: `H`
- Base requested by implementer: `ae6184a`
- Status: `implemented-not-integrated`
- Scope: additive Core retarget source and ordinary/property tests only

Implemented `retargetCoreStackObjectV1` with the frozen contract boundary:

- validates the complete Registry/Runtime/Announcement bundle before reading the operation;
- strictly inspects operation records, replacement arrays, IDs, target references, accessors, symbols, and sparse arrays;
- requires exactly one shared-stack location and the matching Announcement record;
- rejects duplicate or unknown selection IDs while accepting empty/no-op and historical targets;
- constructs fresh Registry, Runtime, and Announcement candidates through existing factories;
- validates the complete candidate bundle before returning a deeply frozen result; and
- replaces only target references while preserving selection identity/order, modes, variables, costs,
  distributions, ability text, kind, ObjectId, Registry, Runtime, and stack order.

Target legality, target existence, mode changes, distribution changes, and any command/event or
public-index integration are deferred by the contract. No ledger, docs, package, machine-check,
review test, public index, Solo/store/components/online file, or git state was changed.

Targeted verification:

- `npx tsc -b --pretty false` reached existing unrelated baseline errors in pre-existing transaction
  review/commit tests; it reported no diagnostic in the new retarget source.
- `npx vitest run --project core src/engine/core/stack/transaction/__tests__/stackRetargetV1.test.ts
src/engine/core/stack/transaction/__tests__/stackRetargetPropertyV1.test.ts` passed: 2 files,
  6 tests.
- Targeted ESLint passed for the new source and both new tests.
