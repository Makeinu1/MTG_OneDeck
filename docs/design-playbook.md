# デザイン実行プレイブック — D0〜D7 を下位判定者だけで完走させる(判断の先払い)

**status**: historical execution contract(判定者専有。**D4 回復契約の再承認まで新規実行に使わない**。現況 = `docs/README.md`)
**作成**: 2026-07-09 Fable 5 引き継ぎセッション(ユーザー命令: デザインの仕事をFableが引き継ぎ、完成版までの作業を下位モデルで回せるよう徹底的に計画せよ)
**性格**: `docs/judge-protocol.md` のD-トラック版。ここに書いてある判断は**後継判定者の地力を使わずそのまま適用してよい**。デザインの価値判断は本書とモックv4に先払い済み——後継の仕事は**照合と検証**であり、再設計ではない。

> **実行停止メモ(2026-07-12・判定者不在期の草稿)**: D0/D1/D2/D3/D5出荷後、D4未実装のPC版に明確な
> ユーザー退行が確認された。本書の既存D4カードは「PC回復＋3カラム＋旧実装大量削除」を結合しており、
> 現状のまま実行しない。D6/D7も停止する。回復案=`research/design/design-recovery-plan.draft.md`。
> D4分割は判定者の格上げ事項(judge-protocol §7)、優先順位はユーザー、不在期の変更は復帰判定者の再オーナー化が必要。
>
> **更新(2026-07-19・ユーザー授権)**: 上記結合カードのうち**「旧実装大量削除」だけを単独で実行**した
> (旧 Playmat + 周辺12ファイル削除・`dialogs.tsx`/`ruleActionCandidates.ts` を `game/` へ移設)。
> 既定経路が本番デフォルトで到達不能=生きた同等性参照ではなかったための撤去で、**PC回復＋3カラムは
> 依然停止**(別途 D4a で実施)。詳細 = `docs/README.md`・`docs/ui-architecture-v2.md` §6 負債。

---

## §0 使い方(D-スライスセッションのコールドスタート)

読込順: `CLAUDE.md` → `docs/judge-protocol.md` → **本書**(当該スライスの§3実行カード)→ 台帳 `research/cr-grounding/cr-backbone-ledger.json` → 実行カードが参照する契約§のみ(全文を読まない)。

- **1セッション=1スライス**。サイクルは§2。着手順はユーザー裁定済み(2026-07-09): **D-トラック先行**=autoloopはD0→D5を順に消費してよい。D6/D7はD5完了時にユーザーへ着手確認(§7)。
- 迷ったら§4(裁量境界)を引く。§4にも無い判断=J2召喚 or STOP(judge-protocol §7)。**背伸びして裁定しない**。
- Codexは2026-07-11までquota枯渇。それまでの着手は§6。

## §1 正本マップ(判断種別→引く場所)

| 判断 | 正本 |
|---|---|
| 何を作るか・受け入れ基準 | 本書§3の実行カード(要約)+台帳note |
| 見た目(色・字・寸法・モーション・音) | `docs/design-system.md`(トークン=§2〜§7b・コンポーネント言語=§8) |
| 構造(ファイル・store・移行順・消すもの) | `docs/ui-architecture-v2.md`(目標構造=§2・viewStore=§3・strangler表=§4) |
| 感情・演出の優先順位(何を祝うか) | `docs/design-vision.md` §2「狙う感情」(北極星②) |
| 視覚の最終正本(迷ったらこれに合わせる) | `research/design/mockups/index.html`(**v4**)。ローカル閲覧=`.claude/launch.json` の `mockups`(port 8899) |
| 裁量の境界(誰が何を決めてよいか) | 本書§4 |
| 検証の手順 | 本書§2 |
| 演出のさらなる詳細(D6/D7契約起草時) | `research/design/vision-sources/game-feel-dialogue-2026-07.txt`(全文転写はしない=北極星③) |

## §2 UIスライス標準サイクルと検証レシピ

### 2.1 サイクル(autoloopの D-トラック版)

1. **milestone**: 本書§3の実行カードを読む(=契約は起草済み。再起草しない)。台帳の該当エントリをin-progress相当としてloop-stateに記録。
2. **review.\* 授权(判定者自筆・実装前)**: §3(b)の逐条仕様をそのままテストに起こす。**対象は純関数層のみ**(actionCatalog/selector/viewStore/投影/ヒューリスティック)。コンポーネントのDOMマウントはしない——`@testing-library/react` は未導入であり、**導入は依存追加=STOP③**(必要と判断したらユーザーへ)。DOM/視覚の正しさは2.3の実機レシピが受け持つ。
3. **Codexブリーフ dispatch**: §3(a)の本文を`research/`配下の一時ファイルに書き、`"$(cat file)"`経由でbackground起動([[codex-dispatch-backtick-quoting-bug]]・`< /dev/null`)。AGENTS.md共通則は再掲しない。
4. **Tier-1 独立監査**(冷たいCodex/Sonnetサブエージェント・findings only): 機械4点(各個実行)+review.\*+禁止ファイル走査+§3(f)のリスク観点を敵対プロンプトで。
5. **Tier-2(判定者)**: findingsの赤旗のみ裁定(judge-protocol §6)。
6. **実機検証**: 2.3のレシピ。**スクショ3形態+コンソール0が揃うまでshipしない**。
7. **ship**: `/ship`(台帳status/evidence更新を同コミットに含める)。push拒否環境ではコミットまで進めユーザーへpush依頼を明示。
8. **周期メタレビュー**(3スライスごと): CLAUDE.mdの5問+「モックv4と実装の乖離が黙認されていないか」(§4)。

### 2.2 スライス受け入れの共通則(ui-architecture-v2 §4 と同一・再掲)

機械4点+review.\* 緑+実機コンソールエラー0+**3形態スクショ**(縦375×812/横812×375/デスクトップ1440×900)。旧機能の削除は「新経路で同じ操作が全て可能」をreview.\*(純関数層: actionCatalogが旧buildMenuItemsの全アクションを保存)+実機で確認してから。

### 2.3 実機検証レシピ(Claude Preview・機械化済み)

- **起動**: `preview_start`(`mtg-onedeck`)→ 該当画面まで操作(デッキはMyDeck既存保存分)。
- **3形態**: `preview_resize` で 375×812 → 812×375 → 1440×900。各でスクショ+主要操作1本(タップ→シート→アクション実行)。
- **コンソール0**: `preview_console_logs`(level=error)が空。warning は新規増分0を確認。
- **クローム予算(D2以降)**: `preview_eval` で実測 — 目標: chrome≤25% / boardCards≥55%(vision原則7):
  ```js
  (() => { const h = innerHeight, px = s => document.querySelector(s)?.getBoundingClientRect().height ?? 0;
    return { chromePct: +(((px('[data-testid="status-band"]')+px('[data-testid="thumb-zone"]'))/h)*100).toFixed(1),
             boardCardsPct: +(((px('[data-testid="board"]')+px('[data-testid="land-row"]'))/h)*100).toFixed(1) }; })()
  ```
- **44px監査(D1以降)**: `preview_eval` で全 `button,[role="button"]` の `getBoundingClientRect` を集計し `min(w,h)<44` の一覧を出す(カード本体は除外=ヒット領域規約はdesign-system §4)。
- **reduced-motion(D5以降)**: DevToolsの「Emulate CSS media feature prefers-reduced-motion」で全モーション停止を目視(preview_evalからは切替不可)。加えてreview.\*でモーション時間トークンの分岐ロジック(あれば純関数)を検証。
- **証跡**: スクショはセッション内で判定に使えば足りる(保存は任意)。

## §3 スライス別実行カード

> 各カード: (a) Codexブリーフ本文 (b) review.\* 逐条仕様 (c) 実機チェック (d) 完了定義 (e) 判定ティア (f) リスクと処方。
> ブリーフの後に判定者が付けるもの: 対象スライスの台帳キー・review.\*ファイル名。

---

### D0 地ならし 【ティア: J3。Codex不在時はJ3代行可(§6)】

**(a) ブリーフ**
```
目的: UI刷新の地ならし(見た目回帰ゼロの純負債除去+土台2点)
スコープ: 以下4点のみ。DEFER=レイアウト変更・トークン刷新(D1)・新画面(D2)
対象: src/App.css / src/ui/icons.tsx(新設) / src/store/viewStore.ts(新設) / カード画像フォールバック箇所(CardView系)
受け入れ: 機械4点+全画面の見た目回帰なし+コンソールエラー0

1. 死CSS削除: App.css:838-960(旧.playmat__sidebar/__main/__stage 3カラム)と:2793-2872(そのmedia query)。現JSX未使用を検索で確認してから削除(実体は:3307+の「M4.13 overrides」)。
2. アイコン: `ti ti-*`+Unicode ::before 偽装(App.css:4293-4345)を全廃し、src/ui/icons.tsx(インラインSVGスプライト・20個未満・線幅1.5px・24pxグリッド・currentColor。必要リスト=docs/design-system.md §6)へ置換。外部アイコンフォント/CDN導入は禁止。
3. viewStore.ts 新設(空殻+ユニットテスト): docs/ui-architecture-v2.md §3のinterfaceどおり。既存Playmatの~25 dialog useStateは移さない。
4. 画像フォールバック: 日本語版画像欠落時はEN画像へ、それも無ければ整形テキストカード。「Localized Image Not Available」プレースホルダの根絶。Scryfall APIの追加呼び出しを増やさない(既存キャッシュデータ内で解決)。
```
**(b) review.\***: viewStoreの状態遷移(openSheet/closeSheet排他=同時に開くのは1つ・toggleFeed/markSeenでunseenCount=0)/ 画像フォールバック順序の純関数(jp→en→text)を入力表で / App.cssに`ti ti-`と`838-960`系セレクタが残存しないことのソース走査アサーション。
**(c) 実機**: 全画面スクショ比較(回帰なし)・アイコンが実SVGで表示・日本語版欠落カード(例: 新セットカード)でEN画像が出る。
**(d) DoD**: 2.2共通則+「Localized Image Not Available」が全経路で出ない。
**(f) リスク**: 死CSS判定の誤り→削除前に`git grep`でクラス使用0を機械確認。アイコン置換漏れ→`ti ti-`の残存0をreview.\*で恒久化。

---

### D1 デザインシステム+カードシート 【ティア: J3(ただし新トークン追加=§4で J2 専有ゲート)】

> **実行記録(2026-07-10・J2)**: 本カードは J3 ティアだが、内包する `tokens.css` 新トークン追加が §4 裁量境界で J2 専有のため、J3 単独では着手できない(前セッションが正しく見送り)。ユーザーが J2(Opus 4.8)を召喚し「進めて」と指示、Codex はクォータ枯渇中(〜7/11)のため J2 が認可+実装を代行、独立 Tier-1(冷 Sonnet)監査を通した。トークン値・rankActions 規則・IA は本書とモック v4 に先払い済みゆえ、J2 の実質作業は「トークン追加の認可+照合実装」に縮んだ。

**(a) ブリーフ**
```
目的: トークン刷新(アルケイン戦術卓)+カードシート(ContextMenu後継)の併存導入
スコープ: DEFER=ContextMenu全面置換(D2)・レイアウト変更(D2)
対象: src/ui/tokens.css(新設) / src/index.css(felt→ink置換) / src/components/game/CardActionSheet.tsx+actionCatalog.ts(新設) / Playmat.tsx(開き先切替のみ)
受け入れ: 機械4点+森タップでマナ生成が一等地+タッチターゲット44px++コンソール0

1. tokens.css: docs/design-system.md §2〜§7の:rootトークンを実装(視覚正本=research/design/mockups/index.html v4の<style>冒頭トークン層を移植)。旧felt-*系はink/surfaceへ置換。新規CSSに生hex/px禁止。
2. actionCatalog.ts: 既存buildMenuItems(Playmat.tsx:735-1109)を純関数抽出(Playmatからはre-export互換維持)。全アクションを保存(サンドボックス=強行含む)。
3. rankActions(card, zone, state): 上位1〜3件の昇格規則は下表(判定者確定済み・変更はJ2):
   優先1: 統率領域の統率者→「唱える(統率者税+n)」/ 優先2: 戦場の未タップ土地→「マナを生成してタップ」/
   優先3: 手札の土地(土地権残)→「プレイする」/ 優先4: 手札の呪文でマナ支払可→「唱える」/
   優先5: 戦場の起動型能力持ち→先頭の能力起動 / 優先6: タップ済み土地・その他→「タップ/アンタップ」。
   マナ不足の「唱える」は昇格しない(「その他」内に警告色で常存=強行可)。
4. CardActionSheet: モバイル=bottom sheet(--surface-2/--sheet-radius/--shadow-sheet・カード拡大幅60%・マナ色縁光)、デスクトップ=カーソル近傍ポップオーバー(同一コンポーネント)。「その他」開閉で全操作。
5. 開き先切替: 右クリック/タップ→シートへ。VITE_UI_V2_SHEET=false でContextMenuへ即時ロールバック可。
```
**(b) review.\***: rankActionsの規則表を入力ケース化(森未タップ→マナ生成先頭・手札《太陽の指輪》マナ可→唱える先頭・統率者→税表示付き先頭・マナ不足呪文→昇格されない)/ actionCatalogが旧buildMenuItemsの全アクションIDを保存(スナップショット比較)/ 純関数性(同一入力→同一出力・stateを変異しない)。
**(c) 実機**: 森タップ→シート先頭「マナを生成してタップ」・「その他」に15項目相当が畳まれる・44px監査(2.3)・シート表示100ms以内(体感)。
**(f) リスク**: buildMenuItems抽出時のクロージャ依存(store直参照)→引数化を徹底。フラグOFF経路の回帰→review.\*はフラグ両値で回す。

---

### D2 縦持ちレイアウト(刷新の本丸) 【ティア: **J2召喚**(App.tsx描画切替+旧モバイル系統削除の裁定のみ)。実装=Codex・監査Tier-1は通常】

**(a) ブリーフ**
```
目的: RotateNotice撤去=縦持ちを第一級市民に。新レイアウトgame/一式の導入
スコープ: DEFER=PrimaryAction状態機械/フィード(D3・ThumbZoneは仮ボタン「次のフェイズ」直結)・デスクトップ3カラム(D4・当面は既存Playmatが横/デスクトップを担当し続けてよい※判定者注: 切替様式は下記)
対象: src/components/game/一式(新設: GameScreen/StatusBand/StackBand/Board/LandRow/HandRibbon/ThumbZone/sheets/)・App.tsx・削除=MobileControlsDrawer/MobileZoneSwap/useIsPhoneLandscape/RotateNotice
受け入れ: 機械4点+縦375pxで1ゲーム完走+クローム予算(chrome≤25%/boardCards≥55%)+コンソール0

1. 単一adaptive tree: GameScreenがCSS grid-template-areasのみで縦/横/デスクトップを出し分け。JSXのisPhone分岐禁止。
2. Board=BoardShelf(design-system §8)【SUPERSEDED 2026-07-18 → adaptiveLaneLayout.ts。密度段階仕様は退役】: クリーチャー/その他の2段(hairline・ラベルなし)・統一サイズ棚・横スク・密度で--board-card-w 96/84/72px・14枚〜重ね・幅遷移は--dur-move。
3. LandRow(design-system §8): 同名基本地形ずらし重ね(×nバッジ・タップ混在は傾き+n⤵)・特殊地形個別・統率者常駐(金枠・統率領域にいる間)。束タップ=束シート(一括タップ+個別一覧)。
4. StatusBand 1行36px: ターン/フェーズ+ゾーン枚数+自ライフ+ベル(全てタップ=シート。相手ライフ・ゾーンチップ列は常設しない)。
5. StackBand: 浮動Stack.tsxの後継(帯・空時は不可視・タップで展開)。
6. data-testid: status-band/board/land-row/hand-ribbon/thumb-zone/stack-band/card-sheet を付与(検証レシピが参照)。
7. 全操作にシート代替(DnD/ダブルクリック専用を作らない)。
```
**(b) review.\***: LandRowの束ね規則純関数(同名基本地形のみ束・Snow-Covered別束・特殊個別・タップ数集計)/ BoardShelf密度関数(枚数→96/84/72/overlapの閾値表)/ StatusBandの表示値selector(ゾーン枚数・ライフがgameStateと一致)/ 旧経路の全操作がactionCatalog経由で到達可能(D1のスナップショットが破れていない)。
**(c) 実機**: 縦375で「新規ゲーム→3ターン(土地・キャスト・戦闘・undo)→終了」完走・クローム予算実測・横812/1440も表示崩れなし(D4前は暫定でよいが操作可能であること)・密度遷移(トークン等で6枚+にして84pxへ)。
**(e) J2召喚の対象**: App.tsxの描画切替様式(GameScreen全面置換 vs ビューポートで新旧併存)の最終裁定と、useIsPhoneLandscape系削除のタイミング。**推奨(Fable)**: 全面置換+旧Playmatはデスクトップ専用として当面残置(D4で削除)——「別コードパス禁止」は新tree内の規律であり、strangler期の新旧併存とは矛盾しない(ui-architecture-v2 §4)。
**(f) リスク**: 最大スライスゆえ2分割可(D2a=game/一式を隠しルートで追加・D2b=切替+削除)。Codex中断時は「実装済み/残作業」で再dispatch(最大2回)。guided resolutionダイアログ(dialogs.tsx)はそのまま流用(D3で再皮膜)。

---

### D3 プライマリアクション+フィード(エンジンの見える化) 【ティア: J3】

**(a) ブリーフ**
```
目的: 「次にすること」駆動+誘発/警告/ログの単一フィード=エンジンの物語の可視化(vision原則2/4)
スコープ: DEFER=モーション(D5)。対象=PrimaryAction.tsx/Feed.tsx/viewStore(feedItems合成)/プレイ可能ハイライトselector・退役=Toasts.tsx/TriggerCandidatePanel.tsx(浮動版)
受け入れ: 機械4点+遷移表どおりのボタン状態+コンソール0

1. PrimaryAction状態機械(判定者確定済み・優先順は上から。変更はJ2):
   ①スタック非空→「スタックを解決(残n)」=resolveStackTop ②未処理誘発n>0→「誘発を処理(n)」=誘発シート
   ③戦闘宣言中→「攻撃を確定」 ④それ以外→「次のフェイズ →」(長押し/隣接小ボタン=次のターン)。
   スタック未解決中のフェイズ移動禁止(CLAUDE.md唯一の強制)は①が最優先であることで構造表現(無効化グレー禁止)。
2. プレイ可能ハイライト: 手札のうちマナ支払可能なカードに--playable-glow(マナ計算selector・memo化)。
3. Feed: gameStoreのwarnings/triggerCandidates/ログの投影合成(独自真実なし・undoで自然に巻き戻る)。項目型=手動/自動(--auto)/誘発候補(--trigger・「スタックへ/無視」内蔵)/警告(--warn)。undo時は「◀ 直前の操作を取り消した」を挿入(view層のみ)。
4. ベルバッジ=未読誘発+警告件数。既読はmarkSeen。
```
**(b) review.\***: 状態機械の遷移表を全ケース入力化(スタック1+誘発2→「スタックを解決」/スタック0+誘発2→「誘発を処理(2)」/戦闘中→「攻撃を確定」/平時→「次のフェイズ」)/ プレイ可能selectorのマナ計算(色拘束・不特定・支払不能ケース)/ feed合成の投影性(gameStore状態からの純導出・同一入力同一出力・undo後に件数が巻き戻る)。
**(c) 実機**: 呪文キャスト→ボタンが「スタックを解決」に変わる→解決→「次のフェイズ」に戻る・誘発発生→ベルにバッジ+ボタン「誘発を処理」・フィード展開で履歴確認。
**(f) リスク**: マナ計算selectorの再計算コスト→memo化(毎レンダ全ログ走査禁止=ui-architecture-v2 §6)。誘発の「無視」がエンジン状態と矛盾しないか(既存triggerCandidatesのdismiss APIを使う。新規エンジンAPI追加は不可=必要ならJ2)。

---

### D4 デスクトップ再構成+旧実装削除 【ティア: **J2召喚**(大量削除の最終go)。削除self-auditはTier-1に個別項目で指示】

**(a) ブリーフ**
```
目的: モバイル部品の3カラム展開+旧実装の退役(strangler完了)
スコープ: 対象=GameScreenのgrid-area展開(統率/ゾーン縦積み|盤面+手札|フィード常設=モックv4画面4)・ImportScreenに保存デッキ一覧カード・削除=playmat/Playmat.tsx(1735行)/旧サイドバー/浮動Stack.tsx/ContextMenu/関連App.css区画
受け入れ: 機械4点+1440pxで1ゲーム完走+DnD併存+コンソール0

1. 3カラムはCSS grid-template-areasの切替のみ(コンポーネント差し替え禁止)。カードシートはポップオーバー形態。
2. DnD(dnd-kit配線=旧Playmat.tsx:291-295)をGameScreenへ移植。全DnD操作にシート代替。
3. ContextMenu削除は「シート完全移行」をreview.*+実機で確認後(全アクションID保存のスナップショットが根拠)。
4. 削除は1コミット内で完結させ、git revertで丸ごと戻せる形に。
```
**(b) review.\***: actionCatalogスナップショット(D1)が削除後も全緑=操作の非破壊の機械的証明 / useShortcutsがPrimaryActionと同一selectorを叩く(キーバインド回帰なし)/ ソース走査=`Playmat.tsx`・`MobileControlsDrawer`等への参照残存0。
**(c) 実機**: 1440pxで1ゲーム完走・DnDとシート代替の両経路・ImportScreenの保存デッキ一覧から起動・375/812回帰スクショ。
**(f) リスク**: 削除起因の隠れ依存(dialogs.tsxがPlaymatのローカル状態を参照等)→削除前にTier-1へ「参照グラフの残存」を明示監査項目として渡す。

---

### D5 祝祭感(L1-L3中核) 【ティア: J3】

**(a) ブリーフ**
```
目的: 4種モーション+ハプティクス+オプトイン音=Arenaとの体感差の中核(design-system §7のL1-L3)
スコープ: 4種のみ(これ以外の装飾モーション追加は禁止=design-system §9)。DEFER=演出レベル制御機構/連鎖(D6)・音3レイヤー(D7・ここでは最大3音の単発SE)
対象: 視覚正本=モックv4の場面1〜3(初手/キャスト→スタック/解決→着地)の実装移植
受け入れ: 機械4点+モーション4種の体感確認+reduced-motionで全停止+コンソール0

1. ドロー: 山札チップ→手札への滑り込み(--dur-move・出発点→到着点の因果=design-system §7共通則)。連続ドローは自動圧縮(~120ms級)。
2. 解決: スタック帯の青白閃き→行き先へ縮小移動して着地(--dur-hero・fx-land/fx-flash相当)。
3. ETB: 着地バウンス+一瞬の金縁(--ease-snap)。
4. ダメージ・ライフ: 数値カウントロール+増減方向の色フラッシュ(--dur-fast〜move)。
5. navigator.vibrate(10)をプライマリ/ドロー/解決に。音=オプトイン既定OFF・3音以下(合成or同梱・外部依存禁止)。
6. prefers-reduced-motionで全モーション0ms+フェードのみ。
```
**(b) review.\***: モーション適用判定の純関数(イベント種別→L値・連続イベント→圧縮フラグ)/ reduced-motion分岐(トークン選択関数)/ 音のopt-in状態がlocalStorage永続でOFF既定。
**(c) 実機**: 4種の体感(モックv4場面1-3と見比べ)・reduced-motion目視・連続ドローでテンポが保たれる(待たされない)。
**(f) リスク**: モーションがundo/高速操作と競合→アニメは常に**装飾層**(状態はDOM即時反映・アニメ中断可)。演出待ちで操作をブロックしない(design-system §9 Don't)。

---

### D6 連鎖感+演出レベル制御 【ティア: J3(契約=下記§5.1で先払い済み)。新GameCommand/GameState不要=view層のみ。エンジンイベント不足が発覚したらjudge-protocol §5.1(分解可能性テスト)】

実行カードは§5.1の契約ドラフトを正とする。視覚正本=モックv4の場面4(統率者L3+)・場面5(連鎖L4=chain-on+苗木トークン波)。

### D7 音+セッション演出 【ティア: J3(契約=§5.2)。音素材の外部依存は禁止(合成/自作同梱)】

実行カードは§5.2。視覚正本=モックv4場面1(初手の儀式)。

## §4 デザイン裁量の境界(lookup)

| 主体 | してよい | してはならない |
|---|---|---|
| **Codex** | トークン値の適用・余白/折返しの微調整・実装都合のDOM構造選択(data-testid維持) | 新トークン・生hex/px・モック外の見た目判断・L0-L4体系外のモーション |
| **J3** | 既存トークン内の割当変更・アイコン追加(§6の20個枠内)・モックとの軽微乖離の記録承認・閾値の±20%調整(BoardShelf枚数閾値・連鎖ヒューリスティック) | 新トークン・IA変更(バンド構成/行構成)・コンポーネント分割の変更 |
| **J2(召喚)** | 新トークン追加・IA/コンポーネント構造変更・engine/store公開APIへの接触判断・D2/D4の削除go | テーマ変更・北極星②の解釈変更 |
| **ユーザー(STOP)** | — | に相当する事項: テーマ・北極星②③・成功指標(80点)・依存追加(testing-library/音源ライブラリ含む)・D6/D7の着手go |

**モック⇄実装乖離の規則**: モックv4が視覚正本。実装制約で乖離する場合、**乖離内容と理由をdesign-systemの該当§へ1行追記してから**判定者が承認する(黙認乖離の禁止)。逆にモック側の誤り(実装して初めて分かる操作性問題)は、J3が「実装を正・モックをstale」と裁定してよい——ただし同じくdesign-systemへ記録。

## §5 D6/D7 契約ドラフト(Fable先払い。着手時にJ3が台帳へdrafted昇格)

### 5.1 D6 連鎖感+演出レベル制御

- **演出レベル制御機構**(view層・エンジン不変): ゲームイベント(gameStoreのログ/eventLog購読)→L値へのマップはdesign-system §7表が正本。同種イベントの連続(<1.5s間隔)は圧縮フラグでL1級へ。
- **連鎖ヒューリスティック(初期閾値・J3は±20%調整可)**: 次のいずれかで発火——①誘発のスタック置きor解決が**10秒内に3回+** ②**1ターンにドロー5枚+** ③**1ターンにトークン生成3体+** ④**スタック連続解決3回+(30秒内)** ⑤**単一フェイズ内のマナ生成8点+**。発火=`chain-on` 8秒(再発火でリセット延長): 戦術ライン一段活性+「⛓ 連鎖中」チップ+L4予算。**コンボの厳密検出はしない**(vision §2)。操作は止めない。
- **統率者登場(L3+)**: 祭壇活性→白金の浮上→スタック→着地→盤面同期の一拍(モックv4場面4の時間構成: 850/650/500/520ms)。
- **review.\* 仕様**: ヒューリスティック純関数(イベント列→chain-on区間)を①〜⑤の境界値ケース(2回は発火しない/3回で発火/8秒後失効/再発火延長)で。
- **完了定義**: 実デッキ(MyDeck)で「回った」ターンにchain-onが体感される・誤発火が静かなターンに出ない(1ゲーム観察)。

### 5.2 D7 音+セッション演出

- **音3レイヤー**(design-system §7b): UI音/カード操作音/状態音。**実装=WebAudio合成(OscillatorNode+エンベロープ)を既定**——依存追加なし・アセット同梱不要。音数≤10種・各≤400ms・既定OFF(設定に「音」トグル+音量)。状態音(スタック中/連鎖中)は短いレイヤーのみ・ループBGMは作らない(「曲」でなく「空気」)。
- **初手の儀式**: 7枚が95ms間隔で配られ扇に整う→キープ確定の小演出(モックv4場面1)。マリガンは山へ戻り再配布。
- **ゲーム開始演出**: デッキセット(統率者表示+デッキカラーのアクセント反映)は控えめに(L2)。
- **review.\* 仕様**: 音のトリガマップ純関数(イベント→音種・OFF時は全て無音)/ 儀式シーケンスのステップ関数。
- **完了定義**: 音ONで30分プレイして疲れない(ユーザー体感確認=これはユーザーへの確認事項)。

## §6 履歴: Codex枯渇時(〜2026-07-11)の代行規則【expired】

- **D0のみJ3代行可**(外科的・有界: 死CSS削除/アイコン/viewStore空殻/画像フォールバック)。条件=[[codex-quota-judge-substitution]]どおり**独立Tier-1(Sonnetサブエージェント)監査を必ず通す**(自己監査は循環)。
- D1以降の本丸はCodex復帰(7/11)待ちが既定。ユーザーが急ぐ場合のみJ2召喚の上で判断。

## §7 完成の定義とゲート

1. **D0→D5を順にship**(各スライス=2.2の受け入れ)。中間チェックポイント: D2完了時にユーザー再採点で**65点**・D3完了時**72点**を目安(未達なら次スライスへ進む前にJ2召喚で原因分析)。
2. **D5完了時 = ユーザー再採点(目標80点)+D6/D7着手のユーザーgo確認**(STOP)。
3. **D6/D7 ship後 = デザイン刷新の完成版**。祝祭がvision §2の優先順位どおりに体感されるかをユーザーが最終裁定。
4. 完成後、CRトラック(fetchland→score.ts修復→…)へ復帰(2026-07-09ユーザー裁定の順序)。
