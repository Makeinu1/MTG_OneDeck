# Cold Audit Brief: fix-fetch-saga-false-positive (2026-08-06)

あなたは冷監査者(cold auditor)です。実装文脈を持たず、**ファイルを編集しない**。
`.claude/audit-standing.md` に従い、凍結成果物を敵対的に監査して findings だけを返す。
フル check(`npm run check`)は実行しない。対象ドメインの review/敵対証拠のみ走らせる。

## 監査対象(凍結候補tree)

- 候補コミット: `9a01f64`(前ベース `5379ffb`)。差分 = `git diff 5379ffb..9a01f64`。
- 変更ファイル: `src/engine/status.ts` のみ(+27/-7)。純粋関数 `detectFetchClause` の修正。
- 契約: `docs/engine-spec.md` §11.1(2026-08-06 スコープ追記込み。`git show 5379ffb -- docs/engine-spec.md` で確認)。
- ユーザー報告: 「ウルザの物語が戦場に出て第一章が誘発すると土地がフェッチされる。第二章でも同じ」。
- 根因(判定者確定): 旧 `detectFetchClause` は search 対象を見ずに face 全文 join へ三断片
  ("Search your library for" + "onto the battlefield" + "shuffle")を照合。第III章の
  "Search your library for an artifact card with mana cost {0} or {1}, put it onto the battlefield,
  then shuffle" が三断片を満たし、カタログ `fetch-activate`・`resolveAll` のフェッチ停止
  (`isFetchAbilityStackItem`)・解決時 FetchSearchDialog 横取り(`fetchDialogForTop`)が
  章 I/II の誘発を含む全能力で誤発火していた。

## 主張(実装側が言うこと)

1. 照合を `splitRulesText` の**節単位**に変更。ある節がフェッチ節と見なされるのは、同一節に
   (a) `search your library for`、(b) `onto the battlefield`、(c) `shuffle` が揃い、かつ
   (d) `isFetchTargetClause` が search 対象を土地と判定したときのみ。
2. (d) の判定: `/search your library for ([^,]+?) cards?\b/i` で対象語を抽出し、`land`
   (basic land 含む)または基本土地サブタイプ語(`Plains|Island|Swamp|Mountain|Forest`)を含む
   ときのみ土地。`an artifact card with mana cost {0} or {1}` 等は非土地。
3. 検出成功時の戻り値は従来どおり **face 全文節 join**(`fetchLifeCost`/`fetchFilter`/
   `fetchConditionalUntap` が face 全体を走査するため。寓話の小道の conditional untap 句は
   別文にある既存挙動を維持)。
4. 日本語検出・`fetchEntersTapped`・`FetchAbility` インターフェース・呼び出し側(catalog/store/
   controller)・GameState/コマンド/grammar は無変更。
5. ウルザの物語(`Enchantment Land — Urza's Saga`)は `fetchAbility` が null を返す。
   実 fetch 土地(汚染された三角州/寓話の小道/進化する未開地/虹色の眺望)は従来どおり検出。

## 監査で走らせる証拠(この範囲のみ)

1. `CI=1 npx vitest run src/store/__tests__/review.m415-saga-false-positive.test.ts --reporter=verbose`
   (R1-R3 全緑。R2 は「章能力は cr-714 境界どおり manual resolution session へ落ち、
   フェッチ停止は起きない」を主張する点に注意)。
2. `CI=1 npx vitest run src/store/__tests__/review.m415.test.ts src/store/__tests__/review.cr701-fabled-passage-untap.test.ts src/store/__tests__/cr701LibrarySearchGuided.test.ts src/components/game/__tests__/review.d1-action-catalog.test.ts src/engine/__tests__/m428.test.ts src/engine/__tests__/m430.test.ts --reporter=dot`
3. `CI=1 npx vitest run src/engine/__tests__/sagaGrammar.test.ts src/engine/__tests__/sagaChapterTriggers.test.ts src/engine/__tests__/sagaSba.test.ts src/engine/__tests__/review.cr714-saga-chapter-sba.test.ts --reporter=dot`
4. weakening 検出: `git diff 5379ffb..9a01f64` にテスト変更が含まれないことを確認。
5. エンジン純粋性: `status.ts` の差分に React/DOM/Zustand 依存の導入がないことを確認。
6. 敵対ケース(自分で fixture を作って `fetchAbility` を確認。一時ファイルは作らない。
   vitest 実行が不要なら読み取り検証のみで可):
   - ウルザの物語(上記 oracle 全文・typeLine "Enchantment Land — Urza's Saga")→ null
   - 「{T}, Sacrifice this land: Search your library for a land card, put it onto the battlefield, then shuffle.」→ 検出(any-land)
   - 「{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.」→ 検出(basic・tapped)
   - 「{T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.」→ 検出(subtypes Island+Swamp・lifeCost 1)
   - 寓話の小道 → 検出(basic・tapped・untapIfControlLandsAtLeast 4)
   - 章III文だけが別カード(非土地)にある場合 → null(土地型ラインガードも確認: actionCatalog は typeLine に Land を含むときのみ fetch を出す)
   - 「Search your library for a creature card, reveal it, put it into your hand, then shuffle.」→ null(手札チュター)
   - fetch 文と無関係な search 文が同一カードに混在する架空の土地カード(fetch 節が land 対象)→ 検出
7. §11.1 契約との整合確認: 追記スコープ文言と実装挙動が一致するか(特に「同一節」「土地対象」)。

## findings の書き方

各 finding に深刻度(BLOCKER/HIGH/MEDIUM/LOW)+ 分類(implementation/contract/ambiguity)+
証拠(再現手順・ファイル行)を付ける。BLOCKER/HIGH=0 なら `AUDIT-OK-PENDING-FULL-CHECK` と明記。
