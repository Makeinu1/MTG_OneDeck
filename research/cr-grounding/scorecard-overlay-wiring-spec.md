# Scorecard Overlay Wiring Spec

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が M0-FREEZE 契約更新を承認した後、Codex が `m-contract-gate` に CR-grounding overlay を接続するための実装仕様。

## 前提

この仕様は **Fable承認後** に使う。承認前に `scripts/m-contract-gate.ts` や `research/m-contract-gate/scorecard.*` を変更しない。

入力:

- legacy seven-condition reports
- `research/cr-grounding/m0-freeze-overlay.json`

出力:

- `research/m-contract-gate/scorecard.json`
- `research/m-contract-gate/scorecard.md`

## JSON schema direction

既存 `GateScorecard` に overlay を追加する。

```ts
type CrGroundingStatus = 'PASS' | 'PASS(core)' | 'PASS(boundary)' | 'PARTIAL' | 'FAIL';

interface CrGroundingOverlayCondition {
  id: string;
  name: string;
  status: CrGroundingStatus;
  evidence: string[];
  freezeTreatment: string;
  remainingBoundary?: string;
}

interface RFreezeDesign {
  id: string;
  artifact: string;
  status: 'drafted' | 'approved' | 'rejected';
  decisionDirection: string;
}

interface CrGroundingOverlay {
  crVersion: string;
  status: string;
  overlayConditions: CrGroundingOverlayCondition[];
  rFreezeDesigns: RFreezeDesign[];
}

interface GateScorecard {
  // existing fields...
  crGroundingOverlay?: CrGroundingOverlay;
  frozen: boolean;
}
```

## Verdict rule

Fable契約承認後の推奨。

Legacy verdict:

- 既存7条件はすべて `PASS` 必須。

Overlay verdict:

- `freezeTreatment === 'required-pass'`: `status === 'PASS'` 必須。
- `freezeTreatment === 'core-pass-only'`: `status === 'PASS(core)'` 許可。ただし `remainingBoundary` 必須。
- `freezeTreatment === 'boundary-pass-only'`: `status === 'PASS(boundary)'` 許可。ただし `remainingBoundary` 必須。
- `freezeTreatment` が `partial-allowed-*`: `status === 'PARTIAL'` 許可。ただし `remainingBoundary` 必須。
- `FAIL` は不可。

Total verdict:

```ts
frozen = legacyFrozen && crGroundingOverlayApproved;
```

重要:

- `PARTIAL` を `PASS` に変換しない。
- markdown上でも `PARTIAL` / `PASS(core)` / `PASS(boundary)` を表示する。
- `frozen` の意味は「M0-FREEZE契約上、S-* carry/scope-boundaryを明示したうえで次段階へ進める」であり、未実装がゼロという意味ではない。

## Markdown rendering

既存 scorecard に次を追加する。

```md
## CR-grounding Overlay

| ID | Name | Status | Freeze treatment | Evidence | Remaining boundary |
|---|---|---|---|---|---|
...

## R-FREEZE Designs

| ID | Status | Artifact | Decision direction |
|---|---|---|---|
...
```

旧 `Superseded...` 注記は、overlay wiring 後は削除または以下へ置換する。

```md
> M-CR-RECONCILE overlay is included. `PARTIAL`, `PASS(core)`, and `PASS(boundary)` are not plain PASS; remaining boundaries are displayed below and must remain out of green coverage.
```

## Tests

`review.m-contract-gate` は reviewer-owned なので、Codexは変更しない。

Fable が期待更新した後、Codex側で追加/修正する通常テスト候補:

- overlay JSON が missing なら `frozen === false`。
- required-pass が `PARTIAL` なら `frozen === false`。
- `PASS(core)` に `remainingBoundary` が無ければ `frozen === false`。
- `PARTIAL` に `remainingBoundary` が無ければ `frozen === false`。
- legacy 7条件が1つでも非PASSなら `frozen === false`。
- overlay許可条件を満たす場合だけ legacy verdict と合成する。

## Implementation order

1. `scripts/lib/mContractGate.ts` に overlay 型と判定純関数を追加。
2. `scripts/m-contract-gate.ts` で `m0-freeze-overlay.json` を読む。
3. scorecard JSON に overlay section を出す。
4. scorecard markdown に overlay table を出す。
5. tests を通す。
6. `npm run m-contract-gate` で再生成。
7. 機械チェック4点。

## Non-goals

- CR-grounding の status を script が推測しない。正本は `m0-freeze-overlay.json`。
- S-* 実装に入らない。
- `review.*` をCodexが編集しない。
- docs契約更新前にこの配線を行わない。
