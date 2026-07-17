import type { GameEvent, PlayerId } from '../../engine/types';

export interface DrawArrival {
  eventId: string;
  sequence: number;
  cardId: string;
  causeCommandType: string | null;
}

/**
 * Returns only draw events appended since the previous render. Initial mount,
 * undo/restore (shorter or divergent logs), empty-library attempts, opponent
 * draws, and ordinary move-to-hand zone changes intentionally produce no cue.
 */
export function appendedLocalDraws(
  previous: readonly GameEvent[] | null,
  current: readonly GameEvent[],
  localPlayerId: PlayerId,
): DrawArrival[] {
  if (previous === null || current.length <= previous.length) return [];
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index]?.eventId !== current[index]?.eventId) return [];
  }

  return current.slice(previous.length).flatMap((event) => {
    if (
      event.type !== 'draw'
      || event.playerId !== localPlayerId
      || event.result !== 'drawn'
      || !event.physicalCardId
    ) {
      return [];
    }
    return [{
      eventId: event.eventId,
      sequence: event.sequence,
      cardId: event.physicalCardId,
      causeCommandType: event.cause.type === 'command' ? event.cause.commandType : null,
    }];
  });
}

/** Keep even very large draw batches inside one short visual beat. */
export function drawStaggerMs(index: number): number {
  return Math.min(Math.max(0, index), 4) * 40;
}
