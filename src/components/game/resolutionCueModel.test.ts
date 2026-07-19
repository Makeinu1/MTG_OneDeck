import { describe, expect, it } from 'vitest';
import { initGame } from '../../engine/init';
import { makeDeck } from '../../engine/__tests__/helpers';
import { completedAutomaticTopResolution } from './resolutionCueModel';

function withStackTop(): { before: ReturnType<typeof initGame>; sourceId: string } {
  const before = initGame(makeDeck(10), 801);
  const sourceId = before.zones.library[0];
  return {
    before: {
      ...before,
      cards: {
        ...before.cards,
        [sourceId]: { ...before.cards[sourceId], zone: 'stack' },
      },
      zones: {
        ...before.zones,
        library: before.zones.library.slice(1),
        stack: [sourceId],
      },
      zonesByPlayer: {
        ...before.zonesByPlayer,
        [before.localPlayerId]: {
          ...before.zonesByPlayer[before.localPlayerId],
          library: before.zones.library.slice(1),
        },
      },
    },
    sourceId,
  };
}

describe('resolution success cue model', () => {
  it('accepts only a completed automatic top transition', () => {
    const { before, sourceId } = withStackTop();
    const after = {
      ...before,
      cards: {
        ...before.cards,
        [sourceId]: { ...before.cards[sourceId], zone: 'graveyard' as const },
      },
      zones: { ...before.zones, stack: [], graveyard: [sourceId] },
    };

    expect(completedAutomaticTopResolution(before, {
      state: after,
      resolutionSession: null,
    })).toBe(true);
  });

  it('rejects unsupported, runtime-failure, and partial manual handoffs', () => {
    const { before, sourceId } = withStackTop();
    const partial = {
      ...before,
      zones: { ...before.zones, graveyard: ['countered-target'] },
    };

    for (const reason of ['unsupported', 'runtime-failure', 'partial']) {
      expect(completedAutomaticTopResolution(before, {
        state: reason === 'partial' ? partial : before,
        resolutionSession: { sourceId, reason },
      })).toBe(false);
    }
  });
});
