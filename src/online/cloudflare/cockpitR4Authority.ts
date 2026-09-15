import type { CockpitTable } from '../../engine/cockpitTable';
import type {
  R4CastOperation,
  R4TableOperation,
} from '../../engine/cockpitR4';
import {
  cockpitOwnerPresent,
  type CockpitMultiplayer,
} from './cockpitMultiplayer';

export type R4FormalOperation =
  | Extract<R4TableOperation, { type: 'playLand' }>
  | Extract<R4TableOperation, { type: 'special.turnFaceUp' }>
  | R4CastOperation;

export function isR4FormalOperation(operation: R4TableOperation): operation is R4FormalOperation {
  return (
    operation.type === 'playLand' ||
    operation.type === 'special.turnFaceUp' ||
    (operation.type === 'cast' && 'sourceZone' in operation)
  );
}

export function r4OperationRequiresContext(operation: R4TableOperation): boolean {
  return isR4FormalOperation(operation);
}

function actorCanReadCard(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  cardId: string,
): boolean {
  const card = table.cards[cardId];
  if (!card) return false;
  if (table.visibility[cardId]?.includes(actor)) return true;
  if (!['hand', 'library'].includes(card.zone)) return true;
  if (card.zone === 'hand' && card.ownerId === actor) return true;
  const peek = multi.members[actor]?.peek;
  if (!peek || peek.seatId !== card.ownerId || peek.zone !== card.zone) return false;
  if (card.zone !== 'library' || peek.count === undefined) return true;
  const library = table.seats.find((seat) => seat.id === card.ownerId)?.zones.library ?? [];
  const index = library.indexOf(cardId);
  return index >= 0 && index < peek.count;
}

function actorCanReadFace(table: CockpitTable, actor: string, cardId: string): boolean {
  const card = table.cards[cardId];
  if (!card) return false;
  if (!card.faceDown) return true;
  return card.controllerId === actor || Boolean(table.visibility[cardId]?.includes(actor));
}

function additionalPrivateIds(operation: R4CastOperation): string[] {
  const costs = operation.additionalCosts;
  if (!costs) return [];
  return [
    ...costs.tapIds,
    ...costs.sacrificeIds,
    ...costs.discardIds,
    ...costs.returnIds,
    ...costs.exileIds,
    ...costs.counters.map((cost) => cost.cardId),
  ];
}

function commonAuthority(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  now: number,
): boolean {
  return Boolean(
    cockpitOwnerPresent(multi, now) &&
      multi.started &&
      actor === multi.masterId &&
      !multi.holds.length &&
      !table.ended &&
      !table.seats.find((seat) => seat.id === actor)?.eliminated,
  );
}

export function authorizeR4FormalOperation(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  operation: R4TableOperation,
  now: number,
): boolean | undefined {
  if (!isR4FormalOperation(operation)) return undefined;
  if (!commonAuthority(table, multi, actor, now)) return false;

  if (operation.type === 'playLand') {
    const card = table.cards[operation.cardId];
    return Boolean(
      card?.zone === 'hand' &&
        actor === table.activeSeatId &&
        card.ownerId === actor &&
        card.controllerId === actor &&
        actorCanReadCard(table, multi, actor, operation.cardId),
    );
  }

  if (operation.type === 'special.turnFaceUp') {
    const card = table.cards[operation.cardId];
    return Boolean(
      card?.zone === 'battlefield' &&
        card.faceDown &&
        table.seats.some((seat) => seat.id === card.controllerId && !seat.eliminated) &&
        actorCanReadFace(table, actor, operation.cardId),
    );
  }

  const card = table.cards[operation.cardId];
  if (
    !card ||
    card.zone !== operation.sourceZone ||
    !table.seats.some((seat) => seat.id === card.controllerId && !seat.eliminated) ||
    !actorCanReadCard(table, multi, actor, operation.cardId) ||
    !actorCanReadFace(table, actor, operation.cardId)
  )
    return false;
  return additionalPrivateIds(operation).every(
    (id) => actorCanReadCard(table, multi, actor, id) && actorCanReadFace(table, actor, id),
  );
}

function isPrivateSource(table: CockpitTable, cardId: string): boolean {
  return ['hand', 'library'].includes(table.cards[cardId]?.zone ?? '');
}

export function r4OperationCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: R4FormalOperation,
): boolean {
  if (operation.type === 'playLand') return isPrivateSource(table, operation.cardId);
  if (operation.type === 'special.turnFaceUp') return Boolean(table.cards[operation.cardId]?.faceDown);
  if (isPrivateSource(table, operation.cardId) || table.cards[operation.cardId]?.faceDown) return true;
  if (operation.additionalCosts) {
    const ids = [
      ...operation.additionalCosts.discardIds,
      ...operation.additionalCosts.exileIds,
      ...operation.additionalCosts.returnIds,
      ...operation.additionalCosts.sacrificeIds,
      ...operation.additionalCosts.tapIds,
      ...operation.additionalCosts.counters.map((cost) => cost.cardId),
    ];
    if (ids.some((id) => isPrivateSource(table, id) || table.cards[id]?.faceDown)) return true;
  }
  return operation.paymentPlan.some(
    (command) =>
      command.type === 'discard' ||
      (command.type === 'moveCard' &&
        (isPrivateSource(table, command.cardId) || table.cards[command.cardId]?.faceDown)),
  );
}
