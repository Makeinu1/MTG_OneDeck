# feel-2 silent-skip honesty — 契約(2026-08-05 判定者承認)

正本 = `docs/engine-spec.md` §34.55(本ファイルは参照ミラー・差分時は正本が勝つ)。

## 背景(判定者 probe 実測 2026-08-05・base 2702113)

1. guided 解決の**全件**で「効果には自動化未対応部分があります。一部手動で処理してください。」が出る。
   合法に全 prompt へ回答しても出る(`Destroy target creature` の対象選択成功時・up-to-one のゼロ選択時・
   variableLoot のゼロ捨て確定時のいずれも実測済み)= 警告ノイズ化。北極星② fake-green 禁止に抵触。
2. up-to-N のゼロ選択は CR 115.6 で合法だが、現行は「キャンセル」ボタンだけがその意味を担う=放棄に見える
   (feel-1 F3 繰入・2026-08-05 判定者裁定)。
3. 同一 item に manual 行が複数あると同一警告が重複する(実測 2 件)。

## 範囲

- `resolveStackTop` への optional payload `guidedHandled?: boolean` 追加(§5.1 判定済み: 既存 primitive で
  表現不能=解決コマンド生成時点で「全 prompt 合法回答済み」の意味を載せる手段が他にない。GameState 不変)。
- エンジン: guidedHandled 解決時の guided 行 generic remainder 警告抑制 + 同 item 内警告重複排除。
- store: `abandonedRequiredPrompt` sticky フラグ・`cancelGuidedPrompt` の合法性分類・新アクション
  `confirmGuidedZeroChoice`・`finishGuidedResolution` の payload 付与。
- UI: DecisionBar の明示ゼロ選択確定ボタン(`guided-zero-confirm`)。target minCount 0 →「対象を選ばない」、
  variableLoot →「捨てるのをやめる」。cancel は既存合法意味のまま残す(置換しない)。

## スコープ外

- grammar/compiler の decision 変更(decision-snapshot byte 一致が回帰床)。
- auto 行の節無マッチ silent drop(`grammar-auto-clause-coverage` = engine-spec §34.54.3 管轄)。
- 非 target prompt の CR 608.2c 順序(`feel-runtime-clause-order` 管轄)。
- GameState/CACHE_SCHEMA_VERSION 変更なし。新 dialog なし(Decision Focus を使う)。

## 証拠

- review pin(判定者専有・現状 red): `src/store/__tests__/review.feel-2-silent-skip-honesty.test.ts`(R1-R8)、
  `src/components/game/__tests__/review.feel-2-zero-choice-ui.test.tsx`(4件)。
- 無改変回帰床: `review.cr121-loot-variable-count`・`review.s4-decision-bar`・`review.cr608-resolution-sliceA/B`・
  decision-snapshot byte 一致・census 行数不変。
- UI 受け入れ: 375×812 / 812×375 / 1440×900 実機 + console error 0(安定後の同一 session)。
