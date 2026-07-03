# M0-FREEZE Contract Update Draft

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が `docs/engine-spec.md` / `docs/acceptance.md` へ反映するための契約文ドラフト。Codex は docs を直接変更しない。

現行 docs への具体的な反映箇所は `docs-contract-update-map.md` を参照する。このファイルは文言ドラフト、`docs-contract-update-map.md` は既存docsを読んだうえでの挿入/追記マップである。

## 反映方針

旧 M-CONTRACT 7条件は維持する。ただし、M-CR-RECONCILE 以後はそれだけで FROZEN としない。CR-grounding overlay を追加ゲートとして扱う。

推奨する契約語彙:

- `PASS`: CR refs、状態遷移不変条件、実行可能 golden/test が揃っている。
- `PASS(core)`: core substrate は実行可能だが、CR例外群や完全形は `S-* carry`。
- `PASS(boundary)`: 最新CR語彙・境界は固定済みだが、実行器は `scope-boundary`。
- `PARTIAL`: 実装/bridge/設計草稿はあるが、CR完全形ではない。残境界を明記する。
- `S-* carry`: M0-FREEZE後の実装マイルストーンへ送る。現時点でPASSにしない。
- `scope-boundary`: 初期スコープ外。検証不能として明示し、緑に混ぜない。

## `docs/engine-spec.md` への追記ドラフト

配置候補: §34.7.1 / §34.7.2 の M-CR-RECONCILE 現況ブロック直後。

```md
### CR-grounding overlay for M0-FREEZE

M-CR-RECONCILE 以後、M-CONTRACT の旧7条件だけでは FROZEN としない。旧7条件に加えて `research/cr-grounding/m0-freeze-overlay.json` の CR-grounding overlay を確認する。

Overlay status 語彙:

- `PASS`: CR refs + 状態遷移不変条件 + executable golden/test が揃っている。
- `PASS(core)`: core substrate は executable だが、CR例外群や完全形は `S-* carry`。
- `PASS(boundary)`: 最新CR語彙・境界は固定済みだが、実行器は `scope-boundary`。
- `PARTIAL`: bridge または設計草稿はあるが、CR完全形ではない。残境界を `S-* carry` として明示する。

M0-FREEZE では `PASS(core)` / `PASS(boundary)` / `PARTIAL` を単純な PASS として潰さない。凍結可能なのは、未実装領域が `S-* carry` または `scope-boundary` として明示され、`PASS` に混入していない場合に限る。

CR-grounding overlay 正本:

- `research/cr-grounding/README.md`
- `research/cr-grounding/m0-freeze-overlay.json`
- `research/cr-grounding/m0-freeze-handoff.md`

R-FREEZE 設計草稿:

- R-FREEZE-1: `research/cr-grounding/rule-choice-substrate.md`
- R-FREEZE-2: `research/cr-grounding/priority-event-loop.md`
- R-FREEZE-3: `research/cr-grounding/mana-ability-substrate.md`
- R-FREEZE-4: `research/cr-grounding/scope-partition.md`
```

## `docs/acceptance.md` への追記ドラフト

配置候補: CRG / M0-FREEZE acceptance 表の近く。

```md
## M0-FREEZE CR-grounding acceptance

M0-FREEZE は、旧 M-CONTRACT scorecard に加えて CR-grounding overlay を確認する。

| Gate | Required treatment |
|---|---|
| CRG-1 CR 2026-06-19 fixed | required PASS |
| CRG-2 CR-grounded golden cases defined | required PASS |
| CRG-3 Commander tax CR 903.8 | required PASS |
| CRG-4 Mana abilities CR 605 | PARTIAL allowed only if CR 605.1b/605.4a is explicit S-* carry |
| CRG-4.5 Commander zone choice CR 903.9a/b | PARTIAL allowed only if generic rule choice is explicit S-CHOICE carry |
| CRG-5 Token death CR 111.7/704.5d | required PASS |
| CRG-6 Trigger/SBA/priority CR 603/704/117 | PARTIAL allowed only if 603.3b second bucket and full SBA are explicit S-* carry |
| CRG-7 Zone movement/LKI CR 400.7/603.10a | PASS(core); 400.7 exceptions and full effective snapshot remain S-* carry |
| CRG-8 2026-06-19 new vocabulary | PASS(boundary); executors remain scope-boundary |

Acceptance rule: 未実装機構を `PASS` に混ぜない。`PARTIAL` / `PASS(core)` / `PASS(boundary)` は残境界を伴ってのみ許可する。
```

## Fable が確認する差分

Fable は上記をそのまま採用する必要はない。ただし、以下の意味は契約に残すべき。

1. 旧7条件だけで FROZEN へ戻さない。
2. CR-grounding overlay を M0-FREEZE 判定に接続する。
3. `PARTIAL` を合格扱いするなら、必ず `S-* carry` と紐づける。
4. `PASS(core)` と `PASS(boundary)` を通常の `PASS` と区別する。
5. scorecard 拡張は `review.m-contract-gate` との整合を取る。

## Codexへの委譲条件

Fable がこの契約更新を承認した後に限り、Codexへ以下を委譲できる。

- `m-contract-gate` に CR-grounding overlay を接続する。
- scorecard を再生成する。
- 必要なら scorecard markdown に overlay section を追加する。

Fable 承認前に Codex が docs / review.* を変更しない。
