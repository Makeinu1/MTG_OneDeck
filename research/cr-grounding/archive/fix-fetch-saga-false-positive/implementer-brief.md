# Implementer Brief: fix-fetch-saga-false-positive(2026-08-06)

あなたは実装者(implementer)です。判定者専有物(`review.*` テスト・`docs/`・台帳・`.claude/`)と git は一切触らないでください。
ベース SHA: `324a75c`。マイルストーン: `fix-fetch-saga-false-positive`。

## Goal

`fetchAbility` がウルザの物語(`Enchantment Land — Urza's Saga`)をフェッチ土地と誤検出する不具合を直す。
ユーザー報告: 「戦場に出て第一章が誘発すると土地がフェッチされる。第二章でも同じ処理が誘発される」。

## 根因(判定者確定済み)

`src/engine/status.ts` の `detectFetchClause` が、**search の対象を見ずに**カード全文(join)に対して
"Search your library for" + "onto the battlefield" + "shuffle" の3断片を照合している。
ウルザの物語第III章 "Search your library for an artifact card with mana cost {0} or {1}, put it onto
the battlefield, then shuffle" が三断片を満たすため `fetchAbility` が非 null になり、カタログの
`fetch-activate`・`resolveAll` のフェッチ停止(`isFetchAbilityStackItem`)・解決時の FetchSearchDialog
横取り(`fetchDialogForTop`)が章 I/II の誘発を含む全能力で発火する。

契約 `docs/engine-spec.md` §11.1 は元々 search 対象が**土地**であることを要求しており、実装が乖離している
(2026-08-06 に同節へスコープ追記済み)。実装を契約へ合わせること。契約文言は変更しない。

## 実装要件(最小外科)

変更は `src/engine/status.ts` の `detectFetchClause` に限定する(純粋関数・engine 規律遵守)。

1. 照合を **splitRulesText の節(clause)単位**で行う(join した haystack への丸投げをやめる)。
2. ある clause がフェッチと見なされる条件: 同一 clause 内に
   (a) `/search your library for/i`、(b) `/onto the battlefield/i`、(c) `/shuffle/i` が揃い、
   (d) **search 対象が土地**であること。
3. (d) の判定: clause 内の `search your library for <対象> card(s)` の `<対象>` 部分を
   `/search your library for ([^,]+?) cards?\b/i` で抽出し、対象に `land`(basic land を含む)
   または基本土地サブタイプ語(`Plains|Island|Swamp|Mountain|Forest`)が含まれれば土地。
   それ以外(例: `an artifact card with mana cost {0} or {1}`)はフェッチではない。
4. 条件を満たす clause が1つでもあれば検出成功とし、**従来どおり該当 face の全文節 join を返す**
   (`fetchLifeCost`/`fetchFilter`/`fetchConditionalUntap` は face 全体を走査するため。
   寓話の小道の conditional untap 句は別文に置かれる既存挙動を維持する)。
5. 日本語検出・`fetchEntersTapped`・`FetchAbility` インターフェース・呼び出し側(catalog/store/controller)
   は変更しない。GameState/コマンド/grammar への変更は禁止。

## Done when

- 判定者所有ピン `src/store/__tests__/review.m415-saga-false-positive.test.ts` の R1/R2 が緑になる(R3 は元から緑)。
- 既存回帰: `src/store/__tests__/review.m415.test.ts`・`review.cr701-fabled-passage-untap.test.ts`・
  `cr701LibrarySearchGuided.test.ts`・`src/components/game/__tests__/review.d1-action-catalog.test.ts` が緑。
- `npx eslint src/engine/status.ts` と対象ディレクトリの vitest が緑。
- 報告は変更ファイル・受け入れ結果・未解決点を記載。
