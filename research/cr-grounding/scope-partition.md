# Scope Partition for M0-FREEZE

> **⚠️ 退役(2026-07-01)**: 背骨/後期背骨/葉/剪定 のレーン分類・scope 境界の**単一正本は `research/cr-grounding/cr-backbone-ledger.json`** に移った。本書は R-FREEZE-4 の設計スタディとして残すが、レーン/status の参照はしない(台帳を見る)。

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象: CR 400.7 例外群 / full effective-characteristics snapshot / full SBA suite / 2026-06-19 新語彙

## 目的

M0-FREEZE 前に、未実装領域を `freeze-blocker` / `S-* carry` / `scope-boundary` へ分ける。目的は、未実装を消すことではなく、未実装を `PASS` に混ぜないこと。

分類語彙:

- `freeze-blocker`: M0-FREEZE 前に分類・設計判断が必要。未分類のまま凍結すると定規が壊れる。
- `S-* carry`: M0-FREEZE 後の S-EVENTS / S-ZONES / S-TURN / S-CHOICE / S-LAYERS / C-GRAMMAR で実装する。現時点で `PASS` にしない。
- `scope-boundary`: 初期スコープ外。必要になるまで実装しないが、CR語彙・検証不能として明示する。
- `PASS(core)`: 中核は実行可能テストで検査済み。ただし full coverage ではない。

## 判定サマリ

R-FREEZE-1〜3 の設計草稿と本ファイルにより、ここで扱う項目に未分類の `freeze-blocker` は残さない。

ただし、これは「実装済み」を意味しない。M0-FREEZE へ渡せる条件は、以下の `S-* carry` と `scope-boundary` を `PASS` に混ぜないこと。

## CR 400.7 exceptions

現状:

- `zoneChangeCounter` / `objectIdOf` により、領域移動で新 object になる core は表現済み。
- `ObjectSnapshot` / `PendingTrigger.sourceSnapshot` により、LTB/death の LKI core は表現済み。
- `cr-zone-change-new-object-lki` は executable。

判定:

| Rule area | Partition | 理由 |
|---|---|---|
| 400.7 core: zone move creates new object | PASS(core) | `zoneChangeCounter` と executable golden あり |
| 603.10a LKI for LTB/death | PASS(core) | `ObjectSnapshot` / `sourceSnapshot` で検査済み |
| 400.7a-d spell-to-permanent continuity | S-* carry | stack/permanent continuity、継続効果、prevention、paid-cost memory は S-LAYERS / S-EVENTS の対象 |
| 400.7e public-zone object finding | S-* carry | public-zone exception は event consumer / effect resolver が必要 |
| 400.7f Aura leaving with enchanted permanent | S-* carry | Aura attachment legality と 704.5m が未実装 |
| 400.7g-i cast/play permission continuity | S-* carry | permission effect / cast-from-zone compiler が必要 |
| 400.7j public-zone movement by same effect/cost | S-* carry | cost/effect link と public zone resolver が必要 |
| 400.7k madness public-zone reference | scope-boundary | madness専用処理は初期S-*の外 |
| 400.7m stickers | scope-boundary | sticker state がない |

凍結条件:

- `CRG-7` は `PASS(core)` のままにする。
- 400.7 例外群を `PASS` に昇格しない。

## Full effective-characteristics snapshot

現状:

- `ObjectSnapshot` は typeLine / power / toughness / counters / tapped / controller などの基礎情報を持つ。
- layer 適用後の full effective characteristics は未実装。

判定:

| Item | Partition | 理由 |
|---|---|---|
| printed/base-ish snapshot for zone-change/LKI | PASS(core) | 現行 event / trigger substrate の検査に必要な範囲は成立 |
| layer-applied P/T, type, color, ability, controller-changing effects | S-* carry | S-LAYERS / S-CONTINUOUS が必要 |
| dependency/timestamp layer resolution | S-* carry | CR 613 系。M0-FREEZE時点では未実装を明示 |

凍結条件:

- `ObjectSnapshot` を full effective snapshot と呼ばない。
- death/LTB core の検査には十分だが、layer依存カードの完全再現には不足すると明記する。

## Full SBA suite

現状:

- PASS: 704.5d / 704.5e / 704.5f / 704.5i / 704.5q。
- PARTIAL: 704.6d / 903.9a。
- 詳細は `sba-inventory.md`。

判定:

| Rule area | Partition | 理由 |
|---|---|---|
| 704.5d/e/f/i/q | PASS | 実装と executable tests あり |
| 704.6d / 903.9a | S-* carry | `rule-choice-substrate.md` の `pendingRuleChoices` へ移す |
| 704.5j legend rule | S-* carry | choice substrate が必要。R-FREEZE-1で方針あり |
| 704.5p safe attachment subset | S-* carry | 実装可能だが freeze-blocker ではない |
| 704.5m/n Aura/Equipment legality | S-* carry | attachment legality parser が必要 |
| 704.5a/b/c and 704.6c defeat/loss | S-* carry | defeat state を導入するなら必要。現サンドボックスでは未実装明示 |
| 704.5g/h damage/deathtouch | S-* carry | marked damage / source deathtouch / regeneration が必要 |
| 704.5k world rule | S-* carry | timestamp state が必要 |
| 704.5r/s counter cap / Saga | S-* carry | ability parser、chapter state、pending/stack判定が必要 |
| 704.5v battle defense 0 | S-* carry | battle supportを入れるなら必要 |
| 704.5y Role duplicate | S-* carry | Role token subtype/timestamp/attachment grouping が必要 |
| 704.5t dungeon | scope-boundary | dungeon/venture state がない |
| 704.5u space sculptor sector | scope-boundary | sector designation/multiplayer choice がない |
| 704.5w/x battle protector/Siege protector | scope-boundary | protector/opponent model がない |
| 704.5z speed | scope-boundary | speed state がない |

凍結条件:

- full SBA suite を M0-FREEZE 条件にしない。
- `sba-inventory.md` の `PASS/PARTIAL/BLOCKED/SCOPE` を維持する。
- S-* 実装では、追加するSBAごとに CR refs + event metadata + executable golden を同時に追加する。

## 2026-06-19 new vocabulary

現状:

- `golden-cases.json` に `cr-20260619-new-mechanics-boundary` がある。
- Heal / Power-up / Teamwork / Preparation は CR語彙として認識するが、実行器は未実装。

判定:

| Mechanic | CR refs | Partition | 理由 |
|---|---|---|---|
| Heal | 701.69 | scope-boundary | keyword action execution は初期S-*外 |
| Power-up | 702.193 | scope-boundary | ability word ではなく keyword ability。entered-this-turn / activation limit / counter+draw 実装が必要 |
| Teamwork | 702.194 | scope-boundary | 追加コスト能力。cast cost pipeline が必要 |
| Preparation Cards | 722 | scope-boundary | card frame / copy / prepared designation state が必要 |

凍結条件:

- 語彙認識は `PASS(boundary)`。
- 実行器未実装を coverage/pass にしない。

## Player-specific zones / dummy opponent

現状:

- `PlayerId`、`ownerId`、`controllerId`、`activePlayerId` は導入済み。
- `zones` はまだ一人回し用の flat shared-ish model。

判定:

| Item | Partition | 理由 |
|---|---|---|
| owner/controller on object snapshots | PASS(core) | event / pending trigger の controller保持に必要な範囲は成立 |
| player-specific library/hand/graveyard | S-* carry | S-ZONES で扱う |
| dummy opponent zones/events | S-* carry | S-ABILITY+DUMMY / later V4 で扱う |
| opponent-only real gameplay automation | scope-boundary | 初期EDH一人回しの外 |

## M0-FREEZE 判断

R-FREEZE-4 の判断は以下で合格とする。

- CR 400.7 例外群を `PASS(core)` へ混ぜない。
- `ObjectSnapshot` を full effective snapshot と呼ばない。
- full SBA suite を freeze blocker にしない代わりに、`sba-inventory.md` で未実装を明示し続ける。
- 2026-06-19 新語彙は `PASS(boundary)` として、実行器未実装を pass にしない。
- player-specific zones / dummy opponent は S-* carry として残す。

この分類により、M0-FREEZE の次判定は「未実装があるか」ではなく、「未実装を正しい箱へ入れたまま scorecard / 契約へ渡せるか」になる。
