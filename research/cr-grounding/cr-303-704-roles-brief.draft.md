# CR-303.7 / 704.5y — Role Token Attachment & Duplicate SBA

## Milestone ID

cr-303-704-roles

## Base SHA

0c2d4315d7eda05a1aa1de45edf6d5ad44361051

## CR References (pinned CR 2026-06-19)

- **303.7**: Some Aura enchantments also have the subtype "Role."
- **303.7a**: If a permanent has more than one Role controlled by the same player attached to it, each of those Roles except the one with the most recent timestamp is put into its owner's graveyard. This is a state-based action. See rule 704.
- **111.10j**: Cursed Role — colorless Aura Role enchantment token, enchant creature, "Enchanted creature has base power and toughness 1/1."
- **111.10k**: Monster Role — "Enchanted creature gets +1/+1 and has trample."
- **111.10m**: Royal Role — "Enchanted creature gets +1/+1 and has ward {1}."
- **111.10n**: Sorcerer Role — "Enchanted creature gets +1/+1 and has 'Whenever this creature attacks, scry 1.'"
- **111.10p**: Virtuous Role — "Enchanted creature gets +1/+1 for each enchantment you control."
- **111.10q**: Wicked Role — "Enchanted creature gets +1/+1," and "When this token is put into a graveyard from the battlefield, each opponent loses 1 life."
- **111.10r**: Young Hero Role — "Enchanted creature has 'Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it.'"
- **704.5y**: If a permanent has more than one Role controlled by the same player attached to it, each of those Roles except the one with the most recent timestamp is put into its owner's graveyard.

## Goal

Implement Role token creation with guided creature attachment and the 704.5y duplicate-Role SBA. After this milestone, creating a Role token on a creature that already has a Role from the same controller correctly puts the older Role into the graveyard as a state-based action.

## Constraints

1. **Engine purity**: all changes in `src/engine/` are pure functions. No React/DOM/Zustand imports.
2. **No continuous effects system**: Role static ability grants (+1/+1, trample, ward, base P/T, triggered abilities) are OUT OF SCOPE. They remain manual/guided. This milestone only models attachment and the duplicate SBA.
3. **TokenKind extension**: extend the `tokenKind` union to include the 7 Role variants: `'cursed-role' | 'monster-role' | 'royal-role' | 'sorcerer-role' | 'virtuous-role' | 'wicked-role' | 'young-hero-role'`.
4. **Predefined Role defs**: when a Role token is created via `createToken`/`createDefinedToken`, synthesize a `CardDef` with `typeLine: 'Enchantment Token — Aura Role'`, correct `name`, and `tokenKind` set to the Role variant. The def's `faces[0].oracleText` should contain the English CR text for that Role.
5. **Guided attachment**: when a Role token is created and enters the battlefield, if there is exactly one legal creature target, auto-attach. If multiple, present a guided target prompt (kind: `'attach-role'`). If zero legal creatures, the Role enters unattached (it will not be SBA'd since 704.5y only applies to attached Roles).
6. **Timestamp proxy**: use `enteredTurn` as primary key and `zoneChangeCounter` as secondary key to determine "most recent timestamp." The Role with the highest `(enteredTurn, zoneChangeCounter)` tuple is kept; all others from the same controller attached to the same permanent are put into their owner's graveyard.
7. **SBA 704.5y**: add to `performStateBasedActionsOnce`. Group battlefield tokens by `attachedTo` + `controllerId`. For each group with 2+ Roles, keep the newest, move the rest to graveyard with `sbaApplied: '704.5y'` and `reason: 'sba'`. This must run in the same SBA pass as other 704.5 checks (simultaneous event).
8. **Wicked Role LTB trigger**: OUT OF SCOPE for this milestone. The "When this token is put into a graveyard from the battlefield" trigger is a triggered ability that requires the trigger system. Record as deferred.
9. **Existing SBA contract**: do not modify existing SBA behavior (704.5a/b/c/f/g/h/j). The new 704.5y check is additive.
10. **UI**: the guided attach prompt must work in the existing `ManualTargetDialog` / decision-focus system. Add `data-testid="attach-role-dialog"` to the dialog. No new viewport-specific layout is expected (Roles use the existing target-selection UI).
11. **Undo**: Role creation + attachment + SBA must be fully undoable via the existing snapshot mechanism.

## Acceptance Cases

### A1: Single Role creation and attachment
Create a Monster Role token targeting a creature. The Role enters the battlefield attached to that creature. `attachedTo` is set. The Role's def has `typeLine` containing "Aura Role" and `tokenKind === 'monster-role'`.

### A2: Duplicate Role SBA (704.5y)
A creature has a Royal Role (enteredTurn=1) attached, controlled by P1. A second Monster Role (enteredTurn=2) is created and attached to the same creature, also controlled by P1. After SBA, the Royal Role is in its owner's graveyard with `sbaApplied: '704.5y'`. The Monster Role remains attached.

### A3: Different controllers — no SBA
A creature has a Cursed Role controlled by P1 and a Wicked Role controlled by OPPONENT_A. Both remain attached. No SBA fires.

### A4: Same controller, different creatures — no SBA
P1 controls a Cursed Role on creature A and a Monster Role on creature B. Both remain attached.

### A5: Three Roles, same controller, same creature
Keep only the newest. The two older ones go to graveyard simultaneously (same `simultaneousGroupId`).

### A6: Role enters unattached (no legal creatures)
Create a Role token when the battlefield has no creatures. The Role enters the battlefield unattached (`attachedTo === undefined`). No SBA fires. No crash.

### A7: Undo restores pre-Role state
After A1 or A2, undo returns to the exact pre-creation snapshot.

### A8: Golden replay
Add a golden case to `research/cr-grounding/golden-cases.json` with id `cr-303-704-roles-duplicate-sba` that exercises A2 end-to-end and verifies the final GameState (Role in graveyard, newest Role attached, event log contains 704.5y).

## Done When

1. All acceptance cases pass as `review.*` tests (judge-authored).
2. Golden case passes.
3. `npm run check` is green (lint + vitest + build).
4. Cold audit returns BLOCKER/HIGH = 0.
5. Ledger updated, commit message includes cold auditor identifier.

## Deferred (record in ledger note)

- Role static ability grants (+1/+1, trample, ward, base P/T, triggered abilities) — requires continuous effects / layer system.
- Wicked Role LTB trigger — requires trigger system integration.
- Enchant legality validation beyond "is a creature" (e.g., "enchant creature you control" vs "enchant creature").
- Role interaction with totem armor / protection / hexproof.
