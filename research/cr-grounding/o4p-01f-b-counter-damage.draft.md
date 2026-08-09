# O4P-01F-B: Core Object Counters & Marked Damage Contract V1

> Draft implementer handoff. This file is not a promoted contract, audit
> finding, or shipped declaration.

## Scope

Task `O4P-01F-B`, parent milestone `O4P-01F`, execution lane
`PARALLEL WAVE 1`, implements an independent value-object contract for a Core
card object's counter collection and marked damage. Base SHA:
`e5420dc62e4417eb65a4cd27e782f3147aca6c60`.

Identity/zone integration and zone-transition consistency remain deferred to
O4P-01F-D. No existing file is changed, including `src/engine/core/index.ts`,
`cardOrientation.ts`, and a runtime barrel.

## Shape and exports

The state has exactly `counters` and `markedDamage`, and each counter entry has
exactly `kind` and `count`:

```ts
interface CoreCounterEntryV1 {
  readonly kind: string;
  readonly count: number;
}

interface CoreCounterDamageStateV1 {
  readonly counters: readonly CoreCounterEntryV1[];
  readonly markedDamage: number;
}
```

The implementation exports the two value types, the exact validation-code
union, issue/result types, `CoreCounterDamageCreationError`,
`validateCoreCounterDamageStateV1`, and
`createCoreCounterDamageStateV1` from `counterDamage.ts` only. The Core index is
intentionally unchanged.

## Validation contract

Counter kinds are trimmed, non-empty strings of one to 80 Unicode code points
with no C0, DEL, or C1 control character. Counter names are open-ended and
case-sensitive; no MTG counter vocabulary is hard-coded. Counts are positive
safe integers. Marked damage is a non-negative safe integer. Numeric strings,
non-finite numbers, fractional numbers, zero counts, and negative values are
invalid.

The input counter array must already be unique and sorted by JavaScript
string/code-unit order. The validator does not sort, merge, deduplicate, trim,
or delete entries. Invalid order is reported as `INVALID_ORDER`, and duplicate
kinds as `DUPLICATE_COUNTER_KIND`.

The exact validation-code union is:

`INVALID_ROOT`, `MISSING_FIELD`, `UNKNOWN_FIELD`, `INVALID_TYPE`,
`INVALID_STRING`, `INVALID_INTEGER`, `DUPLICATE_COUNTER_KIND`,
`INVALID_ORDER`.

Unknown input is inspected without invoking accessor values. Root and entry
objects must be plain objects with only enumerable data fields in the declared
shape. Arrays must be ordinary dense arrays with no symbol or additional own
properties. All issues are returned, sorted by path and then code using
code-unit comparison. Inputs are not mutated.

Successful output is separately allocated, has root field order
`counters`, `markedDamage`, entry field order `kind`, `count`, and deep-freezes
the root, counters array, and every entry. The factory delegates validation as
its sole validation path and returns the validator's successful value; invalid
input throws `CoreCounterDamageCreationError` with the same issues.

## Explicit deferrals

This slice does not implement player counters, loyalty arithmetic, +1/+1 and
-1/-1 cancellation, damage clearing, deathtouch metadata, damage source,
infect, wither, zone counter loss, Skullbriar-like exceptions, SBAs,
commands/events, or UI. It does not integrate counters or damage into Core
identity/zone objects.

## Verification target and status

Ordinary and fast-check tests cover valid empty/multiple/open-ended/Unicode
collections, string and integer boundaries, duplicate/order failures, strict
field and descriptor rejection, issue ordering, non-mutation, deep freeze,
JSON round-trip, factory/validator parity, fixed field order, and generated
sorted-unique collections plus adjacent swaps. The candidate status is
`implemented-not-integrated`; independent cold audit and release ownership are
deferred to the judge lane.
