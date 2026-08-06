# Re-Audit Brief: fix-fetch-saga-false-positive F1 閉塞 (2026-08-06)

あなたは冷監査者(cold auditor)です。実装文脈を持たず、**ファイルを編集しない**。
`.claude/audit-standing.md` に従い、凍結成果物を敵対的に監査して findings だけを返す。
フル check(`npm run check`)は実行しない。対象ドメインの review/敵対証拠のみ走らせる。

## 経緯

初回監査(Boyle)は BLOCKER 0 / HIGH 1 で終了した。
- **F1 — HIGH / implementation**: `FETCH_TARGET_PATTERN` の `[^,]+?` がカンマで止まるため、
  「a basic Forest, Plains, or Island card」型(Panorama/Landscape/Hideout サイクル約20枚)が
  null に退化。判定者の判定者有界外科修正で閉塞。
- F2 — LOW(既存・範囲外): 非土地 Saga の土地対象フェッチ章は新旧とも検出。store 側の
  消費経路(`isFetchAbilityStackItem`/`fetchDialogForTop`)に型行ガードがない点は残存するが、
  本変更による悪化ではない。台帳 note として記録予定。
- F3 — LOW(契約準拠): shuffle が別文にある Evamar 型は null。pinned corpus に該当カードなし。

## 監査対象(再凍結候補tree)

- 候補コミット: `5b91354`(前候補 `9a01f64`、契約ベース `5379ffb`)。
- 再監査スコープ差分 = `git diff 9a01f64..5b91354`(status.ts の capture window 1行 + R4 pin 追加のみ)。
- 契約: `docs/engine-spec.md` §11.1(2026-08-06 スコープ追記込み)。

## 主張(修正側が言うこと)

1. `FETCH_TARGET_PATTERN` を `/search your library for (.+?) cards?\b/i` へ変更。
   capture window は最初の " card(s)" 終端子まで走り、カンマで止まらない。
   Panorama 型の「a basic Forest, Plains, or Island card」が window 内に収まる。
2. `isFetchTargetClause` は変更なし: window 内に `land` または基本土地サブタイプ語
   (`Plains|Island|Swamp|Mountain|Forest`)を含むときのみ土地。
3. ウルザの物語の artifact search は相変わらず null。
4. 新 review pin R4 が Panorama 型を固定(42/42 緑)。

## 監査で走らせる証拠(この範囲のみ)

1. `CI=1 npx vitest run src/store/__tests__/review.m415-saga-false-positive.test.ts --reporter=verbose`(R1-R4 全緑)
2. `CI=1 npx vitest run src/store/__tests__/review.m415.test.ts src/store/__tests__/review.cr701-fabled-passage-untap.test.ts src/store/__tests__/cr701LibrarySearchGuided.test.ts src/components/game/__tests__/review.d1-action-catalog.test.ts src/engine/__tests__/m428.test.ts src/engine/__tests__/m430.test.ts --reporter=dot`
3. weakening 検出: `git diff 9a01f64..5b91354` に既存テストの緩和・skip 化が含まれないことを確認(R4 は追加のみ)。
4. 敵対ケース(`fetchAbility` を直接確認。一時ファイルは作らない):
   - Panorama 型(上記 R4 fixture)→ 検出(subtypes Forest/Island/Plains・tapped・lifeCost 0)
   - ウルザの物語 → null
   - 「Search your library for an artifact card with mana cost {0} or {1}, put it onto the battlefield, then shuffle」のみ → null
   - 「Search your library for a Forest or a Plains card, put it onto the battlefield, then shuffle」→ 検出
   - 「Search your library for a creature card, put it onto the battlefield, then shuffle」→ null(土地でない)
5. pinned corpus(`research/scryfall-rules/2026-06-19/`)で `search your library for` を含む土地カードを
   スポットチェック(旧挙動で検出され新挙動で null に退化するカードが他に無いか。Panorama 系以外)。

## findings の書き方

各 finding に深刻度(BLOCKER/HIGH/MEDIUM/LOW)+ 分類 + 証拠を付ける。
BLOCKER/HIGH=0 なら `AUDIT-OK-PENDING-FULL-CHECK` と明記。
