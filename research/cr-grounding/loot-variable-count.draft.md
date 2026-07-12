# 自己完結loot効果の可変数 — engine-spec 草稿 (cr-121-drawing + cr-701 共有プリミティブ拡張)

実装者(Codex代行)による草稿。判定者が独立監査後に `docs/engine-spec.md` へ再オーナー化する。
根拠: `research/cr-grounding/planned-sequence-batch5.draft.md` 候補1。CR条番号: **121.1/121.2**(draw)・**701.9**(discard)・**608.2h**(可変値の解決タイミング)。

## 0. 実装前probeで確定した2つの事実(スコープを決定づけた)

1. **`resolveCount`/`countSpec` の既存バグ**: `discard up to two cards` は `countSpec`(`src/engine/grammar/ir.ts`)の語数正規表現に "two" がマッチし、"up to" 修飾語を無視して `{kind:'fixed', value:2}` に誤解決していた(CR608.2hが要求する「プレイヤー選択の上限」ではなく「必須の2枚」として扱われていた)。`draw that many cards` は逆に何ともマッチせず `{kind:'unknown'}` に落ちていた。
2. **`src/store/gameStore.ts` は本セッションのブリーフで編集禁止**(並行UXトラックの out-of-band 変更が同ファイルに混在中。`git diff -- src/store/gameStore.ts` で確認した実差分は snapshot-persistence dev flag のみで本タスクと無関係だが、ブリーフの指示は絶対)。この制約が、以下の「guided化できる範囲」を決定づけた。

## 1. CountSpec拡張(`src/engine/grammar/ir.ts`)

```ts
export type CountSpec =
  | { kind: 'one' }
  | { kind: 'fixed'; value: number }
  | { kind: 'up-to'; max: number }        // NEW — CR608.2h: プレイヤー選択の上限(any number of は max=Infinity)
  | { kind: 'that-many'; delta: number }  // NEW — CR608.2h: 姉妹節の実数値を参照する値(delta=+/-K)
  | { kind: 'variable-x' }
  | { kind: 'for-each' }
  | { kind: 'unknown' };
```

- `up-to`: `up to N`(N=数字/数詞)・`any number of` を検出。**「discard up to two cards」は依然 auto/guided に昇格しない**(§3参照)が、少なくとも demand計器・将来のcompiler拡張が「これは必須固定Nではなくプレイヤー選択」と正しく区別できるようになる(既存の誤 `fixed` 分類はcensus等の他ツールにとっても地雷だった)。
- `that-many`: `that many`(+ 任意で `plus <N>` / `minus <N>`)を検出し、`delta` に符号付き調整値を格納。`resolveCount`(`compile.ts`)は引き続き `one`/`fixed` のみを直接解決するため、この2種は今まで通り「単体では解決不能」= `variable-count`/`needs-choice` 系の manual reasonに落ちる(既存の集計バケットは変更なし=回帰なし)。

**回帰チェック済み**: `resolveCount` の呼び出し元(discard guided prompt / sacrifice manual reason / token生成 / count-driven-auto群)を全て確認し、いずれも「up-toを含む未対応kindはnullとして扱う」という既存の防御的挙動を継続する。既存 review/test に "up to N" を `resolveCount` 系atom(discard/create-token/draw等)経由で解決させている前提のケースは無し(grep確認済み)。

## 2. guided化した範囲: 「discard N cards(固定), then draw that many [plus/minus K] cards」

新関数 `guidedDiscardThenDrawPlan(ir)`(`compile.ts`)が対象を検出する:

- `ir.effects` が正確に2節(discard→draw)、両方 `optional===false`。
- discard節の count が `one`(=1)または `fixed`(=N、コンパイル時に既知の**必須**枚数。「up to」ではない)。
- draw節の count が `that-many`(delta込み)。
- 両節とも自己完結(`isSelfFixedCountDiscardClause`/`hasSupportedPlayerSubject` で `target`/`each`/`opponents?`/`their`/`that player`/`controller`/`up to`/`any number` 等を含む節は除外=cross-player・可変選択は honest manual のまま)。

一致した場合:
- discard側は**N個の同一な discard prompt(count=1)** を `EffectPrompt[]` として積む(既存の単体discard promptと全く同じ形。`buildGuidedCommands` は無変更で1枚ずつ正しく処理する)。
- draw側は **discard固定数Nとdeltaからコンパイル時に静的計算した `{type:'draw', count: max(0, N+delta)}`** を `commands`(auto側)として同梱する。これは既存の「Discard a card, then draw a card.」(discard=1, draw=1が独立にfixed(1)解決される既存パス)と全く同じ「mixed auto+guided」パターンの一般化(§32 mixed→guided; CR608.2c)であり、**新しいGameCommand型・新しいGameStateフィールド・`gameStore.ts`の変更は一切不要**。

### なぜ「compile時に静的解決」で足りるのか

discard数が**固定**(プレイヤーがどの札を捨てるかは選ぶが、何枚捨てるかはコンパイル時に確定=必須)である限り、"that many" が指す実数値も**コンパイル時に既に分かっている**(=discard固定数と同じ)。プレイヤーの実行時選択(どのN枚を選ぶか)には依存しない。したがって draw の count は discard の**guided回答を待たずに**確定でき、既存の「auto commandがguided prompt列に同梱される」メカニズムだけで正しく動く。

### 0枚選択・負の delta の扱い

`Math.max(0, N + delta)` で下限0にフロアする(例: 「discard a card, then draw that many cards minus one」→ N=1, delta=-1 → draw 0)。テスト済み(`src/engine/grammar/__tests__/lootVariableCount.test.ts`)。

## 3. guided化*しなかった*範囲: 「discard up to N / any number of cards, then draw that many」

**これが本来の最優先demand(Celes, Rune Knight / Tersa Lightshatter / Fable of the Mirror-Breaker 第II章)の実体だが、本スライスでは manual のまま据え置いた。** 理由はCR上の懸念ではなく、**このセッションで`gameStore.ts`が編集禁止だったことによるアーキ上のブロッカー**:

- discard数が「up to N」/「any number of」の場合、実際に捨てた枚数は**プレイヤーの実行時選択**であり、コンパイル時には決まらない。
- 現行アーキでは、guided promptは1枚ずつ `confirmGuidedDiscard(cardId: string)`(`gameStore.ts`)経由で答えられ、`advanceGuidedResolution` が都度 prompt queueを1つ消費して `pending.commands` に累積する。しかし **`buildGuidedCommands`(pure関数、compile.ts)は「このスロットの回答」だけを受け取り、それ以前のスロットで実際に何枚捨てられたかという累積情報にはアクセスできない**(ctx/answerのいずれにも履歴が乗らない)。
- 加えて `confirmGuidedDiscard` は1回の呼び出しにつきcardIdを1枚しか受け取れないため(`cardIds:[cardId]` 固定)、「全選択を1回の回答でまとめて送る」経路も無い。
- 結果、"draw = 実際に捨てた枚数" を締めくくる場所が**store側のオーケストレーション**にしか存在しない。これを追加せずに guided化すると、①最大値Nを機械的にdrawする(=宣言された「up to」を無視した虚偽auto。CR608.2h違反)、②途中で `cancelGuidedPrompt()` により一部スロットを辞退された場合に実際の discard枚数とdraw枚数が食い違う、のいずれかの**実プレイでのバグ**を埋め込むことになり、manualより悪い。「auto詐称なし」の原則により、honestに manual のまま据え置いた。

### 解放に必要な残作業(次スライス向けメモ)

`gameStore.ts` 編集が許可されたセッションで、以下のいずれかを追加すれば解放できる:
1. **N個の discard prompt sequence + 終端フック**: `PendingGuidedResolution` に「このシーケンスは discard-then-draw 合成である」マーカーを持たせ、最後のスロット消費時(`prompts.length===0` 直前)に累積 discard 枚数を数えて `draw` commandを追加注入する分岐を `advanceGuidedResolution`/`finishGuidedResolution` に足す。
2. **`confirmGuidedDiscard` の複数選択対応**: `cardIds: string[]` を受け付ける経路(または新規 `confirmGuidedDiscardBatch`)を追加し、UI側が「up to N枚」を1回の回答でまとめて提出できるようにする(ただし GameScreen.tsx も編集対象になる)。

いずれも `gameStore.ts`(および場合により `GameScreen.tsx`)の変更を要するため、本スライスの不可侵制約下では実施していない。**新規GameCommand型・新規GameStateフィールドは、上記いずれの案でも不要**(`PendingGuidedResolution` はstore内部型、`confirmGuidedDiscardBatch` はstore APIの追加関数であり、どちらもGameCommand/GameStateではない)。

## 4. 分解可能性テスト(北極星③)

- discard: 既存 `discard` GameCommand(`cardIds`)をそのまま再利用。**変更なし**。
- draw: 既存 `draw` GameCommand(`count`)をそのまま再利用。**変更なし**。
- `EffectPrompt`/`CountSpec` は compiler内部型(GameState/GameCommandではない)への追加のみ。
- 新規GameState/GameCommand: **なし**。既存プリミティブの合成のみで固定N型は完結=分解可能性テストPASS。up-to型は解放に `gameStore.ts` 側の小さな追加(store内部型 `PendingGuidedResolution` への追加フィールド or 新規store関数)が必要だが、これもGameCommand/GameStateの新設ではない。

## 5. demand実測への影響(正直な報告)

`gaps.json` 実例19件のうち、named例(Celes/Tersa/Fable)は**全て up-to/any-number型**であり、本スライスでは manual→guided に転換していない。本スライスが実際にguided化するのは「discard N cards(固定), then draw that many [plus/minus K] cards」という**同じ構文パターンの固定数サブケース**であり、MyDeck 4デッキの現存census内には該当する実例は0件(19件は全てup-to/any-number)。ただし:
- CR上・構文上は正当な自己完結loot patternの一部(brief内の記法「discard {up to} N cards」の「{up to}」= 省略可能=固定数形も元々スコープ内)。
- 17,491枚の広いコーパスでは固定数形(例:「Discard two cards, then draw two cards plus one.」のような形)が存在する可能性があり、今後 census が拾えば効く。
- 何より、ir.ts側の `up-to`/`that-many` 分類の導入自体が、demand計器の正確性(旧: "up to" を "fixed" と誤魔化していた)を改善しており、次スライス(gameStore解放後)の実装コストを下げる。

**正直な結論**: 本スライスは基盤(CountSpec正確化 + 固定数リンク機構)を築いたが、19件の実demandを動かすには次スライスで `gameStore.ts` 編集許可が必要。
