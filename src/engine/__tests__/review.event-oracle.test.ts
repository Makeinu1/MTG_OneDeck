// Reviewer-owned adversarial gold for M0-O2(Slice2 イベント語彙 LLM-oracle ハーネスの機械部分)。
// 契約 = docs/oracle-harness.md §7(EventFacts schema・3軸集合差・KPI)。
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側(scripts/lib/eventOracleHarness.ts)を直す。
//
// 採点対象は純関数 computeEventReport(GameState 非依存・決定的・scripts 配下)。
// LLM 予測そのもの(predictions.json の中身)は採点しない=データ扱い。
import { describe, expect, it } from 'vitest';

import type { EventFamily, ObserverScope } from '../../../scripts/lib/eventClassify';
import { computeEventReport, type EventFacts } from '../../../scripts/lib/eventOracleHarness';

function facts(partial: Partial<EventFacts>): EventFacts {
  return {
    families: [],
    observers: [],
    hasInterveningIf: false,
    uncertain: [],
    ...partial,
  };
}

function classifierCard(
  oracleId: string,
  families: EventFamily[],
  observers: ObserverScope[],
  hasInterveningIf = false,
) {
  return { oracleId, name: oracleId.toUpperCase(), families, observers, hasInterveningIf };
}

describe('M0-O2 差分・KPIゴールド: computeEventReport(族/観測者/介在条件の3軸集合差)', () => {
  // a: 完全一致 / b: 族 oracleOnly("other") で不一致 / c: zone を uncertain マスク → 一致扱い
  const classifier = [
    classifierCard('a', ['dies', 'enters'], ['self']),
    classifierCard('b', ['cast'], ['self']),
    classifierCard('c', ['enters', 'zone'], ['self']),
  ];
  const predictions = [
    { oracleId: 'a', name: 'A', facts: facts({ families: ['dies', 'enters'], observers: ['self'] }) },
    { oracleId: 'b', name: 'B', facts: facts({ families: ['cast', 'other'], observers: ['self'] }) },
    {
      oracleId: 'c',
      name: 'C',
      facts: facts({ families: ['enters'], observers: ['self'], uncertain: ['zone'] }),
    },
  ];
  const gold = [
    { oracleId: 'a', families: ['dies', 'enters'] as EventFamily[], observers: ['self'] as ObserverScope[], hasInterveningIf: false },
    { oracleId: 'b', families: ['cast'] as EventFamily[], observers: ['self'] as ObserverScope[], hasInterveningIf: false },
  ];

  const report = computeEventReport(classifier, predictions, gold);

  it('比較数 = 予測と分類器が揃ったカード数', () => {
    expect(report.comparedCount).toBe(3);
    expect(report.sampleSize).toBe(3);
  });

  it('族不一致率 = uncertain でない族不一致 / 比較数(b のみ)', () => {
    expect(report.familyDiscrepancyRate).toBeCloseTo(1 / 3, 6);
  });

  it('観測者・介在条件は全一致 → 各不一致率 0', () => {
    expect(report.observerDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.interveningIfDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('検証不能率 = uncertain を含むカード / サンプル数(c のみ・安全KPI)', () => {
    expect(report.unverifiableRate).toBeCloseTo(1 / 3, 6);
  });

  it('uncertain マスクで一致したカード(c)は discrepancies に出ない', () => {
    expect(report.discrepancies.some((d) => d.oracleId === 'c')).toBe(false);
  });

  it('族 delta(b: oracleOnly=other・classifierOnly=空・deltaSignature=+other)', () => {
    const b = report.discrepancies.find((d) => d.oracleId === 'b');
    expect(b).toBeDefined();
    expect(b?.familyOracleOnly).toEqual(['other']);
    expect(b?.familyClassifierOnly).toEqual([]);
    expect(b?.familyAgree).toBe(false);
    expect(b?.agree).toBe(false);
    expect(b?.deltaSignature).toBe('+other');
  });

  it('per-family confusion(cast=一致1 / other=oracleOnly1 / enters=一致2)', () => {
    const cast = report.perFamilyConfusion.find((x) => x.family === 'cast');
    expect(cast).toEqual({ family: 'cast', classifierOnly: 0, oracleOnly: 0, agreeBoth: 1 });
    const other = report.perFamilyConfusion.find((x) => x.family === 'other');
    expect(other).toEqual({ family: 'other', classifierOnly: 0, oracleOnly: 1, agreeBoth: 0 });
    const enters = report.perFamilyConfusion.find((x) => x.family === 'enters');
    expect(enters).toEqual({ family: 'enters', classifierOnly: 0, oracleOnly: 0, agreeBoth: 2 });
  });

  it('uncertain マスクされた族(c の zone)は confusion に計上されない', () => {
    const zone = report.perFamilyConfusion.find((x) => x.family === 'zone');
    expect(zone).toEqual({ family: 'zone', classifierOnly: 0, oracleOnly: 0, agreeBoth: 0 });
  });

  it('物差し校正(ゴールド真値・cast は precision=recall=1 / other は FP で precision=0)', () => {
    const cast = report.goldCalibration.find((x) => x.family === 'cast');
    expect(cast?.support).toBe(1);
    expect(cast?.precision).toBeCloseTo(1, 6);
    expect(cast?.recall).toBeCloseTo(1, 6);
    const other = report.goldCalibration.find((x) => x.family === 'other');
    expect(other?.support).toBe(0);
    expect(other?.precision).toBeCloseTo(0, 6);
  });

  it('クラスタは deltaSignature 別・attribution は null(Fable が後で裁定)', () => {
    const cluster = report.clusters.find((x) => x.signature === '+other');
    expect(cluster?.count).toBe(1);
    expect(report.discrepancies.every((d) => d.attribution === null)).toBe(true);
  });
});

describe('M0-O2 観測者軸 + 介在条件軸 + deltaSignature 連結順', () => {
  // 族一致 / 観測者割れ(opponent↔any)/ 介在条件割れ(classifier true, oracle false)
  const classifier = [classifierCard('d', ['cast'], ['opponent'], true)];
  const predictions = [
    { oracleId: 'd', name: 'D', facts: facts({ families: ['cast'], observers: ['any'], hasInterveningIf: false }) },
  ];
  const report = computeEventReport(classifier, predictions, []);
  const d = report.discrepancies.find((x) => x.oracleId === 'd');

  it('族は一致・観測者と介在条件が不一致', () => {
    expect(report.familyDiscrepancyRate).toBeCloseTo(0, 6);
    expect(report.observerDiscrepancyRate).toBeCloseTo(1, 6);
    expect(report.interveningIfDiscrepancyRate).toBeCloseTo(1, 6);
    expect(d?.observerAgree).toBe(false);
    expect(d?.interveningIfAgree).toBe(false);
  });

  it('観測者 delta(oracleOnly=any・classifierOnly=opponent)', () => {
    expect(d?.observerOracleOnly).toEqual(['any']);
    expect(d?.observerClassifierOnly).toEqual(['opponent']);
  });

  it('deltaSignature = 族→観測者(@)→介在(if) の順・oracleOnly(+)先頭', () => {
    // 族 delta なし / 観測者 +@any(oracleOnly), -@opponent(classifierOnly) / 介在 -if(classifier true & oracle false)
    expect(d?.deltaSignature).toBe('+@any,-@opponent,-if');
  });
});

describe('M0-O2 不変条件(決定的・空入力)', () => {
  it('同入力で同出力(決定的)', () => {
    const c = [classifierCard('x', ['enters'], ['self'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ families: ['enters'], observers: ['self'] }) }];
    const a = computeEventReport(c, p, []);
    const b = computeEventReport(c, p, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('全一致サンプルは discrepancies 空・deltaSignature は出ない', () => {
    const c = [classifierCard('x', ['enters'], ['self'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ families: ['enters'], observers: ['self'] }) }];
    const report = computeEventReport(c, p, []);
    expect(report.discrepancies).toEqual([]);
    expect(report.familyDiscrepancyRate).toBeCloseTo(0, 6);
  });

  it('予測のないカードは比較対象外(comparedCount に数えない)', () => {
    const c = [classifierCard('x', ['enters'], ['self']), classifierCard('y', ['dies'], ['any'])];
    const p = [{ oracleId: 'x', name: 'X', facts: facts({ families: ['enters'], observers: ['self'] }) }];
    const report = computeEventReport(c, p, []);
    expect(report.comparedCount).toBe(1);
  });
});
