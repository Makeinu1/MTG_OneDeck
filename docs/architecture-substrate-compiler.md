# MTGルール基盤(Substrate)+ 文法コンパイラ(Compiler)アーキテクチャ

> ステータス: **設計(design-only)**。本書はコード・契約(`engine-spec.md` 本体・`CLAUDE.md` 本体)を
> まだ変更しない設計図である。実装は本書を背骨に、後述のマイルストーンを1つずつ起こす。
> 最終更新: 2026-06-26。参照CR: 2026-06-19 版。

## 0. 用語と状態語彙(正本・2026-07-01 追加)

MTGを一人回しできる状態にする主役は**4部構成**。中心名詞は **`GameState`**(その瞬間を再開・undo できる完全な状態)。ルールエンジンは GameState を読み次 GameState へ変え、コンパイラは GameState を直接書かず「GameState を変える command」を作り、ゲームエンジンは GameState を保持し、検査器は「その変化が CR 根拠付きか」を見る。

| 用語 | 責務 | やらないこと | 本コードでの実体 |
|---|---|---|---|
| ゲームエンジン | `GameState` 保持・UI操作・履歴・保存・undo/redo・入力→command化 | CR判断を全部内包しない | `src/store/`(Zustand)+ UI |
| ルールエンジン(= 本書の「ルール基盤/Substrate」) | 構造化済み `GameCommand` を CR に沿って次 `GameState`/`GameEvent`/warning へ | 英語 oracle text を直接読まない | `src/engine/`(純粋関数)|
| カード文法コンパイラ(Compiler) | oracle text → command/trigger/effect plan へ変換(auto/guided/manual) | `GameState` を直接書き換えない | `src/engine/grammar/` ほか(段階拡大)|
| 検査器 | 実装済み主張と未実装境界が嘘でないかを CR 根拠で監査 | ゲームを進行しない・盤面裁定を再実装しない | `research/cr-grounding/`(golden-cases・**背骨台帳**・review.*)|

用語注: 本書は歴史的経緯で「ルール基盤(Substrate)」と呼ぶが、**議論上の「ルールエンジン」と同一物**。コード/ファイル名は改名しない(payoff 無き churn)。

### 進捗語彙(5状態ライフサイクル)
「PASS(core) を PASS と誤読する」落とし穴を防ぐため、CR領域ごとの状態は次の5値で表す(**`research/cr-grounding/cr-backbone-ledger.json` の `status` カラムが正本**):

| 状態 | 意味 | 旧語彙との対応 |
|---|---|---|
| `drafted` | 契約草稿のみ(CR接地・golden定義)| ≒ Not started 直前 / DRAFT |
| `implemented-not-green` | 実装したが機械チェック4点 or review 未緑 | (旧語彙に無かった正直さ)|
| `review-green` | `review.*` 緑・golden 実行可能 | ≒ Active 完了直前 |
| `shipped` | commit + CI 緑 +(該当時)Pages | ≒ Done |
| `deferred` | 明示的に後回し・境界として可視 | ≒ scope-boundary / PARTIAL の残境界 |

`FROZEN`(契約凍結)は state ではなく**契約側のゲート印**として引き続き使う(§34)。

### CR領域のレーン分類(背骨/後期背骨/葉/剪定)
どの CR 領域を先に積み、どれを剪定するかは **`cr-backbone-ledger.json` が単一正本**(旧 `scope-partition.md`・README ゲート表・`m0-freeze-overlay.json` の重複役割を退役・subsume)。レーン定義: `backbone`(GameState/遷移/event/priority/SBA/compiler着地先を決める=CR依存順に実装)/ `late-backbone`(重要だが前提state重い=設計を先に凍結し実装は段階化)/ `leaf-compiler`(個別文法=substrate完成後)/ `pruned`(主価値に直結せず=実装しないが可視に残す)。autoloop の「次は何か」は台帳 lookup(`.claude/commands/autoloop.md` step 0)。

## 1. Context — なぜ全体設計か

統率者戦(EDH)の一人回しアプリ。発端は「複数誘発カードが扱えない」だが、議論を経て本質は
誘発単体ではなく **「MTG総合ルール(CR)の対象モデルをどう盤面に再現し、カード文法をどう
その上にコンパイルするか」の全体設計** だと合意した。

ユーザー決定: 憲章 `CLAUDE.md` L35「完全ルールエンジンには踏み込まない」を**意図的に緩め**、
統制された範囲で工数大でも自動化に挑戦し、**少数の誤謬は許容**する。誘発の小手先修正ではなく、
ルール基盤そのものを土台から描く。

参照CR: 領域=CR400(特に 400.7)、ターン構造=CR500、唱える/起動/誘発/静的/解決=CR601/602/603/604/608、
マナ能力=CR605、効果=CR609-616、イベント=CR700.4、ターンベース処理=CR703、状態起因処理(SBA)=CR704、
能力4分類=CR113.3、継続効果の層=CR613、統率者=CR903。

## 2. 中核思想 — 「ルール基盤(正・有界)」と「文法コンパイラ(部分・計測)」の分離

MTGを丸ごと自動化しようとすると破綻する。鍵は2つの関心を完全に分けること。

- **ルール基盤(Substrate)** = CRの構造規則(オブジェクト・領域・ターン/フェイズ・スタック・
  唱える/起動/解決の手続き・イベント・SBA・継続効果の層)。カード個別の挙動は含まない。
  範囲が**有界**なので正確かつ決定的・可逆に作り切れる。これが「総合ルールの盤面再現」。
- **文法コンパイラ(Compiler)** = カードの oracle 文 → 基盤プリミティブ列への翻訳。範囲が
  **無界**(全カード文)なので部分カバレッジ・段階拡大・誤謬許容。`auto/guided/manual` に
  縮退し `confidence` を持つ。これが「文法のコンパイル」。

この分離により「総合的だが統制下で誤謬許容」が成立する。基盤は小さく完全で可逆、コンパイラは
大きく部分的で計測管理。**コンパイラは状態を直接書き換えず、基盤の決定的プリミティブ
(= 拡張版 `GameCommand`)列を生成するだけ**。誤訳しても undo で必ず戻せる
(既存スナップショット履歴 200 件が保険)。LLMジャッジは引き続き助言のみ・盤面を変えない
=「決定的文法コンパイラが変える」方針を堅持する。

### 2.1 「カード効果 = 変数の read/write」は必要だが不十分(2026-06-24 補強)
ESO は「MTGを再現するための変数の最小十分集合」だが、**変数の値の増減だけではMTGを再現できない**。
MTGの挙動の本体は値そのものではなく、その値を **(a) いつ読むか(read-timing / juncture)**
**(b) どのオブジェクト同一性で読むか(LKI=最後に存在した情報を含む)** **(c) 置換の前か後か(CR616)**
**(d) どのタイムスタンプ/依存順で確定するか(継続効果の層 CR613)** にある。
同じ「+1/+1」でも、いつ・どのオブジェクトに・どの順で適用されるかで盤面は変わる。
ゆえに **ESO の各エントリは値だけでなく、読み取りタイミングとオブジェクト識別を第一級の属性として持つ**
こと(`変数/概念` 列に read-timing と object-identity を併記する)。これは特に
**Slice3(ゾーン+プレイヤー=所有者/コントローラー/LKI)** と **Slice4(タイミング/juncture/SBA)** の
設計指針であり、ここを変数増減だけでモデル化すると後から最も戻しにくい破綻を生む(M0 凍結ゲートが
Slice3/4 一巡を要求する理由)。物差し側も、分類一致だけでなく**実行(ゴールデン再生)**で
read-timing/object-identity の正しさを突合する(`engine-design-method.md` §3・§5)。

## 3. 現状の裏取り(2026-06-22 探索)

| 領域 | 現状 | 母体ファイル/関数 |
|---|---|---|
| 有効特性 | def 直読み + カウンタ加減のみ。層システムなし | `src/engine/status.ts` の `effectivePower`/`effectiveKeywords` |
| 領域(ゾーン) | 全体共有 `Record<ZoneId, string[]>`。プレイヤー別でない | `src/engine/types.ts` の `GameState.zones` |
| フェイズ/ターン | `PHASE_ORDER` は7フェイズ・戦闘単一。SBA・戦闘サブステップなし | `src/engine/types.ts` / `commands.ts`(`turn.ts` 不在) |
| 誘発検出 | prev/next 差分方式。イベントストリームなし | `src/store/gameStore.ts` の `detectTriggerCandidates` |
| スタック/解決 | スタックゾーン・能力オブジェクト・コピーは実装済(限定的) | `commands.ts` の `castToStack`/`resolveStackTop`/`applyAutoCommand` |
| 能力分類 | 7値 `AbilityShape`(CR113.3 の4分類を内包) | `grammar/index.ts` の `classifyAbilityShape` |
| 文法コンパイラ | G0〜G4 完了。IR・コンパイル・auto/guided/manual・コスト精算あり | `grammar/ir.ts`(`parseAbilityIR`)/`grammar/compile.ts`(`compileAbilityIR`) |
| カバレッジ計測 | コーパス 17,491 枚で計測ハーネス稼働 | `npm run accuracy`(§16/§28)・`npm run grammar-coverage`(§29) |
| 不変条件 | I1〜I12 を fast-check で検証中 | `src/engine/__tests__/review.properties.test.ts` |

未実装で本アーキが新設するもの: `src/engine/events.ts`・`src/engine/layers.ts`・`src/engine/turn.ts`、
プレイヤー別ゾーン、SBA、継続効果の層システム、ダミー対戦相手。

## 4. ルール基盤(Substrate)— CR構造規則の盤面モデル

### S0. オブジェクトと特性(CR109-114, 200番台, 613)
統一 `GameObject`: カード/トークン/コピー/スタック上の呪文/スタック上の能力/紋章。所有者・
コントローラーを持つ。**印刷特性(actual)と有効特性(effective)を分離**。現状は def を直読み
するが、CR613 では継続効果適用後の値が真。`computeEffectiveCharacteristics(state, objId)` を
新設し、**層システム(S4)** を通して P/T・型・色・能力等を算出する。
**母体 = `status.ts` の `effectivePower`/`effectiveKeywords`** を一般化。現 `CardInstance`
(faceIndex/counters/tapped/enteredTurn 等は流用)を母体に拡張し、def 直読み箇所を effective 経由へ段階移行。

### S1. 領域(CR400-408)— プレイヤー別ゾーン
CR400.1: library/hand/graveyard は各プレイヤー固有、battlefield/stack/exile/command は共有。
現状の全体 `zones` をプレイヤー別(`zones[playerId].hand` 等)+ 共有ゾーンへ一般化する。
不変条件 I1(各 id はちょうど1ゾーン)/I2(カード保存則)をプレイヤー別へ一般化。
**前方互換**: 旧スナップショットは単一プレイヤーへ写像する(`restoreGame` で補完。
[[snapshot-forward-compat]] 必須)。これがダミー対戦相手(S5)の器になる。

### S2. プレイヤー・ターン構造(CR102, 500番台, 703, 704)
プレイヤー集合(あなた + ダミー対戦相手N人)・アクティブプレイヤー・優先権(一人回しは
簡略: 自動パス基調)。フェイズ/ステップを CR500 完全準拠で:開始(アンタップ/アップキープ/
ドロー)・戦闘前メイン・戦闘(戦闘開始/攻撃宣言/ブロック宣言/戦闘ダメージ/戦闘終了)・
戦闘後メイン・終了(終了ステップ/クリンナップ)。現 `PHASE_ORDER` を戦闘サブステップ込みへ拡張。
ターンベース処理(CR703): アンタップ・ドロー・クリンナップ(手札7枚へ・ダメージ消去)を
juncture フックに。SBA(CR704): 致死ダメージ・タフネス0・レジェンド・±1/±1相殺等を、
優先権取得前に `stabilizeBeforePriority()` として処理する。順序は CR117.5/704.3 に合わせ、
SBA を単一イベントとして実行→pending triggers をスタックへ置く→必要なら再度 SBA、を固定点まで繰り返す。
**新 `src/engine/turn.ts`**。
誘発/SBA/ターンベースはすべて S4 のイベント/juncture に接続する。

### S3. スタックと唱える/起動/解決(CR601, 602, 605, 608)
唱える手続き(CR601)を構造化: モード選択→対象→コスト確定→支払い→スタックへ。
現 `castToStack` を母体に、モード/対象/追加・代替コストを構造ステップ化。マナ能力(CR605)は
スタックを使わない特別扱いを明示。スタックは共有ゾーン(M4.27 の能力オブジェクト/コピー基盤を流用)。
解決(CR608)= トップから1つ、効果適用。現 `resolveStackTop`/`applyCompiledEffectsForStackItem`/
`applyAutoCommand` を解決エンジンの母体に。

### S4. 能力の4分類 + イベント/継続効果(CR113.3, 603, 604, 611, 613, 614)— 設計の心臓
CR113.3 の4分類を第一級の型として持つ(現 7値 `AbilityShape` がこれを内包: activated/triggered/
delayed-triggered/replacement/static/spell/keyword)。

- **誘発型(CR603)**: trigger condition(event)+ effect。**明示イベントストリームを新設**し、
  能力が購読する。現状の prev/next 差分(`detectTriggerCandidates`)はイベントの弱い代理。
  CR700.4「イベント=あらゆる出来事」に倣い、基盤の各プリミティブがイベントを発行し、誘発は
  それを購読(observer: self/you/opponent/any)して `pendingTriggers` に入る。CR603.3 により、
  誘発はイベント直後に即スタック化せず、次にプレイヤーが優先権を得る前に APNAP 順でスタックへ置く。
  介在条件(CR603.4 intervening-if)・
  「毎ターン1回」(CR603.x)・遅延誘発・状態誘発・反射誘発を構造で表現。**新 `src/engine/events.ts`**。
- **静的(CR604)→ 継続効果(CR611)→ 層システム(CR613)**: 最難関。
  `computeEffectiveCharacteristics` が層1〜7(コピー/コントロール/文章/型/色/能力/P・T)を
  タイムスタンプ順で適用。これで「+1/+1を与える」「飛行を持つ」「○○は××になる」等の常在効果が
  effective 特性に反映され、誘発・SBA・キャスト可否が正しく動く。**新 `src/engine/layers.ts`**。
- **起動型(CR602)/マナ能力(CR605)/忠誠度(CR606)**: コスト+効果。マナ能力はスタック非経由。
  (G4 で `activationPlanForSource`/`compileAbilityCost` 実装済 — コンパイラ半が母体。)
- **呪文能力(CR113.3a)**: インスタント/ソーサリー解決時の指示。
- **置換効果(CR614)/軽減(CR615)**: スタックを使わずイベントを発生前に差し替える。
  イベントストリームに「置換フェーズ」を設け、ETB置換(タップ状態で出る・+1/+1付きで出る等)・
  ダメージ軽減を表現。

### S5. ダミー対戦相手(監視型誘発の発火基盤)
S1 のプレイヤー別ゾーンに最小ダミー相手を載せる。相手の draw/cast/着地/死亡が本物のイベントになり、
`observer:'opponent'` の誘発(例: タタル後半)が自然に発火する。対戦AIは作らない
(イベント源を生む最小実体)。

## 5. 文法コンパイラ(Compiler)— oracle文 → 基盤プリミティブ

既存の文法器トラック(G0〜G4 完了、`engine-spec` §29〜§33)を**コンパイラ半として継続**する。
基盤が整った上で、これまで踏み込めなかった誘発/継続効果/置換を束縛できるよう IR を拡張する。

段階(既存資産を再 homing):
- **G1 分割**: faces→段落→能力行(既存 `splitAbilityLines`)。
- **G2 分類**: 行→能力4分類+keyword(既存 `classifyAbilityShape`)。CR113.3 と一致。
- **G3 構造化パース(文法AST)**: 能力ごとに型付き AST へ(既存 `parseAbilityIR` を一般化)。
  今より踏み込む点:
  - **イベント文法(誘発)**: event種別 + observer + 介在条件 + 頻度 を構造化(現状は raw 文字列のみ)。
  - **主語/目的語/対象**: controller・zone・型フィルタ付き(「あなたがコントロールするクリーチャー」等)。
  - **数量・期間(duration)**: 継続効果(「ターン終了時まで」)・回数。
  - **モード・コスト節**(追加/代替)。
- **G4 束縛/プランナ**: AST→基盤プリミティブ列(拡張 `GameCommand`)。clause ごとに
  auto/guided/manual + confidence/risk/reasons を判定(既存 `compileAbilityIR` を拡張)。
  基盤の effective 特性・対象集合・イベントに束縛。
- **G5 カバレッジ計測**: 全17,491枚コーパスに対し分類・コンパイル一致率と誤謬を炙り出す
  (既存 `npm run accuracy`(§16/§28)・`npm run grammar-coverage`(§29))。誤謬は予算として
  計測管理し、頻出カードから優先的にカバレッジを上げる。

## 6. 自動化ポリシーと安全網(誤謬許容の作法)

- 誘発はイベントで検出して `pendingTriggers` に入り、優先権前の SBA/誘発処理でスタックへ置く。効果が `auto` なら自動実行、`guided` はプロンプト、
  `manual` は手動。自動度はトグル(既存 `effectsAuto` global/card)。
- すべて単一 undo 単位で可逆(サンドボックスの強行・可逆性を維持)。低信頼でも実行する代わり
  根拠を `reasons` に残す。
- **唯一の強制(CR準拠の例外, spec §17 既存)**: スタック非空ではフェイズ移動不可。
  SBA は既定自動(トグルで助言化)。

## 7. 意図的なスコープ境界(誤謬を許容/初期は非対応)

層システムの依存関係(CR613.8)・置換効果の相互作用(CR616)・特殊タイミング・サブゲーム/
次元/策略(CR729/901/904)・両面/合体/レベル等の周辺型(CR710-730)の網羅は初期非対応。
基盤は素直なケースを正しく、複雑相互作用は手動/undoで救う。

**契約改定の前提**: 本アーキは `CLAUDE.md` L35「完全ルールエンジンには踏み込まない」の緩和を伴う。
緩和の正式承認と型・不変条件の契約化は、後述 **M-CONTRACT** で行う(本書は設計記述のみ)。

## 8. マイルストーン・ロードマップ(このアーキを背骨に一新)

`1セッション=1マイルストーン` で着手できる粒度へ分解。各マイルストーンは独立して出荷可能
(機械チェック4点通過・回帰なし・不変条件維持・スナップショット前方互換)。
既存の G0〜G5 文法器トラックは**コンパイラ半に吸収**、精度向上プログラム(Phase B/C)は
**C-COVERAGE に畳む**。V4オンライン/V3デザインは背骨の後ろへ再配列する。

**最重要の順序原則(2026-06-23 改訂)**: 先頭に来るのは実装ではなく **理解→エンジン落とし込みの
モデリング・サイクル**。「エンジンは何を変数として持つべきか」という state 設計を、ルール面と
カードテキスト面の二面から磨き、収束してから実装へ移る。手法の正本は **`docs/engine-design-method.md`**。

### M0 — モデリング・サイクル(先頭・反復・"磨き続ける")
- **M0**: `docs/engine-design-method.md` の手法に従い、生きた2成果物
  **エンジン状態オントロジー(ESO)** と **オラクル文法⇄状態変異カタログ** を、CR(上から)と
  17,491枚コーパス(下から)の二面分析で収束まで磨く。スライス順(有効特性/層 → イベント語彙 →
  ゾーン/プレイヤー → タイミング/SBA)。完全な物差しは無い前提で **multi-oracle・3状態・反証**の
  KPIを併走。**コードは書かない**(Codex は下面のコーパス抽出のみ)。収束基準(churn 閾値・頭被覆)
  を満たしたら凍結ゲートへ。

### 凍結ゲート(M0 収束後・spec承認)
- **M-CONTRACT**: M0 で収束した state モデルを契約へ**凍結**する。`CLAUDE.md` L35 緩和の承認(済)
  + `engine-spec.md` §34(GameObject/有効特性/イベント/プレイヤー別ゾーンの型・新不変条件 I13+・
  スコープ境界・前方互換・KPI/物差し)。*契約のみ、エンジンコードなし*。§34 は M0 完了まで draft。

### 基盤半(土台。コンパイラ束縛の前提)
- **S-EVENTS**: `events.ts` 新設。`commands.ts` の各プリミティブがイベント発行(ETB/LTB/death/
  draw/cast/phase-change 等)。純粋追加で挙動不変。`gameStore` の差分検出をイベント購読へ移行。
- **S-LAYERS**: `layers.ts` 新設。`computeEffectiveCharacteristics`(層7 P/T・層6 能力・層4 型・
  層5 色を最小)。`status.ts` と def 直読み箇所を段階移行(旧経路はパリティ確認まで残す)。
- **S-ZONES**: プレイヤー別ゾーン一般化(S1)。前方互換写像。I1/I2 一般化。
- **S-TURN**: `turn.ts` 新設。戦闘サブステップ・ターンベース処理 juncture 化・SBA 自動(トグル助言)。
- **S-ABILITY+DUMMY**: 能力4分類の第一級化(S4)+ 誘発のイベント購読(observer/介在条件/頻度)
  + ダミー相手(S5)。**= 複数誘発 routing 破綻の根治**。
- **S-CONTINUOUS**: 静的→継続効果を層エンジンへ接続。起動/マナ/置換(ETB置換)最小実装。

### コンパイラ半(既存 G トラックの延長)
- **C-GRAMMAR**: `ir.ts` 拡張 — イベント文法・主語目的語フィルタ・期間・モード/コスト節
  (母体 `parseAbilityIR`)。
- **C-BIND**: `compile.ts` 拡張 — AST→基盤プリミティブ束縛、clause別 auto/guided/manual
  (母体 `compileAbilityIR`)。
- **C-COVERAGE**: コーパス計測でカバレッジ拡大・誤謬予算管理(精度プログラム Phase B/C を吸収)。

### 自動化半
- **A-LOOP**: 自動発火/解決ループ + 自動度トグル + 助言(条件/頻度/confidence)+ override UI
  (`src/components/playmat/`)。

### その後(既存ロードマップを再配列)
- **V4 オンライン4人EDH**: プレイヤー別ゾーン+ダミー相手基盤が土台になる。→ **V3 デザイン磨き**。

**依存関係**: **M0(モデリング・サイクル)→ M-CONTRACT(凍結)→** S-EVENTS / S-LAYERS(並行可)
→ S-ZONES → S-ABILITY+DUMMY(events必須)→ S-CONTINUOUS。C-GRAMMAR/C-BIND は events+layers
成立後に着手。C-COVERAGE は随時。A-LOOP は S-ABILITY 後。実装(S-*)は M0 が紙の上で state 設計を
収束させて初めて安全に着手できる。

## 9. 検証方針

- **単体**: triggerSpecs/AST に2題材の実 oracle(真面目な身代わり=ETB(self)/death(self)、
  タタル=ETB(self)/draw(opponent, once-per-turn, intervening))を与え分離を確認。
  `computeEffectiveCharacteristics` の層適用(+1/+1・付与キーワード)。
- **統合**: 真面目な身代わりが ETB/死亡を別々に正しく自動解決。ダミー相手ドローでタタル監視型が
  条件・頻度評価のうえ発火。
- **回帰+不変条件**: 既存 `triggerCandidates`/`review.*` テスト、I1〜のプロパティ
  (プレイヤー別へ一般化)、機械チェック4点(`npm run lint`/`npx tsc --noEmit`/`npx vitest run`/
  `npm run build`)、`npm run accuracy` で誤謬率を可視化。

## 10. 主な対象ファイル

- **基盤**: `src/engine/types.ts`(GameObject/プレイヤー別ゾーン/プレイヤー/イベント)、`init.ts`、
  `commands.ts`(プリミティブ拡張・解決エンジン・SBA・ターンベース)、新 `src/engine/layers.ts`
  (有効特性)、新 `src/engine/events.ts`(イベント/購読)、新 `src/engine/turn.ts`
  (フェイズ/ステップ/juncture)。
- **コンパイラ**: `src/engine/grammar/ir.ts`・`compile.ts`・`index.ts`(AST拡張・束縛)、
  新 triggerSpec、`src/data/ruleClassifier.ts`。
- **状態/UI**: `src/store/gameStore.ts`(イベント駆動の検出・自動度・undo)、
  `src/components/playmat/`(自動度トグル・助言・行別経路)。
- **契約**: `CLAUDE.md`(設計原則の改定)、`docs/engine-spec.md`(新章「ルール基盤+文法コンパイラ」:
  型・不変条件・スコープ境界・前方互換)。

## 11. 役割分担(プロジェクト規約)

契約(spec)改定の承認・監査・コミット/リリースは Fable。重い実装は Codex が自己完結ブリーフで
1マイルストーンずつ。本書は設計図であり、実装は **M-CONTRACT → 基盤 P1(S-EVENTS〜)** から段階着手する。
