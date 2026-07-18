import { describe, expect, it } from 'vitest';
import type { DrawEvent, GameEvent, LifeChangeEvent } from '../../engine/types';
import { appendedLocalDraws, drawStaggerMs } from './drawAnimationModel';

function drawEvent(
  eventId: string,
  sequence: number,
  cardId: string | undefined,
  playerId = 'P1',
  commandType = 'draw',
): DrawEvent {
  return {
    type: 'draw',
    eventId,
    sequence,
    cause: { type: 'command', commandType },
    playerId,
    result: cardId ? 'drawn' : 'empty-library-attempt',
    ...(cardId ? { physicalCardId: cardId } : {}),
  };
}

function lifeEvent(eventId: string, sequence: number): LifeChangeEvent {
  return {
    type: 'lifeChange',
    eventId,
    sequence,
    cause: { type: 'command', commandType: 'adjustLife' },
    playerId: 'P1',
    delta: -1,
    previousLife: 40,
    nextLife: 39,
    direction: 'loss',
  };
}

describe('draw animation model', () => {
  it('does not replay draws from initial or restored state', () => {
    expect(appendedLocalDraws(null, [drawEvent('e1', 1, 'c1')], 'P1')).toEqual([]);
  });

  it('returns only newly appended successful local draws', () => {
    const previous: GameEvent[] = [lifeEvent('e1', 1)];
    const current: GameEvent[] = [
      ...previous,
      drawEvent('e2', 2, 'c2'),
      drawEvent('e3', 3, undefined),
      drawEvent('e4', 4, 'c4', 'P2'),
      lifeEvent('e5', 5),
    ];
    expect(appendedLocalDraws(previous, current, 'P1')).toEqual([{
      eventId: 'e2',
      sequence: 2,
      cardId: 'c2',
      causeCommandType: 'draw',
    }]);
  });

  it('does not animate undo or divergent history', () => {
    const previous: GameEvent[] = [drawEvent('e1', 1, 'c1'), drawEvent('e2', 2, 'c2')];
    expect(appendedLocalDraws(previous, previous.slice(0, 1), 'P1')).toEqual([]);
    expect(appendedLocalDraws(previous, [drawEvent('e1', 1, 'c1'), lifeEvent('other', 2), drawEvent('e3', 3, 'c3')], 'P1'))
      .toEqual([]);
  });

  it('keeps a multi-draw batch ordered and preserves the phase-draw cause', () => {
    const previous: GameEvent[] = [lifeEvent('e1', 1)];
    const current: GameEvent[] = [
      ...previous,
      drawEvent('e2', 2, 'c2', 'P1', 'nextPhase'),
      drawEvent('e3', 3, 'c3'),
    ];
    expect(appendedLocalDraws(previous, current, 'P1')).toEqual([
      { eventId: 'e2', sequence: 2, cardId: 'c2', causeCommandType: 'nextPhase' },
      { eventId: 'e3', sequence: 3, cardId: 'c3', causeCommandType: 'draw' },
    ]);
  });

  it('compresses long batches after the fifth visual offset', () => {
    expect([0, 1, 2, 4, 8].map(drawStaggerMs)).toEqual([0, 60, 120, 240, 240]);
  });
});
