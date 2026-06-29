# Rule Choice Substrate Study

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 903.9a / 704.6d / 704.5j / 117.5 / 704.3

## 目的

M0-FREEZE 前に、CR上プレイヤー選択を要求する state-based action を commander 専用実装へ閉じ込めない。

現状の `pendingSbaChoices` は CR 903.9a の bridge として有効だが、型が `CommanderZoneSbaChoice` 専用である。これを最終 substrate として凍結すると、legend rule 704.5j や将来の選択型SBAで同じ設計問題を再発する。

結論: **次の実装判断では、`pendingSbaChoices` を汎用 `pendingRuleChoices` へ一般化する。**

## CRから導く要件

### 903.9a / 704.6d commander zone SBA

要点:

- commander が graveyard/exile にあり、その object が「前回SBA確認以降」にその zone へ置かれた場合にだけ選べる。
- owner は command zone へ置いてよい。
- これは replacement ではなく state-based action。
- battlefield→graveyard/exile の zone-change event と death/LTB trigger は消してはならない。

設計帰結:

- choice は発生元 `ZoneChangeEvent` に接地する。
- choice 解決で command を選ぶ場合、command への後続移動は `reason:'sba'` / `sbaApplied:'903.9a'` の event を残す。
- decline した場合、その object に対して同じ「前回SBA確認以降」条件で再提示し続けないため、choice の解決済み事実を保持するか、同一 priority-boundary 内では再生成しない。

### 704.5j legend rule

要点:

- 同じ player が同名 legendary permanent を2つ以上 control している場合、その player は1つを選び、残りは owners' graveyards へ置かれる。
- 選択は任意ではない。
- 同じSBAチェックで複数の legendary group が成立しうる。

設計帰結:

- commander 903.9a と同じく「SBA中にプレイヤー選択が必要」な pending choice として扱う。
- choice は `controllerId`、legendary name、候補 object set に接地する。
- 解決時は選ばなかった object 群を同一 `simultaneousGroupId` で graveyard へ置く。
- 704.5j は「選ばない」選択肢を持たない。UI/APIは keep object を必須にする。

### 117.5 / 704.3 priority boundary

要点:

- priority を得る前に、SBA実行と誘発stack placementを固定点まで繰り返す。
- ただし choice が必要なSBAは、選択が解決されるまで fixed-point を完了できない。

設計帰結:

- `stabilizeBeforePriority()` は `pendingRuleChoices` が空でない状態を stable と扱わない。
- choice pending 中は「priorityを得た」とは言わない。
- UIは choice を表示し、解決後に stabilization を再開する。
- サンドボックス上の強行操作を許す場合でも、それは CR-grounded stable state ではなく manual override として扱う。

## 推奨型

実装時の方向性。最終名は `docs/engine-spec.md` 更新時に確定する。

```ts
type RuleChoiceTiming = 'sba-before-priority';

interface PendingRuleChoiceBase {
  choiceId: string;
  timing: RuleChoiceTiming;
  ruleRef: string;
  controllerId: PlayerId;
  createdAtEventSeq: number;
  simultaneousGroupId?: string;
}

interface CommanderZoneRuleChoice extends PendingRuleChoiceBase {
  kind: 'commander-zone-sba';
  ruleRef: '903.9a';
  cardId: PhysicalCardId;
  fromZone: 'graveyard' | 'exile';
  toZone: 'command';
  eventId: string;
  sourceObjectId: ObjectId;
  options: ['move-to-command', 'leave-in-zone'];
}

interface LegendRuleChoice extends PendingRuleChoiceBase {
  kind: 'legend-rule';
  ruleRef: '704.5j';
  controllerId: PlayerId;
  name: string;
  objectIds: ObjectId[];
  cardIds: PhysicalCardId[];
  requiredSelection: 'keep-one';
}

type PendingRuleChoice = CommanderZoneRuleChoice | LegendRuleChoice;
```

## State migration

推奨:

- `GameState.pendingSbaChoices` を最終 substrate にしない。
- 次の実装 milestone で `GameState.pendingRuleChoices: PendingRuleChoice[]` を追加する。
- 旧snapshot backfill:
  - `pendingRuleChoices` が無ければ `[]`。
  - もし `pendingSbaChoices` が存在する旧snapshotを読む場合は、`CommanderZoneRuleChoice` へ変換する。
- migration 完了後、内部実装は `pendingRuleChoices` だけを見る。

理由:

- `pendingSbaChoices` の名前はSBAに閉じており、将来 rule choices が replacement / prevention / modal continuous へ広がったときに狭い。
- ただし現時点の凍結阻害はSBA choiceなので、`timing:'sba-before-priority'` を明示しておく。

## Command / store 方針

### create

SBA check が選択を要求したら、即座に盤面を変えず `pendingRuleChoices` を追加する。

- 903.9a: graveyard/exile へ置かれた commander event から生成。
- 704.5j: 同一 controller + 同名 legendary permanent group から生成。

### resolve

`resolveRuleChoice(choiceId, selection)` のような store action で解決する。

- 903.9a `move-to-command`:
  - card を command へ移す。
  - event は `reason:'sba'` / `sbaApplied:'903.9a'`。
  - choice を削除し、stabilization を再開。
- 903.9a `leave-in-zone`:
  - card は動かさない。
  - choice を削除し、同じ boundary 内で再生成しない。
- 704.5j:
  - keep card 以外を owners' graveyards へ同時に移す。
  - event 群は `reason:'sba'` / `sbaApplied:'704.5j'` / same `simultaneousGroupId`。
  - choice を削除し、stabilization を再開。

### invariants

- pending choice がある状態は CR-grounded priority-ready state ではない。
- pending choice は undo/redo と snapshot restore の対象。
- pending choice は根拠CR、選択主体、対象 object、発生元 event または group を持つ。
- `PASS` 判定のテストは、choice 生成だけでなく choice 解決後の event metadata を検査する。

## Golden cases to add

### `cr-commander-9039a-rule-choice`

目的: 現 bridge を汎用 rule choice substrate に移す。

観測:

- battlefield→graveyard event が先にある。
- death/LTB pending trigger は保持される。
- `pendingRuleChoices[0].kind === 'commander-zone-sba'`。
- `move-to-command` 解決で `sbaApplied:'903.9a'` の command event が残る。
- `leave-in-zone` 解決では command event は発生しない。

### `cr-legend-rule-choice`

目的: 704.5j が同じ rule choice substrate に載ることを確認する。

観測:

- 同じ controller が同名 legendary permanent を2つ control すると `legend-rule` choice が生成される。
- keep selection は必須。
- keep 以外が owners' graveyards へ移る。
- それらの zone-change event は `sbaApplied:'704.5j'` と同一 `simultaneousGroupId` を持つ。

## M0-FREEZE 判断

R-FREEZE-1 の判断は以下で合格とする。

- `pendingSbaChoices` を最終形にしない方針が明文化されている。
- `pendingRuleChoices` が 903.9a と 704.5j の両方を表現できる。
- choice pending が priority-ready state ではないことが明示されている。
- migration / backfill / event metadata / golden cases が定義されている。

この設計なら、次にコードへ進んでも「commanderだけ特殊処理」から legend rule で作り直す手戻りを避けられる。
