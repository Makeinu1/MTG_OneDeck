// Reviewer-owned adversarial gold for M0-O1(LLM-oracle 盲予測ハーネスの機械部分)。
// 契約 = docs/oracle-harness.md §3(ファクト→層 写像)/ §4(差分・KPI)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/oracleHarness.ts)を直す。
//
// 採点対象は純関数 factsToLayers / computeReport(GameState 非依存・決定的・scripts 配下)。
// LLM 予測そのもの(predictions.json の中身)は採点しない=データ扱い。
import { describe, expect, it } from 'vitest';

import {
  computeReport,
  factsToLayers,
  type OracleFacts,
} from '../../../scripts/lib/oracleHarness';

function facts(partial: Partial<OracleFacts>): OracleFacts {
  return {
    changesController: false,
    changesTypes: false,
    changesColors: false,
    grantsOrRemovesAbilities: false,
    setsBasePT: false,
    modifiesPTByAmount: false,
    switchesPT: false,
    definesCharacteristicByCount: false,
    isCopyEffect: false,
    noContinuousEffect: false,
    uncertain: [],
    ...partial,
  };
}

describe('M0-O1 写像ゴールド: factsToLayers(挙動ファクト → 層)', () => {
  it('単ファクト → 対応層(契約 §3 写像表)', () => {
    expect(factsToLayers(facts({ changesController: true })).layers).toEqual(['L2']);
    expect(factsToLayers(facts({ changesTypes: true })).layers).toEqual(['L4']);
    expect(factsToLayers(facts({ changesColors: true })).layers).toEqual(['L5']);
    expect(factsToLayers(facts({ grantsOrRemovesAbilities: true })).layers).toEqual(['L6']);
    expect(factsToLayers(facts({ setsBasePT: true })).layers).toEqual(['L7b']);
    expect(factsToLayers(facts({ modifiesPTByAmount: true })).layers).toEqual(['L7c']);
    expect(factsToLayers(facts({ switchesPT: true })).layers).toEqual(['L7d']);
    expect(factsToLayers(facts({ isCopyEffect: true })).layers).toEqual(['L1a']);
  });

  it('definesCharacteristicByCount → L7a かつ cda=true', () => {
    const mapped = factsToLayers(facts({ definesCharacteristicByCount: true }));
    expect(mapped.layers).toEqual(['L7a']);
    expect(mapped.cda).toBe(true);
  });

  it('noContinuousEffect のみ → 空集合・cda=false', () => {
    const mapped = factsToLayers(facts({ noContinuousEffect: true }));
    expect(mapped.layers).toEqual([]);
    expect(mapped.cda).toBe(false);
  });

  it('複数ファクト → 重複なし・LAYER_ORDER 昇順', () => {
    const mapped = factsToLayers(
      facts({ setsBasePT: true, changesTypes: true, grantsOrRemovesAbilities: true }),
    );
    // L4 < L6 < L7b(layerClassify の LAYER_ORDER と同順)
    expect(mapped.layers).toEqual(['L4', 'L6', 'L7b']);
  });

  it('uncertain のファクトは確定層に出ず uncertainLayers に出る', () => {
    const mapped = factsToLayers(facts({ changesTypes: true, uncertain: ['switchesPT'] }));
    expect(mapped.layers).toEqual(['L4']);
    expect(mapped.uncertainLayers).toEqual(['L7d']);
  });

  it('決定的(同入力同出力)', () => {
    const a = factsToLayers(facts({ modifiesPTByAmount: true, changesColors: true }));
    const b = factsToLayers(facts({ modifiesPTByAmount: true, changesColors: true }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('M0-O1 差分・KPIゴールド: computeReport', () => {
  const classifier = [
    { oracleId: 'a', name: 'A', layers: ['L7c' as const], cda: false },
    { oracleId: 'b', name: 'B', layers: ['L4' as const, 'L7c' as const], cda: false },
    { oracleId: 'c', name: 'C', layers: ['L4' as const, 'L6' as const], cda: false },
  ];
  const predictions = [
    { oracleId: 'a', name: 'A', facts: facts({ modifiesPTByAmount: true }) }, // → L7c(一致)
    { oracleId: 'b', name: 'B', facts: facts({ changesTypes: true }) }, // → L4(分類器のみ L7c)
    {
      oracleId: 'c',
      name: 'C',
      facts: facts({ grantsOrRemovesAbilities: true, uncertain: ['changesTypes'] }),
    }, // → L6 確定 + L4 不確定(分類器の L4 は不確定マスクで不一致に数えない)
  ];
  const gold = [
    { oracleId: 'a', layers: ['L7c' as const] },
    { oracleId: 'b', layers: ['L4' as const, 'L7c' as const] },
  ];

  const report = computeReport(classifier, predictions, gold);

  it('不一致率 = 不確定でない不一致 / 比較数', () => {
    expect(report.comparedCount).toBe(3);
    // a 一致 / b 不一致 / c は不確定マスクで一致 → 不一致は b のみ
    expect(report.discrepancyRate).toBeCloseTo(1 / 3, 6);
  });

  it('検証不能率 = uncertain を含むカード / サンプル数(安全KPI)', () => {
    expect(report.unverifiableRate).toBeCloseTo(1 / 3, 6);
  });

  it('カード別 delta(classifierOnly / oracleOnly / deltaSignature)', () => {
    const b = report.discrepancies.find((d) => d.oracleId === 'b');
    expect(b).toBeDefined();
    expect(b?.classifierOnly).toEqual(['L7c']);
    expect(b?.oracleOnly).toEqual([]);
    expect(b?.agree).toBe(false);
    expect(b?.deltaSignature).toBe('-L7c');
  });

  it('不確定マスクされたカードは discrepancies に出ない', () => {
    expect(report.discrepancies.some((d) => d.oracleId === 'c')).toBe(false);
  });

  it('層別 confusion(L7c は分類器のみ1・一致1)', () => {
    const l7c = report.perLayerConfusion.find((x) => x.layer === 'L7c');
    expect(l7c).toEqual({ layer: 'L7c', classifierOnly: 1, oracleOnly: 0, agreeBoth: 1 });
  });

  it('物差し校正(ゴールド真値・L7c の recall=0.5 / precision=1)', () => {
    const l7c = report.goldCalibration.find((x) => x.layer === 'L7c');
    expect(l7c?.support).toBe(2);
    expect(l7c?.precision).toBeCloseTo(1, 6);
    expect(l7c?.recall).toBeCloseTo(0.5, 6);
  });

  it('クラスタは deltaSignature 別・attribution は null(Fable が後で裁定)', () => {
    const cluster = report.clusters.find((x) => x.signature === '-L7c');
    expect(cluster?.count).toBe(1);
    expect(report.discrepancies.every((d) => d.attribution === null)).toBe(true);
  });
});
