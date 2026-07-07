# UIアーキテクチャ v2 — Playmat解体と移行戦略

**status**: 契約(判定者専有)。`docs/design-vision.md` のIAを実装可能な構造に落としたもの。D0〜D5 スライスの実装分解の正本。
**前提**: エンジン(`src/engine/`)と store の公開 API(`GameStore` interface, `src/store/gameStore.ts:713-812`)は**変更しない**。UI刷新はエンジン契約に触れない(必要が生じたら spec 変更承認フロー)。

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
      StatusBand.tsx         ← ターン/フェーズ/相手ライフ/ベル(バッジ)
      StackBand.tsx          ← スタック帯+展開リスト(浮動 Stack.tsx の後継)
      Board.tsx              ← クリーチャー/その他/土地圧縮の3セクション(スクロール領域)
      LandStacks.tsx         ← 基本地形の色別束+特殊地形個別(一括タップ導線)
      ZoneChips.tsx          ← 墓地/追放/山札/統率チップ(タップ=ZoneSheet)
      HandRibbon.tsx         ← 横スクロール手札+プレイ可能ハイライト
      ThumbZone.tsx          ← PrimaryAction+ライフ+undo+メニュー
      PrimaryAction.tsx      ← 文脈ボタン(状態機械は selector で導出)
      CardActionSheet.tsx    ← カード操作シート(ContextMenu 後継)
      Feed.tsx               ← ログ/誘発/警告/自動実行の統合タイムライン
      sheets/                ← ZoneSheet・ライフ増減・確認等の bottom sheet 群
    playmat/                 ← 旧実装(D4 完了時に削除)
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
| D4 | デスクトップ grid-area・導入画面の保存デッキ一覧 | — | 旧 `playmat/Playmat.tsx`・旧サイドバー・`Stack.tsx` 浮動版・ContextMenu(シート完全移行を確認後)・関連 App.css 区画 |
| D5 | モーション4種+ハプティクス+オプトイン音 | — | — |

**受け入れ共通則**(全スライス): 機械4点+`review.*` 緑+実機コンソールエラー0+**縦375px/横812px/デスクトップ1440pxの3形態スクショ確認**。旧機能の削除は「新経路で同じ操作が全て可能」を review.* が確認してから(サンドボックス全操作の保存=vision 原則6)。

## 5. 既存資産の扱い

| 資産 | 扱い |
|---|---|
| `CardView.tsx` のタッチ判別(tap 220ms/8px, `:122-157`) | **維持・流用**。タップの意味だけ変更(メニュー即開→シート開) |
| dnd-kit 配線(`Playmat.tsx:291-295`) | 維持(デスクトップ第一)。D2 で GameScreen に移植。全DnD操作にシート代替必須 |
| `dialogs.tsx` 16種 | guided resolution 系は当面流用(D3 でシート様式へ再皮膜)。Attack/Token 等は ≡ メニュー配下に残す |
| `useShortcuts` キーバインド | 維持(デスクトップ)。PrimaryAction と同じ selector を叩く |
| `GameLog` データ | フィードの投影元として維持(表示コンポーネントのみ退役) |
| PWA meta/safe-area(`index.html`) | 維持。D2 で `viewport-fit=cover`+`env(safe-area-inset-*)` を thumb zone に適用 |

## 6. リスクと決め

- **性能**: フィード合成は memo 化した selector で(毎レンダ全ログ走査をしない)。カードグリッドは既存同様 CSS transform のみで tap 回転。
- **`data-testid` は維持**(`zone-*`/`card-*`/`next-phase` 等)。review.* とブラウザ自動操作の互換を守る。新設要素にも同規約で付与(`primary-action`/`card-sheet`/`feed` 等)。
- **土地圧縮の同名束ね**は「同名の基本地形のみ」(Snow-Covered は別束。特殊地形は個別)。束の中の個別操作(1枚だけ生け贄等)は束シート内の一覧から可能にする=情報の非破壊。
- **undo 文言**: フィードは投影ゆえ undo 後の履歴表示が巻き戻る。「操作の記録が消える」ことへの違和感は、undo 実行時にフィードへ「◀ 直前の操作を取り消した」項目を挿入して緩和(gameStore は触らず view 層で)。
