# Implementer Brief: feel-2 silent-skip honesty (2026-08-05)

あなたは実装者です。判定者所有物(`review.*`テスト・`docs/`・台帳)とgitを触らないこと。
落ちたら実装を直すこと。報告=変更ファイル・受け入れ結果・defer・未解決点。

## Milestone

- id: `feel-2-silent-skip-honesty` / base SHA: `BASE_SHA`(judge freeze commit of contract+brief+review pin)
- 契約: `research/cr-grounding/archive/feel-2-silent-skip-honesty/contract.md`(先に完全に読む)と
  `docs/engine-spec.md` §34.55(正本)。
- review pin(変更禁止・現状 red):
  - `src/store/__tests__/review.feel-2-silent-skip-honesty.test.ts`(R1-R8。8 red / 1 green。R3 は
    「required 放棄の警告維持」回帰 pin で現状緑を**維持**する)
  - `src/components/game/__tests__/review.feel-2-zero-choice-ui.test.tsx`(4件。3 red / 1 green)
- CR正本: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19版)。115.6(up-to のゼロ選択合法)、
  608.2h(解決時情報固定・variableLoot の実捨札数)、101.3(不可能部分の無視)。

## やること(4つの実装項目)

対象ファイルは `src/engine/commands.ts`・`src/store/gameStore.ts`・`src/components/game/DecisionBar.tsx`
(必要なら `src/components/game/decisionFocus.ts`・`gameController.tsx` の配線のみ)。
grammar/compiler(`src/engine/grammar/`)の変更禁止。GameState フィールド追加禁止。

1. **`resolveStackTop` への optional payload**: `GameCommand` の resolveStackTop に
   `guidedHandled?: boolean` を追加(types 定義は commands.ts 内)。`applyResolveStackTop` から
   `applyCompiledEffectsForStackItem` へ threading する。
2. **エンジンの警告誠実化**(§34.55.2):
   - `guidedHandled === true` の解決では、`guided` decision 行に対する汎用 manual remainder 警告
     (「自動化未対応部分があります。一部手動で処理してください。」)を出さない。manual decision 行・
     遅延誘発 partial 警告・counter-scaled・保存済み対象経路は不変。
   - 同一 `applyCompiledEffectsForStackItem` 呼び出し内の**同一テキスト**の manual remainder 警告は
     重複排除(1 item 1 回)。
   - `guidedHandled` が false/undefined のときは現行どおり。
3. **store の合法性分類**(§34.55.1/§34.55.3):
   - `PendingGuidedResolution` に `abandonedRequiredPrompt?: boolean`(sticky)追加。
   - `cancelGuidedPrompt`: 現行の variableLoot 捨て止め分岐と activation/mana-ability 分岐は維持。
     それ以外で `pending.prompts[0]` の `minCount ?? count >= 1` の prompt を放棄したときだけ
     `abandonedRequiredPrompt: true` を付与して `advanceGuidedResolution([])`(minCount 0 の cancel は
     合法ゼロ選択として false のまま)。variableLoot の cancel は捨て止め=合法なので false。
   - 新アクション `confirmGuidedZeroChoice()` を store API に追加:
     - target prompt かつ `minCount === 0` → `advanceGuidedResolution([])`(ゼロ選択確定)。
     - variableLoot prompt → cancel の variableLoot 分岐と同一の捨て止め最終化(実捨札数ドロー)。
     - それ以外(required prompt 等)→ no-op(fail-closed)。
   - `finishGuidedResolution` は解決コマンドを
     `{ type: 'resolveStackTop', to, guidedHandled: !pending.abandonedRequiredPrompt }` にする。
     activation/mana-ability pending 経路・counter 経路など guided 解決以外の既存挙動は触らない。
4. **DecisionBar のゼロ選択 affordance**(§34.55.3):
   - `store.pendingGuided?.prompts[0]` が (a) target かつ `minCount === 0` のとき
     ラベル「対象を選ばない」、(b) variableLoot discard のときラベル「捨てるのをやめる」の
     確定ボタンを `data-testid="guided-zero-confirm"` で描画し `store.confirmGuidedZeroChoice()` を呼ぶ。
   - 既存の cancel ボタン・count 表示・warning 表示・teamwork 表示は変更しない
     (`review.s4-decision-bar` が回帰床)。

## 禁止事項(fail-closed規律)

- review.* テスト・`docs/`・台帳・git を触らない。落ちたら実装を直す。
- grammar decision の変更禁止: `research/grammar-compile/decision-snapshot.json` は byte 一致が回帰床。
- `review.cr121-loot-variable-count` の cancel 意味(捨て止め)を変更しない。
- required prompt のゼロ選択を合法化しない(R8 fail-closed)。
- `any` 禁止・TypeScript strict・コメントは英語・ログ/UI文言は日本語。
- 新 dialog・新 GameCommand・GameState フィールド追加は禁止(契約は payload 拡張のみ)。

## 反復テスト

`CI=1 npx vitest run src/store/__tests__/review.feel-2-silent-skip-honesty.test.ts src/components/game/__tests__/review.feel-2-zero-choice-ui.test.tsx --reporter=dot`

全緑になったら周辺回帰として次を1回だけ回す:

`CI=1 npx vitest run src/store/__tests__/review.cr121-loot-variable-count.test.ts src/components/game/__tests__/review.s4-decision-bar.test.tsx src/engine/__tests__/review.cr608-resolution-sliceA.test.ts src/engine/__tests__/review.cr608-resolution-sliceB.test.ts src/engine/grammar/__tests__/decisionSnapshot.test.ts --reporter=dot`

フル check(`npm run check`)は実行しない(判定者が凍結後にやる)。

## 完了報告の形式

変更ファイル一覧・各項目の対応内容・defer(触らなかったもの)・未解決点・vitest結果の実出力貼り付け。
