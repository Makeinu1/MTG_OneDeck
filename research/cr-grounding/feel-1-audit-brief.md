# Cold Audit Brief: feel-1 guided target sweep (2026-08-05)

あなたは冷監査者(cold auditor)です。実装文脈を持たず、**ファイルを編集しない**。
`.claude/audit-standing.md` に従い、凍結成果物を敵対的に監査して findings だけを返す。
フル check(`npm run check`)は実行しない。対象ドメインの review/敵対証拠のみ走らせる。

## 監査対象(凍結候補tree)

- 候補コミット: `bb268e5`(前ベース `8d33c97`)。差分 = `git diff 8d33c97..bb268e5`。
- 変更ファイル: `src/engine/grammar/compile.ts`(+約430行の文法拡張・fail-closedガード)、
  `src/engine/commands.ts`(eligibleTargets の maxManaValue 強制)、
  `src/engine/__tests__/review.grammar-guided.test.ts`(判定者所有ピン1件の裁定更新: §32.3 tapped形)、
  `research/grammar-compile/decision-snapshot.json`・census(計器再生成)、ブリーフ文書群。
- 契約: `research/cr-grounding/feel-1-guided-target-sweep.draft.md`
- CR正本: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19版)。
  根拠条: 115.1/115.2(対象合法性)・115.7(up-toゼロ選択合法)・202.3/202.3b(mv上限)・608.2h(誠実実行・推測禁止)。

## 主張(実装側が言うこと)

1. R5〜R9: up-to-one(minCount 0)・graveyard return(card noun)・Skyclave形(nonland/nontoken/opponent/mv上限)が guided 化。
2. "an opponent controls" は controller='opponent' に解決(2人・4人ゲームとも合法候補のみ提示)。
3. controller/mv 修飾は対象節の文内スコープのみ読む(トリガー条件の "you control" が filter に混入しない・降格もしない)。
4. fail-closed: TargetFilter/runtime が表現できない制約(tapped/power/toughness/keyword/サブタイプ/関係節/duration/複合節/多文)を持つ文は文全体 manual。silent drop なし。
5. uncovered-clause 判定で部分実行を禁止("Choose a color." はマナプロンプトが covered 扱いの有界例外)。
6. コーパス純効果: m→g +58 / g→m -311。g→m は全て旧guidedのfake-green(制約silent drop)是正で、判定者が全件分類済み。過剰拒否ゼロ。

## 監査で走らせる証拠(この範囲のみ)

1. `CI=1 npx vitest run src/engine/__tests__/review.feel-1-guided-target.test.ts --reporter=verbose`(11件全緑確認)
2. `CI=1 npx vitest run src/engine/__tests__/review.grammar-guided.test.ts src/engine/grammar/__tests__/ --reporter=dot`
3. `CI=1 npx vitest run src/engine/__tests__/manaWriteCompiler.test.ts --reporter=dot`
4. コーパス m→g 全件の CR 115 合法性スポットチェック(サンプル30件以上。実oracle文と出力filterを突き合わせ、非法候補を提示しうる行が無いか確認)。再現: `research/grammar-compile/corpus-extract.json.gz` と `decision-snapshot.json` の差分(実装者の手法は自由)。
5. g→m 320件の分類妥当性スポットチェック(サンプル30件以上: 降格理由が実在する表現不能制約か。旧guidedが本当に制約を落としていたか)。
6. 敵対ケース(自分で作って `compileAbilityIR` で確認): 
   - "Exile up to two target creatures." → manual(複数 up-to)
   - "Destroy target tapped creature." → manual(fail-closed)
   - "Whenever a creature you control with flying attacks, tap target creature." → guided かつ filter に controller/keyword 混入なし
   - "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle." → manual(R10 pin)
   - "Target player reveals their hand. You choose a card from it." → manual(R11 pin)
7. `eligibleTargets` の maxManaValue 強制を GameState fixture で確認(R9相当・mv超過候補の排除)。

## findings の書き方

各 finding に深刻度(BLOCKER/HIGH/MEDIUM/LOW)+ 分類(implementation/compiler/substrate/contract/ambiguity)+ 証拠(カード名・oracle文・再現手順)を付ける。BLOCKER/HIGH=0 なら `AUDIT-OK-PENDING-FULL-CHECK` と明記。
