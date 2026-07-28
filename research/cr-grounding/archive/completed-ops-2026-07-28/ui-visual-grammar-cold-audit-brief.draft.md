# 冷監査ブリーフ: UI視覚文法改修(S0〜S5)

**監査対象**: 2026-07-25 実装の UI視覚文法改修。claimed status = `implemented-not-audited`(実装+判定者review緑・冷監査未)。

**2026-07-26 出荷前補正**: 375×812 の実機確認で、折りたたみ時の `⋯` が
30×30px、メニュー右端が viewport を10px超えることを検出した。現在の凍結差分は
`⋯` を `--touch-target` (44×44px)へ拡大し、メニューをトリガー右端基準で左へ
展開し、カード面から重複する `role="button"` / `tabIndex` を除いたと主張する。
さらに、パイルが盤面を覆う問題に対して「盤面」→最小の「スタック N」復帰タブ
→元の折り畳み/展開状態へ戻る可逆な board-peek 導線を追加したと主張する。
この補正を含む現在の `HEAD` + working tree 全体を監査対象とする。

**2026-07-26 初回冷監査後の境界訂正**: 初回監査はS0の返済済みコントラストを
未返済とする文書のstale、S2走査の `store/` 全除外、S3の誤ったstatus主張を検出した。
現凍結差分は、S0文書を現行化し、警告文から禁止表現を除去して `store/` も走査対象へ
戻したと主張する。またS3は、X値は唱える／起動する手順で確定する(CR 601.2b /
602.2b)、必須のmanual resolution完了は隠すべきでない、という境界へ訂正した。

## あなたの役割
あなたは**冷監査者(cold auditor)**。実装文脈を持たない別主体として、以下のstatus主張を**敵対的に検証**せよ。「shipped相当か確認して」ではない。主張の誤り・境界のstale・evidenceの借用を見つけることが仕事である。

**制約**: ファイルの編集禁止。**findings only**。契約・盤面を変えない。CR参照は `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19版)。

## 検証すべきstatus主張

今回の改修は「説明UI(操作を文章で言い直すテキスト)を削減し、位置・光・動きで伝える」もの。対象スライス:
- **S0** テーマparity基礎: `src/ui/tokens.css` のライトテーマコントラスト修正(action-primary≥7:1, text-dim≥4.5:1, warn≥4.5:1, stack-glow ライトoverride追加)。ダーク値は不変のはず。
- **S1** スタックパイル化: `src/components/game/StackBand.tsx` を中央ワークスペース→盤面右中央のカードパイルへ。scrim廃止・「対応を追加」廃止・インライン解決ボタン廃止・手動操作を⋯へ格納。
- **S2** 説明文廃止: `Board.tsx`/`LandRow.tsx`/`SupportRow.tsx` の `.semantic-drop` テキスト削除。「土地をプレイ」「唱える → スタック」「盤面へ移動して〜」等の禁止文字列が製品ソースに残留しない。
- **S3** 非常口の⋯格納: スタック項目の⋯メニューに、任意の手動補正である対象記録と手動打ち消し／能力除去を格納。X値はCR 601.2b / 602.2bに従い唱える／起動する時点で確定し、スタック上の変更操作は設けない。進行に必須の手動処理完了は例外パネルへ表示し、⋯へ隠さない。
- **S4** DecisionBar最小化: `DecisionBar.tsx` がinstructionを視覚テキストとして描画しない(aria-label専用)。カウント+キャンセルのみ。
- **S5** StatusBand/PrimaryAction短縮: 「現在：」削除・「計」数字のみ・「源N」削除・compactラベル短縮(解決/誘発/攻撃/スキップ/戦闘/完了)。

## 監査手順

1. **テスト実行**: 以下を個別に実行し、緑であることを確認:
   - `npx vitest run src/ui/__tests__/review.s0-contrast.test.ts`
   - `npx vitest run src/ui/__tests__/review.s2-forbidden-strings.test.ts`
   - `npx vitest run src/components/game/__tests__/review.s1-stack-pile.test.tsx`
   - `npx vitest run src/components/game/__tests__/review.s4-decision-bar.test.tsx`
   - `npx vitest run src/components/game/__tests__/review.s5-compact-labels.test.ts`
2. **boundary検証**:
   - `git diff` で `src/ui/tokens.css` のダーク(`:root`)ブロックが変更されていないことを確認(S0の境界)。
   - `src/components/game/game.css` に生hex/rgbが追加されていないことを確認(`npx vitest run src/ui/__tests__/review.css-token-guard.test.ts`)。
   - 禁止文字列が `src/` の製品ソース(aria-label・review.*・actionCatalog.ts・dev/ 以外)に残留していないことを `rg` で独立確認(review.s2 の再検証)。
3. **spot-check**:
   - `StackBand.tsx` を読み、scrim(`stack-workspace__backdrop`)・「対応を追加」(`stack-band-respond`)・「上から解決」(`stack-band-resolve-top`)・「全解決」(`stack-band-resolve-all`)・「閉じる」(`stack-workspace__close`)が**実際に削除されている**ことを確認(テストは存在しないことしか見ないが、削除漏れのdead codeがないかも見る)。
   - 任意の手動補正(対象記録・手動打ち消し／能力除去)が⋯メニューから**到達可能**なままか確認。`controller.store.removeStackItem` / `setManualTargets` への配線をテストと実装の両方で確認する。
   - X値にスタック上の変更UIがないことは、CR 601.2b / 602.2bの確定タイミングと整合するか確認する。manual resolution時は必須の「完了」が⋯ではなく例外パネルに可視表示され、`completeManualResolution` へ配線されているか確認する。
   - `DecisionBar.tsx` が `focus.instruction` を視覚テキストとして描画していないことを確認。ただし `DecisionFocusModel` の型から instruction フィールドは削除されていないこと(aria-label用)。
   - `primaryActionDisplay.ts` の full ラベルが変更されていないこと(aria-labelの完全な意味が保持されている)。
4. **adversarial check**:
   - review.s1-stack-pile.test.tsx が「パイルの位置(右中央)」「最前面カードの発光」「ずらし重ね」を**検証していない**(jsdomはlayoutを見ない)ことを認識した上で、`game.css` の `.stack-pile*` ルールが実際に右中央配置・発光・重ねを表現しているかを目視で確認。テストが通っていても視覚契約が満たされていない可能性を敵対的に探れ。
   - 「全解決」機能が⋯メニュー等から**完全に失われていないか**確認(サンドボックス哲学)。もし全解決への到達経路がPrimaryAction以外に無くなっていれば、それは非常口の削除=哲学違反の可能性がある。判定材料として報告せよ。
   - 375px幅で `stack-pile__overflow-trigger` が44×44px以上となるCSSであること、
     `stack-pile__overflow-menu` が右viewport外へはみ出さない配置であること、
     `⋯` が別の `role="button"` 内へネストしないDOMであることを確認する。
   - 「盤面」でカードパイル/展開一覧が消え、最小の「スタック N」復帰タブだけが残ること。
     復帰後に board-peek 前の折り畳み/展開状態が保存されること。stack target decision
     または manual resolution 中は必要UIを隠せないこと。複数スタック時は展開一覧に
     全項目が表示され、下に積まれた項目を選択・確認できること。

## 出力形式

domain(S0〜S5)ごとに verdict: `SHIPPED-OK` / `BLOCKER` / `HIGH` / `MEDIUM` / `LOW` と、findings(根拠のファイル:行番号付き)。BLOCKER/HIGH は shipped 昇格を阻害する。

## 禁止
- 「shipped相当か確認して」等の確認バイアスを誘発する思考。status主張を**敵対的に検証**せよ。
- ファイルの編集。findings only。
