# MTG OneDeck：共通Cockpit開発計画・次タスクへの引継ぎ

更新: 2026-09-10。状態: 計画確定、実装未着手。ファイル名の日付は作成日を維持する。

## 1. 目的・権威・権限

Goal: ユーザーが日常的に一人回しを使い、困った操作を小さく改善でき、その改善が同じエンジン・セッション処理・UIの2人/4人対戦へ届くプロダクトにする。管理する実装・変換・入口を減らす。
Non-goals: 全CR/全カード自動裁定、高度なAI対戦、汎用framework、独立した対戦UI、最初からの全機能完成、新サービス/依存更新、今回の公開。
Acceptance criteria: 各段階を通常のUI操作で確認でき、共通操作に別実装を足さず、保存を保全し、置換する旧経路と退役条件が明確になる。
What stays untouched: 元チェックアウトの未完了作業、既存保存・デッキ・公開済み部屋、設定/認証情報。元データ削除、commit/push/deploy/外部書込みを行わない。

要求の正本は[product-requirements](product-requirements.md)、操作範囲は[UX仕様](cockpit-ux-requirements-2026-09-09.md)のJ-01〜05/M-01〜11。本書は開発順序と引継ぎの正本。[比較書](cockpit-architecture-comparison-2026-09-10.md)は技術根拠・実証条件を参照する。旧[統合仕様](cockpit-specification-2026-09-09.md)と旧アーキテクチャ案は素材であり、旧D・二人先行・soloローカル固定・自動支援全保全を実行指示として採用しない。

ユーザーは設計判断を委任し、本計画に基づく次タスクでのローカル開発を依頼した。既決事項の再承認は不要。必要なコード・契約・既存検査の更新は対象範囲内で行う。既存のユーザー作業を失う操作、本番データ変更、外部公開の権限はない。許可が必要な操作に至ったら、それまでに具体的にレビューできる成果を用意する。

## 2. 変えない思想と初期構成

- 同じエンジン・操作支援・セッション処理・Cockpitを使い、一人回し→2人対戦→4人対戦の順に完成する。共通化は同じ意味の責任を共有することであり、巨大な一ファイルや設定frameworkにまとめることではない。
- 一人回しもサーバー正本の非公開セッションを第一候補として、最初の実用経路で実証する。クライアントは表示・私的選択を持ち、盤面の確定は一箇所。先回りして別のローカルエンジンや二host実装を作らない。
- 人間の人数とゲーム席を分離する。最初は人間1人＋通常の相手1席に受け身Bot。島だけの練習デッキを使い、通常のカード/領域/ライフ/対象として扱う。偽のネットワーク接続やBot専用エンジンは不要。
- Botは限定した定型操作だけを同じ認可・確定経路へ送る。通常は応答・攻撃・ブロックをしない。複雑な選択は人が代行。HOLD/未完処理/通信異常/undo直後は停止し、意図しない自動再実行やターン連続消化をしない。
- 人がルールを判断し、アプリは選択・計算・確定・履歴を助ける。マナ生成/自動タップ/支払いとキーワード手動操作に必要な解析を保全し、一般効果・誘発・置換の自動判断を縮小する。
- 通常操作はmaster、部屋管理は部屋主。部屋主が不在masterの操作権を回収し、Kickできる。部屋主不在中は停止し、所有権移譲はしない。ゲーム上の脱落だけでは管理権限を失わない。
- Kick/脱落/終局は確定後に回復不可。確定前に対象と取消不可を表示する。通常undoはその境界とターン境界を越えず、soloのredoは維持する。
- 部屋は最終利用から6時間で失効。部屋主不在中の他席接続やpingでは延命しない。soloの保存checkpointとデッキを6時間で削除する意味ではない。
- PC 1440×900を基準。対戦スマホは対象外、812×375のsoloは希望要件。カードの見やすさ、統率者演出、同じ操作の手触りを保つ。

## 3. 段階と完了条件

開始時点ではすべて未着手。過去のCI、旧online、モック、設計レビューの合格を新方式の実績にしない。

| 段階 | ユーザーが得る成果 | 完了条件 |
| --- | --- | --- |
| P0 開発基点 | 既存作業を壊さず開発開始できる | §5の最小読込みと差分確認を済ませ、P1の変更対象・保全対象・旧入口を本書へ短く記録。計画の再作成だけで止まらずP1へ進む |
| P1 最初に触れる一人回し | 実デッキと相手1席で、一手を処理し、戻し、保存から続けられる | 下記の一続きの旅程が共通サーバー経路で動く。マナ/キーワード支援と旧保存の代表例、応答不明の復帰を実証。残る保全範囲を明示して次の改善を受けられる |
| P2 一人回しの保全範囲を閉じる | 既存の価値を維持した日常の練習道具になる | M-01〜11の対象操作、統率者演出、必要な状態/関係、保存・undo/redoを同じ経路へ接続。代表複合処理が完遂でき、ユーザーの一つの改善を共通箇所へ反映できることを示す |
| P3 2人対戦 | 同じ画面・支援で相手と開始から結果まで遊べる | 独立した二席でデッキ準備、応答/HOLD、手動処理、全体undo、秘密、部屋主/回収/Kick、切断復帰、不可逆な終局を通す。旧2P経路への代替実装を作らない |
| P4 4人対戦 | 同じ卓で複数戦線と脱落後の継続を扱える | 独立四席で固定席/三人概要、複数攻撃先、別防御席の確定と同席競合、割込み・復帰、脱落後の継続を確認。二人の結果から合格を推定しない |
| P5 移行・公開・退役 | 新方式を安全に使い続けられ、旧実装の管理負担が減る | 旧保存/旧部屋の処遇と切戻しを閉じ、現行CIと実環境の成果を確認して、個別に許可された時点で公開。対象旧入口/適用/変換/接続経路を退役 |

P5の退役作業は各段階で可能になった範囲から進める。公開を待たずに不要な新規重複を整理するが、旧保存や利用中の部屋の扱いを未確認で消さない。各段階の変更は一つのプレイ上の成果に絞り、全段階を一度に実装しない。

### P1の具体的な一続きの旅程

1. 通常の開始入口で実デッキを選び、非公開セッションと通常の相手1席を作る。島だけの練習デッキの初期化を示し、一般デッキの検査を全体で緩めない。
2. 初手を確認して開始し、draw/土地を置く/tap/マナ生成を行う。初回受入はキープの通常経路。残る初手支援はP2で閉じる。
3. 対応済みの自動支払いで呪文をStackへ置く。発生源と実行済みコストを維持する。マナ不足や非マナ負担を無言で成功にしない。
4. 効果を人が読み、移動と数値変更を組み合わせて手動処理を終える。処理途中に盤面/本文を開いても選択と発生源が残る。対象の他席指定を一例通す。
5. キーワード付与の代表一件を同じ操作経路で行い、確定した基本操作のundo/redoを確認する。Botはundo直後に取り消した操作を再実行しない。
6. サーバーの確定状態から端末checkpointを保存する。通常の再読込みでは稼働sessionへ再接続し、期限切れ後はcheckpointから新しい私的sessionを作って続ける。サーバー応答喪失の前後で結果を照合し、支払い・移動を二重適用しない。サーバー保存と端末checkpoint保存を区別し、いずれの失敗も成功表示にしない。
7. ローカル実runtimeと同じbrowser sessionでプレイをたどり、受付反応/確定までの遅延と、操作当たりの保存・送受信負担を記録する。実アカウントの容量/無料枠は別途read-onlyで検証し、ローカル結果から本番成立を断定しない。

最初の実装はこの旅程に必要な中核・session・UIを縦につなぐ。先に全command一覧、全protocol、全マナ相互作用、全四人画面を作らない。見本に使うカード/旧snapshotは関連の既存検査・fixtureから選び、実際に選んだものだけ記録する。状態の直接注入だけで通常入口を省略しない。

P1は試遊可能な初期版であり、P2の全機能保全や全旧保存移行の認定ではない。P1を触って改善を始められるようにしつつ、P2の合意済み範囲を落とさない。ユーザー回答がない間は、必要な保全や検証を独立して進めてよい。人間の理解を観察済みとは記録しない。

### 実証の扱いと撤退条件

比較書E1（支援の分離）、E2（保存移行）、E3のsolo部分（確定/復帰）はP1に組み込む。別々の捨てる試作を完成させてからP1を作り直さない。独立した2席/4席のE3はP3/P4で閉じる。最初から席・権限・投影の境界を持つが、対戦完成をP1の条件にしない。

次の場合は機能追加を止め、失敗した境界だけを修正する。

- 手動の領域移動に旧自動置換/SBA/priorityを偽装しないと再利用できない。
- マナ支援を使うために旧GameState全体の往復変換や全効果エンジンが必要になる。
- 旧保存の必要な情報や支払いを黙って落とす。
- 確定の一回性、秘密の配送、原子的保存を満たさない。
- 実測でサーバー方式がsoloの操作性または無料運用を満たせない。

純粋処理の必要部分を作り直す裁量はある。全remoteの条件が成立しなければ、同じsession/engine/UIをbrowserとremoteへ配置する対案を再評価する。両完成品を先に作らない。方式変更の理由・残る費用・ユーザー体験の差を示し、必要な要求変更だけを相談する。

## 4. 変更する責任と減らす負債

ディレクトリを大量に先行作成せず、次の責任だけを必要な箇所に置く。名称は新規packageの指定ではない。

| 責任 | 再利用/調査する資産 | 新経路で残さないもの |
| --- | --- | --- |
| 共通の卓上状態・純粋適用 | `src/engine/types.ts`、`commands.ts`、`core/tabletop/operationsV1.ts` | localPlayer依存の重複正本、manualに混ざる一般の自動裁定、strict rootの偽装 |
| マナ・キーワードの操作支援 | `autotap.ts`、`manaTransaction.ts`、`grammar/`、`actionCatalog.ts`、`ManualKeywordsDialog.tsx` | UI/storeへの直接依存、同じ支援のonline用コピー、無条件の任意command受理 |
| sessionの認可・確定・履歴 | `src/online/tabletopManual/`、`protocol/`、`cloudflare/` | master/部屋主/対象席の混同、receiptをundoで消す処理、盤面と接続資格の一括巻戻し |
| 共通Cockpitと私的選択 | `GameScreen.tsx`、`gameController.tsx`、`gameScreenInteractionPort.ts`、`remoteGameScreen.tsx`、`presentation/` | 非公開を空のGameStateで偽装する投影、別UI、空関数で未対応を成功扱いする操作 |
| 保存と移行 | `src/data/gameSnapshot.ts`、`gameStore.restoreGame`、`cloudflare/persistence.ts` | 保存失敗の無言成功、旧データ上書き、通常復帰で全履歴再生を必須にする構造 |
| 接続管理 | `src/online/publicApp/v3.ts`、`browser/`、`cloudflare/websocket.ts` | 複数の独立poll/socket/retry所有者、dispose後の更新/再接続 |

同じ意味の操作は一つの純粋適用を使い、実行主体だけを人間/Botで変える。表示は許可された情報から作る。操作可否の案内とサーバーでの認可を整合させる。結果イベントは履歴/演出へ接続し、復帰snapshotを新しい成功として再演出しない。

各段階の終了時に本書の進捗へ「置換した入口、まだ残す旧経路、残す理由、退役可能になる条件」を数行で記録する。削除件数や行数を目標にせず、一つの改善の修正/検証範囲が減ったかを見る。文書や検査を増やして退役を先送りしない。

## 5. 次タスクが最初に読むものと作業基点

引継ぎ元: `/Users/shumpeiabe/Desktop/MTG_OneDeck`。HEAD `1f80a8dfbc89568f4a9d31459c655b3d54d5afe3`、branch `main`、dirty。次タスクは専用worktreeで作業し、引継ぎ元を書き換えない。新worktreeのHEAD/status/AGENTSを再確認し、異なる基点なら違いを記録する。

新worktreeには未コミット文書が自動で入ると仮定しない。引継ぎ元から次の五文書を読み、同じrepo相対パスに必要な最新版を反映する。本書とproduct要求が必読、UXはP1と§6、比較は§4/5/8を中心に読む。旧統合仕様は必要な境界だけ参照する。

1. `docs/cockpit-implementation-plan-2026-09-09.md`（本書）
2. `docs/product-requirements.md`
3. `docs/cockpit-ux-requirements-2026-09-09.md`
4. `docs/cockpit-architecture-comparison-2026-09-10.md`
5. `docs/cockpit-specification-2026-09-09.md`（旧詳細候補。現要求を優先）

これらが参照する旧設計/比較文書は必要になったものだけ引継ぎ元から参照またはコピーし、新しい実行指示にはしない。リンクの維持に必要な文書は追加で持ち込んでよいが、ソースや設定を一括コピーしない。

モック参照（read-only）:
`/Users/shumpeiabe/.codex/visualizations/2026/09/01/01a05df1-4c8a-7f61-bb08-de5808d67ac2/`
の `edh-ui-constitution.v0.3.md`（内容v0.41）、`manual-play-interaction.v0.1.md`（内容v0.16）、`cockpit.js`。選択・発生源・最小化/復帰・密集表示の体験を継承する。fixtureやDOM直接更新を本体の実装にしない。この旧モックの編集は不要。

引継ぎ元で既に変更されているソース/設定:
`.codex/config.toml`、`package.json`、`scripts/online/o4p-09i-full-match-evidence.ts`、`src/components/online/PublicOnlineApp.tsx`、`src/online/browser/__tests__/o4p09iFullMatchEvidence.test.ts`、`src/online/cloudflare/__tests__/tabletopRuntimeV1.test.ts`、`src/online/cloudflare/runtime.ts`、`src/online/publicApp/index.ts`、`src/online/publicApp/v3.ts`。

未追跡には本計画等の文書のほか、`.c2cignore`、`.wrangler/`がある。設定、認証、ローカルDBをコピーしない。旧online差分は既存作業として保全し、必要な修正を移植する場合だけ狭いdiffを確認して持ち込む。まとめてreset、採用、撤去しない。

live台帳は `research/cr-grounding/cr-backbone-ledger.json`、契約の入口は `docs/contracts/manifest.json`。旧O4Pの実績を新方式へ転記せず、今回触る責任に関する項目だけ確認する。最初に全台帳・全repoを再監査しない。

## 6. 検証・保存・公開の扱い

基点の限定検査（引継ぎ元で実行済み、4ファイル59件PASS。新worktreeや新実装の証明ではない）:

```sh
npx vitest run --project dom src/store/__tests__/review.mana-transaction.test.ts src/store/__tests__/review.act1-mana-shortcut-cost.test.ts src/store/__tests__/soloPreservation.contract.test.ts
npx vitest run --project core src/engine/__tests__/review.act3-activated-keyword.test.ts
```

必要な範囲だけ再実行する。新テストは変えた挙動を既存検査で捉えられない場合に限り、通常経路と重大失敗を小さく証明する。既存のsolo接続不要検査は旧localの保証であり、ユーザーが承認したサーバー実証を禁止する根拠にしない。旧検査を黙って緩めず、新旧の適用対象と新方式の受入を明示する。

UI変更は同じbrowser sessionで1440×900、375×812、812×375、console error 0を確認。対戦のスマホは案内、横スマホsoloは希望評価として報告する。実通信はローカルruntimeから始める。`npm run dev`、`wrangler.jsonc`、`scripts/online/o4p-09i-full-match-evidence.ts`等の起動方法を現環境で確認し、旧strict旅程を新manualの合格証明へ流用しない。実行権限や利用中portを確認し、他タスクのプロセスを止めない。

保存は状態・receipt・履歴・制御を原子的に確定する。undoでも配信用revisionは前進し、接続資格や部屋主管理権を巻き戻さない。一般の効果判断を手動化しても、構造・入力・秘密・認可の検査は残す。

soloの保存checkpointは稼働セッションと寿命を分け、旧保存を保持したまま新形式を読戻す。未保存のDraftや履歴を復元したと主張せず、必要な途中状態を移せない場合は無言で落とさない。期限切れ後のcheckpoint読込みは新しい私的セッションであり、旧部屋や不可逆な終局を復活させるものではない。既存部屋へ6時間TTLを遡及適用しない。

認証/共有状態/protocol/保存/主要CRの変更は別文脈のread-onlyレビューを受ける。固定CRは `rule/Magic_The_Gathering_Comprehensive_Rules.txt`。意味上の裁定と手動入力の支援を区別する。レビューの合格を実機証拠にしない。

開発中はtargeted testsを使う。将来の許可されたreleaseではexact SHAに対する現行CIの `check:release` を唯一のfull-strength gateとする。local full checkを重複実行しない。local-only完了で必要な場合はAGENTSに従い一度の `npm run check` を選ぶ。今の文書引継ぎは `npm run check:docs` とdiff確認だけでよい。

秘密、招待情報、生のprivateエラーをログ・報告へ残さない。無料枠/遅延は実測条件を添える。ローカル通信、公開版、人間の理解、CIは別々の証拠として報告する。

## 7. 次タスクへの実行依頼と報告

今回の担当範囲はユーザー依頼によりP0→P2。P1成立時は中間報告して追加承認を待たずP2へ進む。計画を読み直すだけで終えず、共通サーバー方式の小さな一人回しの実装・接続・検証を進める。難所では同じ目的を満たす最小の実装判断を自律的に行い、アーキテクチャ比較全体を再開しない。P2〜P5を同時着手しない。

P1が成立したら、起動/操作方法、実際に動く旅程、未対応の保全対象、検証結果、移行/退役した経路、次の一変更を報告する。ユーザーが触って改善を伝えられるチェックポイントを作る。公開・commit・pushは行わない。

追加アイデア（プリセット、応答練習、相手視点、改善メモ、混成卓）は初回必須にしない。ユーザーの改善報告には、場面・困った操作・期待する結果があれば開発側で再現/修正できるようにする。ユーザーに全モードの検証や技術解決策の作成を求めない。

### 進捗

- 計画/要求/UX/方式比較: 作成済み。新方式のruntime・UI・移行は未実装。
- 以下は計画策定時の状態。今回のP0→P2の結果は末尾の実装記録を正本とする。
- P3〜P5: 未着手。
- 旧経路の退役: 未実施。対象は§4、条件は§3/6。

### 2026-09-10 P0開始記録

- 引継ぎ元 HEAD `1f80a8d` はdirtyのまま保全。既存専用worktree `/private/tmp/onedeck-solo-cockpit`（HEAD `80c3eb6`、開始時clean）を使用。新規worktreeは作らず、指定五文書と最新AGENTSだけ反映。設定・認証・DB・dirtyソースは移植しない。
- Goal: P1の通常開始→支払い→手動処理→保存復帰、続いてP2のM-01〜11。Non-goals: P3/P4/P5、公開、汎用framework。Acceptance: 通常UI、実runtime、保存/復帰、独立レビュー。What stays untouched: 引継ぎ元、旧デッキ/保存/部屋、設定。
- 変更対象: マナ計算の席別入力、共通手動卓、既存Cloudflare runtime内の非公開セッション、共通カード表示と操作。旧local操作とstrict onlineは新セッションの確定に使用しない。
- 旧入口は現在残存。新solo通常入口の切替と旧保存読戻しの実証後にlocal新規開始を退役。旧保存読込みは必要情報を保全できるまで残す。旧online部屋はP3以降の移行対象。新旧を恒久併存させない。

| 対象 | 再利用する入口/検査 | 開始時に定めた新経路の確認 |
| --- | --- | --- |
| M-01/02 | autotap、manaTransaction、review.mana-transaction、review.act1-mana-shortcut-cost（Sol Ring、基本土地、Lotus Petal） | 明示席の生成/色/非マナ負担→支払いとStackの原子的確定 |
| M-03 | ManualKeywordsDialog/status | 値/期間/由来の付与除去→undo |
| M-04 | arrangeTop、proliferateAll | 枚数/候補/順序を選んで確定 |
| M-05 | actionCatalog、activatedKeyword、review.act3-activated-keyword | Equip/Cycling等のコスト→発生源/対象を保持したStack |
| M-06/07 | move/discard/createToken、Modalの盤面を見る | 他席を含む複数操作→閲覧往復→処理終了 |
| M-08/09 | ターン操作、Battle | 個別進行/任意ショートカット、割当→手動反映 |
| M-10/11 | CommanderRitual、cleanup | 税/演出、解除対象確認 |
| 保存 | soloPreservation.contract、gameSnapshot | 旧データ保持、checkpoint、新規読込み、応答喪失照合 |

## ローカル実装・受入記録（2026-09-10）

P0確認済み、P1は通常UIの一続きの旅程を実証して中間報告済み。P2の採用操作と代表旅程をローカルで受入済み。P3/P4/P5には進めていない。ユーザー本人の試遊・理解を観察した記録ではない。

### 起動と通常の使い方

専用worktree `/private/tmp/onedeck-solo-cockpit` を使用。端末を二つ開く。

```sh
cd /private/tmp/onedeck-solo-cockpit
WRANGLER_SEND_METRICS=false npx --offline wrangler@4.130.0 dev --local --port 8789 --inspector-port 9231 --persist-to .wrangler/cockpit-local
```

```sh
cd /private/tmp/onedeck-solo-cockpit
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

[ローカル一人回し](http://127.0.0.1:5175/) を開く。カード取得には通信が必要。今回の実行では既存のローカルWrangler 4.130.0を使用し、依存ファイルは更新していない。

1. マイデッキを開くか、デッキリストを読み込む。解決枚数・未解決を確認し「一人回し」。初手を確認してキープ／マリガン。
2. カードのチェックで選択し、移動・タップ・マナ生成を行う。「本文・操作」から支払い案を確認してStackへ置く。
3. 「処理を始める」後、整理・検索・数値変更や別カードの操作を続ける。「盤面を見る」で本文を最小化しても選択と発生源は残る。最後に「処理を終える」。
4. 相手席の準備・判断は同じ操作で代行する。Botに自動の応答・攻撃・ブロック判断や操作の再実行はない。
5. 「端末へ保存」でcheckpointを保存。通常の再読込みは稼働セッションへ再接続する。通信結果不明時は「再接続」で照合してから続ける。

### M-01〜11の接続と確認

全入口の確定は `CockpitClient` → 同じSQLite session transaction → `applyTableOperation`。ブラウザは未確定選択を保持し、確定盤面をローカルで先行適用しない。

| 範囲 | 接続した操作 | 主な確認 |
| --- | --- | --- |
| M-01 | 単体/一括生成、色選択、自動タップ/支払い、支払い源の除外、X・手動最終コスト | 島2枚の一括生成、統率の塔のB/G/UからU選択→カニを唱える。Xと古い支払い案拒否は限定テスト |
| M-02 | 既存認識済みのマナ能力/マナ誘発とコスト解析を共有。非マナ負担を表示し確定前に確認 | 既存mana tests、受取席の違い/一括原子性。未対応条件・循環は部分成功にしない。召喚酔いは自分の直近ターン開始で判定 |
| M-03 | 採用キーワードの付与/除去、値・期間・由来・発生源snapshot、複数の独立した付与 | 速攻、護法{2}、期限、undo/redo。旧付与も解除可能に移行し、不明な値/由来は不明と表示 |
| M-04 | 占術/諜報の候補・上下順、切削、サーチ、シャッフル、ランダム捨て、選択増殖 | 各入口を通常UIで実行。占術候補→本文→盤面→復帰→確定、選択増殖→undo/redo |
| M-05 | 認識済みサイクリング/装備/忍術等、手動起動/誘発、特殊コスト、対象、Stackコピー | 装備{1}を相手席で支払い→手動添付、Emry誘発登録/コピー/除去。cycling等は共有解析の既存検査と限定コスト検査 |
| M-06 | 席をまたぐ複数選択、所有者別移動/上下順、公開範囲、数値、token/コピー、特徴編集、添付、制御、表裏、関連 | 鳥tokenの青/2/2/修整/護法、相手へ制御変更、装備添付、公開先、保存復帰。裏向きと追放関連も保存→再読込み→操作→undo |
| M-07 | 発生源・本文・支払済みコスト・対象snapshotを保持した処理開始/継続/終了 | 子画面往復、別Stack項目の除去中も親の処理を保持。一般効果/誘発/置換を自動解決しない |
| M-08 | 個別フェイズ/ターン、明示したアンタップ→ドロー→メインのshortcut、マナ消去 | 通常UIの個別進行/shortcut、HOLD・未完処理の停止検査 |
| M-09 | 攻撃/ブロック関係、数値割当/一括反映、第2ダメージ段階、PW忠誠度/Battle守備値 | 通常UIで相手盤面準備→攻撃/ブロック→3/1の相互反映→人が墓地移動。第2段階/対象incarnationは限定テスト。致死移動/勝敗は自動確定しない |
| M-10 | 統率者表示、領域移動、唱えた回数/税、CommanderRitual | Emryの親和による手動最終コストU・理由を保持して唱える、実演出、回数1/次税2、コピーから統率者属性を分離 |
| M-11 | 手札調整、記録ダメージ、期限付き修整/付与の一覧と選択解除 | 戦闘後cleanupで解除対象を確認して実行、次ターン境界でundo不可 |

マナの未対応制限・非マナ条件、攻撃の合法性、置換/軽減、任意効果は人が判断する。上記は全カード/全相互作用の自動対応の認定ではない。公開範囲はsoloの実状態として保存するが、独立した他席への配送・秘密投影の受入はP3以降。

### UI・旅程

- 両席の戦場と手札を同じCardView/選択/本文入口で表示。1440×900で盤面・手札を同時に確認でき、同名カードには席/位置情報を加えた。日本語フェイズ、テーマ/音設定、成功確定後だけの演出を接続。
- 実デッキ開始→生成/支払い→呪文/能力→手動処理、複数選択→移動/数値→本文往復→終了→undo/redo、相手準備→戦闘→cleanup、状態/関連の保存→復帰→続きの操作を通常UIで確認。
- 同一IABで1440×900、375×812、812×375。横soloは本文の最小化/復帰、undo/redo、保存/再読込みまで操作可能だが縦スクロールが多い。快適さの本人評価とスマホ対戦は未実施。
- 最新通常操作にconsole errorなし。過去のHMR依存配列警告1件・古い開発保存形状の例外2件は修正済みの履歴として区別した。

### 保存・復帰と負担

- 稼働sessionは受理した利用から6時間。端末デッキ・checkpointは別DBで保持し期限削除しない。サーバーと端末保存は別表示、失敗を成功にしない。
- P1で実Workerのclock注入点を6時間進め、期限切れ→署名checkpoint→新credential/generationを確認（実時間6時間待機ではない）。通常reloadは同じ稼働盤面と履歴へ戻る。期限切れ再開では旧undo履歴を持ち越さない。
- 応答喪失はHTTP転送点で確定後のcast応答だけ破棄。read receiptで一度だけの支払い/Stack登録へ復帰し、操作を自動再送しない。Botもundoした操作を再実行しない。
- 通常undoは同一ターン内、redoは次の新規操作まで。明示確認した終局は通常UIで操作停止/再読込み維持、SQLite検査でundo禁止/古いcheckpointからの終局取消禁止を確認。
- 旧デッキ/保存元データは変更しない。支払済みStackのsourceSnapshot/activationEnvelope/targets、ordered zones、カード状態、旧戦闘宣言を移行。旧endOfCombatは処理済みとして再適用しない。旧pending選択/誘発、敗北確認、ダンジョン等の移せない保存は理由を表示して拒否し、黙って欠落させない。これら全旧形式の可用性は未認定。
- 実測: このMacのVite5175→一時計測HTTP8791→Worker8789、既存 `Mydeck/Muldrotha.txt` 100枚（未解決0）＋Bot100枚。単発HTTP所要: create34.82ms、mulligan50.83ms、draw22.49ms、生成40.72ms、cast31.05ms、resolve.end39.73ms、checkpoint34.76ms、reload read30.60ms。UI描画時間/統計的なp95ではない。
- 同条件create要求110,718bytes/応答29,184bytes、cast要求384/応答29,663bytes。応答は圧縮wire量。revision3時点のtable170,201bytes、defs109,322bytes、undo3件を含むSQLite record680,837bytes。全状態snapshot方式なので履歴に応じて増える。上限はrequest2MB、session25MB、同一ターン200操作、超過は保存せず明示する。長期履歴の最大負担、公開環境遅延、無料枠の収容数は未測定。

### 旧経路と検証

新規solo・旧保存の通常再開入口は新sessionへ置換済み。旧GameScreen/storeは旧onlineと未移行の旧機能の依存を残す。P3で同じsession/UIへ接続し既存部屋の移行を実証した後、参照がなくなった旧入口を退役する。新sessionは旧GameState全体への変換・第二のローカル確定経路を持たない。既存mana/keyword解析は資源入力を小さくして再利用した。

独立read-onlyレビューで共有状態/保存/認可/コスト/移行/終局を確認。指摘されたHIGH（非マナ負担、原子的確定、秘密payload永続化、発生源消失、cleanup途中実行、Stack ID衝突等）を修正し各限定再レビューで追加HIGH/BLOCKERなし。生成APIは現行sourceとの完全一致で検査し、手書き契約の過去blob検査を維持。既存runtimeゲートの一覧と限定import許可を新sessionへ合わせ、別文脈で確認した。旧solo-local固定検査はApp/共通画面→単一browser clientの辺だけ許可。歴史リリース検査は当時のcommit差分を維持し、現在の未追跡ソースを昔の候補一覧に縛る部分を退役した。

全体検査: 各段階の検証完了。Core全量236ファイル/2,141件PASS。DOM全量実行で旧構造を固定する14失敗を検出し、境界と開始入口を更新して対象11ファイル/44件の再実行PASS。成功済みの無関係テストは繰り返していない。生成文書・runtime一覧・Lintの失敗も修正後に各段階PASS、最後のclient移動後のbuild/変更箇所LintもPASS。bundleはgzip約356KBでchunk-size warningあり。公開・commit・push・deploy・外部サービス書込み・既存ユーザーデータ削除は実施していない。

P2時点の未認定条件: 全旧保存形式の移行、全カード相互作用、長期最大容量/無料枠、本人の理解・操作感。旧保存の明示拒否は元データ保全を伴い、自動裁定の縮小範囲へ無言で変換しない。P3の独立二席・秘密配送・部屋主管理、P4の四席、P5公開は未着手。Worker8789とVite5175を起動したまま、100枚デッキの通常UIと端末checkpointを残して停止する。

## P3/P4 ローカル実装・検証（2026-09-12）

最新依頼の「Pro利用枠内で現在のMacから最大速度で実装」に従い、P0–P2が存在する本worktreeを拡張した。mainや別の2P worktreeの未保存作業は取り込まず、開始時点のソースを `/private/tmp/onedeck-multiplayer-baseline-20260912` に退避した。以下はローカルの機械検証・ブラウザー操作の結果であり、人間同士の実戦完了や公開環境の認定ではない。

### 実装した範囲

- デッキ選択から2人/4人の部屋を作成し、招待コードで各自のデッキを持って参加。同じ `CockpitSessionScreen`、`CockpitClient`、SQLite transaction、`applyTableOperation` を使用する。
- 各席が初手を確認してキープし、部屋主が開始。開始後の新規参加は拒否。開始前のkickは席を空けて招待を更新する。
- 通常操作は一人のマスターが確定。各席のHOLD、操作権貸与・返却、部屋主の回収を接続。防御側は自席のブロックだけを独立確定でき、別防御席のブロックを上書きしない。
- 相手の手札・全席の山札はカード本体/定義を応答から除外し、枚数のみ配送。マスターの明示した非公開領域の閲覧は本人だけに配送する。裏向きやsnapshot由来の定義も投影対象を制限する。
- 約1.5秒間隔でサーバー確定状態を取得。単一の送信経路でpollとcommitを直列化し、revision競合は最新盤面に更新して選び直す。応答不明時はreceiptを照合し、自動再送しない。再接続では接続世代を更新し旧画面の送信を拒否する。dispose後の返信・timer・保存更新を止める。
- 部屋主の30秒の不在検知で進行停止。再接続で復帰する。脱落後も部屋主は接続を維持する必要がある。
- 確認付きの脱落/kickはundo境界を閉じる。席IDを残して残存席へターンを進め、他の防御先の戦闘を維持する。貸し手が脱落したら返却先を除去する。残り一人で終局し以後の変更を拒否する。
- 固定CR 800.4a/j/kを参照。脱落者所有の物を除去する一方、複雑な制御効果終了の自動推論はしない。他人所有の物を脱落者が制御している場合は確定を拒否し、効果に従った制御終了・必要な追放を手動で行ってから再確定する。一般効果、攻撃/ブロックの合法性、軽減・置換、致死移動は既存のguided/manual境界を維持する。
- 2P/4Pの秘密を含む全卓checkpointの端末export/restoreは提供しない。稼働中はSQLiteの確定状態・履歴へ再接続できる。6時間失効後のmultiplayer復元は未実装。

### 実操作の証拠と再実行

100枚のローカルfixtureデッキを各ブラウザーの端末デッキDBにだけ用意し、それ以降は通常UIを操作した。fixtureはマナコスト0のクリーチャーで、実デッキの全カード相互作用を証明しない。

- 2つ/4つの独立ブラウザーcontextで、部屋作成→参加→キープ→開始→ドロー→HOLD→貸与→ドロー→返却→undo→別席reload→攻撃登録→ダメージ確定/一度だけ反映→戦闘終了→フェイズ同期→脱落→全席の終局表示までPASS。
- 4Pでは、マスターだけの相手手札閲覧と戦場準備、2つの攻撃先、P2/P3それぞれによるブロック確定も通常UIでPASS。
- 1440×900、812×375、375×812で横overflowなし。撮影確認では非公開カード領域を隠し、招待が表示されない開始後だけを使用。モバイルは縦スクロールが多く、操作感の本人評価は未実施。
- 全contextのconsole error/warning 0。確認用結果は `/private/tmp/onedeck-cockpit-2p-result.json` と `/private/tmp/onedeck-cockpit-4p-result.json`。招待コード・credential・非公開のカード情報は出力しない。

再現スクリプトは `scripts/online/cockpit-multiplayer-evidence.ts`。既存CDP harnessを使い、localhostの開発環境だけを受け付ける。

```sh
node --import tsx scripts/online/cockpit-multiplayer-evidence.ts
COCKPIT_SEATS=2 node --import tsx scripts/online/cockpit-multiplayer-evidence.ts
```

本作業の画面は `http://127.0.0.1:5177/`。Viteの `COCKPIT_WORKER_ORIGIN=http://127.0.0.1:8791` で今回のWorkerに接続する。既存8789 Workerとは別の `.wrangler/cockpit-multiplayer-20260912` を使用した。再起動例:

```sh
WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/onedeck-multiplayer-wrangler.log npx --offline wrangler@4.130.0 dev --local --port 8791 --inspector-port 9233 --persist-to .wrangler/cockpit-multiplayer-20260912
```

```sh
COCKPIT_WORKER_ORIGIN=http://127.0.0.1:8791 npm run dev -- --host 127.0.0.1 --port 5177 --strictPort
```

このMacではoffline npxの解決に失敗したため、既にキャッシュ済みの同版Wrangler CLIを直接起動した。依存追加/更新はしていない。

### 検証状況と残るgate

- Cockpit engineの既存7ファイル14件PASS。SQLite sessionの既存solo 3件と新multiplayer 3件、poll/commit/disposeを検証するclient 1件PASS。
- 全体 `npm run check -- --continue-on-error` は一度実行。Core 236ファイル2,141件PASS、DOMは382ファイル2,747件PASS/4件失敗/1件skip。新しいUI/type import辺と入口の名称を対象に修正し、失敗4ファイルは限定再実行で全件PASS。追加client検査も別途PASS。全体をもう一度実行して成功済みの無関係な検査を繰り返してはいない。
- 新しいprojection/authファイルを4つのCloudflareゲートの正確なファイル一覧・3つのimport許可へ追加し、対応した3つの境界テストhashを更新。4ゲートの限定再実行PASS。生成APIを更新。最終build PASS、差分チェックPASS。
- 別文脈のread-onlyレビューでprotocol/秘密投影/脱落/接続世代/境界差分を確認し、今回差分のHIGH/BLOCKERなし。
- **未解決の出荷gate:** `check:docs` は `CONTRACT-ENGINE-MULTIPLAYER` の `soloOnlineBoundary.test.ts` が過去の `lastVerifiedCommit` と異なるためstaleで停止する。実際のcommit後にその実commitへ再アンカーする既存規則があり、免除・架空SHA・未来SHAは使わない。commitは未承認のため実行せず、この1件を未解決として保持する。他の手書き契約と固定CRは変更していない。
- 公開・commit・push・deployは未実施。P3/P4のローカル代表操作は実装/機械検証済みだが、人間2人/4人によるフルマッチ、実デッキ相互作用全体、公開遅延/容量/無料枠、旧online部屋の新経路への移行、6時間後のmultiplayer復元は未認定/未実装の範囲として残す。

### 公開候補の準備（2026-09-12、追加承認後）

ユーザーがcommit・push・公開を承認。productionのCockpit通信先を既存Cloudflare Workerに接続し、devはVite proxyを維持した。対象session/client/CORS境界の検査、別文脈の最終レビュー、秘密情報スキャンを実施。実装commit後にCONTRACT-ENGINE-MULTIPLAYERのlastVerifiedCommitだけをその実commitへ更新する。公開はその後のexact SHAのCI結果で判定し、この準備記録自体を公開成功の証拠とはしない。
