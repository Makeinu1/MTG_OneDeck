# M0-FREEZE Docs Contract Update Map

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が `docs/engine-spec.md` / `docs/acceptance.md` を更新するときに、M0-FREEZE の contract-update 反映漏れを防ぐための変更マップ。Codex は docs を直接変更しない。

## 結論

現行 docs には M-CR-RECONCILE / CRG 表 / CR grounding policy がすでに入っている。したがって必要なのは全面書き換えではなく、次の3点の契約化である。

1. `research/cr-grounding/m0-freeze-overlay.json` を M0-FREEZE 判定の追加正本として明記する。
2. Fable の承認対象を **contract-update stage** と **M0-FREEZE 完了** に分ける。
3. `m-contract-gate` の総合判定が legacy seven conditions + CR-grounding overlay の合成であることを §34.7.2 に足す。

## 現行 docs の状態

### `docs/engine-spec.md`

確認済みの既存内容:

- §34.0 に CR grounding policy がある。
- CR 2026-06-19 固定、ローカルCR、metadata、仕様判断ごとの根拠CRがある。
- `PASS` / `PASS(core)` / `PASS(boundary)` / `PARTIAL` を区別する旨がある。
- Z1〜Z5、M2 Player/Controller、APNAP v1、pending trigger、SBA subset の現況がある。
- §34.7.1 に旧7条件と M-CR-RECONCILE による FROZEN 撤回がある。
- §34.7.2 に legacy seven-condition scorecard の定義がある。

不足:

- `m0-freeze-overlay.json` を旧7条件に追加する overlay 正本として明示していない。
- `m0-freeze-decision-record.md` / `m0-freeze-evidence-audit.md` を Fable decision の入力として参照していない。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` の overlay verdict rule が §34.7.2 の scorecard 判定ロジックにまだ入っていない。
- `frozen` の意味が「未実装ゼロ」ではなく「S-* carry / scope-boundary を明示したうえで次段階へ進める」ことが scorecard 節で明確でない。

### `docs/acceptance.md`

確認済みの既存内容:

- `M-CR-RECONCILE CR 2026-06-19 地盤改良(engine-spec §34.0)` 節がある。
- CRG-1〜8 の acceptance 表がある。
- CRG-4 / 4.5 / 6 は `PARTIAL`、CRG-7 は `PASS(core)`、CRG-8 は `PASS(boundary)` として表現されている。

不足:

- CRG表が `m0-freeze-overlay.json` の freeze treatment と接続されていない。
- `PARTIAL allowed only if ... S-* carry` という acceptance rule が表の外に明示されていない。
- M0-FREEZE の acceptance が「旧 scorecard + CR-grounding overlay」であることがまだ弱い。

## `docs/engine-spec.md` 反映マップ

### 現行行アンカー

2026-06-28 時点の現行 `docs/engine-spec.md` では、挿入先は次の通り。
行番号は作業時点の目安であり、Fable が実際に編集する時点では周辺見出しで再確認する。

| Map | Current anchor | 挿入/更新位置 |
|---|---:|---|
| E1 | line 1799 | `M0 CR Grounding Gate の status 正本は ...` の直後 |
| E2 | line 1891 | `> **次 = M-CR-RECONCILE**...` の直後 |
| E3 | line 1929 | `**ゲート判定ロジック(決定的)**:` の既存3項目の後 |
| E4 | line 1896 | `**成果物**: research/m-contract-gate/scorecard.{md,json}` の段落内または直後 |

### E1. §34.0 CR grounding policy 末尾に overlay 正本を追加

配置候補:

- `M0 CR Grounding Gate の status 正本は ...` の直後。

追加すべき意味:

```md
M0-FREEZE の CR-grounding overlay 正本は `research/cr-grounding/m0-freeze-overlay.json` とする。
`research/cr-grounding/README.md` と `docs/acceptance.md` の CRG 表は人間向け表示であり、scorecard 配線時の機械可読入力は overlay JSON を使う。
Fable の承認/差戻し記録は `research/cr-grounding/m0-freeze-decision-record.md`、証拠監査は `research/cr-grounding/m0-freeze-evidence-audit.md` を参照する。
```

狙い:

- README / acceptance / overlay JSON の役割を分ける。
- scorecard wiring が Markdown を読みに行かないようにする。

### E2. §34.7.1 現況ブロックを更新

配置候補:

- `> **次 = M-CR-RECONCILE** ...` の直後。

追加すべき意味:

```md
2026-06-28 現況: CR-grounding research handoff は contract-update stage へ進める材料が揃ったが、M0-FREEZE は未完了。
M0-FREEZE 完了には、docs契約反映、scorecard overlay配線、scorecard再生成、Fable承認が必要。
したがって S-* 実装にはまだ進まない。
```

狙い:

- 「材料が揃った」と「凍結完了」を混同しない。
- 704.5p などの個別SBAへ直行する誤誘導を防ぐ。

### E3. §34.7.2 scorecard 節に overlay verdict rule を追加

配置候補:

- `ゲート判定ロジック(決定的)` の直後。

追加すべき意味:

```md
M-CR-RECONCILE 以後、総合判定は legacy seven conditions だけでなく CR-grounding overlay を合成する。

Input:
- legacy seven-condition reports
- `research/cr-grounding/m0-freeze-overlay.json`

Overlay verdict:
- `required-pass`: `PASS` 必須。
- `core-pass-only`: `PASS(core)` を許可。ただし `remainingBoundary` 必須。
- `boundary-pass-only`: `PASS(boundary)` を許可。ただし `remainingBoundary` 必須。
- `partial-allowed-*`: `PARTIAL` を許可。ただし `remainingBoundary` 必須。
- `FAIL` は不可。

Total verdict:
- `frozen = legacyFrozen && crGroundingOverlayApproved`

`PARTIAL` / `PASS(core)` / `PASS(boundary)` は通常の `PASS` に変換しない。Markdown scorecard でも status と remaining boundary を表示する。
```

狙い:

- `scorecard-overlay-wiring-spec.md` の内容を契約に昇格する。
- `m-contract-gate` 実装時の判定ロジックを docs 正本にする。

### E4. §34.7.2 成果物リストを拡張

配置候補:

- `成果物: research/m-contract-gate/scorecard.{md,json}` の近く。

追加すべき意味:

```md
CR-grounding overlay wiring 後の scorecard は、JSON に `crGroundingOverlay` section を含む。
Markdown には `CR-grounding Overlay` と `R-FREEZE Designs` を表示する。
旧 `Superseded` 注記は overlay 込みの判定に置き換える。
```

狙い:

- scorecard再生成後に旧注記を残して混乱させない。

## `docs/acceptance.md` 反映マップ

### 現行行アンカー

2026-06-28 時点の現行 `docs/acceptance.md` では、挿入先は次の通り。

| Map | Current anchor | 挿入/更新位置 |
|---|---:|---|
| A1 | line 518 | CRG-1〜8 表の直後 |
| A2 | line 518 | A1 の直後、同じ M-CR-RECONCILE 節末尾 |

### A1. M-CR-RECONCILE 節に M0-FREEZE acceptance rule を追加

配置候補:

- CRG-1〜8 表の直後。

追加すべき意味:

```md
M0-FREEZE は旧 M-CONTRACT scorecard に加えて CR-grounding overlay を確認する。
CRG-1 / 2 / 3 / 5 は required PASS。
CRG-4 / 4.5 / 6 は `PARTIAL` allowed only if 残境界が S-* carry として明示されている場合に限る。
CRG-7 は `PASS(core)`、CR 400.7例外群と full effective-characteristics snapshot は S-* carry。
CRG-8 は `PASS(boundary)`、Heal / Power-up / Teamwork / Preparation の実行器は scope-boundary。
未実装機構を `PASS` に混ぜない。
```

狙い:

- acceptance上も overlay JSON の treatment と同じ読みになる。

### A2. Acceptance evidence を追加

配置候補:

- M-CR-RECONCILE 節末尾。

追加すべき参照:

```md
判定材料:
- `research/cr-grounding/m0-freeze-overlay.json`
- `research/cr-grounding/m0-freeze-review-sheet.md`
- `research/cr-grounding/m0-freeze-decision-record.md`
- `research/cr-grounding/m0-freeze-evidence-audit.md`
```

狙い:

- Fable / reviewer がどこを見れば承認できるかを acceptance から辿れるようにする。

## 反映してはいけないこと

Fable承認前:

- `docs/` を Codex が直接編集しない。
- `review.*` を Codex が編集しない。
- `m-contract-gate` を overlay 込みと偽って再生成しない。
- S-* 実装へ進まない。

Fable承認後でも:

- `PARTIAL` を `PASS` に変換しない。
- `PASS(core)` / `PASS(boundary)` を plain `PASS` に潰さない。
- `CRG-4` を CR605全体complete と書かない。
- `CRG-6` を 603.3b second bucket 実装済みと書かない。
- `CRG-7` を 400.7例外群完了と書かない。
- `CRG-8` を新語彙実行器実装済みと書かない。

## Fable承認後の Codex 委譲文

Fable が D1〜D6 を承認した後、Codexへ渡すなら以下のように限定する。

```text
docs契約は更新済み。`research/cr-grounding/scorecard-overlay-wiring-spec.md` に従い、
`m-contract-gate` に `research/cr-grounding/m0-freeze-overlay.json` を読む
CR-grounding overlay を接続してください。

禁止:
- `review.*` の変更
- S-* 実装
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` の plain PASS 化

完了条件:
- scorecard JSON に `crGroundingOverlay` が出る
- scorecard Markdown に CR-grounding Overlay / R-FREEZE Designs が出る
- `frozen = legacyFrozen && crGroundingOverlayApproved`
- overlay JSON missing / required-pass non-PASS / remainingBoundary missing の通常テストがある
- `npm run m-contract-gate`
- 必要な機械チェック
```

## 現時点の判断

Codex観点では、docs反映の方向は **軽微追記 + scorecard判定ロジックの明文化** で足りる。
既存 docs にはCRG表とCR grounding policyがかなり入っているため、全面再設計は不要。

次にFableがすべきこと:

1. `m0-freeze-decision-record.md` の D1〜D6 を承認/差戻しする。
2. 承認なら、本ファイルの E1〜E4 / A1〜A2 を docs に反映する。
3. `review.m-contract-gate` の扱いを決める。
4. Codexへ scorecard overlay wiring を委譲する。
