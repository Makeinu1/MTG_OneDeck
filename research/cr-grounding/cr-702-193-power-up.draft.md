# cr-702-193-power-up — Power-up keyword activated ability

- **Milestone ID**: cr-702-193-power-up
- **Base SHA**: 3ff3b88
- **CR refs**: 702.193a, 702.193b, 118.7, 602
- **Lane**: leaf-compiler
- **Depends on**: cr-118-costs-act4 (shipped), cr-602-activated-abilities (shipped)

## Goal

Recognize `Power-up — {COST}: [EFFECT]` as a keyword activated ability, implement
the conditional cost reduction (permanent's mana cost when it entered this turn),
and enforce "activate this ability only once" per battlefield object.

## CR text (pinned 2026-06-19)

> 702.193a Power-up is a keyword that adds additional rules to the activated
> ability that follows it. "Power-up — [Cost]: [Effect]" means "[Cost]: [Effect].
> If this permanent entered this turn, this ability's cost is reduced by this
> permanent's mana cost. Activate this ability only once."
>
> 702.193b Generic mana in the permanent's mana cost reduces generic mana in the
> cost to activate its power-up ability. Colored and colorless mana in the
> permanent's mana cost reduces mana of the same type, and any excess reduces
> that much generic mana. (See rule 118.7.)

## Oracle corpus (demand probe)

40 cards in the 2026-06-19 Scryfall corpus have Power-up. Pattern is highly
consistent:

```
Power-up — {5}{U}: Put three +1/+1 counters on this creature. (Activate each power-up ability only once. Reduce the cost by its mana cost if it entered this turn.)
```

Reminder text in parentheses is stripped by `removeReminderAndQuotes` before
`canonicalizeActivatedKeyword` runs, so the canonicalizer sees:

```
Power-up — {5}{U}: Put three +1/+1 counters on this creature.
```

Some cards reference power-up in other abilities (e.g. Advancing the Spirit,
Marvel Boy) — these must NOT be matched as power-up activated abilities.

## Constraints

1. **Grammar only recognizes the keyword line.** `canonicalizeActivatedKeyword`
   matches `^power-up\s*[—―-]\s*{COST}:\s*{EFFECT}` (case-insensitive). Other
   lines that merely mention "power-up" are not matched.

2. **Expansion preserves the effect text verbatim.** The expanded activated
   ability line is `{COST}: {EFFECT}. Activate this ability only once.` — the
   effect text passes through to the existing compile pipeline unchanged.
   keywordId = `'power-up'`, keywordLabel = `'パワーアップ'`,
   activationZones = `['battlefield']`.

3. **Cost reduction is conditional on entered-this-turn.** When the source
   permanent's `enteredTurn === state.turn`, the activation mana cost is reduced
   by the permanent's mana cost (from `CardFace.manaCost` of the source face).
   Reduction follows CR 118.7: generic reduces generic, colored reduces same
   color, colorless reduces colorless, excess of any type reduces generic.
   If the permanent did NOT enter this turn, no reduction applies.

4. **Activate only once per battlefield object.** Track activated power-up
   abilities by objectId (`${card.id}:${zoneChangeCounter}`). A permanent that
   leaves and re-enters gets a new objectId and may activate again. The
   restriction is enforced at activation time (block with warning if already
   activated).

5. **New GameState field requires backfill.** Add
   `powerUpActivated: Record<string, true>` to GameState (keyed by objectId).
   Initialize as `{}` in `init.ts`. Backfill in `restoreGame` for old snapshots.

6. **No new GameCommand types.** Record the activation in the existing
   `activateAbility` flow (store layer). The engine command layer does not need
   a new command — the store marks `powerUpActivated[objectId] = true` after
   successful activation.

7. **Effect compilation is out of scope.** The effect text (e.g. "Put a +1/+1
   counter on this creature and draw two cards") is compiled by existing atoms.
   This milestone does NOT add new effect atoms or change compile decisions.

8. **Manual boundary honesty.** If cost reduction or once-only enforcement
   cannot be completed, the power-up ability must remain manual/guided — never
   report partial implementation as auto-complete.

## Acceptance cases

### A1: Grammar recognition
`canonicalizeActivatedKeyword('Power-up — {5}{U}: Put three +1/+1 counters on this creature.')`
returns exactly one activation with keywordId `'power-up'`, keywordCost `'{5}{U}'`,
activationZones `['battlefield']`, and text containing `'{5}{U}: Put three +1/+1 counters on this creature.'`.

### A2: Non-power-up lines are not matched
`canonicalizeActivatedKeyword('You may pay {0} rather than pay the power-up cost of the first power-up ability you activate during each of your turns.')`
returns `null`.

### A3: activatedAbilityLines preserves keyword metadata
A CardDef with oracle text `"Flying\nPower-up — {4}{W}: Put two +1/+1 counters on this creature."`
produces an activated ability line with keywordId `'power-up'`, costText `'{4}{W}'`,
and the correct flat index.

### A4: Cost reduction when entered this turn
A permanent with manaCost `{1}{W}` and power-up cost `{4}{W}` that entered this
turn has its activation mana cost reduced to `{3}` (generic 4−1=3, W−W=0).

### A5: No cost reduction when NOT entered this turn
Same permanent, enteredTurn < state.turn → activation cost remains `{4}{W}`.

### A6: Colored excess reduces generic (CR 118.7c)
Permanent manaCost `{W}{W}`, power-up cost `{2}{W}` → reduction: W reduces W (1),
second W has no W to reduce so reduces generic (1) → final cost `{1}`.

### A7: Activate only once
After activating a power-up ability on objectId X, attempting to activate it
again on the same objectId is blocked with a warning.

### A8: Re-entry resets the restriction
After the permanent leaves and re-enters (new zoneChangeCounter → new objectId),
the power-up ability can be activated again.

### A9: Snapshot backfill
`restoreGame` with a snapshot missing `powerUpActivated` does not throw and
backfills `powerUpActivated: {}`.

### A10: No fake-green
Power-up abilities whose effects compile to `manual` or `guided` remain
manual/guided. The keyword recognition does not upgrade compile decisions.

## Done when

1. All acceptance cases A1–A10 pass in a `review.*` test file.
2. Existing tests remain green (no regressions).
3. `npm run check` passes (lint + vitest + build).
4. No new `any` types; TypeScript strict.
5. UI labels in Japanese; code/comments/identifiers in English.
6. `data-testid` on any new UI elements (if any).

## Files likely touched (implementer guidance, not prescriptive)

- `src/engine/grammar/activatedKeyword.ts` — power-up pattern
- `src/engine/types.ts` — `powerUpActivated` on GameState
- `src/engine/init.ts` — initialize field
- `src/engine/commands.ts` — backfill in restoreGame path (if applicable)
- `src/store/gameStore.ts` — cost reduction + once-only enforcement in activateAbility
- `src/engine/mana.ts` — may need a `reduceManaCost` utility
- `src/engine/__tests__/review.cr702-193-power-up.test.ts` — review test (judge-owned)

## Review test ownership

The `review.cr702-193-power-up.test.ts` file is judge-owned. The implementer
writes ordinary tests only. The judge authors the review test after freezing
the contract.
