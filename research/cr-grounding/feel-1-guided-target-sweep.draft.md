# feel-1: guided target sweep — 契約草稿 (2026-08-04)

**status**: judge draft (Codex判定者)。ユーザー裁定「気持ちよさキュー優先」の第1スライス。
**lane**: feel / **base SHA**: e99b873 / **計器**: census 2026-08-04再走 = manual 486行・needs-target 229行

## Goal

既存の guided target 機構(`guidedTargetPrompt`/`TargetFilter`/`eligibleTargets`)を文法拡張し、
censusでneeds-targetに落ちている行をmanual→guidedへ変換する。**新CR知識不要・GameState変更なし・新GameCommandなし。**

## Scope(2026-08-04 census実測・効果verbで再分類)

needs-target 229行を「効果が実装済みか」で分離した真の内訳:

| クラスタ | 行数 | 対応 |
|---|---:|---|
| verb-supported(destroy/exile/counter/return/put counter。効果実装済み・対象文法のみ不足) | 50 | **feel-1a本命**。TargetFilter文法拡張でmanual→guided |
| search-tutor(ライブラリ探索型) | 29 | guidedLibrarySearchPrompt拡張(同スライス内・届く分のみ) |
| up-to-N / mv-filter / type-mod / you-control修飾 | 上記50行の内訳 | controller='you'修飾・maxManaValue・excludedTypes・up-to countの構文解析 |
| **maxManaValue脱落修正** | バグ | **必修**。controller修飾と同居するとmv上限が落ちる(CR115違反=非法対象提示)。修正不能の複合はmanualへfail-closed |

## Non-goals(本スライスで触らない・別スライスへ分離)

- temp-boost/keyword until-EOT(13行)・静的anthem・mass(「other」84行の大半)は**一時的/持続効果の新substrateが必要**。feel-1b以降(Slice C領分)へ送る。本スライスは触らない。
- optional-may(20行)はmanualが正解。減らさない。
- 新GameCommand・GameStateフィールド追加禁止(judge-protocol §5.1)。既存eligibleTargets/TargetFilterの文法拡張のみ。
- UI変更なし(guided対象選択ダイアログは既存を再利用)。
- 複合文の部分実行禁止(未対応clauseが残る文は全体manual維持)。

## Frozen acceptance

1. **計器**: census再走でneeds-target行数が**実減少**(目標: verb-supported 50行+search-tutorの一部で合計40行以上guided移行)。auto/guidedの既存行が1行も減少しない(回帰ゼロ)。
2. **filter正確性**: 各新構文形はCR 115(対象の合法性)に従い、**exact-phrase gateパターン**(Slice A/B慣行)で文単位マッチ。誤マッチで非法対象を提示しない。
2b. **maxManaValue必修**: controller修飾と同居してもmv上限が脱落しない。脱落する複合文はguided化せずmanualへfail-closed(非法提示禁止)。
3. **fail-closed**: 文法不一致・複合未対応はmanualへ落ちる(silent auto化禁止・北極星②)。
4. **up-to-Nの誠実性**: 0個選択は合法確定=効果解決(115.8相当)。推測で最大個数を選ばない。
5. 既存`review.*`全緑。対象テストは`npx vitest run src/engine/__tests__/ src/engine/grammar/__tests__/`の範囲。
6. review pin = `src/engine/__tests__/review.feel-1-guided-target.test.ts`(新規・判定者所有)。各構文クラスタ最低2ケース+fail-closedケース+回帰pin(既存guided行の決定不変)。

## CR grounding

- 115.1/115.2 対象選択と合法性・115.8 対象変更の合法性
- 601.2c 対象選択はcastの一部(起動/解決のguided promptはUI補助であり選択自体はユーザー)
- 608.2h 解決時の誠実実行(推測禁止)

## Done when

計器ゲート(1)を実測で達成し、review pinが緑、対象テスト全緑で候補tree凍結。冷監査→フルcheck→ship。
