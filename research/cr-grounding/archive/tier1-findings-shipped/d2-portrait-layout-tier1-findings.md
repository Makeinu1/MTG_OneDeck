# D2 縦持ちレイアウト — Tier-1 独立監査所見

監査対象: `src/components/game/`(新設)+ `src/App.tsx`(改変)。契約 = `docs/design-system.md` §8、`docs/ui-architecture-v2.md` §2/§4、`docs/design-playbook.md` §3 D2。
監査日: 2026-07-10。

## 1. 機械4点セット

| チェック | 結果 |
|---|---|
| `npm run lint` | ✅ PASS(エラー・警告なし) |
| `npx tsc -b` | ✅ PASS |
| `npx vitest run` | ✅ PASS — 175 test files / 1522 tests 全緑 |
| `npm run build` | ✅ PASS(`dist/` 生成。500KB超チャンク警告のみ、ブロッカーではない) |

すべて緑。**機械4点は問題なし**。

## 2. Forbidden-file 整合性(要石)— クリーン

- `src/components/playmat/Playmat.tsx`: **byte-unmodified**(`git show HEAD:...` と作業ツリーの md5 が一致=`bfcc479e...`)。ロールバック経路は保全されている。
- `review.*` ファイル: 新設は `src/components/game/__tests__/review.d2-layout-model.test.ts` のみ。既存 `review.d1-action-catalog.test.ts` は無改変(HEAD からの diff 0)。
- `src/engine/**` / `src/store/**`: 変更なし(`git diff --stat` 該当なし)。UI専業スライスとして境界を守っている。
- 変更ファイル一覧: `git diff --stat` → `src/App.tsx`(+15行のみ)。新規(untracked) 16ファイル(Board/GameCard/GameScreen/HandRibbon/LandRow/LifeSheet/ManualKeywordsDialog/StackBand/StatusBand/ThumbZone/gameController/boardShelf/game.css/landRowModel/statusBandModel/review.d2-layout-model.test.ts)。**この観点は完全にクリーン**。

## 3. サンドボックス「全操作保存」— BLOCKER(重大な機能欠落)

`docs/ui-architecture-v2.md` §4 の受け入れ共通則:「旧機能の削除は『新経路で同じ操作が全て可能』を review.* が確認してから」。D2 のブリーフ(design-playbook §3 D2(a))は PrimaryAction状態機械とデスクトップ3カラムを明示的に DEFER しているが、**それ以外の HUD レベル操作の欠落については一切の乖離記録(コメント)がない**——LandRow.tsx/StatusBand.tsx/CardActionSheet.tsx には正しく「乖離記録」コメントが付与されているのと対照的。

新レイアウト(`ThumbZone.tsx` の `GameMenuSheet` + `LifeSheet.tsx`)が旧 `PlaymatHud.tsx`(`ControlRail`/`OtherActions`/`MatchControls`/ライフ詳細パネル)と比較して**到達不能**になっている操作:

| 操作 | 旧実装(到達可能) | 新実装での到達可否 |
|---|---|---|
| **統率者ダメージ追跡**(CR903.10a・21点で敗北) | `PlaymatHud.tsx:383-419` `adjustCommanderDamage` + 対戦相手追加(`addOpponent`) | ❌ `src/components/game/` 全体に `commanderDamage`/`adjustCommanderDamage`/`addOpponent` の参照なし(`gameController.tsx:616` は AttackDialog 用の読み取りのみ) |
| **毒カウンター**(感染デッキの中核) | `PlaymatHud.tsx:344-350`(`adjustCounter('poison', ...)`) | ❌ どこにも無い |
| **エネルギー / 経験カウンター** | `PlaymatHud.tsx:351-362` | ❌ どこにも無い |
| **全タップ**(`tapAllPermanents`) | `PlaymatHud.tsx:530-536`(その他の操作メニュー) | ❌ `ThumbZone.tsx` の `GameMenuSheet` は「全てアンタップ」のみ(51行目)。`tapAllPermanents` の呼び出しが `src/components/game/` に存在しない |
| **全カウンター増殖(汎用)**(`proliferateAll`) | `PlaymatHud.tsx:545-551` | ❌ `gameController.tsx:336` にはあるが、特定カードの `rule-candidate-proliferate` からのみ到達(汎用ボタンなし) |
| **ランダムに捨てる(汎用)**(`discardRandom`) | `PlaymatHud.tsx:552-558` | ❌ `gameController.tsx:927` の `countDialog` 経路はカードの `rule-candidate-discard` からのみ開ける。汎用メニュー項目なし |
| **ダイスロール(6/20面)・コイン投げ** | `PlaymatHud.tsx:566-586`(`rollDie`/`flipCoin`) | ❌ `src/components/game/` に一切参照なし |
| **自動進行(メイン1まで)トグル** | `PlaymatHud.tsx:620-625`(`autoAdvanceToMain`) | ❌ どこにも無い(新規ゲームの既定値 `true` のまま固定=変更不能) |
| **redo(やり直す)** | `PlaymatHud.tsx` `ControlRail` に専用ボタン(`store.redo()`) | ⚠️ キーボードショートカット(`gameController.tsx:186` `onRedo`)経由でのみ到達可。**タッチ操作専用の D2(縦持ち第一級)で、画面上に redo ボタンが一つも無い**——undo ボタンはある(`ThumbZone.tsx:74-83`)のに非対称 |
| **情報パネル**(ストーム数・今ターンの土地/ドロー等の読み取り専用表示) | `Playmat.tsx:1389` `InfoPanel` | ❌ `src/components/game/` に相当UIなし(実害は上記より軽微・読み取り専用) |

補足: `LifeSheet.tsx` 自体のライフ調整(自分/対戦相手)は実装されている(±1/±5 ステップは旧実装の ±1 のみより改善)。しかし `LifeSheet.tsx:19` の `opponentLabels` は `state.opponentLife` の key のみを見ており、旧 `opponentLabelsFromState`(`PlaymatHud.tsx:29-33`)が含んでいた `state.commanderDamage` の key を含めていない——この副次的な不整合は上記「統率者ダメージ機能自体が丸ごと無い」問題に包含される。

**影響**: `VITE_UI_V2_LAYOUT` は既定で ON(`App.tsx:22`)。つまり**新規にこのアプリを開く全ユーザーの既定 UI で、感染カウンター管理・統率者ダメージ21点の追跡・ダイス/コイン・全タップ等の EDH の中核操作に到達できない**。ロールバック(`VITE_UI_V2_LAYOUT=false`)でのみ復旧する。`review.d2-layout-model.test.ts` はこれらの欠落を一切検出しない(対象が純関数3本のみのため)。

## 4. handlerFor ↔ actionCatalog id 突合 — HIGH(1件の誤配線)

`actionCatalog.ts` の `buildCardActionCatalog` が生成しうる全 id を列挙し、`gameController.tsx` の `handlerFor`(380-473行)と突合した。

**結論**: id の網羅性そのものは保たれている(`cast-cost-advisory` を除く全 id が `handlerFor` の prefix 分岐 or `switch` にヒットし、`default: () => undefined` に落ちない)。しかし **1件、間違ったストアメソッドに配線されている**:

### HIGH — battlefield の「コピー(トークン)」が誤って `copyStackItem` を呼ぶ

- `actionCatalog.ts:219`: 戦場パーマネントに対し `{ id: 'copy-permanent', label: 'コピー(トークン)', testId: 'copy-permanent' }` を push。
- 期待される挙動(旧 `Playmat.tsx:928-934`): `onSelect: () => store.copyPermanent(cardId)`。
- 実際の配線(`gameController.tsx:424-427`):
  ```ts
  case 'copy-permanent':
  case 'stack-copy-effect':
  case 'stack-copy-ability':
    return () => store.copyStackItem(cardId);
  ```
  battlefield の `copy-permanent` が、スタック専用の `stack-copy-effect`/`stack-copy-ability` と誤って同じ分岐に束ねられ、`store.copyPermanent(cardId)` ではなく `store.copyStackItem(cardId)` を呼ぶ。

**実害の確証**: `applyCopyStackItem`(`src/engine/commands.ts:3816-3819`)は `if (!draft.state.zones.stack.includes(cardId)) throw new EngineError(...)` — 戦場のカードは定義上 `zones.stack` に含まれないため**必ず例外を投げる**。`gameStore.ts` の `dispatch`(1205-1218行)はこれを catch して `console.error` するのみで画面はクラッシュしないが、(a) CLAUDE.md の受け入れ基準「コンソールエラー0件」に違反し、(b) 「コピー(トークン)」操作自体が完全に機能しない(何も起きない)。

再現手順: 戦場の任意の非スタックパーマネントのカードシートを開き「コピー(トークン)」を選択 → コンソールに `EngineError` ログ・盤面変化なし。

## 5. review.d2-layout-model.test.ts の質 — クリーン(タウトロジーなし)

`boardShelf.ts` / `landRowModel.ts` / `statusBandModel.ts` はいずれも純関数として実装されており、テストは実装を呼び出して境界値・実データと突合している(自己参照的な assertion は見当たらない)。

- **密度閾値**: 0/1/3/5→96px、6/7/9→84px、10/13/14/30→72px、`isBoardOverlap` は 13=false/14=true/20=true を明示的に境界テスト。`boardDensity` も 5/6/9/10/13/14 の境界を個別に確認。仕様(§8: 〜5=96/6〜9=84/10〜=72/14〜重ね)と完全一致。
- **土地束ね**: 同名基本地形3枚→1束(`cardIds` 順序保持)/異名基本地形→出現順で別束/Snow-Covered は名前が異なるため別束/特殊地形(Command Tower・Flooded Strand)は個別束/タップ数集計(2/3枚中2枚タップ→`tappedCount=2`)/1枚のみでは `isBundle=false`、2枚目で `true` 化/入力配列の非変異(JSON snapshot 比較)。すべて実装呼び出しベースで、境界(1枚→2枚の isBundle 反転)も明示的にテストされている。
- **statusBandModel**: `turn`/`phase`/`life`/`phaseLabel` が `GameState` の値と一致することを確認、ゾーン枚数チップが各 zone の実際の length と一致することを確認、`stackActive` の true/false 両方を明示的にテスト、常設チップが手/墓/追/山の4種のみである(相手ライフ行なし=vision原則7)ことを確認。

**この観点は完全にクリーン**。ただし対象が3つの純関数に限定されており、§3 で指摘した HUD 操作の消失や §4 の copy-permanent 誤配線は本テストのスコープ外(検出できない)。

## 6. ロールバックフラグ — クリーン

`src/App.tsx:21-23`:
```ts
function isV2LayoutEnabled(): boolean {
  return import.meta.env.VITE_UI_V2_LAYOUT !== 'false';
}
```
`state` がある場合、`isV2LayoutEnabled()` が true(既定・env 未設定含む)なら `<GameScreen>` へ、`'false'` 明示時のみ旧 `<Playmat>` + `<RotateNotice>` へ分岐(73-87行)。ロジックは反転しておらず、フォールバック経路も無傷。**この観点はクリーン**。

## 7. gameController.tsx の再現オーケストレーション — 概ねクリーン(§4のバグを除く)

以下を Playmat.tsx と1対1突合し、すべて一致を確認:
- back-to-import: `useGameStore.setState({ state: null, warnings: [], triggerCandidates: [], canUndo: false, canRedo: false, mulliganDecisionPending: false })` — Playmat.tsx:1791-1798 と完全一致(デッキ再インポートでなく状態クリアのみ、が正しい仕様)。
- mulligan keep: `store.keepOpeningHand()` → `freeMulliganBottomCount(count)` → 0超なら bottom dialog、そうでなければ `store.beginFirstTurn()` — Playmat.tsx:1441-1450 と完全一致。
- restart: `store.restart()` — 一致。
- crack-clue/food/blood, sacrifice-token, fetch-activate, ability-activate/trigger, loyalty-plus/minus, flip(faceIndex循環), facedown, counter-plus/minus, card-effects-auto, play-land/play-land-from-graveyard, cast-to-stack/cast-from-zone, stack-resolve-top/all, stack-move-*, stack-counter/stack-remove-ability — すべて Playmat.tsx の対応する onSelect と1対1で一致(store呼び出し・引数とも)。

唯一の相違が §4 の `copy-permanent` 誤配線。

## 8. その他

- **44px タッチターゲット**: `game.css` は `--touch-target`(44px)トークンを ThumbZone の主要ボタン・StatusBand のライフ/ゾーンチップに適用。チップ自体の見た目は26px高だが `::after` 疑似要素でヒット領域を44pxへ拡張する意図的な実装(`game.css:80-81`)。この観点は問題なし。
- **`useIsPhoneLandscape`/`MobileControlsDrawer`/`MobileZoneSwap` の未削除**: `ui-architecture-v2.md §4` の表では D2 で「消す」対象だが、`design-playbook.md §3 D2(e)` の J2 裁定(「旧Playmatはデスクトップ専用として当面残置・D4で削除」)により、旧 `Playmat.tsx` が残置される限りこれらのフックも残置が正しい——**契約上サンクション済みの逸脱であり指摘事項ではない**。
- コンソールエラー0件の実機確認(縦375px等)は本監査の範囲外(Tier-1は静的監査+機械4点。実機確認はブリーフ記載の通り判定者の実機タスク)。ただし §4 の bug は実機で踏むと確実にコンソールエラーを出すため、実機確認時に検出されるはずである。

---

## 総括(重大度順)

1. **BLOCKER** — HUD操作の大量欠落(§3): 統率者ダメージ追跡・毒/エネルギー/経験カウンター・全タップ・汎用増殖/ランダム捨て・ダイス/コイン・自動進行トグル・redoボタンが新既定UIから到達不能。乖離記録なし。EDHの中核ルール(CR903.10a)に関わるため実プレイに支障。
2. **HIGH** — `gameController.tsx:424-427` の `copy-permanent` 誤配線(§4): battlefield の「コピー(トークン)」が `store.copyPermanent` でなく `store.copyStackItem` を呼び、必ず `EngineError` で失敗する。
3. **クリーン**: 機械4点(§1)、forbidden-file整合性(§2)、handlerFor id網羅性(copy-permanent以外)、review.d2テスト品質(§5)、ロールバックフラグ(§6)、ダイアログ再現の正確性(§7)、44pxタッチターゲット。
