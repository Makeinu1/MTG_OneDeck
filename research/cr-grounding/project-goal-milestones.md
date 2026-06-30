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
| S-COMBAT: combat structure(first slice) | CR 506–510 の combat 構造 substrate。declare attackers/blockers state + combat damage step が `markDamage` を発行し既存 704.5g/h へ接続 | Codex | **Active(next)** | attacking/blocking/blockedBy state + combat damage assignment → markDamage。defer=first/double strike step分割・banding・複数blocker damage ordering nuance・trample-to-player(follow slice) |
| S-SBA incremental(残) | 残り SBA(704.5a/b/c 敗北 state・704.5p 等)を価値順に増やす | Codex | Not started | 各SBAがCR refs、event metadata、golden/test付きで追加される |
| S-ZONES / S-LAYERS | 400.7例外群とeffective snapshotを境界から実装対象へ移す | Codex | Not started | public-zone exception / LKI / layer-applied snapshot が個別testで固定される |
| C-GRAMMAR | Oracle compiler の対応構文を増やす | Codex | Not started | compiler誤訳がGameStateを直接書かず、command列とundoで閉じる |

## Immediate next action

S-COMBAT: combat structure(first slice)= CR 506–510。damage-marked substrate(§34.12・b6ab728)で creature は致死 damage で死ねるが、**combat が未モデルゆえ damage は manual `markDamage` 経由でしか入らない**。combat 構造を起こして damage-marked substrate を「生かす」のが CR 完全性逆算で最も高レバレッジ(combat は CR 5xx の大領域)。設計=本マイルストーンで起こす(既存 R-FREEZE なし)。

Fable のアーキ方向(次 bootstrap で Codex draft → CR 照合・確定):
1. combat 構造 state: creature の attacking / blocking / blockedBy(CR 506–509)。GameState に combat 局面を持つか、card flag か は draft で決める(イミュータブル・前方互換 backfill 必須)。
2. combat damage step: 攻撃/ブロックから damage 割当を決定的に算出し **既存 `markDamage` command を発行**(新 SBA は足さない=704.5g/h が destroy を担う)。
3. **defer(scope-boundary)**: first/double strike の damage step 分割・banding・複数 blocker への damage ordering の細部・trample-to-defending-player(follow slice)・combat 中の優先権ループの完全自動化。最小=「攻撃宣言→ブロック宣言→combat damage が markDamage を出し 704.5g/h が解決」。

手順: Codex が現 turn/phase 構造を調査し engine-spec §34.13 草稿 + golden を `*.draft`(CR 条番号併記)へ → Fable が CR 照合・`review.*` author・docs 昇格 → Codex 実装 → Tier-1(冷却)→ Tier-2(Fable 再オーナー化)→ Sonnet ship。**最大リスク=combat 全体を一気に引き込むこと。first slice に厳格に限る。**

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

1セッションは1マイルストーンに閉じる。次のマイルストーンは **S-COMBAT: combat structure(first slice)**(CR 506–510 の攻撃/ブロック宣言 + combat damage が `markDamage` を発行)であり、first/double strike・banding・trample-to-player・combat 優先権完全自動化へは広げない。**最大リスク = combat 全体(全ステップ・全キーワード)を一気に実装すること。first slice = 攻撃宣言→ブロック宣言→combat damage→既存 704.5g/h destroy に厳格に限る。新 SBA は足さない(704.5g/h を再利用)。**
