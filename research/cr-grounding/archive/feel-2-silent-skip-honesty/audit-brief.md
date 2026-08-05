# Cold Audit Brief: feel-2 silent-skip honesty (2026-08-05)

あなたは冷監査者(cold auditor)です。実装文脈を持たず、**ファイルを編集しない**。
`.claude/audit-standing.md` に従い、凍結成果物を敵対的に監査して findings だけを返す。
フル check(`npm run check`)は実行しない。対象ドメインの review/敵対証拠のみ走らせる。

## 監査対象(凍結候補tree)

- 候補コミット: `2c07351`(ベース `53a3432`)。差分 = `git diff 53a3432..2c07351`。
- tree hash: `782e88379342e933da3b4a7c0ff64803e0bf6cc1`。release fingerprint:
  `428456240675d7875f96d032ee820b78664a1dc1e4772f944e43a46d86d582ef`。
- 変更ファイル(ソース6件+ブリーフ1件): `src/engine/commands.ts`、`src/store/gameStore.ts`、
  `src/components/game/DecisionBar.tsx`・`decisionFocus.ts`・`game.css`・`gameController.tsx`、
  `research/cr-grounding/archive/feel-2-silent-skip-honesty/implementer-brief.md`。
- 契約正本: `docs/engine-spec.md` §34.55(ミラー: 本ディレクトリ `contract.md`)。
- CR根拠: 115.6(up-toゼロ選択合法)・608.2h(誠実実行・捨て止め最終化)・101.3(任意効果)。

## 主張(実装側が言うこと)

1. `resolveStackTop` に optional payload `guidedHandled?: boolean` を追加。guided plan の全 prompt に
   合法回答したときだけ `true`。生エンジン呼び出し(未指定)の挙動は完全不変。GameState 不変。
2. `guidedHandled === true` の解決では `guided` decision 行への汎用 manual remainder 警告を抑制。
   `manual` decision 行の警告は維持し、同一 item 内で重複排除(1 item 最大1回)。
3. `guidedHandled` が false/undefined のときは旧挙動どおり警告(required prompt 放棄の誠実シグナル維持)。
4. store: `cancelGuidedPrompt` は `variableLoot` 無し かつ `minCount ?? count >= 1` の prompt 放棄のみ
   `abandonedRequiredPrompt: true`(sticky)を設定。minCount 0 / variableLoot の cancel は abandonment ではない。
5. `finishGuidedResolution` は stack 解決 pending にのみ `guidedHandled: !abandonedRequiredPrompt` を付与。
   activation / mana-ability pending は pre-feel-2 のコマンド形状を維持。
6. 新アクション `confirmGuidedZeroChoice()`: target minCount 0 → 空選択で advance(CR 115.6)。
   variableLoot → 捨て止め最終化(cancel の variableLoot 分岐と同一意味: 実際に捨てた枚数+delta を引く、
   CR 608.2h・CR 121.2 の playerId 含む)。required prompt・activation/mana-ability pending → no-op(fail-closed)。
7. UI: `zeroChoice` affordance(`data-testid="guided-zero-confirm"`)は guided stack 解決中のみ表示。
   target minCount 0 →「対象を選ばない」、variableLoot →「捨てるのをやめる」。cancel は置換されず併存。
   判定者実機検証済み: 375×812(target/loot)、812×375(両方)、1440×900(両方)、全件 console error 0。
8. grammar/compiler・decision-snapshot・census・GameState・CACHE_SCHEMA_VERSION 一切不変。

## 監査で走らせる証拠(この範囲のみ)

1. `CI=1 npx vitest run src/store/__tests__/review.feel-2-silent-skip-honesty.test.ts --reporter=verbose`(R1-R8)
2. `CI=1 npx vitest run src/components/game/__tests__/review.feel-2-zero-choice-ui.test.tsx --reporter=verbose`(4件)
3. 回帰床: `CI=1 npx vitest run src/store/__tests__/review.cr121-loot-variable-count.test.ts src/components/game/__tests__/review.s4-decision-bar.test.tsx --reporter=dot`
   および `CI=1 npx vitest run src/engine/__tests__/review.cr608-resolution-sliceA.test.ts src/engine/__tests__/review.cr608-resolution-sliceB.test.ts --reporter=dot`
4. `git diff --name-only 53a3432..2c07351` に `src/engine/grammar/`・`research/grammar-compile/` が無いことを確認
   (decision 不変の機械証拠)。
5. エンジン純粋性: `src/engine/commands.ts` の差分に React/DOM/Zustand 依存の導入が無いことを確認。
6. 敵対ケース(自分で fixture を作って確認。store テストは `src/store/__tests__/` の既存ヘルパー、
   エンジン直叩きは `src/engine/__tests__/helpers` を参考に一時ファイルは作らず vitest `-t` 不可なら読み取り検証で可):
   - guidedHandled=true で guided 行のみ → 警告0件。guided+manual 混在 → 警告1件(manual 由来)。
   - manual 行2本 + guidedHandled=true → 警告1件(重複排除)。
   - guidedHandled=undefined(生呼び出し)→ 旧挙動: guided 行でも警告が出る。
   - required prompt(minCount ?? count >= 1)を cancel して finish → guidedHandled=false 相当で警告維持。
   - minCount 0 prompt を cancel して finish → 警告なし(abandonment ではない)。
   - `confirmGuidedZeroChoice()` を required prompt / activation pending / mana-ability pending で呼ぶ → 全て no-op。
   - variableLoot(max ≥ 3)で 2枚捨て→zero-confirm → ちょうど2枚引く(playerId は prompt controller)。
     (max=2 は2枚目で reachedMax 自動最終化のため zero-confirm 到達は max≥3 の場合のみ — Aristotle F3 補足)
7. UI wiring 読み取り検証: `zeroChoice` が `guidedIsStackResolution`(mode undefined|'resolution')かつ
   該当 prompt 種別のときのみ付くこと。teamwork/cast/activation フォーカスに漏れないこと。

## findings の書き方

各 finding に深刻度(BLOCKER/HIGH/MEDIUM/LOW)+ 分類(implementation/contract/ambiguity)+
証拠(再現手順・ファイル行)を付ける。BLOCKER/HIGH=0 なら `AUDIT-OK-PENDING-FULL-CHECK` と明記。
## 追記(2026-08-05 判定者裁定)

- 冷監査 Aristotle(019fd278)の結果: BLOCKER=0 / HIGH=0 → `AUDIT-OK-PENDING-FULL-CHECK`。
- F1(MEDIUM・contract/ambiguity)は option (a) で裁定: manual remainder 警告の重複排除は全経路で
  無条件に適用する実装を追認(「重複警告 実測 2 件」の問題意識は guided/raw を問わず成立)。
  §34.55.1 に carve-out を追記し「完全不変」→「重複排除を除き不変」へ修正。コード変更なし。
- F2(LOW)=本ブリーフ §3 の cr121 pin パス記載誤り(正しくは `src/store/__tests__/`。上に修正済み)。
- F3(LOW)=variableLoot zero-confirm 到達条件の補足(上に追記済み)。欠陥なし。
