# Re-Audit Brief: feel-1 findings F1/F2/F4 closure (2026-08-05)

あなたは同一の冷監査者です。初回監査(候補 `bb268e5`)の findings F1(HIGH)/F2(MEDIUM)/F4(LOW)に対し、
判定者が外科修正を適用した。本ブリーフの目的は**影響クレームだけの再監査**。フル再監査ではない。
F3(MEDIUM)はfeel-2へ送る判定者裁定(契約: UI変更なし。ゼロ選択は cancel→advanceGuidedResolution([]) で
合法に実行される)のため本再監査の対象外。F5(LOW)は台帳記載で閉じる。

## 修正候補tree

- 修正コミット: `a8483d3`(前候補 `bb268e5`・base `8d33c97`)。
- 差分: `git diff bb268e5..a8483d3`(compile.ts ガード+語彙+条番号、review pin R12/R12b追加、
  snapshot/census再生成、契約書条番号修正)。

## F1 是正内容(検証ポイント)

1. `compileAbilityIR` の節順序ガードは **target prompt 節以降に即始コマンド節がある行だけ** manual にする。
   非 target prompt の混在(例: "Scry 2. Draw a card."・"discard a card, then draw a card.")はベース出荷済み
   挙動を維持(これは別件として台帳登録)。
2. 検証: 初回報告の 6 行(Plunge into Winter 等)が manual であること。R12/R12b が緑であること。
3. 検証: "Destroy up to one target artifact. Put a +1/+1 counter on up to one target creature." は guided 維持。
4. ガードが target 節より**前に**即始コマンド節がある形(安全)を降格していないことのスポット確認。

## F2 是正内容(検証ポイント)

`supportedNouns` に `nonartifact`/`nonenchantment` 追加。Go for the Throat / Coeurl / Haywire Mite が
guided に復帰し、filter が `excludedTypes` を持つこと。nonblack 等**色**制約は引き続き manual であること
(Shriekmaw/Bone Shredder は nonblack を含むため manual が正)。

## F4 是正内容

`115.7`→`115.6` の条番号修正が compile.ts・review pin・契約草稿・実装者ブリーフに適用済みであること。

## 走らせる証拠(この範囲のみ・フル check 禁止)

1. `CI=1 npx vitest run src/engine/__tests__/review.feel-1-guided-target.test.ts --reporter=verbose`(13件)
2. `CI=1 npx vitest run src/engine/__tests__/ src/engine/grammar/__tests__/ --reporter=dot`
3. 上記の敵対スポットケース5件程度の compileAbilityIR 確認
4. `git diff bb268e5..a8483d3 -- src/engine/grammar/compile.ts` の読み込み(ガードのスコープが target 限定か)

## 判定

F1/F2/F4 が閉じていれば `AUDIT-OK-PENDING-FULL-CHECK` を宣言。残存問題があれば深刻度+分類+証拠で報告。
ファイル編集禁止・git禁止は継続。
