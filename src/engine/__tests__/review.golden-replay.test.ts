import { describe, expect, it } from 'vitest';

import {
  formatGoldenReplayDiffs,
  parseGoldenReplayCase,
  replayGoldenCase,
  type GoldenReplayCase,
  type GoldenUnverifiable,
} from '../goldenReplay';

// Review-owned (Fable). M-GATE-3 / engine-spec §34.7.4 + §34.7.2 条件5。
// 実デッキ加重サンプル・構造化検証可能性(scope-boundary / runtime-gap)・T5=70% を
// ゲート集計とは独立に再計算して採点する(敵対的)。実装エージェントは本ファイルを変更しない。

const DECKS = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
const MIN_TOTAL = 32;
const MIN_PER_DECK = 8;
const T5 = 0.7;

const rawModules = import.meta.glob('../../../research/golden-replay/cases/*.json', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(rawModules).sort(([left], [right]) => left.localeCompare(right));

const cases: { path: string; raw: Record<string, unknown>; parsed: GoldenReplayCase }[] = entries.map(
  ([path, payload]) => ({
    path,
    raw: payload as Record<string, unknown>,
    parsed: parseGoldenReplayCase(payload, path),
  }),
);

function unverifiableOf(testCase: GoldenReplayCase): GoldenUnverifiable[] {
  return testCase.unverifiable ?? [];
}

function isPureScopeBoundary(testCase: GoldenReplayCase): boolean {
  const list = unverifiableOf(testCase);
  return list.length > 0 && list.every((entry) => entry.kind === 'scope-boundary');
}

function hasRuntimeGap(testCase: GoldenReplayCase): boolean {
  return unverifiableOf(testCase).some((entry) => entry.kind === 'runtime-gap');
}

function isVerified(testCase: GoldenReplayCase): boolean {
  return unverifiableOf(testCase).length === 0;
}

describe('golden replay execution harness (M-GATE-3)', () => {
  it('整備された実デッキ加重サンプル(最小標本・全デッキ網羅)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(MIN_TOTAL);
    const byDeck = new Map<string, number>();
    for (const { parsed } of cases) {
      byDeck.set(parsed.sourceDeck, (byDeck.get(parsed.sourceDeck) ?? 0) + 1);
    }
    expect(new Set(byDeck.keys())).toEqual(new Set(DECKS));
    for (const deck of DECKS) {
      expect(byDeck.get(deck) ?? 0).toBeGreaterThanOrEqual(MIN_PER_DECK);
    }
  });

  it('自由文字列 limitations[] は構造化検証可能性へ移行済み(残存禁止)', () => {
    const offenders = cases.filter(({ raw }) => 'limitations' in raw).map(({ path }) => path);
    expect(offenders, `legacy limitations[] remains: ${offenders.join(', ')}`).toEqual([]);
  });

  it('検証可能性エントリは整形式・kind 混在禁止(1ケース=1機構)', () => {
    for (const { path, parsed } of cases) {
      const list = unverifiableOf(parsed);
      const kinds = new Set(list.map((entry) => entry.kind));
      expect(kinds.size, `${path}: scope-boundary と runtime-gap の混在`).toBeLessThanOrEqual(1);
      for (const entry of list) {
        expect(['scope-boundary', 'runtime-gap']).toContain(entry.kind);
        expect(entry.reason.trim().length, `${path}: 空 reason`).toBeGreaterThan(0);
        expect(entry.ref.trim().length, `${path}: 接地 ref 欠落`).toBeGreaterThan(0);
      }
    }
  });

  it('検証可能在圏率 verifiedInScopeRate ≥ T5(§3=検証不能を緑に混ぜない)', () => {
    const parsedCases = cases.map(({ parsed }) => parsed);
    const inScope = parsedCases.filter((testCase) => !isPureScopeBoundary(testCase));
    const verifiedInScope = inScope.filter((testCase) => isVerified(testCase));
    expect(inScope.length).toBeGreaterThanOrEqual(MIN_TOTAL - MIN_PER_DECK);
    const rate = inScope.length === 0 ? 0 : verifiedInScope.length / inScope.length;
    expect(rate, `verifiedInScopeRate=${(rate * 100).toFixed(2)}%`).toBeGreaterThanOrEqual(T5);
    // runtime-gap 在圏ケースは verified 分子に入っていない(緑混入なし)ことを保証。
    for (const testCase of verifiedInScope) {
      expect(hasRuntimeGap(testCase)).toBe(false);
    }
  });
});

describe('golden replay cases pass (board transition)', () => {
  for (const { parsed } of cases) {
    it(parsed.name, () => {
      const result = replayGoldenCase(parsed);
      expect(result.pass, formatGoldenReplayDiffs(result.diffs)).toBe(true);
    });
  }
});
