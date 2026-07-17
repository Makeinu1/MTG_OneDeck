import { describe, expect, it } from 'vitest';
import { celebrationLogSignals, chainReasonFor } from './celebrationTimelineModel';

describe('celebration timeline model', () => {
  const quiet = { triggerCount10s: 0, drawCountTurn: 0, tokenCountTurn: 0, resolveCount30s: 0, manaAddedPhase: 0 };

  it('fires at each documented chain boundary and not immediately below it', () => {
    expect(chainReasonFor({ ...quiet, triggerCount10s: 2 })).toBeNull();
    expect(chainReasonFor({ ...quiet, triggerCount10s: 3 })).toBe('triggers');
    expect(chainReasonFor({ ...quiet, drawCountTurn: 5 })).toBe('draws');
    expect(chainReasonFor({ ...quiet, tokenCountTurn: 3 })).toBe('tokens');
    expect(chainReasonFor({ ...quiet, resolveCount30s: 3 })).toBe('resolves');
    expect(chainReasonFor({ ...quiet, manaAddedPhase: 8 })).toBe('mana');
  });

  it('extracts only celebration-relevant log contributions', () => {
    const signals = celebrationLogSignals([
      { seq: 1, turn: 1, phase: 'main1', message: '《源》の誘発型能力をスタックに積んだ。' },
      { seq: 2, turn: 1, phase: 'main1', message: '《呪文》を解決した(→墓地)。' },
      { seq: 3, turn: 1, phase: 'main1', message: 'トークン《苗木》を3個生成しました。' },
      { seq: 4, turn: 1, phase: 'main1', message: 'Gマナを8点加えました。' },
    ]);
    expect(signals).toEqual({ triggers: 1, resolves: 1, tokens: 3, mana: 8 });
  });
});
