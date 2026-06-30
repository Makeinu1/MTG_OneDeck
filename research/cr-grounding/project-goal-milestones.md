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
| S-SBA: damage-marked substrate | CR 704.5g/h(lethal/deathtouch combat damage destroy)+ CR 120.3 damage-marked state + CR 514.2 cleanup clearing | Codex | **Active(next)** | `damageMarked` state + `markDamage`/`clearMarkedDamage` command + 704.5g/h を `performStateBasedActionsOnce` へ。full combat phase orchestration / regeneration replacement / first-strike は defer |
| S-SBA incremental(残) | 残り SBA(704.5a/b/c 敗北 state・704.5p 等)を価値順に増やす | Codex | Not started | 各SBAがCR refs、event metadata、golden/test付きで追加される |
| S-ZONES / S-LAYERS | 400.7例外群とeffective snapshotを境界から実装対象へ移す | Codex | Not started | public-zone exception / LKI / layer-applied snapshot が個別testで固定される |
| C-GRAMMAR | Oracle compiler の対応構文を増やす | Codex | Not started | compiler誤訳がGameStateを直接書かず、command列とundoで閉じる |

## Immediate next action

S-SBA: damage-marked substrate = CR 704.5g/h(lethal/deathtouch combat damage destroy)。ユーザー裁定(2026-06-30「最終ゴールから逆算・小手先でなく substantive な変更を」)を受け Fable が選定: **combat は最大の未モデル CR 領域であり damage-marked state は combat 系全体がぶら下がる substrate**(lethal/deathtouch/first-strike/regeneration が読む)。defeat-state(704.5a/b/c)より構造的レバレッジが高く substrate-first に合致。設計=本マイルストーンで起こす(既存 R-FREEZE なし)。

Fable のアーキ判断(固定制約):
1. `CardInstance.damageMarked: number`(既定0・restore で backfill)+ deathtouch 由来の追跡(CR 704.5h 用)。
2. command `markDamage`(cardId/amount/deathtouch?)+ `clearMarkedDamage`(CR 514.2 cleanup)。
3. SBA を `performStateBasedActionsOnce`(commands.ts:527)へ: 704.5g(toughness>0 かつ damageMarked≥toughness → graveyard)・704.5h(deathtouch 由来 damage≥1 かつ toughness>0 → graveyard)。既存 704.5f(toughness≤0)と整合。
4. **defer(scope-boundary)**: full combat phase orchestration(declare attackers/blockers/combat damage step 自動)・regeneration replacement(704.5g の「unless regenerated」)・first/double strike ordering。これらは leaf/compiler 後付け。

手順: Codex が engine-spec §34.12 草稿 + golden を `*.draft`(CR 条番号併記)へ → Fable が CR 照合・`review.*` author・docs 昇格 → Codex 実装 → Tier-1(冷却)→ Tier-2(Fable 再オーナー化)→ Sonnet ship。

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

1セッションは1マイルストーンに閉じる。今のセッションのマイルストーンは **S-SBA: damage-marked substrate**(CR 704.5g/h + damage-marked state)であり、defeat-state(704.5a/b/c)・full combat orchestration・C-GRAMMAR へは広げない。**最大リスク = (1) full combat phase machinery(declare attackers/blockers/combat damage step)を引き込むこと(本 Phase は state + command + SBA のみ。combat 自動化は別)、(2) regeneration replacement を SBA に混ぜること(704.5g「unless regenerated」は replacement 系で defer)、(3) 既存 704.5f(toughness≤0)との二重 destroy。damageMarked は cleanup(514.2)で確実にクリアする。**
