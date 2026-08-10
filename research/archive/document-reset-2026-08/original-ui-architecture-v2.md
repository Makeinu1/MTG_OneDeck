# UIアーキテクチャ v2 — Playmat解体と移行戦略

**status**: 契約(判定者専有)。`docs/design-vision.md` のIAを実装可能な構造に落としたもの。D0〜D5とAVスライスの実装分解の正本。
**前提**: エンジン(`src/engine/`)と store の公開 API(`GameStore` interface, `src/store/gameStore.ts:713-812`)は**変更しない**。UI刷新はエンジン契約に触れない(必要が生じたら spec 変更承認フロー)。

> **実装状態(2026-07-19 更新)**: D2/D3の新treeは稼働中。**旧 Playmat とその周辺12ファイルは
> 削除済み**(2026-07-19・ユーザー授権・D4前倒し)——既定経路が本番デフォルトでは到達不能
> (dev fixture `?ui=legacy` のみ)で「生きた同等性参照」ではなくなっていたため。ロールバックは
> `git revert`。現役だった `dialogs.tsx`/`ruleActionCandidates.ts` は `src/components/game/` へ移設。
> **未完はデスクトップ grid-area(§4 D4 本体・PC退行の回復)と DnD/hover/viewStore の乖離**で、
> これらは旧 Playmat 復活ではなく新レイアウト側で埋める(作業計画 = `research/design/d4a-*`)。

---

## 1. 現状の構造問題(なぜ解体が必要か)

| 問題 | 実体 | 影響 |
|---|---|---|
| 神コンポーネント | `Playmat.tsx` 1,735行: ~25 dialog useState・`buildMenuItems`(:735-1109)・DnD配線・全ダイアログのレンダリング | どの画面変更も Playmat を触る=衝突・回帰の温床 |
| 死んだCSS系統 | `App.css:838-960`(旧 `.playmat__sidebar/__main/__stage` 3カラム)+ その media query `:2793-2872`。現JSXは未使用(実体は `:3307+` の「M4.13 overrides」) | カスケード汚染・二重メンテ |
| view state が store 外 | 選択・メニュー開閉・ビューア状態が全て Playmat ローカル useState | モバイル/デスクトップでの画面分割・共有不能 |
| モバイル別コードパス | `useIsPhoneLandscape` で `MobileControlsDrawer`/`MobileZoneSwap` に**丸ごと差し替え** | 二系統がドリフト(縦持ち非対応の温床) |
| アイコン偽装 | `App.css:4293-4345` の `ti ti-*` クラスに Unicode `::before` | 品質の下限を毀損 |

## 2. 目標構造

```
src/
  components/
    game/                    ← 新レイアウト(D2で新設、旧 playmat/ と当面併存)
      GameScreen.tsx         ← 唯一のレイアウトルート(縦/横/デスクトップを CSS で適応。JSX分岐しない)
      StatusBand.tsx         ← 1行36px: ターン/フェーズ+ゾーン枚数チップ+自ライフ+ベル(全てタップ=シート。Round 2 で相手ライフ行・ゾーンチップ列を廃止しここへ集約)
      StackBand.tsx          ← スタック帯+展開リスト(浮動 Stack.tsx の後継)
      Board.tsx              ← クリーチャー(大)/その他(小)の2セクション(ラベルなし・hairline区切り・スクロール領域)
      LandRow.tsx            ← 土地行: 同名基本地形の物理スタック(ずらし重ね)+特殊地形個別+統率者常駐(design-system §8 LandRow)
      HandRibbon.tsx         ← 横スクロール手札+プレイ可能ハイライト
      ThumbZone.tsx          ← undo+PrimaryAction+メニュー(ライフは StatusBand へ移動)
      PrimaryAction.tsx      ← 文脈ボタン(状態機械は selector で導出)
      CardActionSheet.tsx    ← カード操作シート(ContextMenu 後継)
      Feed.tsx               ← ログ/誘発/警告/自動実行の統合タイムライン
      sheets/                ← ZoneSheet・ライフ増減・確認等の bottom sheet 群
    (旧 playmat/ は 2026-07-19 に削除。dialogs.tsx / ruleActionCandidates.ts は game/ へ移設)
  store/
    gameStore.ts             ← 不変(エンジン橋)
    viewStore.ts             ← 新設(D0): view state 専用 Zustand store
  ui/
    icons.tsx                ← 新設(D0): インラインSVGスプライト(design-system §6)
    tokens.css               ← 新設(D1): design-system §2-§7 のトークン(index.css から分離)
```

**規律**:
- **単一 adaptive tree**: 縦持ち/横持ち/デスクトップで**コンポーネントを差し替えない**。`GameScreen` が CSS Grid の `grid-template-areas` 切替(container/media query)だけで3形態を出し分ける。JSX の `isPhone ? <A/> : <B/>` 分岐は禁止(現行の腐敗パターン)。
- **エンジン/ストア境界**: 新コンポーネントは `useGameStore` の既存 actions/selectors のみ使用。カードシートのアクション列挙は既存 `buildMenuItems` のロジックを **`src/components/game/actionCatalog.ts` に純関数として抽出**して共用(Playmat からは当面 re-export で互換維持)。
- **アクションランク付け**(カードシート上位1〜3件)は `actionCatalog.ts` 内の純関数 `rankActions(card, zone, gameState): RankedAction[]` として実装。規則はヒューリスティック(土地未タップ→マナ生成、手札の呪文でマナ可足→唱える、フェッチ→起動、等)。**エンジンには入れない**(UI関心事)。

## 3. viewStore(D0 新設)

```ts
interface ViewStore {
  // シート/パネル(同時に開くのは1つ。opening は queue しない)
  activeSheet: null | { kind: 'card'; cardId: string } | { kind: 'zone'; zone: ZoneId }
              | { kind: 'life' } | { kind: 'menu' } | { kind: 'confirm'; payload: ConfirmPayload };
  feedOpen: boolean;
  stackExpanded: boolean;
  // フィード
  feedItems: FeedItem[];        // gameStore の warnings/triggerCandidates/log を購読して合成
  unseenCount: number;          // ベルのバッジ
  openSheet(s: ViewStore['activeSheet']): void;
  closeSheet(): void;
  toggleFeed(): void; toggleStack(): void; markSeen(): void;
}
```

- 既存 Playmat の ~25 dialog useState はここへ**移さない**(旧ダイアログは旧 Playmat と共に退役)。移すのは新レイアウトが必要とする上記のみ。guided resolution のダイアログ群(`pendingGuided` 駆動)は当面既存 `dialogs.tsx` を流用し、D3 でシート様式に再皮膜する。
- `FeedItem` は gameStore の `warnings` / `triggerCandidates` / ゲームログの**投影**(独自の真実を持たない。undo で自然に巻き戻る)。

## 4. 移行戦略(strangler・各スライス単独ship可)

| スライス | 足す | 切り替える | 消す |
|---|---|---|---|
| D0 | `viewStore.ts`(空殻+テスト)・`ui/icons.tsx`・画像フォールバック(EN画像) | アイコン参照を SVG へ | 死CSS(`App.css:838-960`,`2793-2872`)・`ti ti-*` 偽装(`:4293-4345`) |
| D1 | `ui/tokens.css`・`CardActionSheet`+`actionCatalog.ts` | 右クリック/タップの開き先を ContextMenu→シートへ(フラグ `VITE_UI_V2_SHEET` でロールバック可に) | — |
| D2 | `game/` レイアウト一式(GameScreen〜ThumbZone) | `App.tsx` の描画先を Playmat→GameScreen へ・`RotateNotice` 撤去 | `MobileControlsDrawer`/`MobileZoneSwap`/`useIsPhoneLandscape` |
| D3 | `PrimaryAction` 状態機械・プレイ可能判定 selector・`Feed` 合成 | Toasts/TriggerCandidatePanel/GameLog の役割をフィードへ | `Toasts.tsx`・`TriggerCandidatePanel.tsx`(浮動版) |
| D4 | デスクトップ grid-area・導入画面の保存デッキ一覧 | — | 旧 `playmat/` 一式(**2026-07-19 削除済み**・§6 負債 (1)(2) 回収)・ContextMenu(新UIが現用中ゆえ据置)・残 App.css 区画 |
| D5 | モーション4種+ハプティクス+オプトイン音 | — | — |
| D8 | `game/ambientMotion.ts`+`AmbientBackdrop.tsx`(生きた背景・design-system §8a)+`--ambient-*` トークン+ThumbZone「背景モーション」トグル | — | — |

**受け入れ共通則**(全スライス): 機械チェック(`npm run check`)+`review.*` 緑+実機コンソールエラー0+**縦375px/横812px/デスクトップ1440pxの3形態スクショ確認**。旧機能の削除は「新経路で同じ操作が全て可能」を review.* が確認してから(サンドボックス全操作の保存=vision 原則6)。

## 5. 既存資産の扱い

| 資産 | 扱い |
|---|---|
| `CardView.tsx` のタッチ判別(tap 220ms/8px, `:122-157`) | **維持・流用**。タップの意味だけ変更(メニュー即開→シート開) |
| dnd-kit 配線(旧 `Playmat.tsx`) | D2 で GameScreen へ移植済み。旧 Playmat は 2026-07-19 削除。全DnD操作にシート代替必須 |
| `dialogs.tsx` 16種(**現 `src/components/game/dialogs.tsx`**・2026-07-19 移設) | guided resolution 系は流用(D3 でシート様式へ再皮膜)。Attack/Token 等は ≡ メニュー配下に残す |
| `useShortcuts` キーバインド | 維持(デスクトップ)。PrimaryAction と同じ selector を叩く |
| `GameLog` データ | フィードの投影元として維持(表示コンポーネントのみ退役) |
| PWA meta/safe-area(`index.html`) | 維持。D2 で `viewport-fit=cover`+`env(safe-area-inset-*)` を thumb zone に適用 |

## 6. リスクと決め

- **性能**: フィード合成は memo 化した selector で(毎レンダ全ログ走査をしない)。カードグリッドは既存同様 CSS transform のみで tap 回転。
- **`data-testid` は維持**(`zone-*`/`card-*`/`next-phase` 等)。review.* とブラウザ自動操作の互換を守る。新設要素にも同規約で付与(`primary-action`/`card-sheet`/`feed` 等)。
- **土地の物理スタック束ね**は「同名の基本地形のみ」(Snow-Covered は別束。特殊地形は個別)。表現は抽象チップでなく実カードのずらし重ね(design-system §8 LandRow)。束の中の個別操作(1枚だけ生け贄等)は束シート内の一覧から可能にする=情報の非破壊。
- **undo 文言**: フィードは投影ゆえ undo 後の履歴表示が巻き戻る。「操作の記録が消える」ことへの違和感は、undo 実行時にフィードへ「◀ 直前の操作を取り消した」項目を挿入して緩和(gameStore は触らず view 層で)。
- **旧UI 死CSS の一掃(2026-07-19 完了)**: 旧 Playmat + 12ファイル削除で死んだ `App.css` の旧盤面CSSを到達性解析で一掃した。除去ファミリ = `.playmat*`・`.hand`(bare)/`.hand__*`・`.stack`(bare)/`.stack__*`・`.mobile-zone-swap*`・`.mobile-controls-drawer*`・`.battlefield*`・`.zones*`・`.zone-card*`・`.game-log*`・`.other-actions*`・`.match-controls*`(**245ルール・約2,254行・CSSバンドル −26KB**)。新UI盤面CSSは `src/components/game/game.css` の別名前空間(`hand-ribbon*`/`stack-band`/`stack-workspace*`)で App.css とは別ファイルゆえ無傷。生存する `.card-view--hand`(hand を含むが `.hand` パターンに掛からない)・`.hand-card`(game.css)等は温存。手法 = ブレース深度パーサで「実セレクタ(`:not()`等の内側を除く)に死クラスを含むルール」を whole-rule 削除(コンマ混在の部分書換は発生せず)。カスタムプロパティの越境参照ゼロ・両テーマ実機で視覚退行ゼロを確認。`review.d0-dead-css-scan.test.ts` の pin を全死ファミリの恒久不在 + over-purge 反証アサートへ拡張済み。
- **D1 実装の負債(2026-07-19 回収済み・旧 Tier-1 findings #5/#7 由来)**: (1) `actionCatalog.ts` は `buildMenuItems` の「抽出+re-export」でなく独立重複実装だったが、`buildMenuItems` を抱えていた旧 Playmat.tsx の削除により **`actionCatalog` + `gameController.handlerFor`(=bindAction 相当)が唯一の正本**になった。golden id テスト(review.d1/review.m64)は引き続き actionCatalog を叩く。(2) `game/actionCatalog.ts` の `playmat/ruleActionCandidates` 隠れ依存は、**`ruleActionCandidates.ts` を `src/components/game/` へ移設して解消**(同時に `dialogs.tsx` も移設)。旧 `playmat/` は空になり削除。
- **D3 実装の乖離(2026-07-10・J2・Tier-1 findings #3 由来)**: (1) **viewStore(§3)は D3 では未配線**——`feedOpen` は `gameController` のローカル `useState`、フィード投影は `feedProjection`(純関数)を各コンポーネントが直接呼ぶ構成にした。理由=D3 の投影は state 非依存の純導出ゆえ Zustand store を挟む必要が薄く、局所 state で十分機能する。viewStore の `feedItems`/`activeSheet`/`toggleFeed` の本配線は、複数パネルの同時制御が必要になる D4(デスクトップ常設フィード)へ延期する。(2) **ベルバッジ = 未処理件数(`feedUnseenCount` = warnings + triggerCandidates)**とし、契約の「既読は markSeen」(read 追跡でバッジを消す)は**未実装**。判定者裁定=バッジは「まだ対応していない項目数」を示す方が一人回しでは有用(誘発をスタックへ/無視、警告をクリアすると自然に 0 へ)。read 追跡の markSeen は viewStore 本配線(D4)と同時に再評価する。

## 7. AudioVisualTransport と意味イベント境界

**意味の正本** = `docs/audio-visual-contract.md`。本節はHOWだけを定め、イベント追加・音色・強度を裁定しない。

### 7.1 目標構造

```text
successful game action
        │
        ▼
PresentationEventProjector  ── semantic normalization
        │
        ├──────────────► CausalVisual      即時・拍待ちなし
        │
        ▼
PresentationEventSequencer ── exactly-once / browser-session monotonic id
        │
        ▼
AudioVisualTransport        AudioContext.currentTime + TrackManifest
        │
        ├──────────────► MusicalEventBus   bounded quantization
        └──────────────► SyncedVisual      CSS custom properties / reused layers

commander-cast ──► CommanderRitual ──► MusicBus duck
```

候補ファイル境界:

```text
src/components/game/presentation/
  presentationEvents.ts     型・決定表の純関数投影
  presentationSequencer.ts  session単調増加ID・配信済み管理
  presentationTuning.ts     snap / mix / visual のTUNABLE初期値
  AudioVisualProvider.tsx   transport lifetime と購読境界
  audioVisualTransport.ts   AudioContext時計・manifest補間・schedule
  musicBus.ts               長尺stream・loop・duck
  musicalEventBus.ts        短音buffer・voice choke
```

ファイル名は実装時に既存構造へ合わせて変更してよいが、責務を `gameController.tsx`、`sound.ts`、`AmbientBackdrop.tsx` の一か所へ再混在させない。

### 7.2 PresentationEvent

```ts
type PresentationEvent =
  | { id: string; sourceEventId?: string; kind: 'spell-cast'; cardId: string }
  | { id: string; sourceEventId?: string; kind: 'commander-cast'; cardId: string }
  | { id: string; kind: 'land-played'; cardId: string }
  | { id: string; kind: 'draw-completed'; count: number }
  | { id: string; kind: 'tap-changed'; cardIds: string[]; tapped: boolean }
  | { id: string; kind: 'stack-resolved'; count: number }
  | { id: string; kind: 'shuffle-completed' }
  | { id: string; kind: 'turn-advanced'; turn: number };
```

- view層だけのephemeral event。GameState、snapshot、save data、undo historyへ保存しない。
- `PresentationEventProjector` は成功したforward actionのbefore / result / afterからkindとpayloadを純粋に導出する。ID採番は行わない。
- `PresentationEventSequencer` はゲームセッションnonce + 単調増加sequenceから全kind共通の`id`を割り当てる。`GameEvent.eventId`、cardId、turn番号、`Date.now()`を一意性の代用にしない。
- `GameEvent.eventId` は因果確認用の `sourceEventId` にだけ使う。undo後の履歴分岐で同じ値が再利用されても、新しいforward actionには新しい`id`を発行する。
- sequencerと配信済み集合はゲーム画面内の子コンポーネントより長く生存し、React remountでリセットしない。reload後は新しいsessionとして現在状態をbaselineにし、既存イベントを投影しない。
- `kind` の追加は `audio-visual-contract` 決定表の更新を先に行う。
- pointer/touch/keyboard/DnD/menuをkindの根拠にしない。
- UI文言・ログ文言のregexから推測しない。

### 7.3 発火源

発火の優先順位:

1. forward semantic actionの成功完了境界で、新しくappendされた `GameEvent` が意味を一意に証明できる場合、そのeventを因果の証拠として投影する（cast系）。eventId自体はpresentationの一意性に使わない。
2. `GameEvent`だけで区別できない場合、`gameController` の単一semantic action境界で、store actionの**成功結果とbefore/after差分**を確認して投影する（land / draw / tap / resolve / shuffle / turn）。遅延resolveは開始intentをephemeral refへ保持し、stack itemが実際に離れた時だけ一度完了させる。
3. どちらでも一意に証明できなければ発火しない。ログregexや各ボタンへの個別`playSound()`で補わない。

`PresentationEventProjector` と sequencer は、最低限次をテスト可能にする。

- commander castがgeneric castへも一致しても、出力は`commander-cast`一件。
- failed / needs-confirm / needs-payment / cancel / thrown actionは0件。
- turn end/startは`turn-advanced`一件。
- multi-draw、bulk tap/untap、resolve-allは一操作一件。内部の自動mana tapや効果内draw/shuffleは別eventへ分裂させない。
- manual-required / guided / fetchの確認待ちは0件で、stack itemが実際に離れた成功時だけ`stack-resolved`一件。
- undo/redo/reload/history divergenceは0件。
- cast → undo → 別の新規castでエンジン側eventIdが再利用されても、後者へ新しいpresentation idを一件だけ発行する。
- redo / reload / React remount / 初回購読は現在状態をbaselineにするだけで0件。
- 入力経路が異なっても同じbefore/action result/afterなら同じkind。

### 7.4 Transport lifetime

- `AudioVisualTransport` はゲーム画面のprovider lifetimeで一つ。renderごとに`AudioContext`やmedia elementを作らない。
- MusicTransportの時計とMusicBusの可聴gainを分離する。MusicBusだけがOFFでも、musical-eventまたは背景motionがONならmanifest時計を維持してよい。
- frame clockをReact state/Zustandへ書かない。必要な視覚値はCSS custom propertiesまたはimperativeな単一描画境界へ渡す。
- BGMは`HTMLMediaElement`+`MediaElementAudioSourceNode`等のstreamを第一候補、短音だけ`AudioBuffer`。
- autoplay制限の解除は、ダークのゲーム画面内で最初に起きた `pointerdown` または
  keyboard操作で行う。解除失敗をゲームエラーにせず、次の明示gestureまたは音設定操作まで待つ。
- Music / musical eventの保存設定は独立させ、保存値がない新規利用者は両方ON。
  既存の明示的な音設定はmusical eventへ移行する。テーマやrouteは保存値を書き換えず、
  ダークのゲーム画面以外では可聴出力だけを停止する。
- 同一ページセッション内のroute・テーマ往復ではmedia位置をmemoryに保持する。
  reload後は新sessionとして先頭へ戻り、再びgestureを待つ。
- 次グリッドは、隣接anchorの `beatIndex` 差を `beatSpan` として `beatSpan * quantizeStepsPerBeat`（初期4）区間へ等分して求める。疎なanchor間全体を4区間だけに分けない。ready transportで次グリッドがsnap window外の場合だけmusical eventを即時再生してよい。
- musical-event OFFはevent soundと同期用の装飾的余韻だけを止め、MusicTransport・MusicBus・背景の時計を変更しない。
- master audio OFF、manifest未準備、load/decode/resume errorではmusical eventと同期用の装飾的余韻を発火しない。因果視覚は即時、背景だけ独立アンビエント周期へfallbackし、GameStateを止めない。
- hidden復帰時は現在media timeからanchorを再計算し、欠落イベントを再生しない。

### 7.5 既存コードの移行

| 現行箇所 | AVスライスで行うこと |
|---|---|
| `sound.ts` | opt-in保存と既存音を分離。`primary/chain`を廃止し、draw/resolveを含むAV7 allowlistはsample busへ移す |
| `gameController.tsx` | 入力別の直接音を持たず、successful semantic actionを一か所でproject。draw/tap/resolve/shuffleの全UI入口を同じwrapperへ合流させる |
| `ThumbZone.tsx` | 全PrimaryActionの`celebrate('primary')`を削除。hapticsを残すなら音と分離し、意味イベントに偽装しない |
| `HandRibbon.tsx` | `celebrate('draw')`を削除。controllerの成功済み`draw-completed`経路だけを使う |
| `CelebrationLayer.tsx` / `celebrationTimelineModel.ts` | chain heuristic・chain visual・chain soundを撤去 |
| `CommanderCutIn.tsx` | 視覚資産を再利用。発火をcast時へ移し、演出をnonblockingにする |
| `pendingCommanderResolution` | AV側から新規依存しない。即時commitでpresentation gateを外せる範囲はUIで行い、store API削除はspec変更としてSTOP |
| `ambientMotion.ts` | 固定700msはfallbackへ。combat 525ms分岐を削除 |
| `AmbientBackdrop.tsx` | transportの位相をCSS変数へ受ける。毎frame React setStateは禁止 |

AV3の構造ゲートでは production code 全体を検索し、`celebrate('primary')` / `celebrate('draw')` / `celebrate('resolve')` / `celebrate('chain')` の直接呼出しが0件であることを固定する。移行表にない新しいcallerへ残すことも不合格。

### 7.6 実装スライス境界

1. **AV0**: `candidate-b-tight-128-bars.mp3` とTrackManifestを凍結。公開権確認済みの
   MP3だけを `public/audio/bgm/` へ同梱する。
2. **AV1**: event projector、tuning、transport fixture。まだ本番音源・新規演出を出さない。
3. **AV2**: ダークAmbientLayerをtransportへ接続。性能ゲートを先に通す。
4. **AV3**: cast / land / turnの通常反応と旧直接音・chainの撤去。
5. **AV4**: commander cast専用音、既存cut-in移行、BGM duck。

一つの実装タスクでAV1〜AV4をまとめない。各sliceで `docs/acceptance.md` M-AVの該当ケースをreview pinへ落とし、実機ユーザーゲートを通す。
