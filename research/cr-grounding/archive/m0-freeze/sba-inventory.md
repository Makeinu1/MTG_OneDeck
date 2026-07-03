# State-Based Actions Inventory

固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 704.5 / 704.6 のうち EDH 一人回し基盤に関係するもの

## 目的

`stabilizeBeforePriority()` を「思いついたSBAの追加」ではなく、CR 704 を検査器にした実装順で拡張するための棚卸し。

分類:

- `PASS`: 現 substrate で実装済み、実行可能テストあり。
- `PARTIAL`: 一部 bridge/substrate はあるが、CRの完全形ではない。
- `READY`: 現 state だけで deterministic に実装可能。次候補。
- `BLOCKED(state)`: 判定に必要な state がまだない。
- `BLOCKED(choice)`: CR上プレイヤー選択が必要で、choice substrate/UI が必要。
- `SCOPE`: 現アプリの初期スコープ外。

## CR 704.5 棚卸し

| Rule | 要旨 | Status | 根拠 / 次手 |
|---|---|---|---|
| 704.5a | life 0 以下のプレイヤーは敗北 | BLOCKED(state) | 敗北 state / replacement loss handling が未定義。現UIは life を許容するサンドボックス。 |
| 704.5b | 空ライブラリから引こうとしたプレイヤーは敗北 | BLOCKED(state) | 「attempted draw from empty library since last SBA」flag がない。 |
| 704.5c | poison 10個以上で敗北 | BLOCKED(state) | 敗北 state が未定義。poison counter 自体はある。 |
| 704.5d | token が battlefield 外にあれば消滅 | PASS | `token-cease` event / `sbaApplied:'704.5d'` / `cr-token-dies-before-ceases`。 |
| 704.5e | spell/card copy が許可zone外にあれば消滅 | PASS | `copy-cease` event / `sbaApplied:'704.5e'` / `cr-sba-copy-ceases-outside-stack`。現 model の `isCopy` は stack copy を表す。 |
| 704.5f | toughness 0 以下の creature は graveyard | PASS | `sbaApplied:'704.5f'` / deterministic fixed-point test。 |
| 704.5g | lethal damage を受けた creature は destroy | BLOCKED(state) | damage marked state、regeneration replacement がない。 |
| 704.5h | deathtouch damage を受けた creature は destroy | BLOCKED(state) | damage source/deathtouch since-last-SBA state がない。 |
| 704.5i | loyalty 0 の planeswalker は graveyard | PASS | `sbaApplied:'704.5i'` / `cr-sba-zero-loyalty-planeswalker`。 |
| 704.5j | legend rule | BLOCKED(choice) | 同名 legendary 判定は可能だが、controller が1つを選ぶ必要がある。choice substrate/UI が必要。 |
| 704.5k | world rule | BLOCKED(state) | world supertype 判定は可能でも timestamp/最短 world timestamp が未保持。 |
| 704.5m | illegal/unattached Aura は graveyard | BLOCKED(state) | `attachedTo` はあるが enchant legality parser がない。unattached Aura だけなら READY に近いが、Aura実装の着地点が未固定。 |
| 704.5n | illegal Equipment/Fortification は unattached | BLOCKED(state) | subtype/legality と attachment policy が未固定。 |
| 704.5p | battle/creature/non-Aura等の不正 attached は unattached | READY/PARTIAL | `attachedTo` と typeLine で一部 deterministic。Aura/Equipment/Fortification との境界整理が必要。 |
| 704.5q | +1/+1 と -1/-1 counter を同数相殺 | PASS | `cr-sba-plus-minus-counter-annihilation`。 |
| 704.5r | counter 上限超過を取り除く | BLOCKED(state) | “can’t have more than N counters” ability parser がない。 |
| 704.5s | Saga final chapter 後 sacrifice | BLOCKED(state) | chapter ability/final chapter number、chapter ability still on stack/pending の判定がない。 |
| 704.5t | dungeon bottom room marker | SCOPE | dungeon/venture state がない。 |
| 704.5u | space sculptor sector designation | SCOPE | sector designation state と multiplayer choice がない。 |
| 704.5v | battle defense 0 は graveyard | BLOCKED(state) | battle defense counter 初期化・battle source ability pending/stack 判定がない。 |
| 704.5w | battle protector 不在 | SCOPE | battle protector / attacked battle state がない。 |
| 704.5x | Siege controller/protector 同一 | SCOPE | battle protector と opponent choice がない。 |
| 704.5y | Role duplicate | BLOCKED(state) | Role token subtype/timestamp/attached target grouping がない。 |
| 704.5z | start your engines speed 1 | SCOPE | speed state がない。 |

## CR 704.6 EDH 関連

| Rule | 要旨 | Status | 根拠 / 次手 |
|---|---|---|---|
| 704.6c | commander combat damage 21点で敗北 | BLOCKED(state) | commanderDamage tracker はあるが敗北 state が未定義。 |
| 704.6d / 903.9a | commander が graveyard/exile に置かれた後 command へ移せる | PARTIAL | `pendingSbaChoices` substrate v1 と `sbaApplied:'903.9a'` event は実装済み。deferred choice UI / `stabilizeBeforePriority()` 本体統合は未実装。 |

## 次候補

この節は「deterministic SBA を増やすなら」の候補であり、M0-FREEZE の次手ではない。凍結前の優先判断は `m0-r-freeze-readiness.md` の R-FREEZE-1〜4、特に commander 903.9a と legend rule 704.5j を同じ設計レーンへ載せる rule choice substrate。

1. `704.5p` の安全 subset: Aura/Equipment/Fortification 以外の non-battle/non-creature permanent と battle/creature が `attachedTo` を持つ場合、unattach する。現 `attachedTo` state だけで実装可能。ただし attachment UI/semantics との整合確認が必要。
2. `704.5m` の unattached Aura subset: Aura で `attachedTo` がない場合に graveyard。enchant legality は未実装として残す。
3. `704.5j` legend rule: choice substrate/UI が必要。commander 903.9a deferred choice と同じ設計レーンに載せるべき。

## 実装しないまま緑にしないもの

敗北系(704.5a/b/c, 704.6c)、damage 系(704.5g/h)、battle/dungeon/sector/speed 系、counter cap/Saga/Role は、必要 state が入るまで `PASS` にしない。
