// Reviewer-owned adversarial gold for M-GATE-4 条件4(非LLM CR-conformance 物差し)。
// 契約 = docs/engine-spec.md §34.7.5。実装エージェント(Codex)は本ファイルを変更しないこと。
// 落ちたら実装側(scripts/lib/crConformance.ts / 該当 *Classify.ts)を直す。
//
// 二層で固定する:
//  (A) crConformance.ts の純関数(集合比較・集計・bounded 判定・PASS 述語)の**論理**。
//      実測値(gold.json/report.json)は採点しない=データ扱い。固定するのは集計と判定の正しさ。
//  (B) gold 代表カードの **CR 接地期待**を 4分類器の実出力で pin(物差しの歯=silent FN を捕える)。
//      ※ 軸ごとの厳密ゴールドは review.{zone,event,layer,timing}-coverage が担う。ここでは
//        ハーネスが依存する「軸→ラベル集合」抽出契約と、CR が一意に決める FN ガードのみを薄く固定する。
import { describe, expect, it } from 'vitest';

import {
  CR_CONFORMANCE_THRESHOLD,
  aggregateConformance,
  compareGoldEntry,
  conformancePass,
  type CrAxis,
  type CrEvaluatedEntry,
} from '../../../scripts/lib/crConformance';
import { classifyCardEvents } from '../../../scripts/lib/eventClassify';
import { classifyCardLayers } from '../../../scripts/lib/layerClassify';
import { classifyCardTiming } from '../../../scripts/lib/timingClassify';
import { classifyCardZones } from '../../../scripts/lib/zoneClassify';
import { makeDef } from './helpers';

// ────────────────────────────────────────────────────────────────────────────
// (A) 純関数の論理(契約 §34.7.5 (2))
// ────────────────────────────────────────────────────────────────────────────

describe('CR_CONFORMANCE_THRESHOLD(契約 §34.7.5)', () => {
  it('= 95%', () => {
    expect(CR_CONFORMANCE_THRESHOLD).toBe(0.95);
  });
});

describe('compareGoldEntry — 集合一致(順序非依存)', () => {
  it('完全一致 = conformant・missing/extra 空', () => {
    const result = compareGoldEntry(['hand', 'library'], ['library', 'hand']);
    expect(result.conformant).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it('取りこぼし(classifier-FN)= missing に出る・非 conformant', () => {
    const result = compareGoldEntry(['dies'], []);
    expect(result.conformant).toBe(false);
    expect(result.missing).toEqual(['dies']);
    expect(result.extra).toEqual([]);
  });

  it('過剰検出(classifier-FP)= extra に出る・非 conformant', () => {
    const result = compareGoldEntry(['upkeep'], ['upkeep', 'draw']);
    expect(result.conformant).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual(['draw']);
  });

  it('重複は集合として畳む(多重度を数えない)', () => {
    const result = compareGoldEntry(['enters', 'enters'], ['enters']);
    expect(result.conformant).toBe(true);
  });
});

describe('aggregateConformance — inScope/divergent/rate/bounded(契約 §34.7.5)', () => {
  const entry = (
    axis: CrAxis,
    conformant: boolean,
    scopeBoundary = false,
    hasAllowance = false,
  ): CrEvaluatedEntry => ({ axis, conformant, scopeBoundary, hasAllowance });

  it('scopeBoundary は分母から除外し別枠(凍結を律しない)', () => {
    const result = aggregateConformance(
      [
        entry('zone-transition', true),
        entry('zone-transition', false, true), // scope-boundary=in-scope から外す
      ],
      CR_CONFORMANCE_THRESHOLD,
    );
    expect(result.total).toBe(2);
    expect(result.scopeBoundary).toBe(1);
    expect(result.inScope).toBe(1);
    expect(result.conformant).toBe(1);
    expect(result.divergent).toBe(0);
    expect(result.conformanceRate).toBe(1);
    expect(result.bounded).toBe(true);
  });

  it('allowance 付き不一致 = conformant に数えない が divergent から除く(bounded 維持)', () => {
    const result = aggregateConformance(
      [
        entry('event-family', true),
        entry('event-family', false, false, true), // CR 引用 allowance
      ],
      CR_CONFORMANCE_THRESHOLD,
    );
    expect(result.inScope).toBe(2);
    expect(result.conformant).toBe(1);
    expect(result.divergent).toBe(0);
    expect(result.conformanceRate).toBe(0.5); // allowance は rate に含めない=閾値が効く
    expect(result.bounded).toBe(true);
  });

  it('allowance 無しの不一致 = divergent(silent 乖離)・bounded=false', () => {
    const result = aggregateConformance(
      [entry('layer', true), entry('layer', false)],
      CR_CONFORMANCE_THRESHOLD,
    );
    expect(result.inScope).toBe(2);
    expect(result.divergent).toBe(1);
    expect(result.conformanceRate).toBe(0.5);
    expect(result.bounded).toBe(false);
  });

  it('perAxis 内訳を軸別に集計する', () => {
    const result = aggregateConformance(
      [
        entry('zone-transition', true),
        entry('zone-transition', false),
        entry('timing', true),
      ],
      CR_CONFORMANCE_THRESHOLD,
    );
    expect(result.perAxis['zone-transition']).toMatchObject({ inScope: 2, conformant: 1, divergent: 1 });
    expect(result.perAxis.timing).toMatchObject({ inScope: 1, conformant: 1, divergent: 0 });
  });

  it('inScope=0 で割り算が壊れない(rate=0・bounded=true)', () => {
    const result = aggregateConformance([entry('layer', false, true)], CR_CONFORMANCE_THRESHOLD);
    expect(result.inScope).toBe(0);
    expect(result.conformanceRate).toBe(0);
    expect(result.bounded).toBe(true);
  });
});

describe('conformancePass — 条件4 PASS 述語(rate≥閾値 かつ bounded)', () => {
  const base = {
    total: 100,
    inScope: 100,
    scopeBoundary: 0,
    conformant: 96,
    divergent: 0,
    conformanceRate: 0.96,
    bounded: true,
    perAxis: {},
  };

  it('rate≥0.95 かつ bounded → PASS', () => {
    expect(conformancePass(base, CR_CONFORMANCE_THRESHOLD)).toBe(true);
  });

  it('rate<0.95 → FAIL(bounded でも)', () => {
    expect(conformancePass({ ...base, conformanceRate: 0.94 }, CR_CONFORMANCE_THRESHOLD)).toBe(false);
  });

  it('bounded=false → FAIL(rate 達成でも silent 乖離を緑にしない)', () => {
    expect(
      conformancePass({ ...base, divergent: 1, bounded: false }, CR_CONFORMANCE_THRESHOLD),
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (B) CR 接地・分類器 conformance(物差しの歯=FN ガード)
//   軸→ラベル集合の抽出契約: layer=.layers / event-family=.families /
//   zone-transition=.zones / timing=.junctures。
//   CR が一意に決める「必ず出るべきラベル(expected ⊆ actual)」のみ薄く固定する
//   (extra の厳密性は coverage gold が担う。ここで過剰に縛らない)。
// ────────────────────────────────────────────────────────────────────────────

function defOf(name: string, typeLine: string, oracleText: string) {
  return makeDef({ scryfallId: name, typeLine, faces: [{ name, typeLine, oracleText }] });
}

describe('CR 接地 conformance — 研究分類器が CR ラベルを取りこぼさない', () => {
  it('zone-transition: 自ライブラリ→自手札(CR 400/121)= zones ⊇ {hand, library}', () => {
    const zones = classifyCardZones(
      defOf('Demonic Tutor', 'Sorcery', 'Search your library for a card and put that card into your hand. Then shuffle.'),
    ).zones;
    expect(zones).toEqual(expect.arrayContaining(['hand', 'library']));
  });

  it('event-family: dies 誘発(CR 700.4)= families ⊇ {dies}', () => {
    const families = classifyCardEvents(
      defOf('Mortician', 'Creature — Zombie', 'Whenever this creature dies, draw a card.'),
    ).families;
    expect(families).toEqual(expect.arrayContaining(['dies']));
  });

  it('timing: 自アップキープ誘発(CR 503)= junctures ⊇ {upkeep}', () => {
    const junctures = classifyCardTiming(
      defOf('Upkeep Engine', 'Enchantment', 'At the beginning of your upkeep, draw a card.'),
    ).junctures;
    expect(junctures).toEqual(expect.arrayContaining(['upkeep']));
  });

  it('layer: P/T 修整オーラ(CR 613)= layers は非空配列(抽出契約)', () => {
    const layers = classifyCardLayers(
      defOf('Pump Aura', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +2/+2.'),
    ).layers;
    expect(Array.isArray(layers)).toBe(true);
    expect(layers.length).toBeGreaterThan(0);
  });
});
