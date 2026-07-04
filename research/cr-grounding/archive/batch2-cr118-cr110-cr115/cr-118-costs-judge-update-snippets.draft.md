# cr-118-costs judge update snippets draft

Status: implementer draft. These are not applied to `docs/` or `review.*`.

## `src/engine/__tests__/review.grammar-cost.test.ts`

Purpose: replace the old honest-manual pin for fixed life payment with the CR 118 fixed-amount promotion, while preserving manual pins for value/choice-bearing costs.

Suggested additions near existing constants:

```ts
const payLifeThree: GameCommand = { type: 'adjustLife', delta: -3 };
const exileSelf: GameCommand = { type: 'moveCard', cardId: 'c1', to: 'exile', position: 'top' };
```

Suggested `assertKnownCostCommands` expansion:

```ts
const ok =
  (cmd.type === 'setTapped' && cmd.cardId === 'c1') ||
  (cmd.type === 'adjustLife' && cmd.delta < 0) ||
  (cmd.type === 'moveCard' &&
    cmd.cardId === 'c1' &&
    (cmd.to === 'graveyard' || cmd.to === 'exile'));
```

Suggested replacement for the old `Pay 3 life` manual test:

```ts
it('「{T}, Pay 3 life: Draw a card.」→ auto / tap + fixed life payment', () => {
  const r = compileCost('{T}, Pay 3 life: Draw a card.');
  expect(r.decision).toBe('auto');
  expect(r.commands).toEqual([tapSelf, payLifeThree]);
  expect(r.manaCost).toBeNull();
  assertKnownCostCommands(r.commands);
});
```

Suggested strict self-exile auto pin:

```ts
it('「{3}, {T}, Exile this land: ...」→ auto / tap + self exile + manaCost {3}', () => {
  const r = compileCost('{3}, {T}, Exile this land: Draw a card.', 'Land');
  expect(r.decision).toBe('auto');
  expect(r.commands).toEqual([tapSelf, exileSelf]);
  expect(r.manaCost).toBe('{3}');
  assertKnownCostCommands(r.commands);
});
```

Suggested manual pins to keep:

```ts
it('「Pay X life: ...」→ manual / variable-x', () => {
  const r = compileCost('Pay X life: Draw a card.');
  expect(r.decision).toBe('manual');
  expect(r.commands).toEqual([]);
  expect(r.reasons).toContain('variable-x');
});

it('「{T}, Exile seven cards from your graveyard: ...」→ manual(chosen graveyard cards)', () => {
  const r = compileCost('{T}, Exile seven cards from your graveyard: Add {U}.', 'Land');
  expect(r.decision).toBe('manual');
  expect(r.commands).toEqual([]);
  expect(r.reasons).toContain('unmodeled-cost');
});
```

CR refs for review comments: CR 118.1, 118.3b, 119.4, 107.3a, 118.4, 602.1, 602.2b, 601.2f, 601.2h, 701.13a, 400.7j.

## `docs/acceptance.md`

Current G4-6 includes fixed `Pay 3 life` in the manual bucket. Suggested split:

```md
| G4-6 | 「{X}, {T}: ...」「{T}, Sacrifice another creature: ...」「{T}, Exile seven cards from your graveyard: ...」「Coven — {1}{W}: ...」を起動(自動 ON) | コスト自動精算されず能力スタックのみ(manual)。warning でコスト手払いを促す。誤発火なし |
| G4-8 | 「{T}, Pay 3 life: ...」「{3}, {T}, Exile this land: ...」を起動(自動 ON) | 固定ライフ支払い/strict self-exile は既存コマンド(`adjustLife`/`moveCard -> exile`)で精算され、能力がスタックへ。`Pay X life` や選択を伴う exile は G4-6 の manual 境界に残る |
```

## `docs/engine-spec.md`

Current §33.6 says `Pay N life` remains manual. Suggested replacement bullet:

```md
- 固定 `Pay N life` は CR118.1/118.3b/119.4 により決定的コストとして `adjustLife -N` へ写す。`Pay X life` は CR107.3a/118.4 の値選択が必要なため manual。
- strict self-exile(`Exile it`/`Exile ~`/`Exile this ...`/exact card name)は CR701.13a/400.7j により `moveCard(source,'exile')` へ写す。数・対象・他オブジェクトの選択を伴う exile は manual。
```
