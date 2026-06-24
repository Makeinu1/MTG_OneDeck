// Reviewer-owned adversarial gold for M0-T-O(Slice4 タイミング LLM-oracle ハーネスの機械部分)。
// 契約 = docs/oracle-harness.md §9(TimingFacts schema・3軸比較・KPI)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/timingOracleHarness.ts)を直す。
//
// 採点対象は純関数 computeTimingReport(GameState 非依存・決定的・scripts 配下)。
// LLM 予測そのもの(predictions.json の中身)は採点しない=データ扱い。
import { describe, expect, it } from 'vitest';

import type { ObserverScope } from '../../../scripts/lib/eventClassify';
import type { CastTiming, TimingStep } from '../../../scripts/lib/timingClassify';
import { computeTimingReport, type TimingFacts } from '../../../scripts/lib/timingOracleHarness';

function facts(partial: Partial<TimingFacts>): TimingFacts {
  return {
    junctures: [],
    junctureScope: [],
    castTiming: ['none'],
    uncertain: [],
    ...partial,
  };
}

function classifierCard(
  oracleId: string,
  junctures: TimingStep[],
  junctureScope: ObserverScope[],
  castTiming: CastTiming[],
) {
  return { oracleId, name: oracleId.toUpperCase(), junctures, junctureScope, castTiming };
}

describe('M0-T-O 3軸ゴールド: computeTimingReport(junctures/junctureScope/castTiming)', () => {
  // a: 完全一致 / b: juncture FN(分類器空・オラクル upkeep) / c: castTiming を uncertain マスク
  const classifier = [
    classifierCard('a', ['upkeep'], ['self'], ['none']),
    classifierCard('b', [], [], ['none']),
    classifierCard('c', ['end-step'], ['self'], ['none']),
  ];
  const predictions = [
    { oracleId: 'a', name: 'A', facts: facts({ junctures: ['upkeep'], junctureScope: ['self'] }) },
    {
      oracleId: 'b',
      name: 'B',
      facts: facts({ junctures: ['upkeep'], junctureScope: ['self'] }),
    },
    {
      oracleId: 'c',
      name: 'C',
      facts: facts({ junctures: ['end-step'], junctureScope: ['self'], castTiming: ['flash'], uncertain: ['flash'] }),
    },
  ];
  const gold = [
    { oracleId: 'a', junctures: ['upkeep'] as TimingStep[], junctureScope: ['self'] as ObserverScope[], castTiming: ['none'] as CastTiming[] },
    { oracleId: 'b', junctures: ['upkeep'] as TimingStep[], junctureScope: ['self'] as ObserverScope[], castTiming: ['none'] as CastTiming[] },
  ];

  const report = computeTimingReport(classifier, predictions, gold);

  it('比較数 = 予測と分類器が揃ったカード数', () => {
    expect(report.comparedCount).toBe(3);
    expect(report.sampleSize).toBe(3);
  });

  it('juncture 不一致率 = uncertain でない juncture 不一致 / 比較数(b のみ・juncture FN の主指標)', () => {
    expect(report.junctureDiscrepancyRate).toBeCloseTo(1 / 3, 6);
  });

  it('junctureScope/castTiming は uncertain マスク後に全一致 → 各不一致率 0', () => {
    expect(report.junctureScopeDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.castTimingDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('検証不能率 = uncertain を含むカード / サンプル数(c のみ・安全KPI)', () => {
    expect(report.unverifiableRate).toBeCloseTo(1 / 3, 6);
  });

  it('uncertain マスクで一致したカード(c)は discrepancies に出ない', () => {
    expect(report.discrepancies.some((d) => d.oracleId === 'c')).toBe(false);
  });

  it('b: juncture は oracleOnly=upkeep(分類器が juncture を取りこぼし=FN)', () => {
    const b = report.discrepancies.find((d) => d.oracleId === 'b');
    expect(b).toBeDefined();
    expect(b?.junctureOracleOnly).toEqual(['upkeep']);
    expect(b?.junctureClassifierOnly).toEqual([]);
    expect(b?.junctureAgree).toBe(false);
    expect(b?.agree).toBe(false);
    expect(b?.deltaSignature).not.toBe('=');
  });

  it('物差し校正(ゴールド真値・upkeep は precision=recall=1)', () => {
    const upkeep = report.goldCalibration.find((x) => x.step === 'upkeep');
    expect(upkeep?.support).toBe(2);
    expect(upkeep?.precision).toBeCloseTo(1, 6);
    expect(upkeep?.recall).toBeCloseTo(1, 6);
  });

  it('attribution は null(Fable が後で裁定)', () => {
    expect(report.discrepancies.every((d) => d.attribution === null)).toBe(true);
  });
});

describe('M0-T-O castTiming + scope の複合 delta', () => {
  // d: castTiming 割れ(classifier none・oracle flash) / scope 割れ(oracleOnly opponent)
  const classifier = [classifierCard('d', ['upkeep'], ['self'], ['none'])];
  const predictions = [
    {
      oracleId: 'd',
      name: 'D',
      facts: facts({ junctures: ['upkeep'], junctureScope: ['self', 'opponent'], castTiming: ['flash'] }),
    },
  ];
  const report = computeTimingReport(classifier, predictions, []);
  const d = report.discrepancies.find((x) => x.oracleId === 'd');

  it('juncture 一致・scope 割れ・castTiming 割れ', () => {
    expect(report.junctureDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.junctureScopeDiscrepancyRate).toBeCloseTo(1, 6);
    expect(report.castTimingDiscrepancyRate).toBeCloseTo(1, 6);
  });

  it('scope delta(oracleOnly=opponent)', () => {
    expect(d?.scopeOracleOnly).toEqual(['opponent']);
    expect(d?.scopeClassifierOnly).toEqual([]);
  });

  it('castTiming delta(classifier none・oracle flash)', () => {
    expect(d?.classifierCastTiming).toEqual(['none']);
    expect(d?.oracleCastTiming).toEqual(['flash']);
    expect(d?.castTimingAgree).toBe(false);
  });
});

describe('M0-T-O 不変条件(決定的・空入力)', () => {
  it('同入力で同出力(決定的)', () => {
    const c = [classifierCard('x', ['upkeep'], ['self'], ['none'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ junctures: ['upkeep'], junctureScope: ['self'] }) }];
    const a = computeTimingReport(c, p, []);
    const b = computeTimingReport(c, p, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('全一致サンプルは discrepancies 空', () => {
    const c = [classifierCard('x', ['upkeep'], ['self'], ['none'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ junctures: ['upkeep'], junctureScope: ['self'] }) }];
    const report = computeTimingReport(c, p, []);
    expect(report.discrepancies).toEqual([]);
    expect(report.junctureDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('予測のないカードは比較対象外(comparedCount に数えない)', () => {
    const c = [
      classifierCard('x', ['upkeep'], ['self'], ['none']),
      classifierCard('y', ['end-step'], ['self'], ['flash']),
    ];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ junctures: ['upkeep'], junctureScope: ['self'] }) }];
    const report = computeTimingReport(c, p, []);
    expect(report.comparedCount).toBe(1);
  });
});
