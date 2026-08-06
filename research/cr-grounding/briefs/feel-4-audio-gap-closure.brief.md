# feel-4拡張「音の空白閉塞」— 実装者ブリーフ

- milestone: `feel-4-audio-gap-closure`
- base SHA: `d8c1973`（main clean）
- 契約正本: `docs/audio-visual-contract.md`（**revision 2026-08-07 適用済み**。§2/§2.1/§3.1を必ず読む）
- 台帳: feel-4-av7-production-integration（boundary改訂済み）
- 役割: あなたは実装者。git操作禁止。`review.*`テスト変更禁止。`docs/`・台帳・`AGENTS.md`変更禁止。

## Goal

ユーザー裁定(2026-08-07)に基づく音の空白を閉じる。既存AV7配線(presentationRuntime → SemanticPresentationLayer → sfxRenderer)を拡張し、新しい発火経路を追加する。

1. **ターンまたぎ無音の修正(バグ)**: `advancePhase()`経由でcleanupを越えてターンが進んだとき`turn-advanced`が発火していなかった。経路を問わずターン番号が増加した成功commitで一件だけ発火する。
2. **draw-step自動ドロー音**: ターン進行の自動ドローで`draw-completed`一件(既存cueを再利用、枚数増幅なし)。
3. **フェイズtick**: 新イベント`phase-advanced`(ターンが変わらずフェイズだけ進んだ成功commit)。新sample `phase-tick.wav`。
4. **マリガン=shuffle**: マリガン確定で既存`shuffle-completed`を発火。
5. **キープ=新確定音**: 新イベント`hand-kept`+新sample `keep-confirm.wav`。キープ確定(初手決定)で一件。

## 判定済みエンジン事実（再調査不要）

- `store.nextPhase()`は`dispatchTurnTransition`を経由。`autoAdvanceToMain`がtrue(既定)かつphaseが`end`なら、1クリックで`[nextPhase, nextPhase, nextPhase, nextPhase]`相当を1commitし、結果は次ターンの`main1`(cleanup越えで`finishTurnAfterCleanup`がturnを加算しdraw-stepで1枚引く)。
- `store.nextTurn()`も`dispatchTurnTransition`経由でターンを進める(既存`advanceTurn()`が`publishTurnAdvance`を発火済み。auto-advanceで手札が増えるケースもカバーする)。
- `store.mulligan()`は`applyCommands([mulligan, draw 7])`の1commit。手札枚数は7→7で不変だが`mulliganCount`が増える。
- `store.keepOpeningHand()`は`mulliganDecisionPending:false`のみ設定するUI状態遷移(GameState commitなし)。契約上「キープ確定」は初手決定の成功とみなす。
- `store.beginFirstTurn()`はhistoryをresetする。ゲーム開始演出はDEFERのため**無音のまま**(publishしない)。
- draw-stepのドローはeventLog上で`commandCause('nextPhase')`。ただし発火根拠はUIログ解析禁止ルールどおり、controllerのbefore/after状態差分を使うこと。

## 実装仕様

### 1. presentationEvents.ts(純粋投影)

- `PresentationProjectionInput`に追加:
  - `{ action: 'advance-phase'; status; previousPhase: Phase相当のstring; nextPhase: string; turnChanged: boolean }` → `turnChanged`またはstatus!==committedならnull、フェイズ未変化もnull、それ以外は`{ kind: 'phase-advanced' }`。
  - `{ action: 'keep-hand'; status }` → committedなら`{ kind: 'hand-kept' }`。
- `PresentationEvent` unionに`PhaseAdvancedEvent { kind: 'phase-advanced' }`と`HandKeptEvent { kind: 'hand-kept' }`を追加。
- 既存kindの挙動は変えない(`advance-turn`のturn比較ガード含む)。

### 2. gameController.tsx(発火chokepoint)

ヘルパ`publishTransitionPresentation(before: GameState | null)`を追加。実行後の`useGameStore.getState().state`と比較し:

1. before/afterがnull → 何もしない。
2. `after.turn > before.turn` → `advance-turn`を一件publish(既存publishTurnAdvanceを呼ぶ)。
3. それ以外で`after.phase !== before.phase` → `advance-phase`を一件publish(turnChanged=false)。
4. ターン増加の有無に関係なく、`after.zones.hand.length > before.zones.hand.length`なら差分枚数で`draw`を一件publish(自動ドロー音)。手札が減った場合は発火しない。

適用箇所:

- `advancePhase()`: before取得→`store.nextPhase()`→ヘルパ(自動ドロー検出含む)。
- `advanceTurn()`: 既存の直接publishをヘルパへ置換(turn-advanced+必要ならdraw。二重発火禁止)。
- `runPrimaryAction`の`manual-resolution`分岐: `completeManualResolution()`の前後でヘルパ(解決一掃後の自動ターン進行カバー)。
- `requestResolveTop`/`requestResolveAll`のstore呼出し前後でもヘルパ(cleanup解決完了でターンが越えるケース)。ただし`resolve-stack`イベントの既存集約(`beginResolvePresentation`/`settlePendingResolvePresentation`)を壊さない。ヘルパはturn/phase/drawのみ担当。
- `beginFirstTurn()`: **発火しない**(DEFER維持)。

マリガン/キープ:

- `requestMulligan()`を追加: before取得→`store.mulligan()`→`before !== useGameStore.getState().state`(成功commitは新オブジェクト)なら`shuffle-library`をcommitted publish。MulliganStageの`onMulligan`をこれへ変更。
- `requestKeepHand()`を追加: `store.keepOpeningHand()`後に`keep-hand`をcommitted publish。MulliganStageの`onKeep`は既存bottom分岐ロジックを維持したまま、先頭で`keep-hand`publish(キープ決定はbottom選択より前に確定するため一件のみ)。

### 3. sfxManifest.ts

- `SfxKind`へ`'phase-advanced'`と`'hand-kept'`を追加(`ALL_SFX_KINDS`にも)。
- `FIXED_LAYERS`へ:
  - `phase-advanced`: `phase-tick.wav -8.20`、chokeGroup `phase-tick`
  - `hand-kept`: `keep-confirm.wav -6.00`、chokeGroup `hand-kept`

### 4. 新sample生成スクリプト(決定論・project-original)

`scripts/generate-av7-phase-tick.mjs`と`scripts/generate-av7-keep-confirm.mjs`を新規作成。`scripts/generate-av7-low-thud.mjs`を雛形に:

- 48kHz・2ch・PCM16 WAVを`public/audio/sfx/`へ出力。
- 長さ1秒以内。true peak -3dBFS以下(振幅0.7以下推奨)。両端2ms fade。
- 固定数式のみ(乱数・外部音源・依存追加禁止)。
- `phase-tick`: dryで非常に小さい区切り音。turn-chipより明確に小さい知覚(高めの短いチップ+急減衰。例: 600Hz→400Hz程度の短いchip、peak 0.1前後)。
- `keep-confirm`: dryで小さい確定音。例: 二つの短いトーン(決定の感じ)、peak 0.2前後。
- 生成したWAVはcommit対象。`public/audio/sfx/LICENSE.txt`のproject-originalリストへ`phase-tick.wav, keep-confirm.wav`を追記。

### 5. SemanticPresentationLayer.tsx

- 新kindの視覚は**追加しない**(契約: phase-advanced/hand-keptは視覚なし)。
- 音の経路は既存のgeneric `scheduleSfx(event.kind, ...)`で自動的に乗る(SfxKind拡張で型が通る)。`tap-changed`以外の分岐追加は不要。commander-castの早期return維持。

## やらないこと(STOP)

- 入力イベントの直接発火(クリック音等)。あくまで成功commitの意味音。
- ライトテーマでの発音(policyは既存`eventsAudible`判定を維持)。
- BGM duck・新規視覚・新規依存・GameState/store公開API変更。
- `phase-advanced`/`hand-kept`以外の新kind追加。
- 既存レビューテストの改変。落ちたら実装を直す。

## 検証(実装者が回す対象テスト)

- `npx vitest run src/components/game/presentation/presentationRuntime.test.ts src/components/game/presentation/__tests__ src/components/game/__tests__/review.av7-production-events-runtime.test.tsx src/components/game/__tests__/review.av7b-audio-gap-closure-runtime.test.tsx`(新reviewは判定者所有・変更禁止)
- `npx vitest run src/components/game/presentation/semanticSound.test.ts`
- sfx manifest系: `rg`で`ALL_SFX_KINDS`/`FIXED_LAYERS`の網羅を確認し、型エラーがないこと(`tsc -b`はフルcheck時まで不要。ただし`npx tsc -b`を1回だけ回して型確認してよい)。

## 報告形式

変更ファイル一覧・受け入れ結果(テスト名と件数)・生成assetの仕様値(長さ/peak/波形概要)・defer・未解決点。

