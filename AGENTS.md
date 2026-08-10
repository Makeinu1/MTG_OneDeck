# MTG_OneDeck 開発統治（モデル非依存の正本）

統率者戦（EDH）一人回しWebアプリ。React + TypeScript + Vite のサーバーレスSPA。
目的は二つある。自分のデッキで遊び「理解と発見の快感」を得ること、そしてMTG総合ルール（CR）を検査可能な`GameState`と可逆な`GameCommand`列へ落とし、英語Oracle文を段階的にコンパイルすること。
カードデータはScryfall API（日本語版優先・IndexedDB cache）、公開先は https://makeinu1.github.io/MTG_OneDeck/ 。

> 本ファイルが常設統治の正本。詳細手順は下記の各正本へ委譲し、ここで再定義しない。`CLAUDE.md`は歴史的な互換入口にすぎない。

## 正本の地図

- 裁定・優先度・コールドスタート: `docs/judge-protocol.md`
- 反復手順・役割別cycle・token economy: `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- Tier-1監査: `.claude/audit-standing.md`
- 状態と次スライス: `research/cr-grounding/cr-backbone-ledger.json`（履歴は同`-history.json`）
- エンジン契約・受け入れ・UI/AV契約: `docs/contracts/manifest.json` と `docs/acceptance/scenarios.json`
- 旧入口: `docs/engine-spec.md`、`docs/acceptance.md`、`docs/audio-visual-contract.md`
- 機械チェック: `npm run check:docs` / `npm run check:fast` / `npm run check:domain` / `npm run check`、禁止ファイル走査: `npm run check:forbidden -- --diff <base>`
- M0の分担・相関遮断: `docs/engine-design-method.md` §7–8

## 役割と品質境界

役割はモデル名でなく能力で定義する。

- **判定者（judge/orchestrator）**: 契約承認、CR裁定、`review.*`、台帳、`docs/`、git、出荷を所有する。
- **実装者（implementer）**: ソース、通常テスト、機械作業、契約草稿を担う。判定者専有物とgitを触らない。
- **冷監査者（cold auditor）**: 実装文脈を持たず、凍結成果物を敵対的に監査してfindingsだけを返す。

実行順、R0〜R3のリスク分類、affected/domain/release lane、BROAD監査予算、fingerprint規律は `document-governance.md` に一本化する。

実装者と受け入れ基準作者・監査者を同一にしない。実装と判定を同じタスクで行った場合も、別主体の冷監査までは`implemented-not-audited`であり、正式出荷しない。別主体は次のいずれかとする。

- `fork_context: false`のサブエージェントへ、実装理由を含まない監査ブリーフのパスだけ渡す。
- 実装履歴を持たない別Codexタスクへ、同じブリーフのパスだけ渡す。

冷監査者はファイルを編集しない。判定者がfindingsを裁定し、BLOCKER/HIGH = 0になるまで昇格しない。statusを`shipped`へ上げる条件は全て必須:

1. 独立冷監査がBLOCKER/HIGH 0。
2. findings記録が台帳noteまたは`research/cr-grounding/archive/`に存在。
3. `npm run check`が全緑。
4. 該当`review.*` / golden evidenceが緑。
5. commitメッセージに冷監査の識別子を記載。

「コード変更なし」「メタデータのみ」「既存テスト緑」は冷監査省略理由にならない。詳細な監査ループとprecedentはSkillおよび`research/cr-grounding/archive/governance/`を参照する。

## 1タスク=1マイルストーン

- 新しいトップレベルタスクにはmilestone ID、base SHA、ブリーフパス、Goal、Constraints、Done whenだけを渡す。過去タスク全文やReferenced chatを引き継がない。
- 通常の上限は実装者1名と冷監査者1名。両者とも`fork_context: false`。一般探索だけのサブエージェントは作らず、独立読取は同一`functions.exec`内でbatch化する。
- 修正は同じ実装者へ返し最大2回。2連敗し、判定者の有界な外科修正でも閉じられなければSTOPする。
- UI・音・演出は専用worktree/dev fixtureの試作タスクと本実装タスクを分離し、人間承認した値とscreenshotを凍結してから新しい本実装タスクを始める。
- 実装中の追加要望は、現受け入れ条件の失敗または致命回帰だけ割り込ませる。それ以外は台帳へ短く記録して次タスクへ送る。
- 実装中は対象テストだけを回す。候補treeを凍結して対象`review.*`と実機証拠を揃えた後、フルcheckより先に冷監査を行う。BLOCKER/HIGH 0なら`AUDIT-OK-PENDING-FULL-CHECK`とし、監査修正と対象再監査を閉じてからrelease treeを再凍結し、同一fingerprintでフル`npm run check`を1回だけ行う。フルcheck自身が欠陥を検出した場合だけ、修正・無効化された対象検証・必要な再監査後に最終フルcheckを再実行する（上限2回）。
- ship時に`.claude/loop-state.md`を`milestone: complete`へ戻し、完了packetをarchiveしてタスクを終了する。

## 不可侵

- 実装者はgit操作（add/commit/push/branch/stash）禁止。
- 実装者は`review.*`を名に含むテストを変更しない。落ちたら実装を直す。
- 実装者は`AGENTS.md`、`CLAUDE.md`、`eslint.config.js`、`CACHE_SCHEMA_VERSION`、`docs/`、台帳、`docs/judge-protocol.md`を変更しない。
- 判定者在席時の草稿先は`research/cr-grounding/*.draft`。契約=`<key>.draft.md`、順序候補=`planned-sequence-batch*.draft.md`、台帳提案=`ledger-update.draft.json`。
- 決定論的CR裁定は固定CRを引いて終了し、prompt再走・多数決をしない。
- 北極星・契約原則の変更、依存追加/更新、データ削除、通常Pages push以外の外部書込、秘密情報はユーザー裁定。

## 自律境界

STOPしてユーザーに聞くのは4類だけ:

1. 優先度式でも解けないロードマップ上の真の価値判断。
2. CRで一意に解けない真の曖昧。
3. 北極星/契約原則変更または不可逆・通常Pages pushを超える外部書込。
4. 実装者2連敗かつ有界な外科修正で閉じられない。

公開・外部送信・戻せない決定は確認が既定。例外は`/ship`で、監査合格と全check緑を認可としてpush、CI、Pages確認まで自走してよい。手順は`.claude/commands/ship.md`を参照する。

## エンジン規律

- `src/engine/`は純粋関数のみ。React/DOM/Zustandに依存しない。
- `GameState`はイミュータブル（構造共有）。`applyCommand`は決定的で、乱数はコマンド生成時にpayloadへ固定する。
- undo/redoはstoreのsnapshot方式、上限200。GameStateへzone/fieldを追加したら`restoreGame`で旧snapshotをbackfillする。
- 文法コンパイラはGameStateを直接書かず、拡張`GameCommand`列だけを生成する。LLM judgeは助言のみで盤面を変えない。
- サンドボックスは警告・確認を示してもユーザーの強行を許す。ただしstack未解決中のphase/turn移動はCR準拠で禁止する。
- D&D・ダブルクリック専用操作を作らず、すべてに右クリックメニューの代替を用意する。

## 北極星

- **北極星①「CR を検査器にする」**: 決定論的な問いは`rule/Magic_The_Gathering_Comprehensive_Rules.txt`（2026-06-19固定）を一次権威とし、真理表/不変条件で検査する。権威順はCR > 人間gold > LLM（解釈のみ）。
- **北極星②「理解と発見の快感を、身体に馴染むリズムで支える」**: 同じ意味操作へ同じ手触りを返す。通常操作を連鎖・履歴・カード強度で採点せず、成功済みの意味イベントだけを鳴らす。GameStateを演出待ちさせない。明示的な儀式は統率者castだけ。
- **北極星③「メタは遊びに従属する」**: メタは実プレイ摩擦、state手戻り、compiler着地先のいずれかを改善しなければ作らない。通常Commander/EDH scope内をCR章・節順で進め、必要最小substrateだけ先行する。MyDeckはgolden/replayと同CR順位のtie-breakに使う。

## 検証

- 実装者の合格自己申告を判定に使わない。判定者が`review.*`を所有し、冷監査者が独立検証する。
- fast-checkはactive engine contractに宣言された不変条件を維持し、状態追加時は対応不変条件も追加する。
- `npm run check`はlint、vitest、`tsc -b`を含むbuildの単一正本。素の`tsc --noEmit`はno-opなので使わない。
- 受け入れシナリオは1項目でも失敗したら、修正後にそのシナリオ全体を最初から再実行する。
- UI変更は安定後の同一browser sessionで一度だけ、375×812、812×375、1440×900の実機とconsole error 0を確認する。
- Scryfall変更は実APIで確認してから仕様化し、ルール解析は英語`oracleText`を正本、`printedText`は表示専用とする。
- 最終GameState差分まで確認する実行可能replayがない効果を「自動化済み」と表示しない。未対応複合挙動はguided/manualへ誠実に縮退する。

## コーディング・報告・出荷

- TypeScript strict、`any`禁止（`unknown`+型guard）。UI文言は日本語、コード/コメント/識別子は英語。
- カード名は`printedName ?? name`を《》で表示。主要UIに`data-testid`を付ける。
- conventional commits、署名なし。`git add -A`は禁止し変更ファイルを明示する。除外前に`git grep -n "<name>" -- docs/ research/`で契約参照を確認する。
- 実装者報告は変更ファイル、受け入れ結果、defer、未解決点を含める。中断時は実装済み/残作業を分ける。
- `main` pushでActionsがtest→build→Pagesを実行する。出荷後はCI success、公開URL 200、worktree cleanを確認する。
