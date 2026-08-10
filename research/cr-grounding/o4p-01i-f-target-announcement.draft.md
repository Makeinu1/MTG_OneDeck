# O4P-01I-F Target Selection Contract V1

Milestone: `O4P-01I-F`  
Base: `4ed8287`  
Status: implemented-not-integrated

This additive slice defines `CoreStackTargetSelectionV1` and validation for an
ordered target-selection array. `selectionId` and `groupKey` use the frozen
Foundation choice-key validator. Targets use the frozen object/player target
reference validator; registry presence, current zone, player activity, and
legality are intentionally not checked.

An empty array is valid. `selectionId` is unique across the array. A target may
occur once per group and may recur in another group. Input order is preserved;
no sorting, repair, coercion, or mutation occurs. Unknown fields, symbols,
non-enumerable fields, accessors, sparse arrays, and extra array properties fail
closed. Issues are sorted by RFC 6901 path and then code. Successful values are
fresh and deeply frozen.

Exports are local to `targetAnnouncementV1.ts`; this slice does not modify
barrels, registries, lifecycle records, ledger, docs, machine checks, or Solo
runtime integration.
