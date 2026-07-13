# Tier-1 独立監査所見: reanimation mana-value-ceiling sub-leaf (batch6)

監査者: 冷たい Tier-1(実装文脈なし・敵対的)。対象 = 未commit working tree diff
(`src/engine/grammar/compile.ts` / `src/engine/commands.ts` /
`src/engine/__tests__/cr400ReanimationGuided.test.ts` /
`src/engine/__tests__/review.cr400-408-return.test.ts`)。
`docs/`/`review.*`/台帳/git は一切変更していない。

## 0. 機械チェック・review pin(実測)

- `npm run lint` → 緑(0件)
- `npx tsc --noEmit` → 緑(0件。ただしこのコマンド自体は `files:[]` ルート
  tsconfig のため実質チェック無しの既知既知の弱点。下記 `npm run build` で実測)
- `npm run build`(`tsc -b && vite build`) → 緑
- `npx vitest run` → 210 files / 1741 tests 全緑
- `npx vitest run src/engine/__tests__/review.cr400-408-return.test.ts`(判定者専有 pin)
  → 緑(10/10)

実装者の自己申告どおり、機械4点+review pin は全て独立再実行でも緑。ただし
下記§1のとおり、**「緑」がカバーしていない実行パスに赤旗を発見した**。

## 1. [HIGH] 起動型能力の target-prompt 経路が新パターンを認識せず、
CR602.2b の対象選択タイミングを破る(サイレントでないが誠実性グレー)

### 症状

`graveyardReturnFilterForRaw`(`compile.ts`)は起動型/誘発型を区別せず
`effect.raw` だけを見るため、`{1}{W}{W}, {Q}: Return target creature card
with mana value 3 or less from your graveyard to the battlefield.`
(実カード = **Order of Whiteclay**、コーパス実測で確認)のような**起動型**
能力も `compileAbilityIR` の decision が `guided` になる。

しかし起動時に実際にターゲットピッカーを出すかどうかを決めているのは
`compile.ts` とは**別の・同期されていない複製実装**
`commands.ts` の `isExactGraveyardCreatureReturn`(私有・行3061)/
`targetFilterForActivationRaw`(行2997)/`isSingleActivationTargetClause`
(行3035)であり、これらは**このdiffで一切変更されていない**
(旧来の exact-match-only のまま)。`isSingleActivationTargetClause` は
`target ... card` という語順を明示的に弾く一般ガード
(`/\btarget\b[^.]*\bcard\b/i` にマッチしたら false)を持ち、その例外は
`isExactGraveyardCreatureReturn`(MV修飾なしの完全一致)だけにハードコード
されている。したがって MV-ceiling 修飾付きの `target creature card with
mana value N or less` は「exact-match」にも一般ガード例外にも該当せず、
`activationTargetPromptsForSource` は**空配列**を返す。

### 再現(実測・スクラッチハーネスで検証・後で削除済み)

`scripts/_audit-scratch-activation-path.test.ts`(監査用一時ファイル、
削除済み・commit対象外)で `{1}, {T}: Return target creature card with mana
value 3 or less from your graveyard to the battlefield.` を持つ起動型ソース
+ グレイブヤードに cmc=2/cmc=5 の2体を置いて実行:

```
compileAbilityIR decision: guided
compileAbilityIR prompts: [{"atom":"effect.return", ..., "filter":{"types":["creature"],"zone":"graveyard","owner":"you","maxManaValue":3}, ...}]
activationTargetPromptsForSource: []                      <- 空。起動時にプロンプトが出ない
activationPlanForSource costDecision: auto costPrompts: []
```

`gameStore.ts:2739-2767` の実際のフローをそのままなぞると:
`targetPrompts=[]` かつ `costPrompts=[]` → `activationPrompts.length===0` →
**そのまま `commitActivation(pending, [], [])` が呼ばれ、ターゲット未選択の
まま `addAbilityToStack`(`targetSelections: []`)がコミットされる**。
`missingTargetWarnings` は「渡された prompts のうち埋まっていないもの」しか
見ないため(`prompts` 引数がそもそも空)、**警告も一切出ない**。

その後、スタックにコミットした状態で `guidedPlanForStackTop` を呼ぶと
(これは activated/triggered を区別せず全スタックトップに対して
`compileAbilityIR` を再実行する共通経路):

```
guidedPlanForStackTop AFTER activation commit:
  {"sourceId":"c1","prompts":[{"atom":"effect.return",...,"filter":{...,"maxManaValue":3},"slotId":"target-0"}],"commands":[]}
eligible targets at resolve-time prompt: ["c2"]   <- cmc=2 のみ。cmc=5 は正しく除外
```

つまり**天井(maxManaValue)自体は最終的に正しく効く**(false-auto ではない)
が、対象選択のタイミングが CR602.2b(起動時に対象を選ぶ)から「プレイヤー
が後で『解決』ボタンを押した時」へズレる。起動コミット時点では
ターゲット未確定・警告なしでスタックに乗ってしまう
(「起動した瞬間は何も選ばず素通りし、後で唐突にピッカーが出る」という
UX的にも誠実性的にもグレーな状態)。

### 実装者ドラフトとの齟齬

`research/cr-grounding/reanim-mv-filter.draft.md` §4 は本件を認識済みで
「起動型経路は既存の exact-match-only のまま、pin も無いので future slice
への既知の scope 外ギャップとして残す」と書いている。しかし実際には
**「何もしない(=完全 manual に留まる)」ではなく、`guidedPlanForStackTop`
が activated/triggered を区別しないため、resolve クリック時に暗黙に
guided plan が発火してしまう**。ドラフトの "silently generalized without a
pin to anchor it" という否定は不正確——pin こそ無いが、挙動自体は
resolve-time 経由で **今まさに** 一般化されてしまっている
(実カード Order of Whiteclay で確認済み。同型のモーダル版 Phoenix Down
`{1}{W}, {T}, Exile this artifact: Choose one — • Return target creature
card with mana value 4 or less ...` も同種リスクだが modal 経路は未追跡)。

### 分類・根拠

- CR 602.2b(起動型能力の対象はスタックに乗せる際に選ぶ)— タイミング違反。
- CR 608.2c(部分実行の禁止)— 本件は最終的に正しく解決されるため厳密には
  該当しないが、"誠実性(auto詐称なし規律)" の観点では
  「guided と自己申告しているのに起動時のUIが対象選択を提供しない」ことが
  問題。
- 帰属 = **compiler誤訳/scope不整合**(2つの独立した重複実装の同期漏れ)。
  物差し誤りではない(CRを正しく読めば起動型も対象内であるべき)。

### 推奨

1. (根治)`targetFilterForActivationRaw`/`isSingleActivationTargetClause`
   を `graveyardReturnFilterForRaw` を再利用する形に一般化し、起動時に
   正しく MV-ceiling filter 付きプロンプトを出す。
2. (フォールバック案)`guidedPlanForStackTop` 側で
   `card.kind === 'activated'` かつ未選択ターゲットがある場合は
   guided plan を出さず manual に倒す(誠実な DEFER に後退させる)。
3. 最低限、ドラフト§4の記述を実測结果に合わせて訂正
   (「out-of-scope で manual のまま」ではなく「resolve-time 経由で
   timing-shifted ながら自動化されてしまう」と明記)。

**この HIGH は凍結/commit 前に判定者裁定が必要**(独立監査の結論)。

## 2. [PASS] コーパス flip 実測: false-auto ゼロ、IN形 guided化 13件確認

`research/scryfall-rules/2026-06-19/raw/...cards.json`(17,491枚、
oracle_id 重複除去)から `graveyard`+`battlefield`+`return` を含む行を
`splitAbilityLines`→`parseAbilityIR`→`compileAbilityIR` の実パイプラインで
408行抽出(guided 60 / manual 348)。

- **maxManaValue 付きで guided になった実カード = 13件**、全て契約IN形と
  一致(修飾なし・固定整数N・単一target・graveyard→battlefield 末尾一致):
  Angel of Indemnity(MV4)/ Call a Surprise Witness(MV3)/ Can't Stay Away
  (MV3)/ Carnage, Crimson Chaos(MV3)/ Cavalier of Night(MV3)/ Driver of the
  Dead(MV2)/ Eddie Brock // Venom(MV1)/ Order of Whiteclay(MV3、起動型
  ※§1参照)/ Revival // Revenge(MV3)/ Squall, SeeD Mercenary(MV3、
  permanent型)/ Surgical Suite // Hospital Room(MV3)/ Teshar, Ancestor's
  Apostle(MV3)/ Unearth(MV3)。
- **false-auto = 0件**。DEFER対象(up to/all/可変X/self-ref/opponent's
  graveyard/tapped/under your control 等の修飾)を持つ行で maxManaValue
  filter が付いた guided 化は1件も観測されなかった(例: Ajani, Adversary
  of Tyrants[MV2、planeswalker型のマイナス能力]・Alesha[可変MV]・
  Astelli Reclaimer[可変X]・Annie Flash[tapped修飾]・Archangel
  Elspeth[all]は全てMANUAL のまま)。
- **modal(Choose one)行**は decision=guided だが `effect.return` prompt
  自体の filter は undefined(モード選択という別経路。既存のモーダル処理
  であり本diffの変更範囲外・非regression)。

MyDeck census 該当行(`research/mydeck-scoring/gaps.json` reanimation)を
個別確認: **Extraction Specialist** / **Sevinne's Reclamation** は共に
IN形の return節自体は正しくマッチしうるが、行内の後続センテンス
(「That creature can't attack or block...」「you may copy this spell...」)
が未サポートの別 effect のため、行全体としては既存の複数-effect集約ロジック
(本diff無関係・pre-existing)により MANUAL のまま——census の期待どおりで
regression ではない。

## 3. [PASS] blast radius: `eligibleTargets` graveyard分岐への
`permanent` 型追加

コードベース全体で `zone: 'graveyard'` を持つ `TargetFilter` を生成する
箇所は3か所のみ(`commands.ts:3002` の起動型exact-match / `compile.ts:1444`
のexact-match / `compile.ts:1453` の新MV-ceiling leaf)。いずれも明示的に
`types` を指定しており、`types` 省略(→ `eligibleTargets` 内で
`types ?? ['permanent']` にデフォルトされる箇所、行3437)で
`zone:'graveyard'` を呼ぶ既存呼び出し元は存在しない。

これは潜在的な罠として記録する価値がある: **もし将来 `{zone:'graveyard'}`
を types 省略で呼ぶコードが追加されれば**、diff前は
`supportsCreatureCard=false` により常に空集合を返していたのが、diff後は
`types` のデフォルト `['permanent']` により `supportsPermanentCard=true`
となり、突然 permanent型カードにマッチするようになる(サイレントな
挙動変化)。**今回の diff 自体には regression なし**(該当呼び出し元が
存在しないため)だが、次に `zone:'graveyard'` フィルタを書く人への
コメント追記を推奨(低優先度・現状は無害)。

## 4. [PASS] activation path の非対称性は§1の通り確認済み(重複扱い回避)

上記§1に統合。

## 5. [PASS] mana value 取得の正しさ

`manaValueOfStackObject(card, face?.manaCost, def?.cmc)` は
`card.zone !== 'stack'`(墓地は常にこれに該当)の場合 `baseManaValue`
(= `def.cmc`)をそのまま返す。`def.cmc` は `mapScryfallCardToCardDef`
(`src/data/scryfall.ts:199`)で Scryfall の**トップレベル `cmc`** から直接
コピーされており、これは X呪文(X=0固定・CR202.3b)・split/MDFC
(合算値・CR202.3c)を既に正しく織り込んだ値(`ObjectSnapshot.manaValue`
と同一ソース)。本diffは既存ヘルパーを再利用しているだけで新規の
mana-value導出ロジックを追加していない。バグなし。

## サマリ(冒頭段落)

機械4点(lint/tsc/vitest/build)・判定者専有 review pin
(`review.cr400-408-return.test.ts`, 10/10)は全て独立再実行で緑。実カード
コーパス(17,491枚→重複除去408行のreanimation-shaped行)を実パイプライン
(`compileAbilityIR`)で flip実測した結果、**false-auto は0件**、
IN形(固定整数MV・単一target)は実カード13件すべて正しく guided化
(false-manualなし)、MyDeck census 該当の Extraction
Specialist/Sevinne's Reclamationは既存の複数-effect集約ロジックにより
regressionなくMANUALのまま。`eligibleTargets` graveyard分岐への
`permanent`型追加は既存呼び出し元が皆無のため blast radius上のregression
なし(将来の潜在罠として記録)。mana value取得は既存`def.cmc`
(Scryfall cmc直接コピー、X=0/split合算済み)の再利用でバグなし。**唯一の
赤旗はHIGH**: `graveyardReturnFilterForRaw`(compile.ts、今回一般化)と
`isExactGraveyardCreatureReturn`/`targetFilterForActivationRaw`
(commands.ts、今回未変更の独立複製実装)が非同期になり、起動型能力
(実カード Order of Whiteclay で実証)は `compileAbilityIR` 上は
guidedと自己申告するのに、起動時のターゲットピッカーが一切出ず
(`activationTargetPromptsForSource`が空配列・警告もゼロ)、無警告で
ターゲット未選択のままスタックにコミットされ、後で「解決」操作をした
時になって初めて`guidedPlanForStackTop`経由で(activated/triggeredを
区別しない共通経路のため)ターゲットプロンプトが出る——最終的な
maxManaValue絞り込み自体は正しく効く(false-autoではない)が、CR602.2b
の対象選択タイミングを破り、実装者ドラフト
(`research/cr-grounding/reanim-mv-filter.draft.md`§4)が
「out-of-scopeのままmanual」と記述している内容と実際の挙動
(resolve-time経由で暗黙に一般化される)が食い違っている。凍結/commit前に
判定者裁定が必要。
