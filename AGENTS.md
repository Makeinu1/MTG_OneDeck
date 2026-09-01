# MTG OneDeck 開発方針

MTG OneDeck は、実デッキで EDH を遊ぶ理解と発見の快感と、Magic 総合ルール
(CR)を検査可能な `GameState` / 可逆な `GameCommand` 列へ落とすことを目的とする
React + TypeScript + Vite の SPA である。プロダクトの WHY/WHAT、プレイヤー成果、
体験品質は [`docs/product-requirements.md`](docs/product-requirements.md) を正本とする。
作業は文書の手続ではなく、そこに記された成果を安全に届けるために行う。

## 最小十分の原則

- 現在の要求を満たす最小の方法で終える。必要性を説明できない設計、抽象化、設定層、
  互換層、テスト、文書は追加しない。
- 要求整理と計画には必要なだけ強い推論を使ってよいが、実行は原則として軽量な
  model / medium-low相当で単線に進める。session全体を最大推論にせず、複数agentを
  既定にしない。まず一人で完遂可能か判断し、独立して並行できる仕事だけを分ける。
- Skillは現在のtaskに直接必要なものだけを使う。手続を増やすSkillや新しいframeworkを、
  手続を守るためだけに導入しない。
- 前提が誤っていれば正しい推論を重ねても成果にならない。検索や推測で代用せず、
  関連する要求・code・既存testを直接読んでから変更する。

## 権限と安全

- 依頼の範囲を越える変更をしない。通常の編集・テストはローカルだけで行う。
- commit、push、deploy/publish、外部サービスへの書込みは、依頼で個別に明示された
  ときだけ実行する。`/ship` や Skill の呼出しは権限を増やさない。
- 秘密情報、認証情報、Room ID・招待コード・生の非公開エラーをログ、証拠、文書へ
  書かない。削除、依存更新、契約原則の変更、公開済み成果の上書きなど不可逆な操作は
  事前確認を要する。
- 実装者はソースと通常テストを担当し、判定者は契約・CR裁定・文書・git・出荷を
  担当する。独立レビューは、認証/セキュリティ、共有マルチプレイヤー状態や protocol、
  永続化/移行/データ損失、主要な CR 意味論、release/deploy 基盤の変更に限って行う。
  レビューは読み取り専用で、実装者と別の文脈から findings を返す。
- read-only分析、diff確認、test実行、plan作成、branch切替、restore/revert、repo内backupは
  それ自体を不可逆操作として再確認しない。ただし既存の未保存作業を失う操作は先に退避する。

## 作業の進め方

1. codeへ触る前に、ユーザーが実際に欲しいもの、今回のscope、明示的な非目標、
   完了条件を数行で言い直す。表面的な症状を直してから意図を推測しない。
2. 最小planに `Goal / Non-goals / Acceptance criteria / What stays untouched` を含める。
   `AGENTS.md`、最小の該当契約、関連code/testを読み、CR裁定や真の曖昧がある場合だけ
   `docs/judge-protocol.md`や台帳を追加で読む。
3. 一つのroot causeへ一つの修正を優先する。patchの積み上げ、旧実装を残す第二実装、
   rare caseの先回り、将来用framework、多数の無関係file変更を始めたら停止し、planを縮める。
4. UI変更は同じbrowser sessionで375×812、812×375、1440×900とconsole error 0を
   確認する。根拠のない自動化を表示せず、未対応の複合効果はguided/manualと明示する。
5. 中断後は`git status`、`HEAD`、必要なCI状態から再構成する。過去の会話や一時fileを
   状態の正本にしない。

## テスト

- testは今回のacceptanceだけを証明する。まず関連する既存testを実行し、それで十分なら
  新しいtestを追加しない。
- 新規testは、今回変えたbehaviorを既存testが検出できない場合、またはユーザーが明示的に
  求めた場合だけ許す。原則としてmain path 1件とcritical failure path 1件を上限とする。
- 網羅感のためのsnapshot matrix、parameter grid、大量E2E、無関係moduleのbackfill、
  新test frameworkやtest infrastructureを作らない。要求されていない境界をtestしない。
- 追加前に「どのacceptanceを証明するか」「既存testが見逃すregressionか」「実装より単純か」
  を答える。test codeが実装より長い・複雑なら過剰設計として、より小さい証明を選ぶ。
- 開発中は関連する targeted tests のみを反復する。exact candidate を現行CIへ送るreleaseでは
  localの`npm run check`を実行せず、`.github/workflows/deploy-pages.yml`の
  `npm run check:release`（`npm run check`、forbidden diff scan、buildを含む）を唯一の
  full-strength gateとする。CI failureはfail-closedでdeployせず停止し、root cause修正後は
  無効になったtargeted evidenceだけを再確認して新しいSHAをpushしCIを再実行する。外部writeの
  自動retryはしない。local-only completion、CIを使わない変更、またはlocal full assuranceの
  明示要求の場合だけ、localの`npm run check`を一度実行してよい。

## エンジンと CR

- `src/engine/` は React/DOM/Zustand に依存しない純粋関数。`GameState` は不変で、
  `applyCommand` は決定的。乱数はコマンド生成時に payload へ固定する。
- undo/redo は store の snapshot（上限 200）。状態のフィールドを増やしたら
  `restoreGame` が旧 snapshot を backfill する。oracle 文の compiler は状態を直接
  書かず、拡張 `GameCommand` 列だけを生成する。LLM は助言であり盤面を変更しない。
- 決定論的な裁定は固定版 CR を一次権威とし、条番号と状態遷移の不変条件をテストへ
  落とす。英語 `oracleText` を解析の正本、`printedText` は表示専用とする。
- 同じ意味の操作には同じ手触りを返す。成功した意味イベントだけを鳴らし、演出で
  `GameState` を待たせない。主要 UI は日本語、カード名は `printedName ?? name` を
  《》で表示し、D&D/ダブルクリック専用操作には右クリックの代替を置く。

## 完了の定義

プレイヤー成果が契約どおりに得られ、必要な targeted tests と選択した検証経路（現行CIへ
exact SHAを送るreleaseならCIの full-strength gate、local-only completion等なら必要に応じた
一度のlocal `npm run check`）が緑で、該当する独立レビューが HIGH/BLOCKER なしで、権限のない
外部書込みを行っていないこと。完了前に、意図とacceptanceを満たす最小解であること、変更fileが必要最小限であること、
新規testが現在のbehaviorだけを固定していること、依存・余分なdirectory・debug code・第二実装が
残っていないことを確認する。作業を大きく見せるための追加作業はせず、変更・検証・defer・
未解決点を簡潔に報告する。
