# Project Goal and Milestones

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19

## Project goal

最終更新: 2026-06-30(Fable 判断で北極星を再定義)

**到達点(destination)= CR 完全性**。ユーザー裁定: 「最終的なゴールは CR 完全性だ」。
このプロジェクトのルールエンジンは、最終的に CR 2026-06-19 の構造規則を完全に盤面再現することを目指す。

ただし**到達の仕方(method)は「丸ごと一括」ではない**。CLAUDE.md 設計原則「完全ルールエンジン化に『丸ごと』は踏み込まないが、統制された範囲で自動化を進める(少数の誤謬は許容)」を堅持する。完全性は asymptote(漸近線)であり、そこへ**最短で**近づく道は:

> CR 2026-06-19 を検査器として使い、**再利用可能な substrate を CR 依存順に積む**ことで、根拠条文・状態不変条件・実行可能golden/test付きで安全に、完全性へ向けて段階的に自動化する。

最短路の判断基準(2026-06-30 Fable):

- **substrate(背骨)を優先する**。priority loop / choice / event 語彙のように、後続マイルストーンが全部ぶら下がる土台を、CR 依存順に先に積む。土台は後で作り直しが効かない=最も rework を減らす。
- **leaf/detection と per-deck patch は後回し**。個別カードの検出配線や4デッキ固有の穴埋めは、substrate が揃えば zero-rework で後から差し込める。完全性へ最短で近づくのは「再利用可能な土台 → 個別検出」の順。
- **未実装領域は消さない**。`S-* carry` / `scope-boundary` / `manual` として見える場所に置く。`PASS` は「未実装がない」ではなく「その範囲と境界がCR根拠付きで検査できる」という意味でだけ使う。完全性は destination だが、各時点の scorecard は「どこまで来たか」を境界付きで正直に表示する。

## Current verdict

最終更新: 2026-06-30

進め方は理念(完全性 destination / substrate-first method)に沿っている。

到達済み:

- **M0-FREEZE 達成(FROZEN)**: 旧7条件 FROZEN + CR-grounding overlay APPROVED(commit 02d1f2c)。scorecard が overlay と残境界を表示し、Fable final approval 済み。定規は完成し、S-* 実装フェーズへ入った。
- **Q5 Phase 1 = S-CHOICE/S-TURN 完了**(commit c6dcb7c): 汎用 `pendingRuleChoices` substrate。903.9a commander choice と 704.5j legend rule が同一 choice substrate で説明できる。
- CR 2026-06-19 固定、CR refs、golden cases、traceability、overlay は版管理下で生きている。

現在地: **Q5 Phase 2 = S-EVENTS/PRIORITY 完了・shipped**(commit baa0b05・2026-06-30・CI 緑 Pages 200)。priority fixed-point loop と `PendingTrigger.stackPlacementBucket` substrate + bucket-aware ordering をフル実装した(`AbilityTriggeredEvent` 検出 observer は C-GRAMMAR へ defer)。**次 = S-EVENTS / MANA**(CR 605.1b triggered mana ability の no-stack transaction。設計正本 = `mana-ability-substrate.md` R-FREEZE-3)。

## Non-negotiable invariant

すべてのルール自動化マイルストーンは、次の4点を同時に満たす。

1. 根拠CR条文を明記する。
2. GameState / event / command に落ちる状態不変条件を明記する。
3. 実行可能 golden/test を追加する。
4. 未実装境界を `PASS` に混ぜない。

この4点のどれかを欠く実装は、短期的に動いても正しいエンジンへ接続できないため差し戻す。

## Milestone map

| Milestone | Goal | Owner | Current status | Exit criteria |
|---|---|---|---|---|
| M0-R: CR grounding research | CRを読むだけでなく、CRG-1〜8の検査観点・golden・境界へ落とす | Codex | Done as research | `m0-freeze-overlay.json`、`golden-cases.json`、traceability、R-FREEZE草稿が存在する |
| M0-FREEZE Q1〜Q4: Contract freeze | overlay を docs 契約 + scorecard 判定器へ接続し Fable final approval | Fable + Codex | **Done**(02d1f2c) | FROZEN: legacy 7-condition + CR-grounding overlay APPROVED、scorecard が境界表示 |
| Q5 Phase 1 — S-CHOICE / S-TURN | 903.9a と 704.5j を汎用 `pendingRuleChoices` に載せる | Codex | **Done**(c6dcb7c) | commander choice と legend rule が同じchoice substrateで説明できる |
| Q5 Phase 2 — S-EVENTS / PRIORITY | priority fixed-point loop(`SBA→choice→trigger→repeat`)+ `PendingTrigger.stackPlacementBucket` substrate + bucket-aware ordering | Codex | **Done**(baa0b05・2026-06-30) | bucket -> APNAP -> controller order が実行可能testで固定。`AbilityTriggeredEvent` 検出 observer は C-GRAMMAR へ defer(field は ordinary backfill 済み=zero-rework) |
| S-EVENTS / MANA | CR 605.1b triggered mana ability をno-stack transactionとして扱う | Codex | **Done**(d9e3a63・2026-06-30) | 605.1bが通常 `pendingTriggers` に混ざらない。活性化源(第1節)検出は C-GRAMMAR defer |
| S-SBA: damage-marked substrate | CR 704.5g/h(lethal/deathtouch combat damage destroy)+ CR 120.3 damage-marked state + CR 514.2 cleanup clearing | Codex | **Done**(b6ab728・2026-06-30) | `damageMarked`/`hasDeathtouchDamage` state + `markDamage`/`clearMarkedDamage` command + 704.5g/h SBA。combat orchestration/regen/first-strike は defer |
| S-COMBAT: combat structure(first slice) | CR 506–510 の combat 構造 substrate。declare attackers/blockers state + combat damage step が `markDamage` を発行し既存 704.5g/h へ接続 | Codex | **Done**(872605e・2026-06-30) | `GameState.combat` + enterCombat/declareAttackers/declareBlockers/resolveCombatDamage(atomic CR510.2)。creature-vs-creature のみ。player damage/first-strike/multi-blocker割当 は defer |
| S-COMBAT slice 2: player/PW combat damage + 統合 | 未ブロック attacker の player/planeswalker への combat damage(CR510.1b/120.3)+ 既存 store `declareAttack`(life 調整hack)を新 substrate へ統合/置換 | Codex | **Active(next)** | 未ブロック attacker が defending player に combat damage を与え life が減る。既存 declareAttack の二重経路を解消。defer=trample-to-player(別)・first/double strike |
| S-SBA incremental(残) | 残り SBA(704.5a/b/c 敗北 state・704.5p 等)を価値順に増やす | Codex | Not started | 各SBAがCR refs、event metadata、golden/test付きで追加される |
| S-ZONES / S-LAYERS | 400.7例外群とeffective snapshotを境界から実装対象へ移す | Codex | Not started | public-zone exception / LKI / layer-applied snapshot が個別testで固定される |
| C-GRAMMAR | Oracle compiler の対応構文を増やす | Codex | Not started | compiler誤訳がGameStateを直接書かず、command列とundoで閉じる |

## Immediate next action

S-COMBAT slice 2 = 未ブロック attacker の player/planeswalker combat damage + 既存 store `declareAttack` 統合。slice 1(§34.13・872605e)で creature-vs-creature combat は動くが、**未ブロック attacker は player に damage を与えない**(creature mark のみ・player damage は対象外にした)。一方で既存 store `declareAttack` が life を直接いじる hack として併存=二重経路。CR 完全性逆算で次の高レバレッジ = combat が**勝利条件(player life)に効く**ようにし、二重経路を解消すること。

Fable のアーキ方向(次 bootstrap で Codex draft → CR 照合・確定):
1. `resolveCombatDamage` に未ブロック attacker → `defendingPlayerId` への combat damage(CR 510.1b)を追加。life を減らす(`adjustOpponentLife` 相当を engine command 経路で・決定的)。
2. 既存 store `declareAttack`(tap + life 調整 + attack trigger)を新 combat substrate(`enterCombat`/`declareAttackers`)へ統合 or 置換。二重経路を1本化。attack trigger 収集の扱いは draft で決める(trigger substrate との接続点)。
3. **defer**: trample-to-player(別 slice・CR 702.19/120.4a)・first/double strike・combat 中の player damage prevention/replacement。

手順: Codex が現 `declareAttack` と combat substrate を調査し engine-spec §34.13 追補 or §34.14 草稿 + golden を `*.draft`(CR 条番号併記)へ → Fable が CR 照合・`review.*` author・docs 昇格 → Codex 実装 → Tier-1(冷却)→ Tier-2 → Sonnet ship。**最大リスク=declareAttack 統合で既存 UI/挙動を壊すこと。回帰テストで縛る。**

Codex は引き続き git 操作禁止、判定者在席中は `docs/`・`review.*` の直接変更禁止(草稿はレーンへ)。

## How CR is used

CR全文をアプリに実装するのではなく、CRを検査器にする。

現在の使い方:

- 2026-06-19版に固定する。
- 仕様判断ごとにCR refsを置く。
- CR refsを golden case と traceability matrix へ接続する。
- 実装済み、部分合格、境界、未実装を overlay status で区別する。
- `m-contract-gate` が overlay を読むことで、CR-grounding が機械判定へ入る。

この形が現段階では最上である。全文パーサ化や完全ルールエンジン化へ進むと、EDH一人回しの価値に対して実装負荷と誤裁定リスクが大きすぎる。次に磨くべき点はCR読解量ではなく、読解結果を docs契約と scorecard 判定器へ接続すること。

## Stop rules

以下の状態では、便利な自動化へ進まない。

- Q1 decision が未記録。
- docs 契約に overlay 判定がない。
- scorecard が overlay を読まずに `frozen: true` を出せる。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` が出力から消える。
- `remainingBoundary` が空のまま部分合格を承認できる。
- 実装案にCR refs、state invariant、実行可能golden/testのいずれかがない。

## Session rule

1セッションは1マイルストーンに閉じる。次のマイルストーンは **S-COMBAT slice 2**(未ブロック attacker の player/PW combat damage + 既存 store `declareAttack` 統合)であり、trample-to-player・first/double strike・combat 優先権完全自動化へは広げない。**最大リスク = declareAttack 統合で既存 UI/挙動を壊すこと。回帰テストで縛り、slice 1 の atomic combat damage 経路を再利用する。**
