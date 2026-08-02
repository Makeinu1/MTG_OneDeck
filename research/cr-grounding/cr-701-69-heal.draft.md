# CR 701.69 Heal — Leaf Compiler Contract (draft)

## CR Authority

**701.69a** "To heal damage already dealt to a permanent, remove that marked damage from that permanent. If an effect states that damage already dealt to a permanent 'is healed,' that permanent's controller removes all marked damage from that permanent."

## Scope

**In scope (auto/guided):**
- Single-target heal: "Heal target creature/permanent" → guided target prompt → `clearMarkedDamage { cardId }`
- Atom recognition: `effect.heal` with ruleRef `701.69`

**Out of scope (manual):**
- "Heal all damage dealt to target permanent" (mass/variable targets)
- Heal embedded in compound abilities with unresolved clauses
- Partial heal ("heal N damage") — CR 701.69a is all-or-nothing per permanent
- Non-permanent heal targets (players don't have marked damage)

## Design

### 1. Atom definition (src/engine/grammar/index.ts)

```ts
{ id: 'effect.heal', label: 'ダメージを癒やす', ruleRef: '701.69', probe: /\bheal(?:s|ed|ing)?\b/i }
```

### 2. Compiler registration (src/engine/grammar/compile.ts)

- Add `'effect.heal'` to `TARGET_REQUIRED_ATOMS`
- Add `'effect.heal'` to `GUIDED_TARGET_ATOMS`
- Add case in `buildGuidedCommands`:
  ```ts
  case 'effect.heal':
    return [{ type: 'clearMarkedDamage', cardId }];
  ```

### 3. Target filter

Existing `targetFilterForRaw` handles "Heal target creature" → `{ types: ['creature'] }`.
"Heal target permanent" also produces a guided prompt with filter `{ types: ['permanent'] }` since `'permanent'` is in `TARGET_TYPES`.
Mass phrasing ("Heal all damage dealt to target creature.") stays manual because the `effect.damage` probe fires on "damage", adding a `needs-parse` reason that suppresses all prompts.

### 4. No new GameCommand / GameState fields

`clearMarkedDamage` already exists (CR 514.2 cleanup). This is pure compiler recognition.

## Golden cases

1. "Heal target creature." → guided prompt, filter `{ types: ['creature'] }`, answer → `clearMarkedDamage { cardId }`
2. "{T}: Heal target creature." → activated shape, cost tap + guided heal
3. "Heal all damage dealt to target creature." → manual (mass/variable, not single-target heal)

## Acceptance

- [ ] `effect.heal` atom detected in oracle text containing "heal"
- [ ] Guided target prompt generated for single-target heal clauses
- [ ] `buildGuidedCommands` emits `clearMarkedDamage { cardId }` for heal prompt
- [ ] Non-single-target heal remains manual (no false auto)
- [ ] Existing tests unaffected (no regression)
- [ ] review.cr701-69-heal.test.ts green
