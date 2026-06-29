# Priority / Event Loop Study

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 117.5 / 603.3 / 603.3b / 704.3 / 101.4

## 目的

M0-FREEZE 前に、優先権直前の処理を「pending trigger をAPNAP順に積める」だけで凍結しない。

現状の `orderPendingTriggersApnap` は CR 603.3b / 101.4 の v1 として有効だが、`PendingTrigger` は ordinary trigger だけを表現している。CR 603.3b の second bucket、つまり「trigger condition が another ability triggering である誘発」は未表現である。

結論: **次の実装判断では、`PendingTrigger` に stack placement bucket を持たせる。**

## CRから導く要件

### 117.5 / 704.3 priority boundary

要点:

- player が priority を得る前に、SBAを実行する。
- SBAを実行したなら、SBAを再チェックする。
- SBAがなくなったら、待機中の誘発を stack へ置く。
- その後、またSBAをチェックする。
- これを、SBAも待機誘発もなくなるまで繰り返す。

設計帰結:

- `priorityReady` は `pendingRuleChoices.length === 0` かつ `pendingTriggers.length === 0` かつ新規SBAなしの状態。
- pending choice がある状態は priority-ready ではない。
- trigger stack placement 後に新しい trigger が発生した場合、同じ priority boundary 内で再度処理する。
- loop の単位は「SBA batch → trigger placement batch → repeat」。

### 603.3b two-bucket trigger placement

要点:

- 複数の誘発が前回priority以降に発生している場合、stack placement は二段階。
- first bucket: trigger condition が another ability triggering ではないもの。
- second bucket: remaining triggered abilities。
- 各bucket内では APNAP 順に、各 player は自分がコントロールする誘発を任意順で置く。

設計帰結:

- bucket は stack placement 時の推測ではなく、trigger 生成時に `PendingTrigger` へ保存する。
- 現行の `controllerId` と user explicit order は維持する。
- ordering は `bucket -> APNAP controller -> controller chosen order`。
- user が explicit order で second bucket を先に指定しても、bucket 境界は CR により正規化する。

## 推奨型

実装時の方向性。最終名は `docs/engine-spec.md` 更新時に確定する。

```ts
type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';

interface PendingTrigger {
  pendingTriggerId: string;
  eventId: string;
  simultaneousGroupId: string;
  triggerId: string;
  sourceId: string;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  label: string;
  abilityLineIndex?: number;

  // CR 603.3b. Existing triggers backfill to 'ordinary'.
  stackPlacementBucket: TriggerStackPlacementBucket;

  // Optional evidence for second bucket cases.
  triggeredByPendingTriggerId?: string;
  triggeredByAbilityEventId?: string;
}
```

S-EVENTS で導入するイベントの方向性:

```ts
interface AbilityTriggeredEvent {
  type: 'abilityTriggered';
  eventId: string;
  sequence: number;
  pendingTriggerId: string;
  sourceObjectId: ObjectId;
  controllerId: PlayerId;
  causeEventId?: string;
}
```

`AbilityTriggeredEvent` は「誘発が発生した」という event であり、「誘発型能力がstackへ置かれた」event ではない。`Whenever an ability triggers...` 系の observer はこの event を読む。

## Ordering algorithm

`orderPendingTriggersApnap` は次の順序へ拡張する。

1. explicit order が全 pending id を含むことを検査する。
2. explicit order を各 controller の選択順として読む。
3. pending を `stackPlacementBucket` で分ける。
4. bucket order は常に:
   - `ordinary`
   - `ability-triggered`
5. 各 bucket 内で APNAP controller order を適用する。
6. 各 controller 内では explicit order を維持する。

擬似コード:

```ts
const buckets = ['ordinary', 'ability-triggered'] as const;
return buckets.flatMap((bucket) =>
  apnapPlayerOrder(activePlayerId).flatMap((playerId) =>
    explicitOrder.filter((id) => {
      const trigger = pendingById.get(id);
      return trigger?.stackPlacementBucket === bucket && trigger.controllerId === playerId;
    })
  )
);
```

## Priority loop algorithm

R-FREEZE-1 の `pendingRuleChoices` と接続した最終形。

```ts
function advanceToPriority(state: GameState): PriorityBoundaryResult {
  let working = state;

  for (;;) {
    const sba = performStateBasedActionsOnce(working);
    working = sba.state;

    if (working.pendingRuleChoices.length > 0) {
      return { status: 'choice-required', state: working };
    }

    if (sba.performed) {
      continue;
    }

    if (working.pendingTriggers.length > 0) {
      const order = orderPendingTriggersForPriority(working);
      if (order.status !== 'ordered') {
        return { status: 'trigger-order-required', state: working, order };
      }
      working = placePendingTriggersOnStackAsBatch(working, order.orderedIds);
      continue;
    }

    return { status: 'priority-ready', state: working };
  }
}
```

重要:

- trigger placement の後にも必ず SBA へ戻る。
- choice required は priority-ready ではない。
- order required も priority-ready ではない。
- deterministic auto-placement は、選択余地が無い場合だけ許す。

## Backfill

既存 snapshot の `PendingTrigger` は `stackPlacementBucket` を持たない。

backfill:

- `stackPlacementBucket: 'ordinary'`
- `triggeredByPendingTriggerId: undefined`
- `triggeredByAbilityEventId: undefined`

理由:

- 現行実装が生成する pending trigger は、zone-change / phase / attack / cast observer 由来であり、second bucket の認識を持たない。
- 既存テストの意味を変えずに CR 603.3b 拡張へ進める。

## Golden cases to add

### `cr-trigger-6033b-two-bucket-order`

目的: second bucket が controller explicit order より上位のCR境界であることを検査する。

盤面:

- P1 が ordinary pending trigger A を control。
- P1 が ability-triggered pending trigger B を control。

操作:

- user explicit order として `[B, A]` を渡す。

期待:

- stack placement order は `[A, B]` に正規化される。
- B が A より先に置かれない。

### `cr-trigger-6033b-apnap-per-bucket`

目的: bucket ごとに APNAP が適用されることを検査する。

盤面:

- active player P1。
- P1 ordinary A。
- OPPONENT_A ordinary B。
- P1 ability-triggered C。
- OPPONENT_A ability-triggered D。

期待:

- placement order は ordinary bucket の APNAP `[A, B]`、次に second bucket の APNAP `[C, D]`。
- 全体は `[A, B, C, D]`。

### `cr-priority-loop-trigger-placement-rechecks-sba`

目的: 117.5 / 704.3 の固定点ループを検査する。

観測:

- pending trigger をstackへ置いた後、SBAへ戻る。
- stack placement により新しい pending trigger が発生した場合、priority-ready にならず同じ boundary 内で処理する。
- choice や ordering が必要ならそこで止まる。

## M0-FREEZE 判断

R-FREEZE-2 の判断は以下で合格とする。

- `PendingTrigger` に `stackPlacementBucket` を持たせる方針が明文化されている。
- 現行 pending trigger は `ordinary` backfill で前方互換になる。
- `AbilityTriggeredEvent` を S-EVENTS の導入候補として定義し、second bucket の観測点を示している。
- ordering は `bucket -> APNAP -> controller chosen order` として定義されている。
- priority boundary は `SBA -> choice -> trigger placement -> repeat` の固定点として定義されている。

この設計なら、現行APNAP v1を捨てずに CR 603.3b の second bucket へ拡張できる。
