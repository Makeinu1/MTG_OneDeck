# D4a PC affordance recovery — 受け入れ契約草稿(J0, 2026-07-12)

## 目的

PC版を「広い画面で盤面を理解し、直接操作できる一人回し卓」へ戻す。旧Playmatの全面復帰や削除は
行わず、同じGameScreen component treeへdesktop affordanceを回復する。

根拠=`r1-pc-ui-baseline.draft.md`。本草稿はJ2承認前であり、`docs/`や`review.*`へ未昇格。

## スコープ

含む:

- desktop全幅利用
- 8枚手札
- readable turn model
- hover preview／通常click inspect／right-click／double-click／DnD／keyboardの役割整理
- graveyard等zoneの常設発見性
- space-aware land compression
- mulliganの構図とresume persistence
- desktopでのpersistent engine feed/log

DEFER:

- 旧Playmat／ContextMenu／App.css大量削除(D4c)
- 保存デッキ一覧
- D6/D7演出
- 新テーマ／新依存
- engine/GameState/GameCommand変更
- 任意phaseへの直接jump(まずturn modelを回復)

## 受け入れ

### A. 幅と舞台

1. viewport 1280以上で`.game-screen`はviewport幅の95%以上を使用する。
2. 1920で中央play stageはviewport幅の72%以上を確保する。
3. 余剰幅を左右の無意味な空白へ捨てず、board／hand／zone／feedのいずれかへ配分する。
4. sparse boardでもcreature／noncreature／landの所在を薄いlabelまたは空間cueで予測できる。

### B. 手札

1. 1280x800、1440x900、1920x1080で8枚手札が横scrollなし。
2. 8枚すべてが完全表示され、card visual widthは96px以上。
3. 9枚以上は利用幅に応じてgap縮小→bounded overlap→scrollの順で段階圧縮する。
4. hover／focus対象は前面化し、隣接cardに隠れない。

### C. turn model

1. 7 phaseすべてが常時見え、current／completed／nextを色だけに依存せず区別する。
2. current phaseの完全な日本語名と、次に進むphase名を表示する。
3. phase進行後、active indicatorと`現在/次`表示が同時に更新される。
4. stack未解決時はPrimaryActionがresolveへ変わる現行規律を維持する。
5. PrimaryActionは残すが、turn構造を理解する唯一の情報源にしない。

### D. card input parity

1. mouse hover 250msで240px級CardPreviewが出現し、leave／menu／dragで消える。
2. desktop通常clickはinspectを開く。破壊的／状態変更actionを直接実行しない。
3. right-clickは全actionへの代替、double-clickは既存quick actionを維持する。
4. hand／battlefield／graveyard等の既存DnD経路をGameScreenへ復元する。
5. DnDで可能なstate changeはright-click actionからも可能。
6. keyboard shortcutsはPrimaryActionと同じselectorを使用し、ゲーム内menuから一覧へ到達できる。

### E. zone visibility

1. desktopではgraveyard／exile／libraryを完全名＋枚数で常設する。
2. graveyard viewerは1 actionで開く。click targetは44px以上。
3. graveyardが非空ならtop cardを直接またはhoverで確認できる。
4. zone railは中央stageのA条件を破らない。1280では縮退可能。

### F. lands

1. 利用幅がある間、同名basic landも個別cardとして表示する。
2. compressionはcontainer overflow予測に基づき、viewport/card countの固定閾値だけで決めない。
3. 6 landsの1440 fixtureでは全cardが個別表示される。
4. 圧縮後も各cardのtapped stateと個別操作経路を失わない。

### G. mulligan

1. fresh gameと判断前resumeの双方でmulligan decisionが表示される。
2. dialogはcentral stage基準で配置し、対象handと同一視野に置く。
3. dialogはhandを覆わず、7枚すべてを見ながらkeep/mulliganできる。
4. GameSnapshotへpending decisionを保存するか、安全に導出する。legacy snapshotはbackfillする。
5. keep後だけ`beginFirstTurn`へ進み、resumeだけで判断済みにしない。

### H. feed／stack

1. desktopでは直近log・warning・triggerをglanceできるpersistent領域を持つ。
2. feedは中央stageのA条件を破らず、1280ではcollapse可能。
3. stack active時はstack内容とresolve actionが同一視野にある。
4. 自動実行と手動実行の区別がfeedから分かる。

### I. responsive regression

1. 375x812の現行portrait完走性を維持する。
2. 812x375を実寸で再確認する。
3. desktop規則はmedia/container queryで適用し、別JSX treeを作らない。
4. 5 viewportすべてconsole error 0。

## visual fixture要件

同一GameSnapshotを新旧UIで再現できるfixtureを用意する。最低場面:

1. mulligan pending＋7 hand
2. 8 hand
3. 6 lands(同名basic 3＋special 3、tapped混在)
4. battlefield 10 permanents
5. stack 2＋trigger/warning/feed items
6. graveyard 10＋exile 2

fixtureは開発／テスト専用で、本番保存データやGameState schemaを汚さない。

## review草稿の責務(判定者専有へ昇格前)

- container幅→hand/land圧縮モードの境界表
- restoreGameのmulligan pending保存／legacy backfill
- input parity(action IDとstate transition)
- desktop CSS source scan: `max-width:1100px`禁止、GameCardの`draggable=false`禁止
- portraitでdesktop railがmount/表示されないこと

## 完了ゲート

- 機械4点
- 全`review.*`
- visual fixture 6場面×5 viewport
- desktop 1ゲーム完走: mulligan→土地→cast→stack resolve→graveyard→phase/turn→undo
- console error 0
- ユーザーがPC版を旧Playmatより使いやすいと確認
