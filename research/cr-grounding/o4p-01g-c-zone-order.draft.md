# O4P-01G-C: Immutable Zone Order & Shuffle Permutation Contract V1

> Implementer draft for the isolated O4P-01G-C substrate. This is not a
> promoted contract, integration declaration, audit record, or shipped
> feature declaration.

## Scope and grounding

`src/engine/core/transition/zoneOrder.ts` provides pure, deterministic array
operations for ordered Core zone contents. It removes one object ID, inserts a
new object ID, moves one existing object within the same zone, and applies a
caller-supplied permutation. The module never creates entropy and never
mutates a caller-owned zone or permutation.

The boundary is grounded in the pinned Comprehensive Rules (2026-06-19):

- CR 400.6 describes a zone-change event as the event that moves an object
  between zones. This slice is only the immutable ordered-array substrate; it
  does not create a GameState, command, event, or replacement effect.
- CR 400.7 says that an object moving between zones becomes a new object. The
  functions here do not perform a zone change and therefore preserve the
  supplied object-ID values and cardinality; incarnation changes and object
  identity transitions remain outside this slice.
- CR 701.24a defines a shuffle as randomizing a library or face-down pile.
  `applyCorePermutationV1` accepts a predetermined permutation only. Entropy
  ownership, random generation, library triggers, and shuffle commands remain
  deferred to an integration slice.

## Public shape

The module exports:

- `CorePermutationV1 = readonly number[]`.
- `CoreZoneOrderErrorCode` with exactly
  `INVALID_ZONE_ARRAY`, `INVALID_OBJECT_ID`, `INVALID_INDEX`,
  `OBJECT_NOT_FOUND`, `OBJECT_DUPLICATED`, `OBJECT_ALREADY_PRESENT`,
  `INVALID_PERMUTATION_LENGTH`, `INVALID_PERMUTATION_VALUE`, and
  `DUPLICATE_PERMUTATION_VALUE`.
- `CoreZoneOrderError`, carrying the operation error `code` and any
  permutation validation `issues` used by application failures.
- `CorePermutationValidationIssue` with `code`, `path`, and `message`.
- `CorePermutationValidationResult`, a discriminated `{ ok: true, value }` or
  `{ ok: false, issues }` result.
- `validateCorePermutationV1`,
  `removeCoreObjectIdExactlyOnceV1`, `insertCoreObjectIdAtV1`,
  `moveCoreObjectIdWithinZoneV1`, and `applyCorePermutationV1`.

Zone object IDs are non-empty strings at this low-level boundary. The branded
`CoreObjectId` type remains assignable through the generic operation surface;
canonical identity and incarnation validation belongs to the identity/runtime
contracts that consume this substrate.

## Permutation validation

`validateCorePermutationV1(input, expectedLength)` accepts unknown input and
requires `expectedLength` to be a non-negative safe integer. The input must be
an ordinary dense array whose length equals `expectedLength`, whose values are
safe integer indices in `0..expectedLength-1`, and whose values are unique.
Thus it contains every index exactly once, including the valid empty
permutation.

Inspection uses own-key and property-descriptor reads. Sparse slots, symbols,
extra properties, non-enumerable elements, and accessor properties are rejected
without reading an accessor. All discovered issues are returned in path and
code-unit order. A successful result is a distinct frozen array that preserves
the input order. Invalid values are not coerced.

`applyCorePermutationV1(zone, permutation)` validates the supplied permutation
against the zone length and applies exactly `output[i] = zone[permutation[i]]`.
Invalid permutations fail with `CoreZoneOrderError`; no fallback order and no
random operation exists.

## Zone operations

- Removal requires one non-empty object ID to occur exactly once. Missing IDs
  produce `OBJECT_NOT_FOUND`; duplicate zone IDs produce
  `OBJECT_DUPLICATED`.
- Insertion accepts an index from `0` through `zone.length`, rejects an ID
  already present with `OBJECT_ALREADY_PRESENT`, and returns a frozen fresh
  array.
- Same-zone movement first removes the existing object once, then inserts it
  at a final index from `0` through `zone.length - 1`. It preserves the ID set
  and count and rejects missing, duplicate, invalid-index, and malformed-zone
  inputs.
- Every successful operation allocates a fresh frozen output. Inputs remain
  byte-for-byte and element-order unchanged; no operation mutates a supplied
  permutation.

## Verification and boundaries

The ordinary and fast-check tests cover the required validator error codes,
complete issue collection, sparse/extra/symbol/accessor rejection without
accessor execution, empty inputs, frozen fresh outputs, nonmutation, all
operation error boundaries, arbitrary permutation uniqueness, inverse
round-trips, insertion/removal round-trips, and same-zone ID/cardinality
invariants. The implementation source is checked for entropy calls and an
untyped escape hatch.

Deferred: integration with `GameState`, Core zone records, `GameCommand`,
shuffle events/triggers, random-source ownership, persistence, UI, runtime
incarnation changes, and any library-specific CR behavior.

## Status

`implemented-not-integrated`
