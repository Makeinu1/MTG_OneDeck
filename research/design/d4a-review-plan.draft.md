# D4a review計画(J0 draft, 2026-07-12)

> `review.*`本体は判定者専有。本書は独立review作者へ渡すアサーション計画であり、製品契約を
> 変更しない。受け入れ正本候補=`d4a-pc-affordance-recovery.draft.md`。

## 外部真理

1. ユーザー指摘7点＋R1実測値
2. desktop input parity = 旧Playmatのhover/DnD/right-click/double-click/keyboard経路
3. portrait preservation = 現行GameScreen 375x812
4. sandbox哲学 = 全DnDにright-click代替、stack未解決中のphase移動禁止

## Review群

### R-D4A-1 hand layout policy

実装側に純関数`handLayout(containerWidth, cardCount)`相当を要求し、以下をpinする。

- 1280 desktopの実効hand幅で8枚→`scroll=false`、card width>=96
- 7→8枚で突然scrollへ飛ばず、gap縮小またはbounded overlap
- 9枚以上の段階順=gap→overlap→scroll
- 同じ入力→同じ出力、入力非破壊

### R-D4A-2 land presentation policy

純関数`landPresentation(containerWidth, cards)`相当:

- 1440 fixtureの6 lands→6 individual
- 狭幅で初めて同名basicをbundle
- special landは常にindividual
- tapped 2枚のidentityが圧縮後も残る
- 表示順とcard idを失わない

### R-D4A-3 mulligan persistence

- newGame→pending true
- pending状態をsave→restore→true
- keep後save→restore→false
- legacy snapshotにfieldなし→安全なbackfill。誤ってpendingを再表示しない条件を明示
- restoreだけでは`beginFirstTurn`を実行しない
- 現在の`review.m424` false固定は契約承認後に判定者が更新

### R-D4A-4 input parity

card/zoneごとのaction matrixをpin:

- hover→preview only(state不変)
- click→inspect only(state不変)
- right-click→全action catalog
- double-click→既存quick action
- DnD transitionと対応action transitionの結果stateが一致
- keyboard next phaseはPrimaryAction selectorとstack guardを共有

### R-D4A-5 desktop source／DOM scan

- desktop breakpoint内に`.game-screen max-width:1100px`が残らない
- GameScreen cardにhard-coded `draggable={false}`が残らない
- 主要要素data-testid維持
- desktop railのための別GameScreen JSX treeを作らない
- legacy PlaymatをD4aで削除しない

### R-D4A-6 responsive DOM

visual fixtureを5 viewportで読み、以下を機械取得:

- viewport / screen / central stage / hand / phase / zones / feed rect
- hand clientWidth/scrollWidth/完全表示枚数
- individual land count/bundle count
- preview出現rect
- console errors

375ではdesktop rail非表示、1440/1920ではdesktop情報がglanceable。812x375は実寸ブラウザで別実行。

## Visual scene matrix

| scenario | 主判定 |
|---|---|
| mulligan | handとの同一視野、resume pending |
| hand | 8枚scrollなし、hover/click |
| lands | individual→space-aware compression |
| battlefield | dense board、zone cue、DnD |
| stack | phase guard、resolve、feed |
| graveyard | zone常設、top card、1 action viewer |

各sceneを`ui=new`で5 viewport。`ui=legacy`はdesktop 3 viewportの比較基準として残すが、合格判定は
「旧と同じ」ではなくD4a数値契約で行う。

## Tier-1敵対観点

- 8枚を収めるためカードを判読不能まで縮小していないか
- rail常設で中央stageを現在より狭めていないか
- hover追加がtouch tap/long-pressを二重発火させないか
- DnD復元がaction sheet代替を壊していないか
- mulligan backfillが進行済みlegacy gameへ誤表示しないか
- stack active時にphase click/shortcutで強行できないか
- 1920だけgreenで1280をscrollへ追いやっていないか

## Green条件

- 上記review全緑
- fixture builder test全緑
- 機械4点
- 6 scenes×5 viewport、console error 0
- 旧Playmat rollback経路green
- ユーザーPC再評価
