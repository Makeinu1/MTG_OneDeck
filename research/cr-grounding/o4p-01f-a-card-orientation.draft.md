# O4P-01F-A: Core Card Orientation Runtime Contract V1

> Implementer draft for the isolated O4P-01F-A runtime value object. This is
> not a formal contract promotion, integration declaration, audit record, or
> shipped feature declaration.

## Scope

`src/engine/core/runtime/cardOrientation.ts` defines the independent
`CoreCardOrientationStateV1` value object for the current card face and
orientation/status flags. It contains exactly `faceIndex`, `faceDown`,
`tapped`, `flipped`, and `phasedOut`.

This slice does not integrate with Identity/Zone state, card-definition face
counts, commands, zone transitions, projections, UI, or the deferred
face-down/transform/morph/manifest/cloak/disguise semantics. Zone consistency
belongs to O4P-01F-D.

## Validation boundary

`validateCoreCardOrientationStateV1(input: unknown)` accepts only plain root
objects with enumerable data properties. It rejects null, arrays, built-ins,
class instances, accessors, non-enumerable properties, symbols, missing fields,
and unknown fields without executing accessors or mutating input.

`faceIndex` must be a non-negative safe integer. The four status fields must be
booleans. All issues are collected and sorted by JSON Pointer path, then by
UTF-16 code-unit order of the validation code. Successful output is a newly
allocated, fixed-field-order, frozen value.

The factory calls the validator as its only validation path, throws
`CoreCardOrientationCreationError` on failure, and returns the validator's
frozen value directly on success. No defaults or correction are applied.

## Verification

The ordinary test file covers valid values, zero and maximum safe integer,
invalid numeric forms, boolean type rejection, structural rejection,
accessor/non-enumerable/symbol handling, complete issue collection and order,
non-mutation, allocation, freezing, fixed enumeration order, JSON round trips,
factory/validator parity, and the exact code vocabulary.

## Protected boundaries

No existing file is changed. `src/engine/core/index.ts`, existing Core state,
canonicalization, fixtures, store/components/online code, package metadata,
scripts, docs, rules, versioning, and review-owned files remain outside this
implementation.

## DEFER

- Identity/Zone integration and zone consistency checks (O4P-01F-D)
- Face-count validation against card definitions
- Face-down visibility/projection
- Morph, manifest, cloak, disguise, turn-face-up costs, and transform handling
- Tap/untap, phasing, summoning sickness, attack/block, and control effects
- UI, commands, events, persistence, protocol, and versioning
- Independent cold audit and release-lane publication

## Status

`implemented-not-integrated`
