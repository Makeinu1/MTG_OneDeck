# O4P-09I task recut (draft)

O4P-09I の complete-match 証明は北極星として維持する。ただし、それを次の一手に
必要な唯一の gate にはしない。先に価値仮説、共有 session の信頼性、意味のある
Commander loop を個別に証明し、最後に既存 O4P-09I journey で総合認定する。

## Task sequence

### O4P-09I-A — Primary use-case selection

- Goal: `rules-light remote table` と `physical Commander private cockpit` を中心に、
  現行 production surface で価値仮説を比較し、次に磨く primary use case を一つ選ぶ。
- Acceptance: `rules-light remote table`、`physical Commander private cockpit`、
  `solo rehearsal to shared table` の三つを既存機能だけで walkthrough し、
  各シナリオの player job、既存手段、OneDeck の差分価値、最大摩擦を一枚に記録する。
  product owner が primary use case を明示的に確定し、選定理由と捨てる仮説を明記する。
- Non-goals: runtime、UI、runner、依存、CR の変更。Arena 採点や complete-match claim。

### O4P-09I-B — Reliable shared session

- Goal: 選定した use case で、二人が同じ production room の共有状態を一連の操作と
  再接続をまたいで安心して継続できる。
- Acceptance: room/deck entry、Pregame、複数の共有 mutation、切断・再接続、
  再接続後の追加 mutation、revision convergence、private projection separation、cleanup を
  一続きの bounded production journey で確認する。
  pending 操作、無反応、重複適用、秘密漏洩、孤児 process/profile はゼロ。
- Non-goals: 勝者、完全試合、全 interaction、Arena-80、四人卓の総合認定。

### O4P-09I-C — Meaningful Commander loop

- Goal: 信頼できる同一 session で、land、cast、HOLD、response または pass、resolve、
  unsupported Manual fallback の会話ループがプレイヤーに理解できる。
- Acceptance: 二人の production session で上記 loop を完了し、操作主体、待ち理由、
  stack の因果、結果状態が視認できる。375x812、812x375、1440x900 は一つの
  GameScreen、horizontal overflow なし、console error 0。人間の観察で最大摩擦を一つだけ
  選び、必要ならその root cause を最小修正する。
- Non-goals: combat corner の網羅、完全試合、四人卓総合、Arena-80。

### O4P-09I — Complete-match certification

既存の journey contract と acceptance brief を維持する。二人の短い完全試合、四人の
continuity/reconnect/privacy、三 viewport、cleanup、fresh-context Arena review の全条件が
揃った場合だけ close する。A/B/C の成功を I の成功へ読み替えない。

## Audit policy for this sequence

監査は commit 数ではなく semantic candidate とリスクで選ぶ。

1. Product/use-case decision: A の終了時に一度だけ、選定根拠と非目標をレビューする。
   code audit、full test、Arena review は行わない。
2. Evidence-driver or diagnostic-only change: 変更した runner と対応 test の targeted check、
   secret-free diff review だけを行う。cold product audit は行わない。
3. Shared protocol、authority、privacy、persistence、runtime change: 変更範囲と不変条件に
   絞った独立 review を一度行う。無関係な UI、CR、ledger history は再監査しない。
4. Ledger evidence/status-only change: JSON/doc consistency と claim-to-evidence の機械検査だけを
   行う。製品 byte が同じなら製品監査を繰り返さない。
5. Release candidate: targeted checks の後、exact SHA の CI `check:release` を一度だけ
   full-strength gate とする。失敗時は最初の root cause だけを修正する。
6. O4P-09I final: production journey 成功後にだけ fresh-context Arena review を一度行う。

一つの task は原則として review 一回と correction 一回までとする。同じ failure class が
繰り返す場合は監査を追加せず、観測可能性または task boundary を再設計する。runner の
secret-free result は最初から phase、settlement、known/projection revision、sent/replayed、
cleanup を含む一つの bounded envelope とし、診断項目を一つずつ production release しない。

## Authority and stop conditions

この再編は product/runtime semantics、既存 O4P-09I contract、acceptance score を変更しない。
外部 production write、commit、push、deploy は各実行時の明示 authority に従う。
product/runtime defect、AUTHORITY、ENVIRONMENT、private-data risk を観測した場合は証拠で
分類して停止し、journey を通すために timeout、retry、sleep、assertion を緩めない。
