# Mana Ability Substrate Study

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 605.1a / 605.1b / 605.3b / 605.4a / 605.5a / 405.6c

## 目的

M0-FREEZE 前に、CR 605 を「起動型マナ能力だけ no-stack」として凍結しない。

現状の `activatedManaAbilityPlanForSource` は CR 605.1a / 605.3b の単純な起動型マナ能力を no-stack で処理できる。一方で、CR 605.1b / 605.4a の誘発型マナ能力は、通常の triggered ability と同じように見えるが、条件を満たす場合は stack に置かず即時解決する。

結論: **誘発型マナ能力は `pendingTriggers` に入れない。S-EVENTS では mana transaction 内の `pendingManaTriggers` として即時解決する。**

## CRから導く要件

### 605.1a activated mana ability

要件:

- activated ability。
- target を要求しない。
- 解決時に mana pool へ mana を加えうる。
- loyalty ability ではない。

現状:

- 単純な起動型マナ能力は `activatedManaAbilityPlanForSource` で no-stack。
- `effectsAuto` OFF でも CR605 の no-stack は維持。

判断:

- 605.1a は PASS(core)。
- 対象を取る add-mana ability は mana ability ではない。

### 605.1b triggered mana ability

要件:

- triggered ability。
- target を要求しない。
- activated mana ability の activation/resolution、または mana が mana pool に加えられたことから trigger する。
- 解決時に mana pool へ mana を加えうる。

設計帰結:

- `effect.add-mana` だけでは mana ability と判定しない。
- trigger source event が mana-related でなければ、通常誘発として扱う。
- target を取るなら、mana を加えうる誘発でも通常誘発として扱う。
- 605.1b と判定したものは `pendingTriggers` に入れず、stack にも置かない。

### 605.4a immediate resolution

要件:

- triggered mana ability は stack に置かれない。
- trigger 元の mana ability の直後に解決する。
- priority を待たない。

設計帰結:

- priority boundary の `pendingTriggers` とは別経路。
- `placePendingTriggersForPriority` の対象にしない。
- mana ability transaction 内で、mana event を発行し、triggered mana ability を集め、即時解決する。
- triggered mana ability が mana を加えた場合、その mana-added event からさらに triggered mana ability が発生しうるため、transaction-local queue を固定点まで処理する。

## 推奨イベント

S-EVENTS で導入する方向性。

```ts
interface ActivatedManaAbilityEvent {
  type: 'activatedManaAbility';
  eventId: string;
  sequence: number;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  abilityLineIndex?: number;
  stage: 'activated' | 'resolved';
}

interface ManaAddedEvent {
  type: 'manaAdded';
  eventId: string;
  sequence: number;
  playerId: PlayerId;
  sourceObjectId?: ObjectId;
  sourceSnapshot?: ObjectSnapshot;
  amount: ManaPool;
  causeEventId?: string;
}
```

`ManaAddedEvent` は zone-change ではないが、605.1b の trigger source として必要である。

## 推奨キュー

`pendingTriggers` とは別に、mana transaction 内だけで使う。

```ts
interface PendingManaTrigger {
  kind: 'triggered-mana-ability';
  ruleRef: '605.1b';
  triggerEventId: string;
  sourceId: PhysicalCardId;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  abilityLineIndex?: number;
  label: string;
}
```

原則:

- `PendingManaTrigger` は `GameState.pendingTriggers` に保存しない。
- undo/redo の単位は、元の mana ability activation と triggered mana ability resolution を含む1 transaction。
- 実装不能な triggered mana ability は stack に逃がさない。`manual-no-stack` として warning / log に残す。

## Transaction algorithm

```ts
function resolveManaAbilityTransaction(state, activatedManaAbility): GameState {
  let working = applyActivatedManaAbilityCostAndMana(state, activatedManaAbility);
  let manaEvents = eventsFromActivatedManaAbility(working);
  let queue = collectTriggeredManaAbilities(working, manaEvents);

  for (;;) {
    const next = queue.shift();
    if (!next) return working;

    const plan = triggeredManaAbilityPlan(working, next);
    if (plan.decision === 'manual') {
      working = logManualNoStack(working, next);
      continue;
    }

    const before = working;
    working = applyCommands(working, plan.commands).state;
    const newManaEvents = collectManaAddedEvents(before, working, next);
    queue.push(...collectTriggeredManaAbilities(working, newManaEvents));
  }
}
```

重要:

- `addAbilityToStack` は使わない。
- priority boundary へ渡さない。
- mana が増えたことを event として観測できるようにする。
- 無限ループを避けるため、実装時は transaction iteration cap と warning を持つ。

## Classification rules

### mana ability にする

- `{T}: Add {G}.` のような targetless activated add-mana ability。
- `Whenever a player taps a land for mana, that player adds ...` のように、activated mana ability または mana-added event から trigger し、targetless で、mana を加えうる triggered ability。

### mana ability にしない

- target を取る activated/triggered add-mana ability。
- `Whenever you cast a spell, add {G}.` のように、mana-related event 以外から trigger する add-mana triggered ability。
- spell。
- loyalty ability。

## Golden cases to add

### `cr-triggered-mana-ability-no-stack`

目的: CR 605.1b / 605.4a を検査する。

盤面:

- land A: `{T}: Add {G}.`
- permanent B: `Whenever a player taps a land for mana, that player adds one mana of any type that land produced.`

操作:

- A の activated mana ability を起動する。

期待:

- A の起動型マナ能力は stack に置かれない。
- B の triggered mana ability も stack に置かれない。
- `pendingTriggers` は増えない。
- manaPool は A と B の両方の mana を反映する。
- priority boundary を待たない。

### `cr-add-mana-trigger-from-non-mana-event-is-normal-trigger`

目的: `effect.add-mana` だけで 605.1b と誤判定しない。

盤面:

- permanent C: `Whenever you cast a spell, add {G}.`

操作:

- spell を cast する。

期待:

- C は triggered mana ability ではない。
- 通常の pending trigger として扱う。
- stack placement は CR 603/117/704 の priority boundary に従う。

### `cr-targeted-add-mana-trigger-is-normal-trigger`

目的: target を取る add-mana ability を mana ability にしない。

期待:

- target を取るなら、mana を加えうる誘発でも 605.1b ではない。
- 通常誘発として `pendingTriggers` に入る。

## M0-FREEZE 判断

R-FREEZE-3 の判断は以下で合格とする。

- CR 605.1a と 605.1b を分けて扱う。
- 誘発型マナ能力を `pendingTriggers` / stack placement へ混ぜない。
- mana-related event を S-EVENTS の観測対象にする。
- unsupported triggered mana ability を通常誘発に逃がさない。
- golden case が no-stack / normal-trigger 境界の両方を持つ。

この設計なら、CR 605 を「起動型は実装済み、誘発型は未実装」と正しく表示しながら、S-EVENTS で通常誘発へ誤配線する手戻りを避けられる。
