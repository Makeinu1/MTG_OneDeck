# Scorecard Overlay Code Map

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: Fable が docs 契約更新を承認した後、Codex が `m-contract-gate` に CR-grounding overlay を配線するときの、現行コードに即した実装マップ。承認前に scripts / scorecard / review.* は変更しない。

## 現行コードの状態

確認対象:

- `scripts/lib/mContractGate.ts`
- `scripts/m-contract-gate.ts`
- `src/engine/__tests__/review.m-contract-gate.test.ts`
- `research/m-contract-gate/scorecard.{md,json}`
- `package.json`

結論:

- 現行 `scripts/lib/mContractGate.ts` は legacy seven conditions 用の純関数のみを持つ。
- `GateScorecard` は `generatedAt` / `conditions` / `frozen` / `headCoverage` / `unverifiable` だけを持つ。
- `judgeFrozen(conditions)` は全 conditions が `PASS` なら `true`。
- `scripts/m-contract-gate.ts` は `m0-freeze-overlay.json` を読まない。
- `renderMarkdown(scorecard)` は Conditions / Head Coverage / Unverifiable Rate / Verdict だけを出す。
- 現行 `scorecard.json` には手動または過去処理由来の `supersededBy` があるが、型と生成器はまだそれを扱っていない。
- `review.m-contract-gate.test.ts` は reviewer-owned。Codex は変更しない。

## 実装方針

Fable承認後の実装は、S-* 実装ではなく Gate wiring のみ。

最小変更は次の4層。

1. `scripts/lib/mContractGate.ts`
   - overlay 型を追加する。
   - overlay 判定純関数を追加する。
   - `judgeFrozen` を直接壊さず、合成用の新関数を追加する。

2. `scripts/m-contract-gate.ts`
   - `research/cr-grounding/m0-freeze-overlay.json` を読み込む。
   - scorecard に `crGroundingOverlay` と `crGroundingOverlayApproved` を出す。
   - `frozen` を `legacyFrozen && crGroundingOverlayApproved` にする。

3. Markdown rendering
   - `CR-grounding Overlay` table を出す。
   - `R-FREEZE Designs` table を出す。
   - 旧 superseded 注記を overlay included 注記へ置換する。

4. 通常テスト
   - reviewer-owned の `review.m-contract-gate.test.ts` ではなく、Codex側の通常テストを新設する。
   - ただし Fable が review expectation を更新する必要がある場合は、先に Fable が行う。

## `scripts/lib/mContractGate.ts` 変更マップ

### L1. 型追加

追加候補:

```ts
export type CrGroundingStatus =
  | 'PASS'
  | 'PASS(core)'
  | 'PASS(boundary)'
  | 'PARTIAL'
  | 'FAIL';

export interface CrGroundingOverlayCondition {
  id: string;
  name: string;
  status: CrGroundingStatus;
  evidence: string[];
  freezeTreatment: string;
  remainingBoundary?: string;
}

export interface RFreezeDesign {
  id: string;
  artifact: string;
  status: 'drafted' | 'approved' | 'rejected';
  decisionDirection: string;
}

export interface CrGroundingOverlay {
  object?: string;
  crVersion: string;
  status: string;
  overlayConditions: CrGroundingOverlayCondition[];
  rFreezeDesigns: RFreezeDesign[];
}

export interface CrGroundingOverlayVerdict {
  approved: boolean;
  problems: string[];
}
```

### L2. `GateScorecard` 拡張

既存:

```ts
export interface GateScorecard {
  generatedAt: string;
  conditions: GateCondition[];
  frozen: boolean;
  headCoverage: HeadCoverageResult;
  unverifiable: UnverifiableResult;
}
```

追加候補:

```ts
  legacyFrozen?: boolean;
  crGroundingOverlay?: CrGroundingOverlay;
  crGroundingOverlayApproved?: boolean;
  crGroundingOverlayProblems?: string[];
```

設計注意:

- 既存 reviewer test が `GateScorecard` の exact shape を見ていないなら互換性は高い。
- `legacyFrozen` を追加し、`frozen` の意味を total verdict に変える。

### L3. Overlay 判定関数を追加

追加候補:

```ts
export function judgeCrGroundingOverlay(
  overlay: CrGroundingOverlay | null,
): CrGroundingOverlayVerdict {
  if (overlay === null) {
    return { approved: false, problems: ['CR-grounding overlay missing'] };
  }

  const problems: string[] = [];

  for (const condition of overlay.overlayConditions) {
    const hasBoundary =
      typeof condition.remainingBoundary === 'string' &&
      condition.remainingBoundary.trim().length > 0;

    if (condition.status === 'FAIL') {
      problems.push(`${condition.id}: FAIL is not allowed`);
      continue;
    }

    if (condition.freezeTreatment === 'required-pass') {
      if (condition.status !== 'PASS') {
        problems.push(`${condition.id}: required-pass must be PASS`);
      }
      continue;
    }

    if (condition.freezeTreatment === 'core-pass-only') {
      if (condition.status !== 'PASS(core)') {
        problems.push(`${condition.id}: core-pass-only must be PASS(core)`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    if (condition.freezeTreatment === 'boundary-pass-only') {
      if (condition.status !== 'PASS(boundary)') {
        problems.push(`${condition.id}: boundary-pass-only must be PASS(boundary)`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    if (condition.freezeTreatment.startsWith('partial-allowed-')) {
      if (condition.status !== 'PARTIAL') {
        problems.push(`${condition.id}: partial treatment must be PARTIAL`);
      }
      if (!hasBoundary) {
        problems.push(`${condition.id}: remainingBoundary required`);
      }
      continue;
    }

    problems.push(`${condition.id}: unknown freezeTreatment ${condition.freezeTreatment}`);
  }

  return { approved: problems.length === 0, problems };
}
```

### L4. 合成判定関数を追加

既存 `judgeFrozen(conditions)` は reviewer test の対象なので意味を変えない。

追加候補:

```ts
export function judgeTotalFrozen(input: {
  legacyFrozen: boolean;
  crGroundingOverlayApproved: boolean;
}): boolean {
  return input.legacyFrozen && input.crGroundingOverlayApproved;
}
```

これにより既存 `judgeFrozen` は legacy 判定として残せる。

## `scripts/m-contract-gate.ts` 変更マップ

### M1. overlay path を追加

追加候補:

```ts
const CR_GROUNDING_OVERLAY_PATH = resolve(
  process.cwd(),
  'research/cr-grounding/m0-freeze-overlay.json',
);
```

### M2. overlay loader を追加

`loadReport` は `LoadedReport` 用なので、overlay用には型を明示した loader を作る。

候補:

```ts
async function loadCrGroundingOverlay(): Promise<CrGroundingOverlay | null> {
  try {
    const source = await readFile(CR_GROUNDING_OVERLAY_PATH, 'utf8');
    return JSON.parse(source) as CrGroundingOverlay;
  } catch {
    return null;
  }
}
```

実装時は `unknown` + type guard を使う方が堅いが、初回は `judgeCrGroundingOverlay` 側で missing/field異常を問題化するのが簡潔。

### M3. scorecard build を変更

現行:

```ts
const scorecard: GateScorecard = {
  generatedAt: new Date().toISOString(),
  conditions,
  frozen: judgeFrozen(conditions),
  headCoverage,
  unverifiable,
};
```

変更候補:

```ts
const legacyFrozen = judgeFrozen(conditions);
const crGroundingOverlay = await loadCrGroundingOverlay();
const crGroundingOverlayVerdict = judgeCrGroundingOverlay(crGroundingOverlay);

const scorecard: GateScorecard = {
  generatedAt: new Date().toISOString(),
  conditions,
  legacyFrozen,
  crGroundingOverlay: crGroundingOverlay ?? undefined,
  crGroundingOverlayApproved: crGroundingOverlayVerdict.approved,
  crGroundingOverlayProblems: crGroundingOverlayVerdict.problems,
  frozen: judgeTotalFrozen({
    legacyFrozen,
    crGroundingOverlayApproved: crGroundingOverlayVerdict.approved,
  }),
  headCoverage,
  unverifiable,
};
```

### M4. console output を明確化

候補:

```ts
console.log(`legacy=${legacyFrozen ? 'PASS' : 'FAIL'}`);
console.log(`crGroundingOverlay=${crGroundingOverlayVerdict.approved ? 'PASS' : 'FAIL'}`);
console.log(`verdict=${scorecard.frozen ? 'FROZEN' : 'NOT FROZEN'}`);
```

## Markdown rendering 変更マップ

現行 `renderMarkdown(scorecard)` は Conditions / Head Coverage / Unverifiable Rate / Verdict のみ。

追加順:

1. Conditions の前か後に注記:

```md
> M-CR-RECONCILE overlay is included. `PARTIAL`, `PASS(core)`, and `PASS(boundary)` are not plain PASS; remaining boundaries are displayed below and must remain out of green coverage.
```

2. `## CR-grounding Overlay`

```md
| ID | Name | Status | Freeze treatment | Evidence | Remaining boundary |
|---|---|---|---|---|---|
```

3. `## R-FREEZE Designs`

```md
| ID | Status | Artifact | Decision direction |
|---|---|---|---|
```

4. Verdict section:

```md
- Legacy seven-condition verdict: PASS/FAIL
- CR-grounding overlay verdict: PASS/FAIL
- Total verdict: FROZEN/NOT FROZEN
```

注意:

- Evidence は `, ` join でよい。
- `remainingBoundary` がない場合は `-`。
- `cell()` で `|` と改行を escape する。

## 通常テスト候補

`review.m-contract-gate.test.ts` は触らない。

Codex側で新規通常テストを作るなら候補:

- `src/engine/__tests__/m-contract-gate-overlay.test.ts`

テスト内容:

1. missing overlay:
   - `judgeCrGroundingOverlay(null).approved === false`

2. required-pass must be PASS:
   - `freezeTreatment:'required-pass'` で `status:'PARTIAL'` は fail

3. PASS(core) requires remainingBoundary:
   - `freezeTreatment:'core-pass-only'` + `status:'PASS(core)'` + boundaryなしは fail

4. PASS(boundary) requires remainingBoundary:
   - `freezeTreatment:'boundary-pass-only'` + `status:'PASS(boundary)'` + boundaryなしは fail

5. PARTIAL requires remainingBoundary:
   - `freezeTreatment:'partial-allowed-*'` + `status:'PARTIAL'` + boundaryなしは fail

6. FAIL is never allowed:
   - any treatment + `status:'FAIL'` は fail

7. happy path:
   - 現行 `m0-freeze-overlay.json` 相当の最小 fixture は approved

8. total frozen:
   - `judgeTotalFrozen({ legacyFrozen:true, crGroundingOverlayApproved:true }) === true`
   - どちらか false なら false

## 実行コマンド

Fable承認後の実装検証:

```sh
npx vitest run src/engine/__tests__/m-contract-gate-overlay.test.ts --reporter=dot
npm run m-contract-gate
npx vitest run src/engine/__tests__/review.m-contract-gate.test.ts --reporter=dot
```

リスクが低く通ったら機械チェック4点:

```sh
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

注意:

- `npm run m-contract-gate` は `research/m-contract-gate/scorecard.{md,json}` を上書きする。
- そのため Fable承認前には実行しない。

## 既存 scorecard との扱い

現在の `research/m-contract-gate/scorecard.md` は先頭に superseded 注記がある。

Overlay wiring 後は以下に置換する。

```md
> M-CR-RECONCILE overlay is included. `PARTIAL`, `PASS(core)`, and `PASS(boundary)` are not plain PASS; remaining boundaries are displayed below and must remain out of green coverage.
```

現在の `research/m-contract-gate/scorecard.json` には `supersededBy` がある。

Overlay wiring 後の扱い候補:

- `supersededBy` を消す。
- 代わりに `crGroundingOverlay` / `crGroundingOverlayApproved` / `crGroundingOverlayProblems` / `legacyFrozen` を追加する。

## 実装時の禁止事項

- `review.m-contract-gate.test.ts` をCodexが編集しない。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` を plain `PASS` に変換しない。
- overlay status を script が推測しない。正本は `m0-freeze-overlay.json`。
- S-* 実装に入らない。
- docs契約更新前にこの実装をしない。

## 現時点の次手

まだ Fable承認前なので、ここで止める。

次に必要な人間/Fable判断:

1. `m0-freeze-decision-record.md` の D1〜D6 を承認/差戻し。
2. `docs-contract-update-map.md` に従って docs を更新。
3. `review.m-contract-gate` の期待更新要否を判断。
4. Codexへこの code map に基づく Gate wiring を委譲。
