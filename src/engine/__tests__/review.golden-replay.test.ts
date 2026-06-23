import { describe, expect, it } from 'vitest';

import {
  formatGoldenReplayDiffs,
  parseGoldenReplayCase,
  replayGoldenCase,
  type GoldenReplayCase,
} from '../goldenReplay';

const modules = import.meta.glob(
  '../../../research/golden-replay/cases/*.json',
  { eager: true, import: 'default' },
);

const cases: GoldenReplayCase[] = Object.entries(modules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, payload]) => parseGoldenReplayCase(payload, path));

describe('golden replay execution harness', () => {
  it('loads the real-deck-weighted case corpus', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
    expect(cases.length).toBeLessThanOrEqual(15);
    expect(new Set(cases.map((testCase) => testCase.sourceDeck))).toEqual(
      new Set(['Celes', 'Gogo', 'Kefka', 'Muldrotha']),
    );
  });

  for (const testCase of cases) {
    it(testCase.name, () => {
      const result = replayGoldenCase(testCase);
      expect(result.pass, formatGoldenReplayDiffs(result.diffs)).toBe(true);
    });
  }
});
