import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { presentationRuntime } from './presentation/presentationRuntime';
/** Only a successful forward server commit emits transient feedback. */
export function publishCockpitOperation(
  operation: TableOperation | { type: 'undo' | 'redo' },
  before: CockpitTable,
  after: CockpitTable,
): void {
  const status = 'committed' as const;
  switch (operation.type) {
    case 'cast': {
      const card = before.cards[operation.cardId];
      presentationRuntime.publish({
        action: 'cast',
        status,
        cardId: card.id,
        sourceZone: card.zone,
        destinationZone: 'stack',
        isCommander: card.isCommander,
        sourceEventId: crypto.randomUUID(),
      });
      break;
    }
    case 'draw':
      presentationRuntime.publish({
        action: 'draw',
        status,
        requestedCount: operation.count,
        completedCount: Math.max(
          0,
          (after.seats.find((seat) => seat.id === operation.seatId)?.zones.hand.length ?? 0) -
            (before.seats.find((seat) => seat.id === operation.seatId)?.zones.hand.length ?? 0),
        ),
      });
      break;
    case 'generate':
    case 'generateBatch':
    case 'activate': {
      const tappedIds = Object.values(after.cards)
        .filter((card) => card.tapped && before.cards[card.id] && !before.cards[card.id].tapped)
        .map((card) => card.id);
      if (tappedIds.length)
        presentationRuntime.publish({
          action: 'change-tap',
          status,
          cardIds: tappedIds,
          tapped: true,
        });
      break;
    }
    case 'tap':
      presentationRuntime.publish({
        action: 'change-tap',
        status,
        cardIds: operation.ids,
        tapped: operation.tapped,
      });
      break;
    case 'keep':
      presentationRuntime.publish({ action: 'keep-hand', status });
      break;
    case 'shuffle':
      presentationRuntime.publish({ action: 'shuffle-library', status });
      break;
    case 'resolve.end':
      presentationRuntime.publish({ action: 'resolve-stack', status, resolvedCount: 1 });
      break;
    case 'turn':
      presentationRuntime.publish({
        action: 'advance-turn',
        status,
        previousTurn: before.turn,
        nextTurn: after.turn,
      });
      break;
    case 'phase':
      presentationRuntime.publish({
        action: 'advance-phase',
        status,
        previousPhase: before.phase,
        nextPhase: after.phase,
        turnChanged: false,
      });
      break;
    case 'move':
      if (operation.to === 'battlefield')
        for (const id of operation.ids) {
          const card = before.cards[id];
          if (
            card.zone === 'hand' &&
            /Land/.test(before.defs[card.defId].faces[card.faceIndex].typeLine)
          )
            presentationRuntime.publish({
              action: 'play-land',
              status,
              cardId: id,
              sourceZone: 'hand',
              destinationZone: 'battlefield',
            });
        }
      break;
  }
}
