# Q2 Scorecard Overlay Test Plan

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が Q1 を承認した後、Codex が Q2(scorecard overlay wiring)を実装するときに、`review.*` を変更せずに何をテストすべきかを固定する。

## 現行コード観察

対象:

- `scripts/lib/mContractGate.ts`
- `scripts/m-contract-gate.ts`
- `src/engine/__tests__/review.m-contract-gate.test.ts`

観察:

- `GateScorecard` は `generatedAt` / `conditions` / `frozen` / `headCoverage` / `unverifiable` のみ。
- `judgeFrozen(conditions)` は全 legacy conditions が `PASS` のときだけ `true`。
- `scripts/m-contract-gate.ts` は `research/cr-grounding/m0-freeze-overlay.json` を読まない。
- `renderMarkdown(scorecard)` は `Conditions` / `Head Coverage` / `Unverifiable Rate` / `Verdict` のみ。
- `review.m-contract-gate.test.ts` は legacy pure functions を固定しており、Codex は変更しない。

Q2 の実装は、既存 reviewer test を壊さず、legacy 判定を `legacyFrozen` として保存し、その上に CR-grounding overlay 判定を合成する。

## Required pure functions

`scripts/lib/mContractGate.ts` に追加する通常テスト対象。

```ts
judgeCrGroundingOverlay(overlay: CrGroundingOverlay | null): CrGroundingOverlayVerdict
judgeTotalFrozen(input: {
  legacyFrozen: boolean;
  crGroundingOverlayApproved: boolean;
}): boolean
```

既存 `judgeFrozen(conditions)` の意味は変えない。これは legacy seven-condition 判定のまま残す。

## Test fixtures

### T1. Missing overlay

Input:

```ts
judgeCrGroundingOverlay(null)
```

Expected:

- `approved === false`
- `problems` contains `CR-grounding overlay missing`

Purpose:

- overlay 未接続のまま `frozen: true` になる事故を防ぐ。

### T2. Required-pass must be PASS

Fixture:

```ts
{
  crVersion: '2026-06-19',
  status: 'test',
  overlayConditions: [
    {
      id: 'CRG-X',
      name: 'required example',
      status: 'PARTIAL',
      evidence: [],
      freezeTreatment: 'required-pass'
    }
  ],
  rFreezeDesigns: []
}
```

Expected:

- `approved === false`
- problem says required-pass must be PASS

Purpose:

- CRG-1/2/3/5 を `PARTIAL` で通さない。

### T3. Core pass requires boundary

Fixture:

```ts
{
  overlayConditions: [
    {
      id: 'CRG-7',
      name: 'Zone movement and LKI',
      status: 'PASS(core)',
      evidence: ['x'],
      freezeTreatment: 'core-pass-only'
    }
  ]
}
```

Expected:

- `approved === false`
- problem says `remainingBoundary required`

Purpose:

- CR 400.7 例外群と full effective-characteristics snapshot を見えなくしない。

### T4. Boundary pass requires boundary

Fixture:

```ts
{
  overlayConditions: [
    {
      id: 'CRG-8',
      name: '2026-06-19 new vocabulary',
      status: 'PASS(boundary)',
      evidence: ['x'],
      freezeTreatment: 'boundary-pass-only'
    }
  ]
}
```

Expected:

- `approved === false`
- problem says `remainingBoundary required`

Purpose:

- Heal / Power-up / Teamwork / Preparation の実行器未実装を緑に混ぜない。

### T5. Partial requires boundary

Fixture:

```ts
{
  overlayConditions: [
    {
      id: 'CRG-6',
      name: 'Trigger/SBA/priority',
      status: 'PARTIAL',
      evidence: ['x'],
      freezeTreatment: 'partial-allowed-only-if-second-bucket-and-full-sba-are-s-carry'
    }
  ]
}
```

Expected:

- `approved === false`
- problem says `remainingBoundary required`

Purpose:

- 603.3b second bucket / full SBA suite を消さない。

### T6. Wrong status for treatment fails

Cases:

- `freezeTreatment: 'core-pass-only'` with `status: 'PASS'` fails.
- `freezeTreatment: 'boundary-pass-only'` with `status: 'PASS'` fails.
- `freezeTreatment: 'partial-allowed-*'` with `status: 'PASS'` fails.
- `status: 'FAIL'` always fails.

Purpose:

- `PASS(core)` / `PASS(boundary)` / `PARTIAL` を plain `PASS` に潰す実装を防ぐ。

### T7. Unknown treatment fails

Fixture:

```ts
{
  id: 'CRG-X',
  name: 'unknown',
  status: 'PASS',
  evidence: [],
  freezeTreatment: 'unknown-treatment'
}
```

Expected:

- `approved === false`
- problem says unknown freezeTreatment

Purpose:

- overlay JSON の typo を silent pass させない。

### T8. Current real overlay passes under Q2 rules

Input:

- `research/cr-grounding/m0-freeze-overlay.json`

Expected:

- `judgeCrGroundingOverlay(realOverlay).approved === true`
- `problems.length === 0`

Purpose:

- Q2 が現在の CRG-1〜8 / R-FREEZE-1〜4 を契約通り受け入れる。

### T9. Total verdict is conjunctive

Cases:

| legacyFrozen | crGroundingOverlayApproved | expected |
|---|---|---|
| true | true | true |
| true | false | false |
| false | true | false |
| false | false | false |

Purpose:

- 旧7条件だけで `frozen: true` にならない。

## CLI/output tests after Q2

Q2 実装後に通常テストまたは smoke check で確認する。

### C1. scorecard JSON shape

After:

```sh
npm run m-contract-gate
```

Expected `research/m-contract-gate/scorecard.json` has:

- `legacyFrozen`
- `crGroundingOverlay`
- `crGroundingOverlayApproved`
- `crGroundingOverlayProblems`
- `frozen`

Expected relation:

```ts
scorecard.frozen ===
  scorecard.legacyFrozen && scorecard.crGroundingOverlayApproved
```

### C2. scorecard Markdown sections

Expected `research/m-contract-gate/scorecard.md` contains:

- `## CR-grounding Overlay`
- `## R-FREEZE Designs`
- `PARTIAL`
- `PASS(core)`
- `PASS(boundary)`
- `remainingBoundary` contents or equivalent displayed text
- overlay included note

Expected not to contain as active verdict basis:

- old `Superseded` note that implies CR-grounding is outside the scorecard

### C3. No S-* mutation

Q2 must not modify engine behavior.

Allowed targets:

- `scripts/lib/mContractGate.ts`
- `scripts/m-contract-gate.ts`
- Codex-owned normal tests
- `research/m-contract-gate/scorecard.{md,json}` after regeneration

Disallowed targets:

- `src/engine/*` unrelated to tests
- `src/store/*`
- `docs/*` after Q1 is closed
- `review.*`

## Post-Q2 verification commands

```sh
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
npm run m-contract-gate
node research/cr-grounding/verify-q2-scorecard-output.mjs
```

Then run the full project gate:

```sh
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

## Failure interpretation

| Failure | Meaning | Action |
|---|---|---|
| real overlay fails | Q2 implementation or overlay JSON disagrees with docs; stop before scorecard regeneration |
| missing overlay passes | total verdict is unsafe; fix `judgeCrGroundingOverlay` |
| `PASS(core)` without boundary passes | CR 400.7 exceptions are being hidden; fix overlay verdict |
| `PARTIAL` becomes plain `PASS` in Markdown | scorecard is misleading; fix rendering |
| legacy false + overlay true yields frozen true | total verdict is not conjunctive; fix `judgeTotalFrozen` |
| `review.m-contract-gate` fails | existing legacy contract was broken; fix implementation, do not edit review test |

## Handoff rule

Q2 can start only after Q1 is approved and docs are updated. This test plan does not authorize touching `scripts/` before that point.
