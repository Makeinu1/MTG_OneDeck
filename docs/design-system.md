# デザインシステム — 「アルケイン戦術卓」仕様

**status**: 契約(判定者専有)。`docs/design-vision.md` の視覚言語を実装可能な仕様に落としたもの。
**適用**: D1 スライスでトークンを実装し、以降の全 D-スライスが従う。実装時は本節のトークンを `src/index.css`(または `src/ui/tokens.css`)へ移植する。
**視覚参照**: `research/design/mockups/index.html`(v4)。実機で退行が確認されたため、現在は正本ではなく比較材料として扱う。

> **現行性メモ(2026-07-12・J0草稿)**: モックの現行版はv4。カラー／タイポ／motion tokenは現役だが、
> §8のdesktop配置・圧縮規則は現行実装とユーザー期待が不一致のため再照合中。desktop部品仕様を
> そのまま実装ブリーフへ転記せず、`research/design/design-recovery-plan.draft.md` のR1実測を先に行う。
> 判定者再オーナー化要。

**テーマ裁定(2026-07-08 Round 3・ユーザー確定)**: 旧「夜のカードテーブル」(緑金フェルト)を**廃止**し、**「アルケイン戦術卓 (Arcane Tactical Table)」を正式採用**。黒〜チャコール〜深ネイビーの卓上に、カード画像とマナ5色だけが意味を持って光る「魔法的な戦術テーブル」。背景は一枚絵でなく、盤面各ゾーンに空間的意味を与える舞台(§8 StageBackdrop)。出典 = `research/design/vision-sources/game-feel-dialogue-2026-07.txt`。

---

## 1. 設計態度

- **カードとマナ色が主役**: 面はすべて低彩度の暗色。彩度と光は「カード画像・マナ5色・意味色(金=行動/青白=スタックの緊張/白金=統率者)」にだけ割り当てる。
- **トークン経由でのみスタイリング**: 生の hex/px を新規 CSS に書かない(既存箇所は D-スライスで漸進置換)。**機械強制済み** = `src/ui/__tests__/review.css-token-guard.test.ts`(トークン期CSSのカラー値プロパティに生 hex/rgb/hsl があれば落ちる。`mask-image`/`filter` のアルファは対象外。`App.css` は legacy ゆえ除外し漸進置換で返済)。
- **ダークが既定でありアイデンティティ**(夜の戦術卓)。**ライトテーマも正式サポートする**(ユーザー裁定 2026-07-16)。実現手段はトークンの light override(`src/ui/tokens.css` の `:root[data-theme='light']`)**のみ**——CSS に `@media (prefers-color-scheme)` は置かず、テーマの門は `:root` と `:root[data-theme='light']` の2つに限る。ゆえに**非トークン色はテーマ切替から構造的に不可視**であり、生 hex 1つが即バグになる(実例=2026-07-15 の相手セットアップ画面がライトで 1.31:1・フォーム全体不可視)。
  - **前景と背景は必ず同じ規則で対にして宣言する**。`color: inherit` と固定背景の同居は禁止(トークンの前景だけが反転して背景が置き去りになる=上記実例の真因)。これも `review.css-token-guard` が機械検出する。
  - **ライト・トークン コントラスト再調整は返済済み**(2026-07-25 S0)。light の
    `--action-primary` + `--action-primary-text` は 7.59:1、`--text-dim` on
    `--surface-0` は 5.14:1、`--warn` on `--surface-0` は 5.25:1。
    `--stack-glow` / `--stack-glow-c` にも light override を持たせた。
    これらの下限と light override の存在は
    `src/ui/__tests__/review.s0-contrast.test.ts` が機械強制する。

### 1b. UI文言ルール — チャネル階層(2026-07-25 新設・判定者専有)

UIがユーザーに伝える手段の優先順位。**新しいUIテキストを追加する前に必ずこの階層に従う**。

| 優先 | チャネル | 使用場面 | 例 |
|---|---|---|---|
| ① | 位置・光・動き | 常時・既定 | スタックパイルの重なり=解決順、候補の発光、ドロップ域の輪郭 |
| ② | 名詞・1〜2字漢字 | 場所/状態の地図 | 「墓」「追」「解」「攻」「対象」「T4」「♥38」 |
| ③ | 短い動詞 | 主操作ボタン1つのみ | 「解決」「攻撃」「戦闘」 |
| ④ | 文章 | **例外時のみ** | エラー、ルール不可、手動処理要求、初回チュートリアル、aria-label、詳細展開時 |

**削減対象(②③に収まらないテキスト)**:
- ユーザーが実行中の操作を言い直す文(「土地をプレイ」「上から解決」)
- 内部遷移の露出(「唱える → スタック」「pending」「guided」「対象選択モードへ移行」)
- 見れば分かることの常設説明(「上から順に解決」「手札・盤面を操作して対応を追加」)

**短漢字ラベルは名詞であり、削減対象ではない**。「墓」「追」「解」「攻」「白」「青」等は盤面の地図・記号として積極的に使ってよい。問題は「日本語が多い」ことではなく「操作を文章で逐一説明している」ことである。

**新文案の5問チェック**(テキスト追加前に必ず自問。一つでも該当すれば常設テキストとして追加しない):
1. この文章がなくても、位置・光・動きで意味を伝えられないか
2. ユーザーがすでに行っている操作を、文章で言い直していないか
3. システム内部の状態遷移を説明していないか
4. 名詞または1〜2字の記号へ短縮できないか
5. 初回だけ表示すれば十分ではないか / エラー時や詳細表示時に移動できないか

**文章(④)が許される場面**: 操作が失敗した / ルール上実行できない / 手動処理が必要 / 複数の解釈がある / 初回チュートリアル / aria-label / ユーザーが詳細を開いた / 警告・不可逆操作の確認。

**機械強制**: 禁止文字列(「盤面へ移動して」「土地をプレイ」「唱える → スタック」「対応を追加」「上から順に解決」「ここに置くと」「ここへドロップ」)の製品ソース残存は `src/ui/__tests__/review.s2-forbidden-strings.test.ts` が検出する(aria-label・review.*・actionCatalog.ts のメニューラベル・dev/ は対象外)。

**テーマ表現原則**: ダークは**発光**(glow/明度)で状態を表し、ライトは**輪郭・影・彩度**(outline/shadow/saturation)で状態を表す。新規affordanceは必ず両表現をトークンで定義する(§1 のトークン経由ルールと対)。

**盤面との可逆な往復**: スタック等の一時レイヤーが盤面カードを覆う場合、内容を
消去・閉鎖するのではなく、盤面を見られる最小表示へ退避し、1操作で元の
折り畳み/展開文脈へ戻れること。常設scrimで盤面操作を塞がない。複数項目は
重なりだけで存在を示しつつ、全項目を個別確認できる展開経路を必ず持つ。

**スタック非常口の境界**: `⋯` に格納するのは任意の手動補正(対象の手動記録、
呪文の手動打ち消し／能力の除去)だけ。X値は唱える／起動する手順で確定する
(CR 601.2b / 602.2b)ため、スタック上で変更する操作を設けない。進行を止める
manual resolution の「完了」は見落とせない例外UIとして表示し、`⋯` へ隠さない。

## 2. カラー(トークン正本 = アルケイン戦術卓)

アンビエント層のトークン(`--ambient-*`・墨雲の `--ink-*` 等)は **§8a を正本**とし、本節では管理しない(2026-07-20 追加・二重管理禁止)。

```css
:root {
  /* 卓面(黒〜チャコール〜深ネイビー。これ以外の「暗い面」を作らない) */
  --ink-0: #0a0e14; --ink-1: #0d1320; --ink-2: #111a2a;
  --surface-0: var(--ink-0);   /* 背景(卓) */
  --surface-1: #141d2e;        /* 盤面ゾーン・チップ */
  --surface-2: #1c2a42;        /* 浮遊要素(シート・ポップオーバー・フィード) */
  --line: rgba(150, 185, 235, 0.10);
  --line-strong: rgba(150, 185, 235, 0.24);

  --text: #c9d6e8; --text-dim: #7f94b0; --text-h: #f0f5fd;

  /* マナ5色(卓上で意味を持って光る唯一の彩度源) */
  --mana-w: #f8e7b9; --mana-u: #6cc3e8; --mana-b: #b48be0;
  --mana-r: #ff8c6b; --mana-g: #8fd99a; --mana-c: #c7cdd6;

  /* 意味色: 金=行動 / 青白=スタックの緊張 / 白金=統率者 */
  --gold: #d8b06a; --gold-bright: #f0cf8c; --gold-dim: rgba(216, 176, 106, 0.18);
  --action-primary: var(--gold);
  --action-primary-text: #17130a;            /* 金ボタン上の文字(コントラスト比 ≥ 7:1) */
  --playable-glow: 0 0 0 1.5px var(--gold-bright), 0 0 14px rgba(240, 207, 140, 0.38);

  --stack-glow-c: #9fd4ff;                    /* スタックの緊張(青白光) */
  --stack-glow: 0 0 0 1px rgba(159, 212, 255, .55), 0 0 20px rgba(140, 190, 255, .35);
  --commander-platinum: #e9eef6;              /* 統率者の白金 */
  --platinum-glow: 0 0 0 1.5px rgba(233, 238, 246, .7), 0 0 22px rgba(210, 225, 250, .4);

  /* エンジン由来イベントの意味色(フィード/バッジ) */
  --auto: #7fb8d8;        /* エンジン自動実行(青=機械) */
  --trigger: #d8a95f;     /* 誘発候補(琥珀=要判断) */
  --warn: #ef6f6f;        /* 警告・強行 */

  /* 光と深度(卓上の冷たい光溜まり+ヴィネット。ゲーム画面ルートに常設) */
  --table-light: radial-gradient(120% 55% at 50% 26%, rgba(160, 200, 255, .07), transparent 60%);
  --table-vignette: radial-gradient(140% 105% at 50% 44%, transparent 58%, rgba(0, 0, 5, .5) 100%);
}
```

*参考: 旧テーマ(廃止)* = 緑金フェルト `--felt-1:#0d1410 / --felt-2:#121b16` 系。移行時 `src/index.css` の felt トークンは上記 ink/surface へ置換する。

**実装乖離記録(D1・2026-07-10・J2 承認)**: felt トークンの「置換」は、旧 Playmat が D4 まで現役レンダラである間の回帰を避けるため、**index.css で felt-*/panel トークン名を維持しつつ値だけ ink/surface へ差し替えるエイリアス方式**で行った(`--felt-1: var(--surface-0)` 等)。これにより App.css の 29 参照を無編集で新色へ移行できる。旧 Playmat の退役(D4)時にエイリアス定義も削除する。トークン正本は `src/ui/tokens.css`(index.css から `@import`)。

**規約**:
- 金(`--action-primary`)は**画面に同時に1箇所**(プライマリアクション)+プレイ可能ハイライトのみ。青白は**スタックにいる間だけ**、白金は**統率者だけ**。意味色の乱用禁止(全部同格に戻る)。
- 破壊的操作は `--warn` 文字色+確認シートで、面積は最小。
- コントラスト: 本文 `--text` on `--surface-1` ≥ 4.5:1 を維持。バッジ・チップの文字は 14px 未満にしない。

## 3. タイポグラフィ(役割の整理)

フォント3種は維持。**役割を固定**する(現状は混用):

| トークン | 書体 | 用途(これ以外に使わない) |
|---|---|---|
| `--display` | Cinzel | ゲームの「儀式」だけ: タイトル・ターン開始表示・勝敗・統率者名ヘッダ |
| `--sans` | Manrope | UI本文・ボタン・シート項目・設定 |
| `--mono` | Space Mono | 数値のみ: ライフ・枚数・マナ量・ターン番号(桁が揃う) |

```css
:root {
  --font-size-xs: 11px;   /* バッジ・注釈(最小。これ未満禁止) */
  --font-size-sm: 13px;   /* 補助・フィード本文 */
  --font-size-md: 15px;   /* 基準(現行 font: 15px) */
  --font-size-lg: 18px;   /* シート見出し・プライマリボタン */
  --font-size-xl: 28px;   /* ライフ等の主数値 */
}
```

## 4. スペーシング・寸法

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  --touch-target: 44px;        /* 全インタラクティブ要素の最小ヒット領域(iOS HIG) */
  --thumb-zone: 88px;          /* 画面下の親指ゾーン高(プライマリ+メニュー行) */

  --card-ratio: 488 / 680;     /* MTGカード実比率(現行踏襲) */
  --card-hand-w: clamp(96px, 26vw, 140px);   /* 縦持ち手札 */
  --board-card-w: 96px;        /* 盤面棚の基準カード幅(BoardShelf。密度で84/72pxへ。§8) */
  --sheet-radius: 20px 20px 0 0;             /* bottom sheet 上角 */
}
```

**規約**: 見た目が44pxより小さい要素(ゾーンチップ等)も、擬似要素でヒット領域を44pxに拡張する。カードは見た目サイズ≠ヒット領域(隣接カードとの重なり順で解決)。

## 5. 形状・影・材質

```css
:root {
  /* 影は3段のみ(現行2段+1) */
  --shadow-card: /* 現行維持 */;
  --shadow-pop:  /* 現行維持 */;
  --shadow-sheet: 0 -8px 40px rgba(0, 0, 0, 0.6);  /* bottom sheet 用 */

  /* 金の材質(ボタン・統率者縁に。ベタ塗り禁止) */
  --gold-surface: linear-gradient(160deg, #e8c883 0%, #d8b06a 45%, #b8904e 100%);
  --gold-edge: inset 0 1px 0 rgba(255, 235, 190, 0.5), inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}
```

- 卓背景は §8 StageBackdrop(楕円の主舞台+戦術ライン+手札レスト)。ゾーン面は原則として面を持たず、舞台の上にカードが直接乗る(パネル感の排除)。空ゾーンは薄いカード形プレースホルダ(「席」の示唆)で空黒を消す。

## 6. アイコン

- **Unicode 偽装(`ti ti-*` + `::before` 文字)を全廃**(D0)。
- 採用: **インライン SVG スプライト自作**(`src/assets/icons.svg` + `<use>`)。外部アイコンフォント・CDN 依存は導入しない(オフライン SPA・依存追加はユーザー確認事項のため回避)。必要アイコンは20個未満: フェイズ送り・ターン送り・undo/redo・メニュー・ベル(フィード)・閉じる・タップ(回転矢印)・攻撃・ライフ±・墓地・追放・山札・統率・検索・設定・ダイス・コイン・警告・自動(歯車)。
- 線幅 1.5px・24px グリッド・`currentColor`。マナシンボルのみ塗り(5色トークン)。
- **実装乖離記録(D0・2026-07-10・J3・Tier-1監査指摘を受け追記)**: (1) 実装は `src/ui/icons.tsx`(name→SVGパスの React コンポーネント)。`ui-architecture-v2.md` §2 のファイルツリーが明示するパスと一致させ、本節の `assets/icons.svg`+`<use>` 記述は旧案として置き換える。(2) アイコン総数は22個(本節の目安20個未満をわずかに超過)。内訳=本節記載の目標セット(D1以降で使用開始)に加え、D4で退役するまで旧 PlaymatHud/MobileControlsDrawer(15種の `ti-*` 全置換対象)を稼働させ続ける必要があり、`info`(情報ボタン)を実務上追加した。J3裁量境界(playbook §4「アイコン追加(§6の20個枠内)」)の範囲内の軽微超過と判定者が承認。

## 7. モーション — 安定した反応文法

`docs/design-vision.md` §2 と `docs/audio-visual-contract.md` の視覚実装仕様。旧 L0〜L4 の「履歴や重要度で高揚させる」意味は**撤回・superseded**。時間トークンは既存機能モーションとの互換のため残すが、レベル名で通常操作を格付けしない。

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-snap: cubic-bezier(0.34, 1.3, 0.64, 1);   /* 手応え(軽いオーバーシュート) */
  --dur-fast: 120ms;    /* 押下・focus・ハイライト */
  --dur-move: 240ms;    /* シート・カードの因果移動 */
  --dur-hero: 420ms;    /* 通常の意味イベント余韻の上限候補 */
  --dur-ritual: 650ms;  /* 統率者固有儀式の構成単位 */
}
@media (prefers-reduced-motion: reduce) { /* 全モーション 0ms + フェードのみ */ }
```

| 層 | 目的 | 音楽イベントか | 視覚 |
|---|---|---|---|
| 即時UI | 操作可能・選択中・失敗を理解する | いいえ | hover/focus/pressed、警告。音楽拍を待たない |
| 機能的因果 | 状態がどこからどこへ変わったか理解する | 原則いいえ | ETB、墓地移動等の短い因果 |
| 通常意味イベント | 自分がゲームを進めた手応え | はい | `draw-completed` / `land-played` / `spell-cast` / `tap-changed` / `stack-resolved` / `shuffle-completed` / `turn-advanced` の一定反応 |
| 固有儀式 | デッキを象徴する一枚を迎える | はい | `commander-cast` の専用cut-in |

**因果の可視化**: カード移動は「出発点→到着点」を理解できること。機能的因果は残してよいが、`audio-visual-contract` のallowlist外では背景パルス、音、粒子バーストを追加しない。

**通常意味イベントの同一性**:

- 同じkindは毎回同じ知覚上の形・方向・強さ・時間範囲。
- 連続回数、カードの強さ、マナ総量、ログ量で増幅しない。
- 新しいイベントDOMを積み上げず、既存要素・疑似要素を再利用する。
- `commander-cast` だけは通常キャスト表現を置き換える専用儀式。

旧 D5 の `motionLevelFor` / `shouldCompress` は現行実装の互換層であり、新規仕様の意味正本ではない。旧 D6 のchain visualは実行禁止。移行対象は `audio-visual-contract` §9。

## 7b. 音 — Music / Musical event / UI feedback

音は任意にON/OFFでき、保存値がない新規利用者は **Music / Musical eventとも既定ON**。
可聴範囲はダークテーマのゲーム画面だけとし、ライトテーマでは保存設定を維持したまま
実効無音にする。旧D7の「ループBGMを作らない」「UI/カード/状態の3レイヤー」は撤回し、次のbusへ置換する。

```text
Master
├─ Music bus             全曲周期ループBGM
├─ Musical-event bus     draw / land / spell / tap / resolve / shuffle / turn / commander
└─ UI-feedback bus       非音楽的なアクセシビリティ補助（既定無音）
```

- 入力イベントを直接鳴らさない。発火kindの正本は `audio-visual-contract` §2。
- `draw-completed`、`tap-changed`、`stack-resolved`、`shuffle-completed`はAV7 allowlist。mana、life、counter、chain、combatと効果内部の副作用は対象外。
- `commander-cast` はgeneric castを置換し、Music busを短時間duckする。
- Masterの保護は安全用limiter/dynamicsを一つまで。大音量化に使わない。
- Music / Musical event / 背景motionは内部状態を分離する。公開設定UIの粒度は実装時に最小化してよい。
- MusicTransportの時計とMusic busの可聴gainも分離する。Musical eventだけをOFFにしても、Musicと背景のmanifest同期は維持する。
- 音色差やduck量はTUNABLEだが、イベント追加・既定値の再変更はユーザー裁定。
- 長時間利用で「意識しなくても手触りが残る」ことを合格軸にする。

## 8. コンポーネント言語(視覚仕様)

### StageBackdrop(反応する舞台・Round 3 追加)
背景は「鑑賞する壁紙」でなく「カードを考えながら動かすための舞台」。背景は**アンビエント層**として常に控えめに生き、`audio-visual-contract` の通常意味イベントへ毎回同じ反応を返す。履歴から「一段盛る」判定はしない。視認性を最優先し、模様は細かくしない。
- **戦場=主舞台**: 画面中央に楕円の光溜まり(`--table-light`)+外周の細い戦術ライン(低コントラスト)。カードが上に乗ると「盤面に置かれた」感が出る。
- **手札=カードレスト**: 画面手前に緩い温光のレスト。「手札を抱えている」感覚。
- **スタック=緊張帯**: 空の時はほぼ不可視。呪文/能力が乗った瞬間だけ青白光(`--stack-glow`)で浮上=「処理待ちの緊張空間」(§ PrimaryAction/StackBand と連動)。
- **ゾーンの空気感**: 墓地=沈む/冷たい・追放=断絶/乾いた空白・ライブラリ=閉じた山・統率領域=特別な祭壇(白金)。面でなく空気で意味を分ける。
- **イベント反応**: AV7 allowlistの成功操作は短く一定。draw枚数、tap枚数、resolve件数で反応を増幅・連打しない。連鎖時の戦術ライン活性は廃止。統率者はキャスト時の固有儀式として別扱い。

### 8a. AmbientLayer(生きた背景・2026-07-20 ユーザー裁定・v4.3 最終モック確定)
ユーザー要望(2026-07-20): 静止背景を廃止し、アイドル時間にも盤面が呼吸する。参照 tetra-nova の本質(音楽同期で脈動するネビュラ背景+多層星+中心脈動)を **CSS 近似+減衰**——"a whisper, never a wave"。**常に抽象表現・具象物体を置かない**(星座線・月・太陽円盤・ルーンリング・フロアグリッド等はすべてユーザー裁定で却下)。本層は `GameScreen` 背後への注入のみ(`pointer-events:none`・`aria-hidden`)。視覚形状の参照 = `research/design/mockups/ambient-motion.html`(v4.3)だが、同モックの固定テンポ・戦闘加速・旧イベント強度は `audio-visual-contract` によりsuperseded。背景は二層: **アンビエント層**(常時・本節)+ **意味イベント層**。
**二スキン原則**: ダークとライトは別のスキン(色差し替えではない)。ダークでTrackManifest transportがreadyの間はそれをペースアンカーにする。master audio OFF / manifest読込失敗時だけ暫定700msへfallbackする。musical-event OFFだけではfallbackしない。ライトは現行の液态呼吸3400msを維持し、楽曲追加はDEFER。
- **ダーク = 脈動する星雲(冬のクオリティ: 冷たく・透き通り・鋭い)**:
  - 星雲ガス×3(氷/金/ティール・中心 alpha .07-.20): ドリフト 64s/88s/112s(alternate)+ 呼吸 7.4s/9.6s/11.8s(opacity .55↔1・位相ずらし)、不定形の縁(**有機的 border-radius** で代替・2026-07-21 パフォーマンス改訂: SVG feTurbulence は常時アニメーション下で致命的に重いため全廃)、`mix-blend-mode` も GPU 合成負荷のため全廃(radial-gradient の輝度で十分光る)。場全体が 300s で緩慢旋回。
  - 星3層・計156(遠84/中46/近26): **個別周波数**(遠 3.2-5.3s/中 2.4-4.5s/近 1.5-3.5s)+個別位相(負 delay)の深いきらめき(opacity 床 ~0.16x・scale .72↔1.32)。**やわらかな光点のみ——十字スパイク禁止**(チープとしてユーザー却下)。冷たいパレット(白〜氷色中心・暖色は約1/5)。**星は主役ではない**。
  - オーロラバンド(抽象・17s スウェイ・opacity .65↔1)+ 流れ星×2(11s/17s スケジュール・可視窓~8%)。
  - **鼓動**: TrackManifest transportがreadyの間は `AudioVisualTransport` の拍位置を共通時計にし、中心コア光(opacity .4↔.92・scale 1↔1.05)とヴィネット逆相を同期する。master audio OFF / manifest読込失敗時だけ700ms。musical-event OFFだけでは切り替えない。**戦闘による525ms化・燠火色・ヒート脈動は廃止**(戦闘AVはDEFER)。
  - **スタック同期**: スタック非空の間、StackBand + StatusBand 下線が同じビート時計で脈動。ライフのハートは2拍ごとに一拍(既存 D5 と同じ時計)。
- **ライト = 墨の世界(ペースアンカー: 液态呼吸 3400ms)**:
  - 墨雲×3(藍黒/セピア/インディゴ・中心 alpha .11-.22・**有機的 border-radius** の不定形縁): ドリフト 24s/38s/52s・液态呼吸 3400ms(opacity .64↔1・位相ずらし)、場全体が 180s で旋回。
  - **自描筆致**×2: 見えない筆がひと筆置く(pathLength dash 21s/29s: 描画→保持→フェード)。**墨の滴**×5(落下・拡散 7s・stagger)。**墨の滲み(bloom)**×6(9s)。**奔流**×3(14s/18s/22s)。**金箔**×10(ドリフト+瞬き)。和紙の目(静的)+ 和紙ハイライト池(上部・3.6s 呼吸・opacity .8↔1)+ 筆致の骨格(90s)+ ヴィネット呼吸 30s。
  - **盤面上の光源**: 見えない太陽が頭上を **90s で一周**——暖かい光の池(回転腕・中心 `--ambient-sun-wash`)が紙面を渡り、冷たい対蹠の影(180°オフセット)と紙のシーン(光沢)が角度ごと回る。**太陽の円盤は描かない——光そのものが太陽**。
- **ターン交代**: 成功した `turn-advanced` 一件に対し、文字スタンプ(Cinzel)+描き線+横切るスウィープを毎回同じ形で一回だけ返す。ターン終了/開始の二重発火を禁止する。光輪は既に撤去済み。
- **フェイズ進行**: **既存 `TransitionCue` のみ**——新規の波紋/ティントは追加しない(ユーザー裁定で撤廃)。`TransitionCue` のタイミング定数(`TURN_CUE_LEAD_MS` 等)は不変。
- **ガードレール(上限・機械検証対象)**: アニメーションは **transform/opacity のみ**(`background-position`・layout プロパティのアニメ禁止。唯一の例外 = 自描筆致の SVG `stroke-dashoffset`+opacity)。アンビエント層は `pointer-events:none` + `aria-hidden`。`will-change` / `mix-blend-mode` / `feTurbulence` は全廃。イベントごとのDOM追加とReact stateによるフレーム時計を禁止する。タブ非表示で一時停止し、復帰時は現在のaudio timeへ再同期して過去イベントを再演しない。`prefers-reduced-motion: reduce` → アンビエント完全静止(世界観は静止画として残す)、スウィープ/スタンプはフェードのみ、流れ星は非表示。背景motionと音の設定は独立。全性能契約 = `audio-visual-contract` §7。
- **パフォーマンス改訂記録(2026-07-21 実機計測)**: ①SVG `feTurbulence`/`feDisplacementMap` は常時アニメーション下でピクセル単位のノイズ生成を毎フレーム行い致命的に重い(特に Chrome)ため**全廃**。不定形の縁は有機的 `border-radius` で代替(契約の意図=不定形は維持)。②`will-change` は星156+多数への付与でレイヤー量産→メモリ爆発のため**全廃**。③`mix-blend-mode: screen` は合成を強制し GPU 負荷を上げるため**全廃**(ダーク背景上では radial-gradient の輝度で十分)。④星の `box-shadow` blur 半径を縮小(ペイント領域削減)。⑤和紙ノイズ層(`paper-grain`)も削除。
- **ターン演出の減衰記録(2026-07-21 ユーザーFB)**: 光輪(放射光線 rays / 拡がる輪 ring)は「やりすぎ」のため撤去。文字スタンプ(Cinzel)+描き線+横切るスウィープのみ残す。
- **スタック脈動の実装記録(2026-07-21)**: StatusBand 下線と StackWorkspace の脈動は `::after` 疑似要素の **opacity** アニメーションで実装(ガードレール「transform/opacity のみ」準拠・既存の静的 box-shadow は不変)。
- **台形盤面の透明化記録(2026-07-21 ユーザー指示)**: `--tabletop-surface` を transparent に変更(ダーク/ライト両方)。アンビエント背景を殺さず透かす。戦術ライン(inset edge)と glow(drop-shadow)は残し「舞台の枠」だけ維持。
- **実装**: 純関数 `src/components/game/ambientMotion.ts`(fallback周期/トグル状態/星・墨の決定的配置)+ `AmbientBackdrop` コンポーネント(`GameScreen` の `TabletopSurface` 直後に mount)+ `game.css` keyframes + `--ambient-*` トークン(`src/ui/tokens.css`)。ダークでTrackManifest transportがreadyの時刻は固定CSS durationでなく `ui-architecture-v2` §7 のtransportからCSS custom propertiesへ投影する。モックの速度スライダーは製品に持ち込まない。

### CardActionSheet(カードシート)
- モバイル: 画面下から `--surface-2`・`--sheet-radius`・`--shadow-sheet` で出現(`--dur-move`)。上部にカード拡大(幅60%)+名前/タイプ行。**マナ色の縁光**をカードの色アイデンティティで。
- アクション領域: 上位1〜3件(エンジン文脈ランク)を `--touch-target` 高の大ボタンで。先頭がそのカードの「一番自然な操作」(土地=マナ生成タップ、手札の呪文=唱える)。「その他」開閉で全操作(ゾーン移動・カウンター・強行・自動化トグル)を既存 ContextMenu 相当の粒度で。
- デスクトップ: 同一コンポーネントをカーソル近傍ポップオーバー(`--shadow-pop`)で。
- **実装(D1・2026-07-10・J2 承認。Tier-1 監査で findings 反映済み)**: アクションモデルは純関数 `src/components/game/actionCatalog.ts`(`buildCardActionCatalog`/`rankActions`)。旧 `Playmat.buildMenuItems` の生 MenuItem(onSelect 付き)を id で priority に join して上位1〜3件を昇格し残りを「その他」へ畳む。**label はシートでは actionCatalog(spec)を正本にする**(`buildSheetModel` の `withSpecLabel`)——統率者税など文脈依存の文言は actionCatalog にしか無いため。挙動(onSelect/testId/danger)は item を再利用ゆえ ContextMenu と同一。上位変種の判定=`isPhoneLandscape` で bottom sheet / popover を出し分け。金はシート内で使わず(PrimaryAction 専有)、先頭アクションは border 強調で示す。新トークン(J2 追加): `--scrim`(overlay 暗転)・`--popover-w-min/max`(popover 幅)。
  - **乖離記録1(affordability・D3 へ延期)**: マナ支払可否(手札呪文の昇格判定)は D1 では既定 `true` 固定——実ゲーム状態に基づくマナ計算関数がまだ無いため。**「マナ不足の唱えるは昇格しない」受け入れ基準(playbook §3 D1(a)(3)・(b))は D3(プレイ可能ハイライト selector)へ明示的に繰り越す**(D1 では純関数 `rankActions` が `canAffordCast:false` を注入された時に正しく振る舞うことを review.d1 でピン留めのみ)。強行キャストは元々サンドボックス許容ゆえ実害なし。統率者の唱えるはマナ可否によらず昇格(規則表 優先1)。
  - **乖離記録2(優先5の代替・J2 追認)**: playbook §3 D1(a)(3) の「優先5: 戦場の起動型能力持ち→先頭の能力起動」は、substrate が「意味のある起動型能力を持つか」を安価に判定できず、汎用 `ability-activate`(全戦場パーマネントに無条件で存在)を昇格すると全カードで雑音化するため、**検出可能な具体的起動型能力である「フェッチ起動」(`fetchActivate`)を優先5相当(priority 60)に割り当て、汎用 `ability-activate` は昇格しない**方針へ J2 が変更・追認した。将来「起動型能力保有」分類器ができた時点で本来ルールへ精密化可能。

### Smart tap / quick ability(2026-07-18・資源状態②追補→同日判定者監査済)
- 戦場の表向き・アンタップ状態のカードに、現在面のoracleからモデル化できた `{T}` 起動型能力が**1本**ある場合、カードの通常クリック/Spaceを手動タップではなく `activateAbility(cardId, flatIndex)` へ配線する。コスト支払いと対象選択を既存CR 602 envelopeから迂回しない。
- `{T}` 能力が**複数**ならカード直上の小型pickerを開き、コスト+効果プレビューから行を選ぶ。行indexは `splitAbilityLines` のflat indexを保持する。マナ能力には `[即時]`、通常能力には `[スタック]` を付けてCR 605の意味差を表示する。
- `{T}` 能力なし・タップ済み・裏向きは従来の手動tap/untap。CardActionSheetの「タップ/アンタップ」は常設し、攻撃やサンドボックス操作の逃げ道を残す。
- カード右上の常設丸ボタンは発見性とモバイル1タップ導線を兼ねる。カード本体のモバイル短押しはpreview、二度押しは全操作sheetという既存契約を維持する。

### Responsive action language(2026-07-18・資源状態②追補→同日判定者監査済)
- **意味の二層化**: 常設面は `Icon` + 漢字2–4文字を基本とし、完全な操作文は `aria-label` / `title` に保持する。重要な初回選択や不可逆操作は短縮せず、CardActionSheet/専用dialogで説明する。アイコン単独への全面置換はしない。
- **PrimaryAction**: 520px以下では「解決 n」「誘発 n」「攻撃」「戦闘」等へ短縮し、stack/bell/attack/phase SVGを併置する。広幅では従来の完全ラベルを表示する。DOM上のaccessible nameは幅にかかわらず完全ラベル。
- **三スライス横断**: quick abilityは正式なtap SVG（複数時は件数badge）、TriggerSheetはbell +「誘発」/ info +「下から解決」、stack footerはphase icon +「下の『解決』から」。CR 605即時/CR 602 stackの区別は能力pickerの文字badgeを残し、意味をアイコンだけへ委ねない。
- **日本語の自然さ**: `手札 Workspace`→「手札一覧」、`カード全体を保ったまま一覧`→「全体表示 · n枚」、`盤面を見る`→「盤面へ」。操作説明を常時段落で反復しない。
- **幅制約**: 375px縦は2段status + compact action、812px横はstatus全体を固定して色別mana stepperだけを横スクロール、1440pxは完全ラベル。狭幅でも `aria-label` / title / keyboard経路を同一にする。

### Tabletop 2.5D卓面(2026-07-19・試作承認ゲート経由でユーザー承認済)
- **卓上視点は背景レイヤーだけで作る**: `TabletopSurface`(装飾専用div・`pointer-events:none`・`aria-hidden`・z-index 0)を盤面+土地行(grid-row 2/4)の背後に敷き、台形clip-path(奥=上辺を絞る: デスクトップ6%/横画面3%/縦画面1.5%)+卓面グラデーションで遠近感を出す。カード・DnD座標・ポップアップ・HUD(手札/Status/Stack/Decision/Thumb)には3D変形を一切かけない——可読性と矩形当たり判定の維持が優先。
- `.game-screen__board`/`.game-screen__support` は `position:relative; z-index:1` で卓面の上に載せる。デスクトップは `.board` に padding-inline を足して台形上辺の絞りとカードの重なりを防ぐ。
- 色はトークン(`--tabletop-edge`/`--tabletop-glow`/`--tabletop-surface` を `--gold`/`--surface-*` から color-mix 導出)。light テーマは `html[data-theme='light']` で上書き。
- 開発Fixtureの `?tabletop=baseline` で旧平面表示と比較可能(本番には切替フラグを置かない)。

### PrimaryAction(プライマリアクションボタン)
- 親指ゾーン左側の幅優先ボタン。`--gold-surface` + `--gold-edge`、文字 `--action-primary-text`・`--font-size-lg`。
- 状態機械(表示文言はエンジン状態から導出): スタック非空→「スタックを解決」/ 未処理誘発→「誘発を処理(n)」/ 戦闘宣言中→「攻撃を確定」/ それ以外→「次のフェイズ →」(長押し or 隣の小ボタンで「次のターン ≫」)。
- スタック未解決中のフェイズ移動禁止は**ボタンがそもそも「解決」になる**ことで表現(無効化グレーではなく、次にすべきことの提示)。
- **誘発直接導線(2026-07-18・資源状態②追補→同日判定者監査済)**: PrimaryAction/次フェイズショートカットは同じ判定を使う。単一かつ対象選択不要なら即座にCR 603.3のスタック配置へ進む。複数または対象選択を伴う場合は専用 `TriggerSheet` を開き、順序を選んで配置する。Feedを必須中継点にしない。シートを閉じても候補は消さず、ready pending trigger中のフェイズ/ターン移動は禁止する。

### BoardShelf(盤面カード棚・Round 4 追加 2026-07-09)【SUPERSEDED 2026-07-18】
- **本節の密度段階仕様(96/84/72px・14枚〜重ね)は 8a72e0d の UI 刷新で `adaptiveLaneLayout.ts` / `battlefieldProjection.ts`(行折返し+動的縮小)に置換され退役**。実装正本はコード(`src/components/game/adaptiveLaneLayout.ts`)+ `adaptiveLaneLayout.test.ts`。旧 `boardShelf.ts` と `review.d2-layout-model` の boardShelf 節は 2026-07-18 のクリーンアップで削除済み。
- 生きている原則(継承): 盤面は統一サイズの棚でクリーチャーとその他のカードサイズを割らない(カードは同格=主役)。旧「2列/4列グリッド」廃止。

### LandRow(土地行・Round 2 でユーザーFBにより確定)
- 盤面下・手札上の**1行横スクロール**(高さ~96px)。抽象チップは不採用=**実カードの物理スタック**で見せる。
- **同名基本地形はずらし重ね**: 最前面カード+背後のカード上端を5pxずつ最大2枚分見せる(3枚以上は「×n」バッジで代表)。枚数バッジは右下 20px 円形(`--surface-2`+`--line-strong`)。
- **タップ状態**: 束内にタップ済みが混じる場合は束をわずかに傾け(-4°)左上に「n⤵」バッジ。単体土地のタップ済みはその場で横倒し(rotate 90°)+減光 brightness(.72)。
- **特殊地形は個別カード**(束ねない。Snow-Covered も別束)。
- **統率者常駐**: 統率者が統率領域にいる間、行の左端に金枠(`--gold` 2px outline)+「統率者」コーナーバッジのカードとして常駐。タップ=カードシート(先頭アクション「唱える(統率者税 +n)」)。
- 束のタップ=束シート(一括タップ「◯色n点出す」+束内の個別カード一覧から個別操作可=情報の非破壊)。

### Feed(フィード)
- 右端スワイプ/ベルで展開する `--surface-2` パネル。項目タイプ: 手動操作(`--text`)・自動実行(`--auto` 左縁+歯車アイコン)・誘発候補(`--trigger` 左縁+「スタックへ/無視」ボタン内蔵)・警告(`--warn`)。
- 誘発項目は履歴/代替導線として残すが、PrimaryActionからFeedを開かない。誘発の正規導線は直接配置または専用TriggerSheet。
- 各項目に相対時刻とカード参照チップ(タップでカードシート)。undo は項目単位でなく従来のグローバル undo ボタンを親指ゾーンに残す(スナップショット方式と整合)。
- 未読誘発・警告はステータス帯のベルにバッジ。

## 9. Do / Don't(品質の下限)

**Do**:
- カード画像を主役にする。背景は控えめに呼吸し、許可された通常意味イベントへ一定の反応を返す。
- 操作結果の因果(出発点→到着点)を見せる。演出は短く意味を持たせる。
- 統率者キャストを固有の儀式として特別扱い(白金)・スタックを緊張空間(青白)にする。背景は盤面の意味づけに使う。

**Don't**:
- 新規の生 hex / 生 px(トークン外)・4層目の面色・2箇所目の金プライマリ。
- 44px 未満のヒット領域・11px 未満の文字。
- **背景を主役にする・アンビエント層の上限(§8a)を超える振幅・入力を直接鳴らす・履歴や連鎖で通常操作を盛る・GameStateを拍待ちさせる**。ソシャゲ風の過剰演出・勝利演出に寄せない。
- `audio-visual-contract` の決定表外の音楽イベント・装飾モーション・自動再生音。
- プレースホルダ画像の露出(画像欠落は EN 版画像→それも無ければ整形されたテキストカード)。
- 常設のゾーンラベル・常設の相手ライフ行・カード上の恒常テキストオーバーレイ(カードが主役=vision 原則7。ゾーン/相手情報はステータス帯の数値チップ+タップシートで)。
