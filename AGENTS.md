# MTG_OneDeck 開発統治(モデル非依存の正本・常設)

統率者戦(EDH)一人回しWebアプリ。React + TypeScript + Vite のサーバーレスSPA。
正体は二重: **自分のデッキで遊び「理解と発見の快感」を得る道具**であると同時に、**MTG総合ルール(CR)を検査可能な GameState と可逆な GameCommand 列へ落とし込み、oracle 文を段階的にコンパイルしていく実験場**(北極星②③の対象)。
カードデータは Scryfall API(日本語版優先・IndexedDBキャッシュ)。公開先: https://makeinu1.github.io/MTG_OneDeck/ (main への push で GitHub Actions が test→build→Pages デプロイ)。

> **このファイルが統治の正本**。ChatGPT/Codex は起動時に本ファイルを読む。手順の詳細は各正本へ委譲し**散文で再定義しない**。`CLAUDE.md` は Claude を使う場合の互換入口で、本ファイルを参照するだけ(独自の優先順位・モデル表・復帰待ち条件を持たない)。

## 統治の読み方(単一正本の地図)

- 裁定準則・優先度式・コールドスタート読込順 = `docs/judge-protocol.md`(読込順の正本は §0)
- 反復ワークフロー = `.agents/skills/mtg-onedeck-development/`(SKILL.md + references/{cycle,token-economy}.md)。`.claude/commands/{milestone,audit,ship,autoloop}.md` は同 Skill への薄い互換参照(STOP条件・委譲規律の正本 = autoloop.md、/ship 手順の正本 = ship.md)。
- Tier-1 監査の常設規約 = `.claude/audit-standing.md`
- スライス状態・次スライス = `research/cr-grounding/cr-backbone-ledger.json`(退避済み履歴 = 同 `cr-backbone-ledger-history.json`)
- 機械チェック = `npm run check` / 禁止ファイル走査 = `npm run check:forbidden`(`scripts/checks/` が正本。散文で再定義しない)
- M0(モデリング・サイクル)の分担・相関遮断 = `docs/engine-design-method.md` §7–8

## 役割 = 能力で定義(モデル名でなく席で。ChatGPT だけで完結できる)

プロジェクトは3席で回る。**どの席も Codex(qwen3.8-max-preview 経由)で担当可**。Claude は解約済み(2026-07-22)——歴史的互換として `CLAUDE.md` は残すが、監査・助言・green のいずれにも使わない:

- **判定者(judge / orchestrator)**: 契約(spec)の承認・CR 裁定・`review.*`・台帳・`docs/`・git commit/push/出荷を所有。決定・再オーナー化を保持する。
- **実装者(implementer)**: ソースと通常テスト・機械チェック・契約や決定論的判断の**草稿**を担う。git・`review.*`・統治ファイルは触らない(下記不可侵)。
- **冷監査者(cold auditor)**: 実装文脈を持たない別セッション。**findings only** で監査し、契約・盤面を変えない。

**相関遮断は全状態で不変の要石**: 実装者と受け入れ基準の作者・監査者が同一だと循環(ゴールポストが動く)。ゆえに凍結・信頼・最終コミットの前に必ず**実装文脈を持たない別主体による独立監査を1回**通す。**同一セッションが判定と実装を兼ねた場合は、実装文脈を持たない別主体が監査するまで `implemented-not-audited` とし正式出荷しない**(fake-green 禁止——通らない条件を通ったことにするより FROZEN 撤回を維持して正直に報告する方が正しい・M-CR-RECONCILE の precedent)。

**「別主体」の満たし方(2026-07-22 明文化・precedent=Wave 0-2 冷監査 Gibbs)**: 以下のいずれかで「実装文脈を持たない別主体」を満たす:
- **サブエージェント(`fork_context: false`)**: 親セッションの会話履歴を継承しないサブエージェントを spawn し、監査ブリーフ(ファイル)だけ渡す。親はブリーフに実装の正当化を書かない(「この domain は shipped 相当か確認して」ではなく「この status 主張を敵対的に検証せよ」と書く)。findings は親が裁定するが、findings の生成自体は親の文脈から独立している。
- **別 Codex タスク**: 完全に別のタスク/セッションで、監査ブリーフのファイルパスだけ渡して実行する。
- いずれの場合も、監査者は**ファイルの編集禁止・findings only**。親セッションが findings を裁定し、HIGH 以上は修正後に再昇格する。

**shipped 昇格の機械的条件(2026-07-22 裁定強化・precedent=Wave 0-2 冷監査スキップ事故)**: 台帳 domain の status を `shipped` へ昇格するには、以下の**全て**が揃っていなければならない。1つでも欠ければ `shipped` への書換は fake-green として差し戻す:
1. 冷監査(実装文脈を持たない別セッション)が findings only で通過し、BLOCKER/HIGH = 0 であること
2. 冷監査の findings 記録が台帳 note か `research/cr-grounding/archive/` に存在すること
3. `npm run check` 全緑であること
4. 該当 domain の evidence(review.* / golden)が緑であること
5. 判定者が commit メッセージに冷監査のセッション識別子を記載すること

**例外なし**: 「コード変更がない」「メタデータのみ」「既存テストが緑」は冷監査スキップの正当化にならない。status 昇格自体が「この domain は完了した」という主張であり、その主張の正当性は実装者と同じセッションが検証してはならない(相関遮断)。

## 1セッション完結の監査ループ(2026-07-22 確立)

判定者セッション内で実装→監査→ship を完結させる標準手順。サブエージェントの `fork_context: false` により、1セッション内で相関遮断を満たす。

1. **判定者**: 実装・evidence テスト確認・台帳更新を行う
2. **判定者**: 監査ブリーフを `research/cr-grounding/<key>-cold-audit-brief.draft.md` に書く。ブリーフには以下を含める:
   - 監査対象(domain id・claimed status・evidence テスト一覧)
   - 監査手順(テスト実行・boundary 検証・spot-check・adversarial check)
   - 出力形式(domain ごとに verdict: SHIPPED-OK / BLOCKER / HIGH / MEDIUM / LOW)
   - 制約(ファイル編集禁止・findings only・CR 参照先)
   - **禁止**: 「shipped 相当か確認して」等の確認バイアスを誘発する文言。代わりに「status 主張を敵対的に検証せよ」と書く
3. **判定者**: サブエージェントを `fork_context: false` で spawn し、ブリーフのファイルパスだけ渡す
4. **冷監査者(サブエージェント)**: ブリーフを読み、テスト実行・boundary 検証・spot-check・adversarial check を実施。findings を返却
5. **判定者**: findings を裁定する:
   - SHIPPED-OK → shipped 昇格
   - MEDIUM → boundary/note 修正後に shipped 昇格(修正内容を note に記載)
   - HIGH → boundary/note 修正後に shipped 昇格(修正必須・修正内容を note に記載)
   - BLOCKER → shipped 不可。実装修正→再監査
6. **判定者**: commit メッセージに冷監査のセッション識別子(agent id)を記載し、push

**ループの自動化**: 複数 domain の一括監査は、ブリーフに全 domain を列挙し、サブエージェント1回で全 domain の findings を返却させる。判定者は findings を一括裁定して1 commit にまとめる。

**precedent**: Wave 0-2(2026-07-22・冷監査 Gibbs `019f86f2`)。13 domain 監査で 2 HIGH(boundary stale: cr-106-mana の 605.1b 実装済み未反映・cr-506-510-combat の trample 実装済み未反映)+ 2 MEDIUM(boundary stale + evidence 借用)を捕捉。実装者と同じセッションでは自己矛盾に気づけないことを実証。

**現在値**(割当更新はこの行だけ編集): 判定者・実装者・冷監査者すべて **Codex(qwen3.8-max-preview 経由)** で担当可。親セッション=判定者、サブエージェント(`fork_context: false`)=実装者または冷監査者。冷監査は上記「1セッション完結の監査ループ」で回す。`CLAUDE.md` は歴史的互換のみ(Claude 解約済み・2026-07-22)。反復手順の正本 = `.agents/skills/mtg-onedeck-development/`。

**原則**(全席共通):
- **トークン経済**: 高能力モデルのトークンは「判断」(裁定・承認・go/no-go)にだけ使い、機械化できるもの(実装・草稿・計測・機械チェック)は全部実装者・サブタスク・スクリプトへ寄せる。判定者が raw ソース精読・diff 行読み・契約/テスト初稿の自筆をしたら委譲漏れのシグナル(正本 = token-economy.md)。
- **助言≠決定**: 照合に還元できない生の分析(アーキ・真に曖昧な CR 解釈・spec 変更)は別の冷たいセッションへ助言照会してよい。ただし助言者は盤面・契約・`docs/`・`review.*` を変えず、決定・commit・再オーナー化は判定者が保持する。
- 判定の大半は外部権威(CR 真理テーブル・`review.*`・機械チェック・非LLM物差し)への**照合**に還元済みで判定者の地力に依存しない。照合に還元できない判断は `docs/judge-protocol.md` の lookup へ、それでも確信が持てなければ STOP→ユーザー。
- 契約(spec)の初稿・決定論的判断の**草稿**は実装者に書かせてよい(根拠 CR 条番号併記・自分のレーン `research/cr-grounding/*.draft` へ)。`docs/`・`review.*` への反映と commit は判定者。
- **例外**: 監査中に見つけた数行規模の外科的修正のみ、判定者が直接行ってよい。

## 不可侵(常時・違反は監査で差し戻し。機械検出 = `npm run check:forbidden`)

- **実装者は git 操作禁止**(add/commit/push/branch/stash すべて。コミットは監査合格後に判定者が行う)。
- **実装者は `review.*` を名に含むテストを変更しない**(判定者専有。これが落ちたら実装側のコードを直す)。
- **実装者は `CLAUDE.md`・`AGENTS.md`(本ファイル)・`eslint.config.js`・`CACHE_SCHEMA_VERSION` を変更しない**。判定者在席時は `docs/` の直接変更も禁止(草稿は `research/cr-grounding/*.draft` へ・根拠 CR 条番号併記)。
  - 草稿レーンの定型: 契約草稿=`<key>.draft.md` / plannedSequence 補充候補=`planned-sequence-batch*.draft.md`(CR 条番号+MyDeck 実プレイ摩擦の根拠必須・順序の最終判断はしない)/ 台帳更新の提案=`ledger-update.draft.json`(台帳本体は触らない)。
- 台帳 `research/cr-grounding/cr-backbone-ledger.json` と `docs/judge-protocol.md` は判定者専有(実装者は読み参照のみ)。
- 凍結・信頼・最終コミットの前に必ず**独立監査を1回**通す(上記の要石)。
- ルールが一意に答える決定論的 CR 裁定は **CR を引いて終了**する(prompt 再走・多数決で希少トークンを浪費しない)。
- **北極星・契約原則の変更、不可逆な外部書込(依存追加/更新・データ削除・外部API書込・秘密)はユーザー裁定**。

## 自律境界(何を確認なしで進めてよいか)

- 公開・外部送信・戻せない決定は確認が既定。**唯一の例外 = `/ship`**: 監査合格(`npm run check` 全緑 + `review.*` 緑)を認可とみなし、人間確認なしで push/Pages 公開まで自走してよい。/ship は機械的手順ゆえ別タスクへ**最大1回だけ**委譲可(手順・検証の正本 = `.claude/commands/ship.md`)。
- 止まってユーザーに聞くのは4類のみ(正本 = autoloop.md の STOP 条件): ①ロードマップ分岐の価値判断 ②CR 解釈の真の曖昧 ③不可逆・外部書込(通常の Pages push を除く)④実装者2連敗かつ有界な外科修正で直らない。
- **セッション運用**: 既定は「1タスク=1マイルストーン。終わったら文脈を切る」(長大セッションは文脈再読でトークンを最も浪費する)。継続が要る場合は loop-state と台帳が継続性を担保する。定型ワークフローは milestone/audit/ship を呼ぶ(手順の再生成を避ける)。

## 契約ドキュメント

- `docs/engine-spec.md` — エンジンAPI契約。型名・関数名・挙動の変更は**実装前に**判定者の承認が必要。仕様変更はまず spec を更新してから実装する。
- `docs/acceptance.md` — 受け入れシナリオ(判定者が維持)。受け入れゲートでは**1項目でも失敗したら修正後にシナリオ全体を最初から再実行**する。

## エンジン規律(`src/engine/`)と設計原則

- **純粋関数のみ**。React/DOM/Zustand に依存しない。**GameState はイミュータブル**(構造共有)。`applyCommand` は決定的——乱数はコマンド生成時に確定しペイロードへ順列を埋め込む。
- undo/redo はスナップショット方式(ストア層が履歴を保持・上限200)。**GameState に zone/フィールドを追加したら `restoreGame` で backfill 必須**(旧 snapshot 復元でクラッシュする。前方互換 I16)。
- 文法コンパイラは GameState を直接書かない——**拡張 `GameCommand` 列のみ生成**(誤訳も undo で戻る)。LLM ジャッジは助言のみで盤面を変更しない。設計 = `docs/architecture-substrate-compiler.md`、手法 = `docs/engine-design-method.md`、契約 = engine-spec §34。
- **サンドボックス哲学**: ルールは強制しない(警告・確認は出すがユーザーは常に強行できる)。**例外**: スタック未解決中のフェイズ/ターン移動は MTG ルール準拠で禁止(強行不可・先にスタックを解決)。
- すべての操作に右クリックメニューの代替を用意する(D&D・ダブルクリック専用の操作を作らない)。

## 🧭 北極星は3本(①正しさ ②気持ちよさ ③作り方。いずれの変更もユーザー裁定)

- **北極星①「CR を検査器にする」(決定論は予測せず照合する)**: ルールが一意に答える問い(ゾーン遷移・owner/controller・キーワード定義・SBA[CR704]・ターン構造[CR500]等)は総合ルール(`rule/Magic_The_Gathering_Comprehensive_Rules.txt`・**2026-06-19 版に固定**)を一次の決定論的権威とし、CR から抽出した**真理テーブル/不変条件で成果物を叩く**。LLM(物差し・ジャッジ)は解釈・認識・相関遮断にのみ使う。**権威順序 = CR > 人間 gold > LLM-oracle(解釈のみ)**。本体 = `docs/engine-design-method.md` §3。
- **北極星②「理解と発見の快感を、静と動のリズムで祝祭にする」**: 届ける快感は「勝利」でなく**知的高揚**。常時は静か、デッキが動き出す瞬間だけ一段盛る。祝祭の優先順位=スタックの物語>統率者の登場>連鎖感>初手の儀式。本体 = `docs/design-vision.md` §2。
- **北極星③「メタは遊びに従属する」**: 型・契約・台帳・運用はすべてメタであり、①実プレイの困りごと削減 ②state 設計の手戻り削減 ③コンパイラ着地先の明確化のどれかに答えられなければ**作らない・削る**。新しい抽象の昇格判定 = 実デッキ需要 × CR根拠 × 既存プリミティブへの分解可能性。**スライス優先度の最上位シグナル = MyDeck 実プレイ需要**(正本 = judge-protocol §2)。本体 = `docs/engine-design-method.md` §9。

## 検証プロトコル

- 実装側の「テスト通過」報告は合否判定に**使わない**。判定者が独立に敵対的テストを書いて判定する(`review.*` = 判定者専有)。
- fast-check プロパティテストの不変条件(`docs/engine-spec.md` の I 系列すべて)を維持する。GameState に状態を追加したら対応する不変条件も追加する。
- 機械チェックは `npm run check`(lint / vitest / build を個別実行。build の `tsc -b` が型検査——素の `tsc --noEmit` は本リポでは no-op)。生成した `dist/` は確認後に削除する。
- UI に見える変更はブラウザ実機(`.claude/launch.json` の `mtg-onedeck`)で確認。**コンソールエラー0件**が合格条件。実機確認は要所のUIだけ(eval往復はトークン高)。
- Scryfall 連携の変更は**実 API で裏取りしてから**仕様化する(API ドキュメントと実挙動の差で重大バグが複数出た実績)。カードのルール解析は英語 `oracleText` を正本とする(`printedText`(日本語)は表示専用)。
- **効果を「自動化済み」と表示してよいのは、最終 GameState 差分まで確認する実行可能 replay がある場合のみ**。未対応の複合挙動は可視的に guided/manual に留め、部分効果を「解決済み」と偽らない。

## コーディング規約

- TypeScript strict。**`any` 禁止**(やむを得なければ `unknown`+型ガード)。
- UI 文言は日本語、コード・コメント・識別子は英語。カード名表示は `printedName ?? name` を《》で囲む。
- conventional commits(`feat:` / `fix:` / `docs:` / `chore:` 等)。署名は付けない。
- `git add` は変更ファイルを明示指定する(`-A` 禁止)。ファイルを「無関係」として除外する前に `git grep -n "<name>" -- docs/ research/` で契約参照の有無を確認(参照ありなら除外禁止)。
- 主要 UI 要素には `data-testid` を付与する(レビューのブラウザ自動操作で使用)。

## 受け入れ標準・報告様式(実装者向け)

- **機械チェック全通過**: `npm run check`(正本 = `scripts/checks/machine-checks.mjs`)。既存テストの回帰なし。ブリーフ指定の golden ケースが実行可能テストに配線されていること。UI に見える変更はコンソールエラー0件。
- **優先順位(矛盾時)**: 本ファイル(統治)> ブリーフ(タスク固有・判定者発行)> 個別の慣習。ブリーフは本ファイルの共通則を再掲しない前提で書かれる——ここに書いてあることはブリーフに無くても常に有効。
- **完了報告**: ①変更ファイル一覧 ②各受け入れ条件の実結果(コマンド出力の要点) ③defer した事項 ④未解決点・自信のない箇所。**あなたの「テスト通過」自己申告は合否判定に使われない**(別セッションの独立監査が敵対的に検証する)——粉飾せず未完・懸念を正直に書くことが最も価値がある。
- **中断報告**: 「実装済み/残作業」を明示して終了(判定者が再実行を判断する。再実行は最大2回、以後は判定者が仕上げる)。

## デプロイ

- main へ push すると GitHub Actions が `npm test` → ビルド(`--base=/MTG_OneDeck/`)→ Pages デプロイを実行する(テストが落ちるとデプロイされない)。デプロイ後は https://makeinu1.github.io/MTG_OneDeck/ が 200 を返すことを確認する。
- Hugging Face Spaces(Static)へは `npm run build` の `dist/` をそのままアップロード可能。
