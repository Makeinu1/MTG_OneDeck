# O4P-01F-C: Core Attachment Reference Contract V1

> Implementer draft. This file records the bounded implementation handoff and
> is not a promoted contract, audit result, or shipped declaration.

## Scope

`src/engine/core/runtime/attachment.ts` defines the independent, one-way
attachment reference value object used by a Core card object. The attachment
side stores one `attachedTo` reference or `null`; the target side has no
reverse list. An object target is any canonical `CoreObjectId` shape and is
not restricted to the battlefield. A player target is allowed.

This slice validates structure and identifier syntax only. It does not check
target existence, self-attachment, source or target zone, card type, Aura /
Equipment / Fortification / Role legality, enchant conditions, protection,
shroud, hexproof, cycles, reverse indexes, detach processing, SBAs, control
effects, or UI rendering.

## Public API

- `CoreAttachmentTargetV1`: discriminated `object` / `player` union.
- `CoreAttachmentStateV1`: `{ attachedTo: CoreAttachmentTargetV1 | null }`.
- `CoreAttachmentValidationCode` and issue/result types.
- `CoreAttachmentCreationError`.
- `validateCoreAttachmentStateV1` and `createCoreAttachmentStateV1`.
- `isCanonicalCoreObjectIdV1`.

No Core index export, runtime index, or existing file is changed.

## Validation contract

The exact issue-code union is `INVALID_ROOT`, `MISSING_FIELD`,
`UNKNOWN_FIELD`, `INVALID_TYPE`, `INVALID_LITERAL`, and `INVALID_ID`.
Inputs must be plain objects with enumerable data properties. Accessors,
non-enumerable properties, and symbol fields are rejected without executing a
getter. All detectable issues are returned, sorted by JSON Pointer path and
then code-unit order of the code. Inputs are never mutated.

`CoreObjectId` syntax is exactly
`<CorePhysicalCardId>:<incarnation>`. The physical-card portion must satisfy
`isCoreBaseId`; the incarnation must be a non-negative safe integer written as
canonical decimal (`0` or a non-zero digit followed by digits). Missing,
negative, fractional, leading-zero, non-finite, exponent, and extra-colon
forms are rejected. Player IDs use the existing Core base-ID predicate.

Successful values are separately allocated, preserve the fixed field orders
`attachedTo`, then `kind` plus the selected ID field, and freeze both the root
and target. The factory delegates all validation to the validator and returns
its success value directly; it does not repair IDs or provide defaults.

## Verification boundary

Targeted tests cover both union branches, null, identifier boundaries and
malformed forms, exact branch fields, missing/unknown fields, plain-object and
descriptor safety, non-mutation, freezing, JSON round trips, factory parity,
issue ordering, fixed field order, and absence of explicit `any` types.

Required completion checks are targeted test success, `npm run lint`,
`npm run build`, and `npm run check:forbidden` with `FORBIDDEN` count zero.
Status remains `implemented-not-integrated` pending independent cold audit and
judge/release ownership.
