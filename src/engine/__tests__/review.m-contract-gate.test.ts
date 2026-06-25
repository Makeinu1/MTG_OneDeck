// Reviewer-owned adversarial gold for M-GATE-1(M-CONTRACT ゲート・スコアカードの機械部分)。
// 契約 = docs/engine-spec.md §34.7.2(成果物・頭被覆定義・検証不能上限 U・判定ロジック)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/mContractGate.ts)を直す。
//
// 採点対象は純関数(GameState 非依存・決定的・scripts 配下)。
// scorecard.json の中身(実測値)は採点しない=データ扱い。ここで固定するのは集計と判定ロジックの正しさ。
import { describe, expect, it } from 'vitest';

import {
  HEAD_COVERAGE_THRESHOLD,
  UNVERIFIABLE_CEILING,
  aggregateHeadCoverage,
  aggregateUnverifiable,
  computeAxisCoverage,
  judgeCondition,
  judgeFrozen,
  type AxisCoverage,
  type GateCondition,
} from '../../../scripts/lib/mContractGate';

describe('M-GATE-1 閾値定数(契約 §34.7.2)', () => {
  it('T = 90% / U = 10%', () => {
    expect(HEAD_COVERAGE_THRESHOLD).toBe(0.9);
    expect(UNVERIFIABLE_CEILING).toBe(0.1);
  });
});

describe('computeAxisCoverage — 逃し箱を未写像とみなす頻度加重', () => {
  it('逃し箱を持つ軸: coverage = 1 − escapeFreq/total(event 実値で確認)', () => {
    // event(族): other lineCount=739 / triggerLineCount=9791
    const axis = computeAxisCoverage({
      axis: 'event-family',
      escapeBox: 'other',
      total: 9791,
      escapeFreq: 739,
      oracleGated: false,
    });
    expect(axis.coverage).toBeCloseTo(1 - 739 / 9791, 6);
    expect(axis.coverage).toBeGreaterThan(0.92);
    expect(axis.oracleGated).toBe(false);
  });

  it('逃し箱を持たない軸は coverage=null(self では FN 検出不能=oracle-gated・100%を主張しない)', () => {
    const axis = computeAxisCoverage({
      axis: 'layer',
      escapeBox: null,
      total: 5000,
      escapeFreq: 0,
      oracleGated: true,
    });
    expect(axis.coverage).toBeNull();
    expect(axis.oracleGated).toBe(true);
  });
});

describe('aggregateHeadCoverage — 集約=逃し箱保有軸の最小値(件数平均でない)', () => {
  const axes: AxisCoverage[] = [
    { axis: 'event-family', escapeBox: 'other', total: 9791, escapeFreq: 739, coverage: 1 - 739 / 9791, oracleGated: false },
    { axis: 'timing-juncture', escapeBox: 'other', total: 2000, escapeFreq: 60, coverage: 1 - 60 / 2000, oracleGated: false },
    { axis: 'zone-scope', escapeBox: 'unknown', total: 16000, escapeFreq: 1920, coverage: 1 - 1920 / 16000, oracleGated: false },
    { axis: 'layer', escapeBox: null, total: 5000, escapeFreq: 0, coverage: null, oracleGated: true },
  ];

  it('aggregate は非 oracle-gated 軸の最小値(最弱軸が凍結を律する)', () => {
    const result = aggregateHeadCoverage(axes, HEAD_COVERAGE_THRESHOLD);
    // 最弱 = zone-scope 0.88
    expect(result.aggregate).toBeCloseTo(0.88, 6);
    expect(result.threshold).toBe(0.9);
  });

  it('集約は単純平均ではない(最小 0.88 ≠ 平均 ≈ 0.925)', () => {
    const result = aggregateHeadCoverage(axes, HEAD_COVERAGE_THRESHOLD);
    const nonGated = axes.filter((a) => !a.oracleGated && a.coverage !== null);
    const mean = nonGated.reduce((s, a) => s + (a.coverage ?? 0), 0) / nonGated.length;
    // 平均 ≈ 0.925(= (0.9245 + 0.97 + 0.88)/3)。集約は最小 0.88 でこれより低い。
    expect(mean).toBeGreaterThan(0.92);
    expect(mean).toBeLessThan(0.93);
    expect(result.aggregate).toBeLessThan(mean);
  });

  it('oracle-gated 軸は集約の母数に入れない', () => {
    const result = aggregateHeadCoverage(axes, HEAD_COVERAGE_THRESHOLD);
    // layer(gated)を 0.10 に汚しても aggregate は変わらない
    const polluted = axes.map((a) => (a.oracleGated ? { ...a, coverage: 0.1 } : a));
    expect(aggregateHeadCoverage(polluted, HEAD_COVERAGE_THRESHOLD).aggregate).toBeCloseTo(result.aggregate, 6);
  });
});

describe('aggregateUnverifiable — サンプル加重平均 + max(条件7)', () => {
  const oracles = [
    { name: 'layer', rate: 0, sampleSize: 192 },
    { name: 'event', rate: 0.024630541871921183, sampleSize: 203 },
    { name: 'zone', rate: 0.0582010582010582, sampleSize: 189 },
    { name: 'timing', rate: 0.015306122448979591, sampleSize: 196 },
  ];

  it('weightedMean = Σ(rate·n)/Σn・max = 最大率', () => {
    const result = aggregateUnverifiable(oracles, UNVERIFIABLE_CEILING);
    const num = oracles.reduce((s, o) => s + o.rate * o.sampleSize, 0);
    const den = oracles.reduce((s, o) => s + o.sampleSize, 0);
    expect(result.weightedMean).toBeCloseTo(num / den, 9);
    expect(result.max).toBeCloseTo(0.0582010582010582, 9);
    expect(result.ceiling).toBe(0.1);
  });
});

describe('judgeCondition — ゲート判定ロジック(§34.7.2・method §3 鉄則)', () => {
  const base = {
    id: 2,
    name: 'head-coverage',
    threshold: 0.9,
    higherIsBetter: true,
    unverifiable: 0,
    unverifiableIsMetric: false,
    source: 'research/m-contract-gate/scorecard.json',
    note: '',
  };

  it('閾値達成 かつ 検証不能ゼロ → PASS', () => {
    const c = judgeCondition({ ...base, value: 0.95 });
    expect(c.status).toBe('PASS');
  });

  it('🔴閾値達成でも 検証不能>0 は PASS にできない(silent divergence 禁止)', () => {
    const c = judgeCondition({ ...base, value: 0.95, unverifiable: 0.03 });
    expect(c.status).not.toBe('PASS');
    expect(c.status).toBe('FAIL');
  });

  it('閾値未達 → FAIL', () => {
    expect(judgeCondition({ ...base, value: 0.85 }).status).toBe('FAIL');
  });

  it('条件7(unverifiableIsMetric)は検証不能自体が指標=上限以下なら PASS', () => {
    const pass = judgeCondition({
      ...base,
      id: 7,
      name: 'unverifiable-rate',
      value: 0.024,
      threshold: 0.1,
      higherIsBetter: false,
      unverifiableIsMetric: true,
    });
    expect(pass.status).toBe('PASS');
    const fail = judgeCondition({
      ...base,
      id: 7,
      value: 0.15,
      threshold: 0.1,
      higherIsBetter: false,
      unverifiableIsMetric: true,
    });
    expect(fail.status).toBe('FAIL');
  });

  it('parity(lowerIsBetter・閾値0)は 3.49% で FAIL', () => {
    const c = judgeCondition({
      ...base,
      id: 6,
      name: 'parity',
      value: 0.0349,
      threshold: 0,
      higherIsBetter: false,
    });
    expect(c.status).toBe('FAIL');
  });

  it('value=null は BLOCKED(器未整備)/ unmeasured=true は UNMEASURED', () => {
    expect(judgeCondition({ ...base, id: 5, value: null, threshold: null }).status).toBe('BLOCKED');
    expect(judgeCondition({ ...base, id: 5, value: null, threshold: null, unmeasured: true }).status).toBe('UNMEASURED');
  });
});

describe('judgeFrozen — 全7条件 PASS のときのみ凍結', () => {
  function cond(status: GateCondition['status']): GateCondition {
    return { id: 1, name: 'x', status, value: null, threshold: null, unverifiable: 0, source: '', note: '' };
  }

  it('全 PASS → frozen', () => {
    expect(judgeFrozen(Array.from({ length: 7 }, () => cond('PASS')))).toBe(true);
  });

  it('1条件でも非 PASS → NOT FROZEN', () => {
    const conditions = Array.from({ length: 7 }, () => cond('PASS'));
    conditions[3] = cond('FAIL');
    expect(judgeFrozen(conditions)).toBe(false);
    conditions[3] = cond('BLOCKED');
    expect(judgeFrozen(conditions)).toBe(false);
  });
});
