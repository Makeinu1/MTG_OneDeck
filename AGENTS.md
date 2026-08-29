# MTG OneDeck 開発方針

MTG OneDeck は、実デッキで EDH を遊ぶ理解と発見の快感と、Magic 総合ルール
(CR)を検査可能な `GameState` / 可逆な `GameCommand` 列へ落とすことを目的とする
React + TypeScript + Vite の SPA である。プロダクトの WHY/WHAT、プレイヤー成果、
体験品質は [`docs/product-requirements.md`](docs/product-requirements.md) を正本とする。
作業は文書の手続ではなく、そこに記された成果を安全に届けるために行う。

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

## 実装と検証

1. `AGENTS.md`、該当契約、`docs/judge-protocol.md`、必要なら台帳を読み、Goal と
   Done when を短く定める。変更は一つの成果に絞る。
2. 編集中は変更に直接関係するテストを実行する。受入シナリオを壊したら、その
   シナリオを最初から再実行する。
3. 実装が安定したら `npm run check` を一度実行する。失敗時は原因を直し、影響を
   受けた主張・テストだけを再確認してから同じ最終チェックを行う。無関係な証拠を
   やり直して緑を水増ししない。
4. UI 変更は同じ browser session で 375×812、812×375、1440×900 と console error
   0 を確認する。根拠のない自動化を表示せず、未対応の複合効果は guided/manual と明示する。
5. 中断後は `git status`、`HEAD`、必要な CI 状態を確認して現在の作業を再構成する。
   過去の会話や一時ファイルを状態の正本にしない。

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

プレイヤー成果が契約どおりに得られ、必要な targeted tests と一度の `npm run check` が
緑で、該当する独立レビューが HIGH/BLOCKER なしで、権限のない外部書込みを行っていない
こと。変更・検証・defer・未解決点を簡潔に報告する。
