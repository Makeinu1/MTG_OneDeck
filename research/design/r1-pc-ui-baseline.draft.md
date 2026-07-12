# R1 新旧UIベースライン比較(J0 draft, 2026-07-12)

## 結論

全面的な旧Playmat復帰は不適切。旧UIはdesktopの空間利用・手札・ゾーン・入力で優れるが、
375px portraitではプレイ自体を拒否する。回復の対象は**旧desktopの長所**であり、D2/D3/D5で得た
portrait対応・文脈PrimaryAction・action sheet・新しいstack/feedモデルは維持する。

比較時の条件:

- 同一origin・同一保存snapshotを`VITE_UI_V2_LAYOUT`だけ切り替えて再開。
- デッキ=`docs/fixtures/test-deck.txt`。
- 実画面=375x812 / 1280x800 / 1440x900 / 1920x1080。
- 812x375はBrowserホストが1280x720へminimum clampしたため、実寸比較は未完。
- いずれもconsole error 0。

## 定量比較

### 8枚手札

| viewport | 新GameScreen | 旧Playmat | 判定 |
|---|---:|---:|---|
| 1280x800 | client 1100 / scroll 1188、完全表示7 | client 848 / scroll 979、完全表示7 | 両方不足 |
| 1440x900 | client 1100 / scroll 1188、完全表示7 | client 990 / scroll 990、完全表示8 | 旧UIが優位 |
| 1920x1080 | client 1100 / scroll 1188、完全表示7 | client 1470 / scroll 1470、完全表示8 | 旧UIが大幅優位 |

旧UIのcount連動negative marginは1440以上で8枚を収める。新UIはviewportに関係なく1100pxで
打ち止めなので、1920でも同じ88px overflowが残る。D4aは旧UIより一段上げ、1280でも8枚を
scrollなしにする。

### 画面幅・舞台

| viewport | 新GameScreen幅 | 旧Playmat幅 | 新UIの未使用横幅 |
|---|---:|---:|---:|
| 1280 | 1100 | 1280 | 180 |
| 1440 | 1100 | 1440 | 340 |
| 1920 | 1100 | 1920 | 820 |

新UIのboardは1920でも1100px。旧UIのmain boardは1920で1590px、右rail 300pxを同時表示する。
新UIはdesktopで得られる情報量を使わず、空の中央高さだけが652pxまで成長する。

### フェーズ

| 項目 | 新GameScreen | 旧Playmat |
|---|---|---|
| 1440でのtrack | 125x17px | 293x31px |
| 表示 | 7つの1文字略号 | 略号＋active/done表現、アクセシブル名は完全名 |
| 進行 | 下端のPrimaryActionが支配的 | 右下next phase＋上部track |

旧UIも完全な日本語フェーズ名を常時視覚表示しておらず、単純復元では不十分。必要なのは
「現在」「完了済み」「次」を言葉で予測できるturn model。任意phase jumpは別判断で、D4aでは
まず`現在: メイン1 / 次: 戦闘`の理解を保証する。

### ゾーン

- 旧UI: 右rail約300pxに統率領域・library・graveyard・exileを完全名＋枚数＋top cardで常設。
- 新UI: 36px status band内の`山/墓/追`チップ。graveyard viewer自体は1 clickなので、raw click数は
  増えていない。
- ユーザーの負担増はclick数より**視覚探索＋小さい対象＋top card消失**。受け入れは「1 click」に加え
  「完全名と枚数を常時見つけられる」を含める。

## 機能／入力比較

| 能力 | 旧Playmat | 新GameScreen | 根拠 |
|---|---|---|---|
| hover preview | 全zoneで`useHoverPreview`配線 | 未配線 | `Playmat.tsx`/`Hand.tsx` vs `GameCard.tsx` |
| DnD | Mouse/Touch/Keyboard sensors＋droppable | `draggable={false}` | `Playmat.tsx:303-307` / `GameCard.tsx:42` |
| right click | action popover | action popover | parity |
| double click | quick action | quick action | parity |
| keyboard | `useShortcuts` | `useShortcuts` | parity。ただしゲーム内hintは弱い |
| game log | 右rail常設 | bellを開いた時だけFeed mount | desktopでは旧UIがglanceable |
| board zone | creature/noncreature/landをlabel付き | creature/otherをhairline、land別row | sparse時は新UIが無標識の空白化 |
| basic lands | 個別カード、幅に応じ縮小 | 同名なら常時bundle | 新UIはspace-awareでない |

## マリガンの真因

fresh gameでは旧・新とも共有`MulliganDecisionDialog`を右上440x179pxに表示する。したがって
「新UIだけからdialog componentが消えた」わけではない。

しかし保存snapshotを`restoreGame`すると、`gameStore.ts:1845`が
`mulliganDecisionPending:false`を無条件設定する。`review.m424.test.ts:91`もこの挙動を固定している。
実機でもfresh legacyでdialog表示 → 同じsnapshotを新UIでresume → dialogなしを再現した。

よって症状は二層:

1. fresh時も右上に遊離し、handとの関係が弱い。
2. 判断前にreload/resumeするとmulligan decision自体が消える。

D4aではlayoutだけでなくsnapshot persistenceを直す必要がある。既存reviewの期待変更を伴うため、
判定者が`review.*`を再オーナー化する。

## portraitとlandscape

- 375x812: 新UIは表示・操作可能。旧UIは`rotate-notice`が全画面表示され、Playmatは
  `visibility:hidden`。D2の価値は維持必須。
- 812x375: 今回のBrowserホストは最小1280x720へclampしたため実寸未測定。既存の812検証記録を
  新しいR3受け入れで再実行する。

## 決定論的高密度fixtureによる補完

`src/dev/visualFixtures/`＋`research/design/visual-fixtures/`を作成し、同一GameStateを新旧UIへ直接渡した。
graveyard scene = hand 8 / lands 6 / creatures 6 / other permanents 4 / stack 2 /
graveyard 10 / exile 2。

1440x900結果:

| 項目 | 新GameScreen | 旧Playmat |
|---|---:|---:|
| board | 1100x346 | 1110x645 |
| hand | 1100、scroll 1188 | 1040、scrollなし |
| phase | 125x17 | 293x31 |
| zone常設領域 | 142x26 | 300x304 |
| 6 lands | 4 bundles(Forest 3を常時束化) | 6 cards個別 |
| stack | 2 cards表示 | 2 cards表示 |

console errorは両UI 0。これにより土地・盤面・stack・graveyardの構造差は再現可能になった。
未完はBrowserホストがminimum clampする812x375実寸のみ。

## R1判定

- 診断は確定: desktop退行は実在し、主因は固定1100px＋mobile圧縮＋desktop affordance未移植。
- 旧UIの全面復帰は却下: portraitを再び壊し、1280の8枚手札も解決しない。
- 次工程: `d4a-pc-affordance-recovery.draft.md`と`d4a-review-plan.draft.md`をJ2が照合する。
