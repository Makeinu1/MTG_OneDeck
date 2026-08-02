# CR 701.69 Heal — Implementer Brief

**Milestone**: cr-701-69-heal
**Base SHA**: cc921c9350a44f07ffa81933627dd3eda1d0931d
**Contract**: research/cr-grounding/cr-701-69-heal.draft.md

## Goal

Add compiler recognition for the CR 701.69 "Heal" keyword action so that single-target heal oracle text produces a guided target prompt resolving to the existing `clearMarkedDamage` command.

## Constraints

- Do NOT create or modify any file matching `review.*`.
- Do NOT touch git, AGENTS.md, docs/, ledger, or eslint config.
- Do NOT add new GameCommand types or GameState fields — `clearMarkedDamage` already exists.
- TypeScript strict, no `any`. UI text in Japanese, code/comments/identifiers in English.
- Engine code (`src/engine/`) must remain pure functions with no React/DOM imports.

## Changes Required

### 1. src/engine/grammar/index.ts — Add atom definition

Add to `EFFECT_ATOM_DEFINITIONS` array (alphabetical position after `effect.grant-keyword`, before `effect.lose-life`):

```ts
{ id: 'effect.heal', label: 'ダメージを癒やす', ruleRef: '701.69', probe: /\bheal(?:s|ed|ing)?\b/i },
```

### 2. src/engine/grammar/compile.ts — Register atom in compiler

a) Add `'effect.heal'` to the `TARGET_REQUIRED_ATOMS` Set (alphabetical after `'effect.grant-keyword'`).

b) Add `'effect.heal'` to the `GUIDED_TARGET_ATOMS` Set (alphabetical after `'effect.exile'`).

c) In `buildGuidedCommands`, inside the `switch (prompt.atom)` block, add a case (after `case 'effect.untap':`):

```ts
case 'effect.heal':
  return [{ type: 'clearMarkedDamage', cardId }];
```

### 3. src/engine/grammar/__tests__/cr701Heal.test.ts — Ordinary tests

Write tests covering:

1. **Atom detection**: `detectEffectAtoms('Heal target creature.')` includes `'effect.heal'`.
2. **IR parse**: `parseAbilityIR('Heal target creature.', 'Creature')` produces an effect with `atom: 'effect.heal'` and `ruleRef: '701.69'`.
3. **Guided prompt**: compiling an ability with "Heal target creature." produces a guided target prompt with `atom: 'effect.heal'` and filter `{ types: ['creature'] }`.
4. **Command emission**: `buildGuidedCommands` for a heal prompt with a chosen cardId returns `[{ type: 'clearMarkedDamage', cardId }]`.
5. **Activated shape**: `parseAbilityIR('{T}: Heal target creature.', 'Creature')` produces activated shape with tap cost + heal effect.
6. **Non-single-target stays manual**: "Heal all damage dealt to target creature." does NOT produce a guided heal prompt (the word "all" or mass phrasing should prevent single-target recognition — verify `isSingleTargetClause` or `guidedTargetPrompt` returns null).

### 4. src/engine/__tests__/cr701Heal.test.ts — Integration test

Write an integration test that:
1. Sets up a GameState with a creature that has `damageMarked > 0`.
2. Compiles "Heal target creature." via the grammar compiler.
3. Resolves the guided prompt with the damaged creature's cardId.
4. Applies the resulting `clearMarkedDamage` command.
5. Asserts `damageMarked === 0` on the target creature.

## Done When

- All new tests pass: `npx vitest run src/engine/grammar/__tests__/cr701Heal.test.ts src/engine/__tests__/cr701Heal.test.ts`
- No existing tests broken: `npx vitest run src/engine/grammar/ src/engine/__tests__/commands.test.ts`
- `npx tsc -b` passes (no type errors)
- Report: list changed files, test results, any deferrals or open questions.
