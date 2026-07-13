# UX research harness

開発サーバーで通常のゲームを開始し、URLへ`?ux-research=1`を付けると研究用Recorderを表示する。
Recorderは製品snapshotとは別のIndexedDBへ保存し、通常の保存schemaと`CACHE_SCHEMA_VERSION`を
変更しない。

```text
http://127.0.0.1:5173/?ux-research=1
http://127.0.0.1:5173/research/design/ux-research/
```

- ゲーム画面: session開始、意味のある瞬間のmarker、fixture候補への昇格理由、JSON export。
- coverage画面: 4デッキ×中心体験の観察状態、Captured Moment Registry、記録済みsession。
- 比較リンク: 保存checkpointを既存visual fixture画面へ読み込み、同じ盤面を`ui=new|legacy`で表示。

## 人間参加ループ

1. coverage画面の「人間への次の指示」を読む。
2. 表示されたデッキを用意し、「指定されたプレイURLを開く」。
3. Discoveryでは特定場面を作らず、普段どおり遊ぶ。
4. 終了条件に達したらRecorderを終了する。
5. coverage画面へ戻り、事後レポートを入力する。
6. 保存後、次のデッキまたは中心体験が自動選択される。

DiscoveryとCoverageが一巡すると、ループはprototype gateで停止する。人間の使用感と司令官の
証拠統合なしに、A/B案やSoakへ自動昇格しない。

Recorderは開発時のみ読み込まれる。録画や外部送信は行わず、操作ログは座標、`data-testid`、
card ID、zone、keyだけをローカル保存する。フォーム入力値は記録しない。

自動markerを含む全checkpointは再生できるが、Registryへ出すのはS0/S1、A/B差、デッキ固有の
快感、再現困難、回帰riskのいずれかを明示して保存した瞬間だけとする。
