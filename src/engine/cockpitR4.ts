import {
  applyR31TableOperation,
  requireExpectedInteractionContext,
  type ExpectedInteractionContext,
  type R31TableOperation,
} from './cockpitR31';
import {
  blockingPublicTableTriggers,
  checkpointTableTriggers,
  emptyTableTriggers,
  triggerTrace,
} from './cockpitTriggers';
import type { CockpitTable } from './cockpitTable';

export interface PermanentEntrySetup {
  tapped?: boolean;
  counters?: Record<string, number>;
  controllerId?: string;
  attachmentTargetId?: string;
  protectorId?: string;
}

export type R4TableOperation =
  | R31TableOperation
  | {
      type: 'playLand';
      cardId: string;
      entrySetup?: PermanentEntrySetup;
    };

export interface R4OperationRequest {
  operation: R4TableOperation;
  context: ExpectedInteractionContext;
}

function requireR4(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function usableSeat(table: CockpitTable, seatId: string): boolean {
  return Boolean(table.seats.find((seat) => seat.id === seatId && !seat.eliminated));
}

export function validatePermanentEntrySetup(
  table: CockpitTable,
  cardId: string,
  setup: PermanentEntrySetup | undefined,
): void {
  if (!setup) return;
  requireR4(typeof setup === 'object' && !Array.isArray(setup), 'INVALID_ENTRY_SETUP');

  if (setup.tapped !== undefined)
    requireR4(typeof setup.tapped === 'boolean', 'INVALID_ENTRY_SETUP');

  if (setup.counters !== undefined) {
    requireR4(
      setup.counters !== null &&
        typeof setup.counters === 'object' &&
        !Array.isArray(setup.counters),
      'INVALID_ENTRY_SETUP',
    );
    const counters = Object.entries(setup.counters);
    requireR4(counters.length <= 100, 'INVALID_ENTRY_SETUP');
    for (const [name, count] of counters) {
      requireR4(
        name.trim().length > 0 &&
          name.length <= 100 &&
          Number.isSafeInteger(count) &&
          count >= 0 &&
          count <= 100000,
        'INVALID_ENTRY_SETUP',
      );
    }
  }

  if (setup.controllerId !== undefined)
    requireR4(usableSeat(table, setup.controllerId), 'INVALID_ENTRY_SETUP');

  if (setup.attachmentTargetId !== undefined) {
    const target = table.cards[setup.attachmentTargetId];
    requireR4(
      setup.attachmentTargetId !== cardId && target?.zone === 'battlefield',
      'INVALID_ENTRY_SETUP',
    );
  }

  if (setup.protectorId !== undefined)
    requireR4(usableSeat(table, setup.protectorId), 'INVALID_ENTRY_SETUP');
}

function playLand(
  before: CockpitTable,
  operation: Extract<R4TableOperation, { type: 'playLand' }>,
  context: ExpectedInteractionContext,
  commandId?: string,
): CockpitTable {
  requireR4(context.kind === 'unbound', 'STALE_INTERACTION_CONTEXT');
  requireExpectedInteractionContext(before, context);
  requireR4(!before.hold, 'HOLD中は土地をプレイできません。');
  requireR4(!before.resolution, '効果の処理を終えてから土地をプレイしてください。');
  requireR4(before.stack.length === 0, 'Stackが空のときに土地をプレイしてください。');
  requireR4(
    !blockingPublicTableTriggers(before).length,
    '未処理の誘発を確認してください。',
  );
  requireR4(
    before.phase === 'main1' || before.phase === 'main2',
    '自分のメイン・フェイズに土地をプレイしてください。',
  );

  const card = before.cards[operation.cardId];
  requireR4(card?.zone === 'hand', '手札の土地を選んでください。');
  requireR4(
    card.ownerId === before.activeSeatId && card.controllerId === before.activeSeatId,
    'アクティブ・プレイヤーの土地を選んでください。',
  );
  const face = before.defs[card.defId]?.faces[card.faceIndex] ?? before.defs[card.defId]?.faces[0];
  requireR4(/\bLand\b/.test(face?.typeLine ?? ''), '土地カードを選んでください。');
  validatePermanentEntrySetup(before, card.id, operation.entrySetup);

  const process = {
    kind: 'action' as const,
    id: commandId ?? `playLand:${card.id}:${card.zoneChangeCounter}`,
    actionType: 'other-formal' as const,
    role: 'action' as const,
  };
  const trace = triggerTrace(before, process.id, process);
  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  checkpointTableTriggers(table, trace, 'change');

  const next = table.cards[operation.cardId];
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as (keyof typeof seat.zones)[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== next.id);

  next.zoneChangeCounter += 1;
  next.counters = {};
  next.damageMarked = 0;
  next.hasDeathtouchDamage = false;
  next.tapped = false;
  next.faceDown = false;
  next.manualKeywords = [];
  delete next.attachedTo;
  delete next.protectorId;
  table.grants = table.grants.filter((grant) => grant.cardId !== next.id);
  table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== next.id);
  delete table.visibility[next.id];
  for (const other of Object.values(table.cards))
    if (other.attachedTo === next.id) delete other.attachedTo;
  next.controllerId = next.ownerId;
  next.enteredTurn = table.turn;
  next.zone = 'battlefield';
  table.seats.find((seat) => seat.id === next.ownerId)!.zones.battlefield.unshift(next.id);

  const setup = operation.entrySetup;
  if (setup?.controllerId !== undefined) next.controllerId = setup.controllerId;
  if (setup?.tapped !== undefined) next.tapped = setup.tapped;
  if (setup?.counters !== undefined)
    next.counters = Object.fromEntries(
      Object.entries(setup.counters).filter(([, count]) => count > 0),
    );
  if (setup?.attachmentTargetId !== undefined) next.attachedTo = setup.attachmentTargetId;
  if (setup?.protectorId !== undefined) next.protectorId = setup.protectorId;

  checkpointTableTriggers(table, trace, 'playLand', 'move');
  return table;
}

export function applyR4TableOperation(
  table: CockpitTable,
  request: R4OperationRequest,
  commandId?: string,
): CockpitTable {
  if (request.operation.type !== 'playLand')
    return applyR31TableOperation(
      table,
      { operation: request.operation, context: request.context },
      commandId,
    );
  return playLand(table, request.operation, request.context, commandId);
}
