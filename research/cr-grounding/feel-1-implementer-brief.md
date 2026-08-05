# Implementer Brief: feel-1 guided target sweep (2026-08-04)

あなたは実装者です。判定者所有物(`review.*`テスト・`docs/`・台帳)とgitを触らないこと。
落ちたら実装を直すこと。報告=変更ファイル・受け入れ結果・defer・未解決点。

## Milestone

- id: `feel-1-guided-target-sweep` / base SHA: `8d33c97`(judge freeze commit of contract+brief+review pin+census)
- 契約: `research/cr-grounding/feel-1-guided-target-sweep.draft.md`(先に完全に読む)
- review pin(変更禁止): `src/engine/__tests__/review.feel-1-guided-target.test.ts` — 現在 6 passed / 5 failed。5 failed を全て緑にするのが主目標。
- CR正本: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19版)。対象合法性=115、up-to 0個選択の合法性=115.7、誠実実行=608.2h。

## やること(5つの実装項目)

対象ファイルは `src/engine/grammar/compile.ts` と `src/engine/commands.ts`(eligibleTargets)のみ。新GameCommand・GameStateフィールド・UI変更は禁止。

1. **R5 up-to-N**: "Exile up to one target permanent." を guided 化。prompt は `count: 1, minCount: 0`(EffectPrompt.minCountは既存フィールド)。"up to one/two/three" を正規表現で認識し、up-to でない文には minCount を付けない。
2. **R6 maxManaValue脱落修正**: "Exile target permanent you don't control with mana value 3 or less." の filter が `controller: 'opponent'` と `maxManaValue: 3` を両方持つようにする。現在は controller 修飾があると maxManaValue が落ちるバグがある。targetFilterForRaw の解析順/合成を直す。
3. **R7 複合修飾**: Skyclave 形 "Exile up to one target nonland, nontoken permanent you don't control with mana value 2 or less." を1文で guided 化。excludedTypes=['land']・excludeTokens・controller='opponent'・maxManaValue=2・minCount=0 が同時に成立する。修飾の順序・コンマ区切りに依存しない正規表現設計にすること。
4. **R8 graveyard return**: "Return target card from your graveyard to your hand." を guided 化。graveyardReturnFilterForRaw の型指定なし("target card")を受け付ける。zone='graveyard'。
5. **R9 eligibleTargets の mv 上限強制**: `eligibleTargets(state, { types:['creature'], maxManaValue:3 })` が mana value > 3 のパーマネントを除外する。現在は除外されていない(=CR115違反の非法対象提示)。mana value の算出元(Def の cmc / faces のマナコスト)を確認し、フィルタを強制する。

## 禁止事項(fail-closed規律)

- 文法不一致・複合未対応の文を guided にしない(manual のまま)。
- 対象を推測で自動選択しない。prompt は必ずユーザーが選ぶ。
- 複合文(未対応 clause が残る)の部分実行禁止。R10/R11 は manual のままが正解(回帰pin)。
- 既存 guided 形の挙動変更禁止(R1〜R4 回帰pin)。
- `any` 禁止・TypeScript strict・コメントは英語・ログ文言は日本語。

## 反復テスト

`CI=1 npx vitest run src/engine/__tests__/review.feel-1-guided-target.test.ts --reporter=dot`

全緑になったら、周辺回帰として `CI=1 npx vitest run src/engine/grammar/__tests__/ --reporter=dot` を1回だけ回す。
フル check(`npm run check`)は実行しない(判定者が凍結後にやる)。

## 完了報告の形式

変更ファイル一覧・R5〜R9の各項目の対応内容・defer(触らなかったもの)・未解決点・vitest結果の実出力貼り付け。
