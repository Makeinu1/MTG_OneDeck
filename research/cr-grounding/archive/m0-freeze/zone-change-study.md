# Zone / Zone-Change Study

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 109 / 110 / 111 / 117.5 / 400 / 403-408 / 603.6 / 603.10 / 704.3 / 704.5d / 704.6d / 903.9

## 目的

このスタディは、CRG-5 トークン死亡、CRG-6 誘発/SBA/優先権、CRG-7 領域移動/LKI を個別実装へ分解する前に、共有する zone-change substrate を決めるためのもの。

結論: 次は「トークン死亡を直接直す」ではなく、`ZoneChangeEvent` / `ObjectSnapshot` / `PendingTrigger` / `stabilizeBeforePriority()` の最小設計を先に入れる。

## CRから導く要点

### 1. zone は場所であり、プレイヤー別 zone と共有 zone がある

根拠: CR 400.1 / 400.2。

- library / hand / graveyard は各プレイヤー固有。
- battlefield / stack / exile / command は共有。
- public / hidden の違いがある。LKI や 400.7 の例外では、公開ゾーンへ移動したかどうかが意味を持つ。

現行 `GameState.zones: Record<ZoneId, string[]>` は一人回しには十分だが、CR substrate としては `owner/controller/playerScope` を event 側へ持たせる必要がある。

### 2. zone-change は単なる代入ではなく event である

根拠: CR 400.6。

移動前に「何の event がその object を動かすか」を決め、置換効果を適用し、矛盾する効果があれば controller/owner が選ぶ。その後に object が実際に動く。

したがって `moveCardInternal(cardId, to)` だけを正本にすると、replacement / SBA / LKI / trigger source が後付けになり破綻する。必要なのは `move object` ではなく `apply zone-change event`。

### 3. 移動後の object は原則として新 object

根拠: CR 400.7 / 403.4。

同じ物理カードであっても、別 zone に移動した object は前の object との記憶を持たない。例外は 400.7a-m に限定される。

設計帰結:
- UI用の安定IDと CR object identity を分ける。
- 現行 `CardInstance.id` は UI/物理カードIDとして残してよいが、CR判断には `objectId` または `zoneChangeCounter` が必要。
- `objectId = cardId + ':' + zoneChangeCounter` のような派生でもよい。重要なのは「同じ cardId だから同じ object」と扱わないこと。

### 4. LTB/death trigger は移動前情報を読む

根拠: CR 603.6 / 603.10。

leaves-the-battlefield 系、sacrifice 系、公開 object が hand/library へ置かれる系などは、event 直前の情報を見る。移動後の `cards[cardId]` を読むだけでは controller、type、effective characteristics、token status を取り違える。

設計帰結:
- `ZoneChangeEvent.before` に LKI snapshot を持つ。
- trigger 判定は `prev/next diff` ではなく event + before snapshot を読む。
- pending trigger は source が消えても成立する必要がある。

### 5. token は battlefield 外へ移動してから SBA で消える

根拠: CR 111.7 / 704.5d。

token は battlefield 以外の zone にあると SBA で消える。ただし、zone-change による誘発は token 消滅前に成立する。

設計帰結:
- `moveCardInternal` が token を battlefield から出る瞬間に削除する現状は CRG-5 の障害。
- ただし外部に不安定状態を晒す必要はない。transaction 内で「token を墓地へ移す event 発行 → pending trigger 収集 → SBA で token cease」を実行し、返却 state は安定状態にできる。
- 既存 invariant「安定 state では token は battlefield にしか存在しない」は維持可能。ただし event log / pending trigger が token の移動を保持する。

### 6. triggered abilities と SBA は優先権前に固定点まで処理する

根拠: CR 117.5 / 704.3 / 603.3 / 603.3b。

優先権を得る前に、SBA を実行し、待機中の誘発を stack へ置き、再び SBA を確認する。このループは固定点まで続く。

設計帰結:
- `triggerCandidates` は UI助言としては有用だが、CR substrate としては弱い。
- `pendingTriggers` は GameState 側へ持たせる。undo/redo/snapshot の対象にする。
- event observer が `addAbilityToStack` を直接呼ばない。event は pending trigger を作り、priority boundary が stack へ置く。

### 7. commander zone choice は replacement と SBA に分かれる

根拠: CR 903.9a / 903.9b / 704.6d。

- graveyard / exile: その zone に一度置かれる。その後、SBA として command へ移せる。
- hand / library: replacement effect。選ぶなら hand/library への zone-change は発生しない。

設計帰結:
- 現行 `moveCommanderWithZoneChoice` は store-level bridge として妥当だが、最終形では `ZoneChangeEvent` + replacement + SBA choice へ統合する。
- command へ移したことを理由に death/LTB trigger を消してはならない。

## 最小設計案

### 追加する概念

```ts
type PlayerId = 'P1' | 'OPPONENT_A';
type PhysicalCardId = string; // 現 CardInstance.id を当面流用可
type ObjectId = string;       // `${physicalCardId}:${zoneChangeCounter}` など

interface ObjectSnapshot {
  physicalCardId: PhysicalCardId;
  objectId: ObjectId;
  defId: string;
  zone: ZoneId;
  zoneOwnerId?: PlayerId;
  ownerId: PlayerId;
  controllerId?: PlayerId;
  isToken: boolean;
  isCommander: boolean;
  faceIndex: number;
  tapped: boolean;
  counters: Record<string, number>;
  typeLine: string;
  power?: number;
  toughness?: number;
}

interface ZoneChangeEvent {
  eventId: string;
  sequence: number;
  simultaneousGroupId?: string;
  causeCommandId?: string;
  reason: 'move' | 'cast' | 'resolve' | 'cost' | 'sba' | 'replacement' | 'token-cease';
  physicalCardId: PhysicalCardId;
  oldObjectId: ObjectId;
  newObjectId?: ObjectId;
  fromZone: ZoneId;
  toZone?: ZoneId; // token cease / outside game は undefined を許容
  replacementApplied?: string;
  sbaApplied?: string;
  before: ObjectSnapshot;
  after?: ObjectSnapshot;
}

interface PendingTrigger {
  pendingTriggerId: string;
  eventId: string;
  simultaneousGroupId: string;
  triggerId: string;
  sourcePhysicalCardId: PhysicalCardId;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  abilityLineIndex?: number;
}
```

### GameState への最小追加

```ts
interface CardInstance {
  // 既存 id は UI/物理IDとして維持
  zoneChangeCounter: number;
}

interface GameState {
  eventLog: ZoneChangeEvent[];      // bounded でもよい
  pendingTriggers: PendingTrigger[];
  nextEventSeq: number;
}
```

`objectId` は保存せず `objectIdOf(card) = card.id + ':' + card.zoneChangeCounter` で派生してもよい。保存する場合も、truth は `zoneChangeCounter`。

## 実装順序

### Z0: 本スタディを正本化

完了条件:
- 本ファイルが存在する。
- `docs/engine-design-method.md` に「ゴールから逆算する」原則がある。
- `docs/engine-spec.md` / `research/cr-grounding/README.md` が、CRG-5 へ直行しない方針を参照する。

### Z1: object incarnation の足場だけ入れる

状態: 実装済み(2026-06-27)。`CardInstance.id` は物理/表示IDのまま残し、CR判断用の incarnation は `zoneChangeCounter` / `objectIdOf(card)` で派生する。

目的: 400.7 を表現可能にする。挙動は極力変えない。

実装:
- `CardInstance.zoneChangeCounter: number` を追加。
- true zone-change 時だけ increment。
- battlefield reorder など同一 zone 内移動では increment しない。
- helper `objectIdOf(card)` を追加。

テスト:
- 同じ physical card が zone-change で `zoneChangeCounter` を増やす。
- library/battlefield の同一 zone 内 reordering では `zoneChangeCounter` を増やさず、battlefield 上の tapped/counters も reset しない。
- pre-Z1 snapshot の復元時に `zoneChangeCounter: 0` を backfill する。
- command→command など同一 zone 新 object 例は CR 400.10 として別途扱うか scope-boundary に明示する。

### Z2: ZoneChangeEvent を発行する

状態: 実装済み(2026-06-27)。`GameState.eventLog` に `ZoneChangeEvent` を蓄積し、`before` / `after` の `ObjectSnapshot` を残す。既存 `triggerCandidates` はまだ差分検出のまま残す。

目的: prev/next diff ではなく event を検査器にする。

実装:
- `moveCardInternal` の内部で `ZoneChangeEvent` を作る。
- `before` / `after` snapshot を保存する。
- まずは `eventLog` へ追記するだけで、既存 triggerCandidates は残す。

テスト:
- battlefield→graveyard の event に before/after の type/controller/zone/tapped/counters/objectId が残る。
- 同一 zone 内 reordering では event を発行しない。
- token が現行実装で即消滅しても、battlefield→graveyard の event と after snapshot は残る。
- hand/library replacement では置換された zone-change event が発生しない。
- pre-Z2 snapshot の復元時に `eventLog: []` を backfill する。

### Z3: pendingTriggers を導入する

状態: 実装済み(2026-06-27)。`GameState.pendingTriggers` を追加し、通常の store 遷移では `eventLog` の新規 `ZoneChangeEvent` から pending trigger を収集する。UI の `triggerCandidates` は `pendingTriggers` から投影する adapter として残す。phase/draw/attack はまだ専用 event 型がないため、Z3では synthetic `implicit:*` eventId で pending 化する。

目的: CR 603/117.5 の前提を作る。

実装:
- `collectPendingTriggers(prev,next)` を追加し、zone-change 系の ETB/death/LTB/cast は `eventLog` から収集する。
- `pendingTriggers` を `GameState` に置く。
- `pendingTrigger` は `controllerId`(誘発をコントロールするプレイヤー。現 substrate では `sourceSnapshot.controllerId ?? ownerId`) と `simultaneousGroupId`(event の同時発生グループ。単一イベントは `eventId`) を持つ。APNAP/同時誘発順序はこの保存値を読む。現在 state から後読みしない。
- UI/store の `triggerCandidates` は `pendingTriggers` を表示する薄い adapter にする。
- `addAbilityToStack(source,'triggered')` は後方互換の source 単位消費として残す。CR-grounded 経路では `putPendingTriggerOnStack(pendingTriggerId)` / `putPendingTriggersOnStack(pendingTriggerIds)` が pending trigger を明示順で消費し、source が消滅済みなら `sourceSnapshot.defId` から ability object を作る。複数件は渡した配列順に stack へ append し、最後の id がスタック最上段になる。
- 優先権前境界の v1 として `placePendingTriggersForPriority(pendingTriggerIds)` を追加する。全pendingが明示順に含まれる場合だけ単一バッチで stack へ置く。渡された順序は各 controller 内の選択順として扱い、controller 間は `activePlayerId` と `PendingTrigger.controllerId` で APNAP 順に正規化する。順序不足、重複、unknown id は warning/manual で止め、盤面を変えない。

テスト:
- event 直後に stack は増えず pending が増える。
- pending trigger は source が zone 移動/消滅しても `sourceSnapshot` から候補表示できる。
- token death では token が `cards` から消えた後も、event.before の `sourceSnapshot` から death pending trigger を保持する。
- dismiss / stack 投入は `pendingTriggers` と adapter 表示の両方を消す。
- pre-Z3 snapshot の復元時に `pendingTriggers: []` を backfill する。

### Z4: stabilizeBeforePriority を導入する

状態: token cease / copy cease / toughness-zero / zero-loyalty planeswalker / +1/+1・-1/-1 counter annihilation の deterministic SBA と commander 903.9a の choice substrate v1 まで実装済み(2026-06-27)。`applyCommand` の返却前に `stabilizeBeforePriority()` を実行し、battlefield 外にある token を CR 704.5d として消滅させる。token は一度 battlefield→graveyard/exile 等の `ZoneChangeEvent` と pending trigger 収集対象になり、その後 `reason:'token-cease'` / `sbaApplied:'704.5d'` の event を残して削除される。不正 zone にある copy は CR 704.5e として `reason:'copy-cease'` / `sbaApplied:'704.5e'` の event を残して削除される。toughness 0 以下の creature は CR 704.5f として墓地へ置かれる。loyalty 0 の planeswalker は CR 704.5i として墓地へ置かれる。+1/+1 と -1/-1 の両方を持つ permanent は CR 704.5q として同数の counter を取り除く。commander 903.9a は UI choice が必要なため、現時点では store transaction 内で `pendingSbaChoices` を生成・解決する bridge として扱い、command への後続移動を `reason:'sba'` / `sbaApplied:'903.9a'` の event として残す。

目的: CR 704.3 / 117.5 の固定点処理。

実装:
- `applyCommand` の最後に `stabilizeBeforePriority` を呼ぶ。既存 public API が `applyCommand` 返却 state に off-battlefield token を残さない前提を持つため、まずは command 境界で固定点処理する。
- SBA 第一弾は token cease、copy cease、toughness-zero、zero-loyalty planeswalker、+1/+1/-1/-1 counter annihilation に限定する。
- commander choice は UI が必要なので、現行 `moveCommanderWithZoneChoice` を bridge として維持する。ただし 903.9a については `pendingSbaChoices` substrate v1 を導入し、graveyard/exile event から choice を生成し、command への後続 move を `sbaApplied:'903.9a'` として記録してから choice を解決済みにする。

テスト:
- token battlefield→graveyard event が残り、返却 state では token が消えている。
- pending trigger は残る。
- token-cease event は `sbaApplied:'704.5d'` を持つ。
- copy-cease event は `reason:'copy-cease'` / `sbaApplied:'704.5e'` を持つ。
- loyalty 0 planeswalker は `sbaApplied:'704.5i'` の battlefield→graveyard event を残す。
- +1/+1/-1/-1 counter annihilation は zone-change event を発行せず、counter state を正規化する。
- commander graveyard/exile は store bridge により、event 後に `pendingSbaChoices` substrate v1 を経由して command へ移る。deferred choice UI と `stabilizeBeforePriority()` 本体への完全統合は残す。

### Z5: CRG-5 / CRG-6 / CRG-7 を実行可能 golden に移す

状態: 実行可能サブセット実装済み(2026-06-27)。`src/store/__tests__/crGroundingGoldenCases.test.ts` が `research/cr-grounding/golden-cases.json` の対象 case id と CR refs を読み、token / trigger-SBA-priority / zone-object-LKI の3ケースを実行する。pending trigger の explicit-order stack placement、priority boundary v1、APNAP ordering core v1 は `pendingTriggerId` 指定で実装済み。

目的: CRを検査器にする。

実装:
- `research/cr-grounding/golden-cases.json` の token / trigger-SBA-priority / zone-object-LKI を executable tests へ移植。実装済みサブセット:
  - `cr-token-dies-before-ceases`
  - `cr-trigger-sba-priority-loop`
  - `cr-zone-change-new-object-lki`
- `putPendingTriggerOnStack(pendingTriggerId)` / `putPendingTriggersOnStack(pendingTriggerIds)` により、pending trigger を明示順で消費して stack へ置く。`placePendingTriggersForPriority(pendingTriggerIds)` は全pending指定を要求する優先権前境界として使い、controller 間は APNAP 順に正規化する。token death のように source が `cards` から消えている場合は `sourceSnapshot` を ability object の `defId`/表示根拠に使う。pending trigger 由来の ability object は `sourceSnapshot.controllerId` を優先する。
- 既存 golden replay には、event envelope を表現できる段階で移す。

残る未実装:
- 603.3b の second bucket(another ability triggering)。
- remaining full SBA suite(現時点で 704.5d / 704.5e / 704.5f / 704.5i / 704.5q と deterministic fixed-point v1 まで)。
- commander 903.9a の deferred choice UI と `stabilizeBeforePriority()` 本体統合。
- CR 400.7 例外群と full effective-characteristics snapshot。

## やらないこと

- いきなり player-specific zones 全移行はしない。一人回しの実用を壊す割に、CRG-5/6/7 の最小達成には過剰。
- いきなり全SBAを実装しない。token cease と toughness 0 以下を先に実装し、legend rule 等は後続。
- `CardInstance.id` を即座に objectId へ置換しない。UI/DnD/store への影響が大きすぎる。まず physical ID と object incarnation を併存させる。
- event observer が直接 stack item を作る設計には戻らない。

## 判断

CRG-5 トークン死亡へ進む前に Z1〜Z4 が必要。特に token を瞬間削除する現行実装を直すだけでは、LKI、pending trigger、commander 903.9a、400.7 の問題が再発する。

Z1〜Z4 の最小 substrate、Z5 の実行可能サブセット、pending trigger の explicit-order batch placement、priority boundary v1、APNAP ordering core v1、同一controller内順序選択UI v1、704.5e/704.5f/704.5i/704.5q + deterministic fixed-point v1、commander 903.9a pendingSbaChoices substrate v1 は成立した。以後の「次候補」は `m0-r-freeze-readiness.md` を正とする。個別SBA追加へ進む前に、rule choice substrate、603.3b second bucket、triggered mana ability、scope partition を凍結前判断として扱う。

2026-06-27 追記: M2 Player/Controller substrate も成立した。`activePlayerId` と card `ownerId/controllerId` は state に入り、`ObjectSnapshot` / `PendingTrigger.controllerId` は発生時点の controller を保存する。R1 APNAP ordering core v1 として `orderPendingTriggersApnap` の純関数と P1/OPPONENT_A の APNAP golden も追加済み。R2 同一controller内順序選択UI v1 として `TriggerCandidatePanel` の上下移動/一括 placement UI と `Playmat.test.tsx` の UI coverage も追加済み。R3/R4 deterministic fixed-point v1 として CR 704.5e copy-cease、704.5f toughness-zero、704.5i zero-loyalty planeswalker、704.5q +1/+1/-1/-1 counter annihilation と、新規 pending trigger が一意順序なら同じ priority boundary 内で stack へ置く処理も追加済み。P1 commander 903.9a choice substrate v1 として `pendingSbaChoices` と `sbaApplied:'903.9a'` event も追加済み。R-FREEZE-1〜4 の草稿は `rule-choice-substrate.md` / `priority-event-loop.md` / `mana-ability-substrate.md` / `scope-partition.md` に分離した。
