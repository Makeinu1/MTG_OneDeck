# O4P-01J-C Structural Retarget Contract Analysis

- Milestone: `O4P-01J`, lane C
- Role: independent Domain Analyst
- PLAN_SHA: `3476e170124158da849dadb5a3031dfda4a28a3c`
- Ruleset: pinned local Comprehensive Rules effective 2026-06-19
- Status: `analyzed-not-integrated`

This is a structural analysis for the immutable retarget transaction. It
reuses the shipped O4P-01I announcement facts: a committed record belongs to
one already represented stack object; target selections are ordered slots with
`selectionId`, `groupKey`, and an object/player reference; empty selections are
valid; references are historical structural snapshots; and mode, variable,
cost, distribution, ability-text, and kind fields are separate announcement
facts. This analysis does not implement, choose final TypeScript public names,
design a target-legality predicate, or design a candidate generator.

## 1. One target

The CR 115.7b shape “change a target” permits at most one existing target slot
to receive a different target. Structurally, the operation therefore has one
replacement slot and must preserve every other slot exactly. It must not be
interpreted as permission to rebuild the complete target list, select a mode,
or alter a distribution. Whether the selected replacement is legal, and what
effect authorized the change, are outside this structural operation.

## 2. Any targets

The CR 115.7c shape “change any targets” permits zero or more target slots to be
changed. A structural request may therefore contain several slot replacements,
but it may not insert, remove, reorder, or re-key slots. Unspecified slots are
carried forward unchanged. The operation still does not decide legality or
whether the governing effect actually grants this permission.

## 3. Empty and no-op

The O4P-01I empty target-selection array remains valid. It represents zero
selected targets, including a zero-valued up-to case; it does not authorize the
transaction to invent a target. A one-target operation has no slot to replace
when the array is empty. An any-targets or choose-new-targets request may make
zero changes, yielding a semantic no-op. A no-op must preserve the complete
announcement content and must not be reported by this structural layer as a
successful game effect. If a future command rejects or records no-ops is a
command-policy decision. Even a returned no-op result is a fresh immutable
value, not the input object.

## 4. Choose-new-targets boundary

CR 115.7d allows any number of current targets to remain unchanged, even when
they are illegal, and requires every changed target to be legal. CR 115.7e
evaluates only the final target set. Therefore “choose new targets” is not the
same as requiring every old slot to be replaced: unchanged slots remain in the
same positions and changed slots are checked only as part of the final set by a
future legality owner. The structural transaction records the requested final
slot references but performs neither that legality check nor the permission
check.

For a spell or ability copy, CR 707.10c supplies this boundary only when the
copying effect says the controller may choose new targets. A copy otherwise
retains the copied target decisions under CR 707.10. Retargeting does not grant
copy-time new-target permission and does not itself create a copy.

## 5. selectionId, groupKey, and order preservation

Each existing target slot keeps its O4P-01I `selectionId` and `groupKey`
verbatim. `selectionId` remains unique for the record; `groupKey` may repeat.
Replacement changes only the target reference associated with an existing slot.
No slot may be renamed, merged, split, or moved to another group. This keeps
distribution assignments, which refer to selection IDs, attached to the same
target occurrence.

## 6. Target array order

The target-selection array remains in declaration order. Its length and slot
positions are unchanged by retargeting, and the replacement result is not
sorted, deduplicated, or normalized. If a future caller supplies several
replacements, they must be associated with existing slots while the output
array follows the original order; caller input order cannot become a new stack
or target order.

## 7. Mode

CR 115.8 forbids a target-changing or new-target effect from changing the
modal choice. The existing `chosenModeKeys` sequence, including its O4P-01I
order and permitted repetition, is copied unchanged. Retargeting cannot add,
remove, reorder, or reinterpret a mode, and it does not validate mode legality.

## 8. Variable and X

The announcement variable records are unchanged, including the announced value
of X and an explicit value of zero. Retargeting neither evaluates X nor derives
a new value from the replacement target. A copied object retains its copied
announcement decisions; target replacement does not alter that retention rule.

## 9. Cost choices

The O4P-01I selected alternative-cost and additional-cost choices are carried
forward exactly, including repeated additional-cost counts and canonical key
order. Retargeting does not recalculate total cost, apply increases or
reductions, pay costs, alter Commander tax, or replace cost-payment objects.
Those are cost and future command/authority responsibilities, not target-slot
mutation.

## 10. Distributions

CR 115.7f prohibits changing the original division or distribution while
changing targets. Every distribution key, assignment amount, assignment order,
and assignment target-selection ID is therefore preserved. Only the object or
player reference behind a retained target slot may differ. No assignment is
created for a new slot, no amount is moved between slots, and no total is
recomputed. O4P-01I's structural rule that assignment IDs refer to target
selections remains sufficient after a slot-preserving replacement.

## 11. Ability text

The exact O4P-01I `abilityTextSnapshot` is unchanged. Activated and triggered
ability records retain the original nonempty text without trimming,
normalization, interpretation, or source re-read. Card-spell and spell-copy
records retain `null`. A missing or moved source does not cause text to be
reconstructed during retargeting.

## 12. Kind

The stack object's kind and its announcement kind remain unchanged. A
card-spell remains a card-spell, a spell-copy remains a spell-copy, and an
activated or triggered ability remains the same ability kind. Retargeting does
not convert kinds, create a source, copy an object, or change registry/runtime
identity. The O4P-01I registry-to-announcement kind parity invariant continues
to hold.

## 13. Historical targets

An O4P-01I target reference is a historical selection snapshot, not a claim
that the referenced object is currently registered, in the same zone, alive, or
legal, and a player reference is not a claim that the player remains active.
Retargeting preserves unchanged historical references and may structurally
carry a replacement reference that passes the canonical reference shape without
being present in the current registry. No stale reference is automatically
rebound to a later object incarnation, and no player-exit or zone-liveness rule
is inferred here.

## 14. Legality boundary

The structural checks are limited to the existing bundle/record shape, target
reference shape, slot identity/order, and same-group duplicate invariant. They
must not inspect protection, hexproof, shroud, controller, zone, player
activity, source restrictions, effect wording, or a candidate set. They must
not claim that an unchanged illegal target became legal or that a replacement
is legal. The final-set rule in CR 115.7e belongs to a later legality owner.

## 15. Same-group duplicate structural constraints

The O4P-01I invariant remains: the same target reference may occur at most once
within one `groupKey`, while the same reference may occur in different groups.
An attempted replacement that creates a same-group duplicate is structurally
invalid even though no target-legality predicate is being designed. The
transaction must reject that candidate atomically; it must not silently
deduplicate, move the slot to another group, or choose a substitute. This is a
shape/invariant check on the committed target array, not a statement about CR
legality for the card or ability.

## 16. Unchanged targets

Every slot not explicitly replaced is copied with the same target reference,
`selectionId`, `groupKey`, and array position. Under CR 115.7d and 707.10c,
unchanged targets may remain illegal; the structural operation must not “repair”
them or force them through a new candidate generator. Under the other future
retarget permissions, whether unchanged slots are allowed and whether all
requested changes must succeed is decided by the permission/legality layer,
not by silently changing the structural replacement semantics.

## 17. Immutable replacement

The transaction validates the complete input bundle before exposing a result,
constructs a candidate bundle with the target references replaced only in the
requested slots, cross-validates the candidate, and exposes no partial Registry,
Runtime, or Announcement value on failure. The input bundle and every nested
array/record remain unmodified. The successful result is fresh and deeply
frozen, including a structural no-op result. Registry, runtime, stack object,
announcement kind, and all non-target announcement fields are semantically
unchanged. No alias to mutable input data is retained.

## 18. Future Command and Event responsibility

O4P-01J intentionally provides no command/event envelope. A future Command or
authority layer must supply the stack object identity and expected revision,
actor/decision authority, timing context, the explicit permission shape (one,
any, or choose-new-targets), the proposed replacement slots, and the legality
evaluation needed for the final target set. It also owns whether a no-op is
accepted and how failures are presented. The structural transaction must not
infer any of those facts.

A future Event layer may report a successful atomic replacement for replay,
projection, and audit, retaining slot identity/order and the old/new reference
relationship as needed. It must be emitted only according to the future command
and event contract; this lane does not invent event names, command metadata,
revision fields, visibility, protocol, priority, or resolution effects. A
failed structural candidate exposes no partial event or partial bundle.

## Result

The lane-C contract is `analyzed-not-integrated`. No target predicate, candidate
generator, implementation, public TypeScript name, ledger update, docs change,
review test, package change, or source change is included.
