# ACT-2 Tier-1 独立監査 findings

**監査者**: Tier-1(実装と別セッション)。findings only — 契約・コードは変更していない。
**対象**: 未コミット working tree 5ファイル diff(`src/engine/grammar/index.ts` の
`activatedAbilityLines` 新設 / `actionCatalog.ts` / `gameController.tsx` /
`gameStore.ts` の `pendingForceActivation` / `dialogs.tsx` の `ForceActivationDialog`)。
**方法**: 機械チェック4点 + 全 review.* + 実コーパス(17,491枚、
`research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`)
に対する `activatedAbilityLines`/`splitAbilityLines`/`abilityLineIndexForKind` の実測 +
実カード oracle 文を使った store 直叩き runtime repro(vitest 一時ファイル、確認後に削除・git 状態はクリーンに復元済み)。

---

## HIGH-1: DFC/MDFC で「1本しか見えないのに manual 落ちする」ギャップが未解決のまま残っている

**該当**: `src/engine/triggers.ts:167-183`(`abilityLineIndexForKind`、未変更ファイルだが今回の diff の
face-aware UI と整合しなくなった)/ `src/components/game/actionCatalog.ts:225-247`(新設の面フィルタ分岐)。

**主張の検証**: ACT-2 の目的は「複数の起動型能力行を持つカードが `abilityLineIndexForKind` の
単一行制約で全 manual 落ちしていた」問題を UI 側の明示 index 渡しで解消すること。これは **同一面内**
に2行以上ある場合(コーパス946枚)には機械的に確認できた(下記 INFO-1〜4)。しかし
**両面カード(DFC/MDFC/transform)で「表示中の面には1行しかないが、裏面にも1行あって合計2行」の
population には効いていない**。

**根本原因**: `actionCatalog.ts` は `activatedAbilityLines(def, card.faceIndex)` で **面フィルタ済み**
の行数を数えて分岐する(`activationLines.length >= 2` か否か)。表示面が1行なら「非回帰=単一行と同じ」
と判断し、総称 `ability-activate`(index 未指定)ボタンを1つだけ出す。ところが実際にクリックされたときに
index を解決する `abilityLineIndexForKind`(`activateAbility`・`activationPlanForSource`・
`activatedManaAbilityPlanForSource` が共通で使うフォールバック)は **面フィルタを一切行わず**、
`splitAbilityLines(def)` の全面から `shape === 'activated'` を数える。裏面にも1行あれば
`matches.length === 2` となり `undefined` を返す → `activationPlanForSource`/
`activatedManaAbilityPlanForSource` はどちらも「2行以上で index 不明」を **manual 判定**として扱う。
結果、UI 上は「1個しかボタンがない=曖昧性ゼロに見える」のに、store 側は「2行あって曖昧」と判断し、
ACT-2 が解決したはずの「manual 落ち」バグと**まったく同じ症状**(コスト自動精算されず「起動コストは
手払いしてください。CR-legalとして扱いません。」)が再現する。

**実測(コーパス全17,491枚走査、静的)**: 「表示面の `activatedAbilityLines` 数 === 1 かつ
全面合計 >= 2」の該当カードは **43枚**。代表例(実カード名):
- Zendikar Rising Pathway 両面土地10種すべて(例: `Barkchannel Pathway // Tidechannel Pathway`
  `{T}: Add {G}.` / `{T}: Add {U}.`、`Blightstep Pathway // Searstep Pathway`、
  `Branchloft Pathway // Boulderloft Pathway` 等)
- `Scorned Villager // Moonscarred Werewolf`、`Ill-Tempered Loner // Howlpack Avenger`、
  `Hound Tamer // Untamed Pup`(狼男 transform、`{1}{R}: ...` が両面にある構造)
- `Grizzled Angler // Grisly Anglerfish`(表: mill+条件付き変身、裏: `{6}: 強制攻撃`)
- `Anje Falkenrath // Anje Falkenrath`(reversible_card。表裏テキスト同一だが `splitAbilityLines`
  は面ごとに別エントリを作るため `matches.length===2` になりバグは同様に発生)
- 他: `Budoka Gardener // Dokai, Weaver of Life`、`Bloodsworn Squire // Bloodsworn Knight`、
  `Chalice of Life // Chalice of Death`、`Miles Morales // Ultimate Spider-Man` など計43枚。

**実測(runtime repro、動的)**: `Grizzled Angler // Grisly Anglerfish` の oracle 文をそのまま使って
`makeDef` → `newGame` → 戦場配置 → `buildCardActionCatalog` を実行すると:
- `activatedAbilityLines(def, 0)`(表面)= 1行 → catalog は総称 `ability-activate` のみを出す
  (`ability-activate-N` 系は出ない)。これは `gameController.tsx` の `id === 'ability-activate-...'`
  分岐に入らず、**通常の switch 文の `'ability-activate'` ケース**(既存コード、`store.activateAbility(cardId)`
  を index なしで呼ぶ)に落ちる——これは実際に UI が押すのと同一の呼び出し。
- 実行結果: `store().warnings` = `['《Grizzled Angler》の起動コストは手払いしてください。CR-legalとして扱いません。']`。
  スタックには積まれる(`stack length: 1`)がコストは一切自動精算されず、{T} タップも mill も
  compile されない——ACT-2 が「解消した」と主張する症状そのもの。

**重要な補足(regression ではなくscope gap)**: この43枚のバグは ACT-2 diff が**新たに作った**もの
ではない。ACT-2 適用前でも `actionCatalog.ts` は無条件で総称 `ability-activate` を1つだけ出していた
ので、同じクリック・同じ `abilityLineIndexForKind` 呼び出し・同じ manual 落ちが起きていたはずである
(pre-existing bug)。ただし ACT-2 は「行を明示列挙して manual 落ちを解消する」ことを **スライスの主張
そのもの**として掲げ、かつ review test で DFC 面フィルタを個別にテスト済み(`表向きフェイスの行だけを
列挙する`)——にも関わらず、その面フィルタが `activatedAbilityLines` という**新設プリミティブの中だけ**
に閉じており、store 側の実解決ロジック(`abilityLineIndexForKind`)には伝播していない。「解決した」と
主張する population の中に、実測43枚(Zendikar Rising Pathway 10種フルセットを含む、EDH で非常に
頻用される土地サイクル)が**未解決のまま残っている**ことは、スライスの完了判定に影響する。

**推奨**: `abilityLineIndexForKind`(`src/engine/triggers.ts:167-183`)に `faceIndex` パラメータを
追加し面フィルタを効かせるか、`activateAbility`/`activationPlanForSource`/
`activatedManaAbilityPlanForSource` が呼び出し元の `card.faceIndex` を伝搬して同じ面フィルタで
解決するよう揃える。もしくは(最小修正)actionCatalog 側で「表示面のみでなく全面の行数」で
`>=2` 判定するよう分岐条件を変える(ただし裏面の行を誤って前面に露出させない設計が必要=review test
の `表向きフェイスの行だけを列挙する` の意図と衝突しないよう要検討)。

**severity**: HIGH — 実プレイ頻度の高いカード種別(EDH 定番の Pathway 両面土地など)で、ACT-2 の
主張する到達性修正が機能しない。ただし新規 regression ではなく既存バグの unfixed scope。

---

## INFO-1: 機械チェック4点(全green)

- `npm run lint` — pass(0 warning/error)。
- `npx tsc --noEmit` を単体では動かさず(memory: ルート tsconfig は `files:[]` で無検査になる罠)、
  代わりに **`npm run build`(`tsc -b && vite build`)を実行** — pass。dist 生成成功、型エラーなし。
- `npx vitest run`(全226ファイル・1918テスト)— **全green**。ACT-2 の新設
  `src/store/__tests__/review.act2-activation-lines.test.ts` を含む。
- `npm run build` — 上記と同一実行で確認済み、pass。

## INFO-2: review.* 全緑

`review.act2-activation-lines.test.ts`(新設・14テスト)・`review.d1-action-catalog.test.ts`・
`review.act1-mana-shortcut-cost.test.ts` を個別実行、3ファイル44テストすべて pass(既存 review pin の
非回帰も確認)。

## INFO-3: コーパス実測 — 過剰列挙(false-affordance)・誤ラベルは検出0件

17,491枚全件を `mapScryfallCardToCardDef` → `activatedAbilityLines(def)` に通し、以下を実測(すべて
実カードコーパス、合成値ではない):
- コロンなしの activated 行: **0件**
- コロン2個以上の activated 行: **0件**
- `effectText` 空文字: **0件**
- `costText` 空文字: **0件**
- 括弧内コロン(リマインダー文由来の誤爬取懸念): **0件**

**確認方法の裏取り**: `+2 Mace`(`Equip {3} ({3}: Attach to target creature...)`)のような
「リマインダー文自体にコロンを含む」典型ケースを個別に検証したところ、`splitAbilityLines` の時点で
既にリマインダーが除去され `Equip {3}` は `shape: 'keyword'`(`'activated'` ではない)に分類済みで、
`activatedAbilityLines` の出力には現れなかった(`activated lines: []`)。これは `splitAbilityLines`/
`classifyAbilityShape` という**今回 diff の対象外の既存機構**の正しさに依存しており、今回の
`activatedAbilityLines` はその上澄みを filter+split しているだけなので、この軸でのバグ生成余地は
実質ない。

`looksTriggered`(効果文が `When/Whenever/At the beginning of` で始まる)ヒューリスティックは10件
ヒットしたが(例: `Adaptive Training Post`, `Cursed Recording`, `Loki Laufeyson` 等)、すべて
「起動型能力の効果が遅延誘発を仕掛ける」正しい oracle 文型("{T}: When you next cast..., copy it.")
であり、`shape` 分類そのものは正しい(誤分類ではなく、このヒューリスティックの false positive)。
実害なし。

## INFO-4: index 空間の一致 — 全17,491枚で不一致0件

`activatedAbilityLines(def).index` が `splitAbilityLines(def)` の flat index と完全一致するかを
全コーパスで検証(a902a9f と同型の compile/UI desync が再発していないかの確認)。**不一致0件**。

## INFO-5: DFC face フィルタ自体(`activatedAbilityLines` 内)は正しい

`activatedAbilityLines(def, 0)`/`activatedAbilityLines(def, 1)` の**プリミティブ自体**は全2面以上
カード(コーパス内の該当枚数を走査)で面漏れ0件を確認(front-only 呼び出しで back 面の行が混入する
ケースはゼロ、逆も同様)。**バグは `activatedAbilityLines` 自体にはなく、それを呼ばない
`abilityLineIndexForKind` 側の非対称にある**(HIGH-1 参照)。両面カードで裏面の能力が誤って前面の
選択肢に現れる、という review test が主張する非回帰(`表向きフェイスの行だけを列挙する`)自体は
正しく成立している。

## INFO-6: blast radius — `pendingForceActivation` のリセット漏れなし

`newGame`(通常/mulligan分岐とも)・`restoreGame`・`undo`・`redo`・`commit`(全成功コミットの単一
chokepoint)のすべての `set()` 呼び出しに `pendingForceActivation: null` が入っていることを目視確認
(grep で全 `pendingGuided: null` 箇所を洗い出し、該当する状態リセット箇所と突合)。永続化される
snapshot フォーマットに `pendingForceActivation` は含まれない(純粋な runtime UI state)ため、
`snapshot前方互換`(旧 snapshot 復元時のクラッシュ)の懸念も該当しない — `restoreGame` は
snapshot データから来ない固定値として `pendingForceActivation: null` を都度セットしている。

`isDialogOpen`(`gameController.tsx:217-231`)に `pendingForceActivation !== null` が正しく
追加されており、ダイアログ表示中はショートカットがブロックされる。`pendingForceActivation` と
`pendingGuided` は `activateAbility` 内で常に排他的に set/null されており(片方を立てるときもう片方を
null にする)、設計上共存しない——ダイアログ競合のリスクは構造的に排除されている。

## INFO-7: 「forced 経路の即時警告 push」は二重化も消失もしない(実測で確認)

ブリーフで疑うよう指示された「一般経路への forced+costWarnings 即時警告 push の新規追加」
(`gameStore.ts:3039-3050`)について、二重警告または警告消失が起きないか runtime repro で検証した。

対象ケース: `{T}: Tap target creature.`(対象選択を要する=guided target picker を経由する)を
タップ済み発生源で `force: true` 起動 → `confirmForceActivation()` → `confirmGuidedTarget()` まで
完走させた。

- `activateAbility` 内の forced 分岐が push する
  `「起動コストは支払えないため、この起動をCR-legalとして扱いません(強行)。」` は
  `pendingGuided` 表示中は `warnings` に一時的に載る(ダイアログ表示中のフィードバックとして機能)。
- 最終的に `confirmGuidedTarget` → `commitActivation` → `commit()` が呼ばれると、`commit()` は
  `warnings` を**丸ごと置換**する(`get().warnings` に追記ではない、`gameStore.ts:1343-1346`)ため、
  上記の一時警告は最終ログには残らない。しかし `commitActivation` 自身が `forced` 時に
  `forcedActivationWarning`(`「の能力を強行起動しました。CR-legalとして扱いません。」`)を
  必ず追加するため、**最終的な `warnings` には等価な「CR-legalでない」旨のメッセージが1件だけ残る**
  (実測: `CR-legal warning count: 1`)。二重化も消失も確認されなかった。

この設計自体は妥当だが、**一時警告メッセージの文言と最終警告メッセージの文言が異なる**
(前者「起動コストは支払えないため...」、後者「能力を強行起動しました...」)ため、もし UI が
`warnings` の変化を逐次バナー表示するような実装だった場合、ユーザーには2種類の文言が別々のタイミングで
一瞬ずつ見える体験になる。実害は薄いが、UI 実測(バナー表示の有無)は本監査のスコープ外につき
未確認。

## INFO-8: 「mana ability manual 判定では pending をセットしない」設計は妥当(死路ではない)

`manaAbilityPlan.decision === 'manual'`(`gameStore.ts:2939-2947`)は「コストが払えない」のではなく
「コンパイラがコストをモデル化できない」ケースであり、`force` してもコンパイラが理解できない以上
バイパスする対象がない。実測(Grizzled Angler repro)でも、`decision === 'manual'` 相当のケースは
スタックには積まれ(`state changed: true`, `stack length: 1`)、「起動コストは手払いしてください」
という警告と共にユーザーが自己管理できる状態になる——ACT-2 以前と同じ自己申告フローであり、
force ボタンがないことによる**新規の袋小路は生まれていない**。

## INFO-9: fail-closed / NaN 経路は安全(到達不能だが正しく防御的)

`gameController.tsx` の `ability-activate-<index>` id パース(`Number.parseInt` → `Number.isNaN`
チェック)は、id が `actionCatalog.ts` の `activatedAbilityLines` からのみ生成される制御された
文字列である以上、実質的に到達不能なコードだが、fail-closed の設計として正しい(NaN なら総称
`activateAbility(cardId)` にフォールバックし、`store.activateAbility` へ NaN が渡ることはない)。
auto 詐称(誤った盤面を自動化と偽って作る)は確認されなかった。

## LOW-1: UI 契約(design-vision原則7 / design-system トークン)

`ForceActivationDialog`(`dialogs.tsx`)は既存 `ShortfallDialog` の idiom(`Modal` ラッパー・
`width="sm"`・`btn`/`btn--danger`・`dialog__actions`・`data-testid` 命名規則)を完全に踏襲しており、
生カラーの直書きはない(`review.css-token-guard` を含む全 vitest が green のため機械的にも確認済み)。
既存の同型コンポーネントからの逸脱は検出されなかった。**ただし light/dark 両テーマでの実機ブラウザ
確認は本監査では未実施**(既存 idiom の完全流用ゆえコード監査で idiom 一致を確認するに留め、実機
確認は行っていない——ship 前の要所チェックとして推奨)。

## LOW-2: draft ドキュメントの CR 引用フォーマット不備(実装対象外)

`research/cr-grounding/act2-activation-lines.draft.md`(未コミットの Codex 草稿、判定者未承認)は
CR602.1・602.2b・118.3 の**実質的な内容**は正確(`rule/Magic_The_Gathering_Comprehensive_Rules.txt`
の該当箇所と突合済み: 602.1 は2514行目「[Cost]: [Effect.] [Activation instructions...]」、602.2b は
2531行目「601.2b–i と同一プロセス」、118.3 は972行目「資源不足では全額支払い不可・部分払い不可」)。
ただし引用フォーマットが `(line 10, rule/601.2a)` のように**存在しない個別ファイル**
(`rule/601.2a` 等)を指しており、実際には CR は単一ファイル
`rule/Magic_The_Gathering_Comprehensive_Rules.txt` にしか存在しない。実装に反映済みの
`review.act2-activation-lines.test.ts` 自体の docstring は正しい引用形式(条番号のみ、存在しない
ファイルパスなし)を使っているため実害はない。draft は「Status: Ready for judge review + CR citation
validation」と自己申告しており、この草稿がそのまま `docs/` へ反映される前に判定者が引用形式を
修正する前提の成果物である。ブロッカーではない。

## 対象外(参考情報)

`research/cr-grounding/act3-keyword-canonicalization.draft.md` は次スライス(ACT-3)のスコーピング
草稿であり、今回の diff にコード変更を伴わない。本監査では内容の精査を行っていない。

---

## サマリ

| 軸 | 結果 |
|---|---|
| 機械4点 | 全green |
| review.* | 全green(非回帰含む) |
| コーパス過剰列挙/誤ラベル | 0件(17,491枚実測) |
| index空間一致 | 0件不一致(17,491枚実測) |
| DFC face フィルタ(新プリミティブ自体) | 正しい(0件漏れ) |
| **DFC face フィルタ(store 解決ロジック側)** | **HIGH-1: 43枚で manual 落ちが未解決** |
| blast radius(pending reset) | 漏れなし |
| forced 警告の二重化/消失 | なし(実測で確認) |
| manual 判定の死路化 | なし |
| NaN fail-closed | 安全 |
| UI トークン契約 | 逸脱なし(実機確認は未実施) |
| CR 引用の実質正確性 | 正確(draft のファイルパス表記のみLOW) |
