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
  type TableTriggerTrace,
} from './cockpitTriggers';
import {
  applyTableOperation,
  manaColors,
  tableCastPayment,
  type CockpitTable,
  type TableOperation,
} from './cockpitTable';
import type { GameCommand } from './commands';
import type { EventProcessRef, ZoneId } from './types';

export interface PermanentEntrySetup {
  tapped?: boolean;
  counters?: Record<string, number>;
  controllerId?: string;
  attachmentTargetId?: string;
  protectorId?: string;
}

export type R4CastSourceZone = 'hand' | 'command' | 'graveyard' | 'exile' | 'library';

export interface R4CastAdditionalCosts {
  tapIds: string[];
  sacrificeIds: string[];
  discardIds: string[];
  returnIds: string[];
  exileIds: string[];
  life: number;
  counters: { cardId: string; name: string; count: number }[];
  note: string;
}

export const emptyR4CastAdditionalCosts = (): R4CastAdditionalCosts => ({
  tapIds: [],
  sacrificeIds: [],
  discardIds: [],
  returnIds: [],
  exileIds: [],
  life: 0,
  counters: [],
  note: '',
});

type R31CastOperation = Extract<R31TableOperation, { type: 'cast' }>;
type R4PassthroughOperation = Exclude<R31TableOperation, R31CastOperation>;

export type R4CastOperation = Omit<R31CastOperation, 'type'> & {
  type: 'cast';
  sourceZone: R4CastSourceZone;
  additionalCosts?: R4CastAdditionalCosts;
};

export type R4TableOperation =
  | R4PassthroughOperation
  | R4CastOperation
  | {
      type: 'playLand';
      cardId: string;
      entrySetup?: PermanentEntrySetup;
    }
  | {
      type: 'special.turnFaceUp';
      cardId: string;
      faceIndex: number;
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

function distinctOrEmpty(ids: string[], message: string): void {
  requireR4(
    Array.isArray(ids) && ids.length <= 100 && new Set(ids).size === ids.length,
    message,
  );
}

function actionProcess(
  id: string,
  actionType: 'cast' | 'other-formal',
  context: ExpectedInteractionContext,
  role: 'action' | 'cost' = 'action',
): EventProcessRef {
  return {
    kind: 'action',
    id,
    actionType,
    role,
    ...(context.kind === 'resolution' ? { parentResolutionId: context.entryId } : {}),
  };
}

function withActionRole<T>(
  trace: TableTriggerTrace,
  role: 'action' | 'cost',
  work: () => T,
): T {
  const previous = trace.process;
  if (previous?.kind === 'action') trace.process = { ...previous, role };
  try {
    return work();
  } finally {
    trace.process = previous;
  }
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

function validateCounterRemoval(
  table: CockpitTable,
  semanticActor: string,
  cost: R4CastAdditionalCosts['counters'][number],
  castCardId: string,
): void {
  const card = table.cards[cost.cardId];
  requireR4(card && cost.cardId !== castCardId, 'INVALID_ADDITIONAL_COST');
  requireR4(card.controllerId === semanticActor, 'INVALID_ADDITIONAL_COST');
  requireR4(
    typeof cost.name === 'string' &&
      cost.name.trim().length > 0 &&
      cost.name.length <= 100 &&
      !['__proto__', 'constructor', 'prototype'].includes(cost.name) &&
      Number.isSafeInteger(cost.count) &&
      cost.count > 0 &&
      cost.count <= (card.counters[cost.name] ?? 0),
    'INVALID_ADDITIONAL_COST',
  );
}

export function r4CastAdditionalCostPlan(
  table: CockpitTable,
  cardId: string,
  additionalCosts: R4CastAdditionalCosts | undefined,
): GameCommand[] {
  if (!additionalCosts) return [];
  const castCard = table.cards[cardId];
  requireR4(castCard, 'INVALID_ADDITIONAL_COST');
  const semanticActor = castCard.controllerId;
  requireR4(usableSeat(table, semanticActor), 'INVALID_ADDITIONAL_COST');
  requireR4(
    typeof additionalCosts.note === 'string' && additionalCosts.note.length <= 2000,
    'INVALID_ADDITIONAL_COST',
  );
  distinctOrEmpty(additionalCosts.tapIds, 'INVALID_ADDITIONAL_COST');
  distinctOrEmpty(additionalCosts.sacrificeIds, 'INVALID_ADDITIONAL_COST');
  distinctOrEmpty(additionalCosts.discardIds, 'INVALID_ADDITIONAL_COST');
  distinctOrEmpty(additionalCosts.returnIds, 'INVALID_ADDITIONAL_COST');
  distinctOrEmpty(additionalCosts.exileIds, 'INVALID_ADDITIONAL_COST');
  requireR4(
    Number.isSafeInteger(additionalCosts.life) &&
      additionalCosts.life >= 0 &&
      additionalCosts.life <= 100000,
    'INVALID_ADDITIONAL_COST',
  );
  requireR4(additionalCosts.counters.length <= 100, 'INVALID_ADDITIONAL_COST');

  const moveIds = [
    ...additionalCosts.sacrificeIds,
    ...additionalCosts.discardIds,
    ...additionalCosts.returnIds,
    ...additionalCosts.exileIds,
  ];
  requireR4(new Set(moveIds).size === moveIds.length, 'INVALID_ADDITIONAL_COST');
  requireR4(
    ![
      ...additionalCosts.tapIds,
      ...moveIds,
      ...additionalCosts.counters.map((cost) => cost.cardId),
    ].includes(cardId),
    'INVALID_ADDITIONAL_COST',
  );

  const commands: GameCommand[] = [];
  for (const id of additionalCosts.tapIds) {
    const card = table.cards[id];
    requireR4(
      card?.zone === 'battlefield' && card.controllerId === semanticActor && !card.tapped,
      'INVALID_ADDITIONAL_COST',
    );
    commands.push({ type: 'setTapped', cardId: id, tapped: true });
  }
  const moves = [
    {
      ids: additionalCosts.sacrificeIds,
      from: 'battlefield' as ZoneId,
      to: 'graveyard' as ZoneId,
      reason: 'sacrifice' as const,
    },
    {
      ids: additionalCosts.discardIds,
      from: 'hand' as ZoneId,
      to: 'graveyard' as ZoneId,
      reason: 'discard' as const,
    },
    {
      ids: additionalCosts.returnIds,
      from: 'battlefield' as ZoneId,
      to: 'hand' as ZoneId,
      reason: 'cost' as const,
    },
    {
      ids: additionalCosts.exileIds,
      from: null,
      to: 'exile' as ZoneId,
      reason: 'cost' as const,
    },
  ];
  for (const group of moves)
    for (const id of group.ids) {
      const card = table.cards[id];
      requireR4(
        card &&
          card.controllerId === semanticActor &&
          (!group.from || card.zone === group.from),
        'INVALID_ADDITIONAL_COST',
      );
      commands.push({
        type: 'moveCard',
        cardId: id,
        to: group.to,
        position: 'top',
        reason: group.reason,
      });
    }
  if (additionalCosts.life)
    commands.push({
      type: 'adjustLife',
      delta: -additionalCosts.life,
      playerId: semanticActor,
    });
  for (const counter of additionalCosts.counters) {
    validateCounterRemoval(table, semanticActor, counter, cardId);
    commands.push({
      type: 'addCounters',
      cardId: counter.cardId,
      counterType: counter.name,
      delta: -counter.count,
    });
  }
  return commands;
}

export function r4CastPayment(
  table: CockpitTable,
  operation: Pick<
    R4CastOperation,
    | 'cardId'
    | 'x'
    | 'excludedSourceIds'
    | 'manualManaCost'
    | 'costNote'
    | 'additionalCosts'
  >,
): { paymentPlan: GameCommand[]; additionalCostPlan: GameCommand[] } {
  const additionalCostPlan = r4CastAdditionalCostPlan(
    table,
    operation.cardId,
    operation.additionalCosts,
  );
  const tapCosts = operation.additionalCosts?.tapIds ?? [];
  const excludedSourceIds = [
    ...new Set([...(operation.excludedSourceIds ?? []), ...tapCosts]),
  ];
  return {
    paymentPlan: tableCastPayment(
      table,
      operation.cardId,
      operation.x,
      excludedSourceIds,
      operation.manualManaCost ?? null,
      operation.costNote ?? '',
    ),
    additionalCostPlan,
  };
}

function costMoveReason(command: Extract<GameCommand, { type: 'moveCard' }>) {
  return ['discard', 'mill', 'sacrifice', 'destroy'].includes(command.reason ?? '')
    ? (command.reason as 'discard' | 'mill' | 'sacrifice' | 'destroy')
    : undefined;
}

function applyCostCommand(
  table: CockpitTable,
  command: GameCommand,
  semanticActor: string,
  trace: TableTriggerTrace,
): CockpitTable {
  switch (command.type) {
    case 'setTapped': {
      const card = table.cards[command.cardId];
      requireR4(
        card?.zone === 'battlefield' && card.controllerId === semanticActor,
        'INVALID_CAST_PAYMENT',
      );
      return applyTableOperation(
        table,
        { type: 'tap', ids: [command.cardId], tapped: command.tapped },
        undefined,
        trace,
      );
    }
    case 'addMana':
      return applyTableOperation(
        table,
        {
          type: 'mana',
          seatId: command.playerId ?? semanticActor,
          color: command.color,
          delta: command.amount,
        },
        undefined,
        trace,
      );
    case 'payMana': {
      let next = table;
      const seatId = command.playerId ?? semanticActor;
      requireR4(seatId === semanticActor, 'INVALID_CAST_PAYMENT');
      for (const color of manaColors) {
        const amount = command.payment[color];
        if (!amount) continue;
        next = applyTableOperation(
          next,
          { type: 'mana', seatId, color, delta: -amount },
          undefined,
          trace,
        );
      }
      return next;
    }
    case 'adjustLife':
      requireR4((command.playerId ?? semanticActor) === semanticActor, 'INVALID_CAST_PAYMENT');
      return applyTableOperation(
        table,
        { type: 'life', seatIds: [semanticActor], delta: command.delta },
        undefined,
        trace,
      );
    case 'dealDamage':
      requireR4(command.targetPlayerId === semanticActor, 'INVALID_CAST_PAYMENT');
      return applyTableOperation(
        table,
        {
          type: 'damage',
          ids: [],
          seatIds: [semanticActor],
          sourceId: command.sourceId,
          delta: command.amount,
        },
        undefined,
        trace,
      );
    case 'moveCard': {
      const card = table.cards[command.cardId];
      requireR4(card?.controllerId === semanticActor, 'INVALID_CAST_PAYMENT');
      requireR4(
        command.position === 'top' ||
          command.position === 'bottom' ||
          command.position === undefined,
        'INVALID_CAST_PAYMENT',
      );
      return applyTableOperation(
        table,
        {
          type: 'move',
          ids: [command.cardId],
          to: command.to,
          position: command.position ?? 'top',
          ...(costMoveReason(command) ? { reason: costMoveReason(command) } : {}),
        },
        undefined,
        trace,
      );
    }
    case 'addCounters': {
      const card = table.cards[command.cardId];
      requireR4(card?.controllerId === semanticActor && command.delta <= 0, 'INVALID_CAST_PAYMENT');
      return applyTableOperation(
        table,
        {
          type: 'counter',
          ids: [command.cardId],
          seatIds: [],
          name: command.counterType,
          delta: command.delta,
        },
        undefined,
        trace,
      );
    }
    default:
      throw new Error('UNSUPPORTED_CAST_PAYMENT');
  }
}

function applyCostPlan(
  table: CockpitTable,
  commands: GameCommand[],
  semanticActor: string,
  trace: TableTriggerTrace,
): CockpitTable {
  return withActionRole(trace, 'cost', () => {
    let next = table;
    for (const command of commands) next = applyCostCommand(next, command, semanticActor, trace);
    return next;
  });
}

function snapshotTargets(table: CockpitTable, ids: string[]) {
  return Object.fromEntries(
    ids.flatMap((id) => {
      const card = table.cards[id] ?? table.stack.find((entry) => entry.id === id)?.source;
      return card ? [[id, structuredClone(card)]] : [];
    }),
  );
}

function validTarget(table: CockpitTable, id: string): boolean {
  return (
    typeof id === 'string' &&
    (Boolean(table.cards[id]) ||
      table.stack.some((entry) => entry.id === id) ||
      table.seats.some((seat) => seat.id === id && !seat.eliminated))
  );
}

function moveCastCardToStack(
  table: CockpitTable,
  cardId: string,
  x: number,
  trace: TableTriggerTrace,
): void {
  checkpointTableTriggers(table, trace, 'change');
  const card = table.cards[cardId];
  requireR4(card, 'INVALID_CAST_SOURCE');
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as (keyof typeof seat.zones)[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
  card.zoneChangeCounter += 1;
  card.counters = {};
  card.damageMarked = 0;
  card.hasDeathtouchDamage = false;
  card.tapped = false;
  card.faceDown = false;
  card.manualKeywords = [];
  delete card.attachedTo;
  delete card.protectorId;
  table.grants = table.grants.filter((grant) => grant.cardId !== cardId);
  table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== cardId);
  delete table.visibility[cardId];
  for (const other of Object.values(table.cards))
    if (other.attachedTo === cardId) delete other.attachedTo;
  card.controllerId = card.ownerId;
  card.enteredTurn = 0;
  card.zone = 'stack';
  card.announcedX = x;
  const owner = table.seats.find((seat) => seat.id === card.ownerId);
  requireR4(owner, 'INVALID_CAST_SOURCE');
  owner.zones.stack.unshift(cardId);
  checkpointTableTriggers(table, trace, 'cast', 'cast');
}

function castR4(
  before: CockpitTable,
  operation: R4CastOperation,
  context: ExpectedInteractionContext,
  commandId?: string,
): CockpitTable {
  requireExpectedInteractionContext(before, context);
  requireR4(!before.hold, 'HOLD中は唱えられません。');
  if (context.kind === 'unbound')
    requireR4(!blockingPublicTableTriggers(before).length, '未処理の誘発を確認してください。');
  const card = before.cards[operation.cardId];
  requireR4(card && card.zone === operation.sourceZone, 'INVALID_CAST_SOURCE');
  requireR4(usableSeat(before, card.controllerId), 'INVALID_CAST_SOURCE');
  const face = before.defs[card.defId]?.faces[card.faceIndex] ?? before.defs[card.defId]?.faces[0];
  requireR4(face && !/\bLand\b/.test(face.typeLine), 'INVALID_CAST_SOURCE');
  requireR4(
    Array.isArray(operation.targets) && operation.targets.every((id) => validTarget(before, id)),
    '対象を確認してください。',
  );

  const plans = r4CastPayment(before, operation);
  requireR4(
    JSON.stringify(operation.paymentPlan) === JSON.stringify(plans.paymentPlan),
    '支払い案が変わりました。確認し直してください。',
  );

  const source = { ...structuredClone(card), announcedX: operation.x };
  const processId = commandId ?? `cast:${card.id}:${card.zoneChangeCounter}`;
  const trace = triggerTrace(before, processId, actionProcess(processId, 'cast', context));
  let table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  table = applyCostPlan(table, plans.paymentPlan, source.controllerId, trace);
  table = applyCostPlan(table, plans.additionalCostPlan, source.controllerId, trace);
  requireR4(table.cards[card.id]?.zone === operation.sourceZone, 'INVALID_CAST_SOURCE');
  if (card.isCommander && operation.sourceZone === 'command')
    table.commanderCasts[card.id] = (table.commanderCasts[card.id] ?? 0) + 1;
  moveCastCardToStack(table, card.id, operation.x, trace);
  table.stack.unshift({
    id: `${card.id}:${table.cards[card.id].zoneChangeCounter}`,
    kind: 'spell',
    source,
    stackCardId: card.id,
    controllerId: source.controllerId,
    targets: [...operation.targets],
    targetSnapshots: snapshotTargets(before, operation.targets),
    paid: [...plans.paymentPlan, ...plans.additionalCostPlan],
    costNote: [
      operation.manualManaCost != null
        ? `手動指定した最終マナコスト ${operation.manualManaCost || '0'} / ${operation.costNote ?? ''}`
        : '印刷マナコスト・X・統率者税から計算',
      operation.additionalCosts?.note
        ? `追加コスト: ${operation.additionalCosts.note}`
        : plans.additionalCostPlan.length
          ? '追加コストを有限指定で支払い済み'
          : '',
    ]
      .filter(Boolean)
      .join(' / '),
    text: face.oracleText ?? '',
  });
  return table;
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

  const process = actionProcess(
    commandId ?? `playLand:${card.id}:${card.zoneChangeCounter}`,
    'other-formal',
    context,
  );
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

function turnFaceUp(
  before: CockpitTable,
  operation: Extract<R4TableOperation, { type: 'special.turnFaceUp' }>,
  context: ExpectedInteractionContext,
  commandId?: string,
): CockpitTable {
  requireR4(context.kind === 'unbound', 'STALE_INTERACTION_CONTEXT');
  requireExpectedInteractionContext(before, context);
  requireR4(!before.hold && !before.resolution, 'HOLDまたは処理中は実行できません。');
  requireR4(!blockingPublicTableTriggers(before).length, '未処理の誘発を確認してください。');
  const card = before.cards[operation.cardId];
  requireR4(
    card?.zone === 'battlefield' && card.faceDown && usableSeat(before, card.controllerId),
    'INVALID_SPECIAL_ACTION',
  );
  const faces = before.defs[card.defId]?.faces ?? [];
  requireR4(
    Number.isSafeInteger(operation.faceIndex) &&
      operation.faceIndex >= 0 &&
      operation.faceIndex < faces.length,
    'INVALID_SPECIAL_ACTION',
  );
  const processId = commandId ?? `special.turnFaceUp:${card.id}:${card.zoneChangeCounter}`;
  const trace = triggerTrace(
    before,
    processId,
    actionProcess(processId, 'other-formal', context),
  );
  const table = structuredClone(before);
  table.triggers ??= emptyTableTriggers(table.turn);
  checkpointTableTriggers(table, trace, 'change');
  table.cards[card.id].faceIndex = operation.faceIndex;
  table.cards[card.id].faceDown = false;
  checkpointTableTriggers(table, trace, 'special.turnFaceUp');
  return table;
}

function isLegacyCast(operation: R4TableOperation): operation is never {
  return operation.type === 'cast' && !('sourceZone' in operation);
}

export function applyR4TableOperation(
  table: CockpitTable,
  request: R4OperationRequest,
  commandId?: string,
): CockpitTable {
  const operation = request.operation;
  if (isLegacyCast(operation))
    return applyR31TableOperation(
      table,
      { operation: operation as unknown as R31TableOperation, context: request.context },
      commandId,
    );
  if (operation.type === 'cast') return castR4(table, operation, request.context, commandId);
  if (operation.type === 'playLand') return playLand(table, operation, request.context, commandId);
  if (operation.type === 'special.turnFaceUp')
    return turnFaceUp(table, operation, request.context, commandId);
  return applyR31TableOperation(
    table,
    { operation, context: request.context },
    commandId,
  );
}
