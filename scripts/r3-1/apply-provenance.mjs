import fs from 'node:fs';

function patch(path, changes) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [from, to] of changes) {
    if (!text.includes(from)) {
      if (text.includes(to)) continue;
      throw new Error(`missing patch anchor in ${path}: ${from.slice(0, 140)}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(path, text);
}

patch('src/engine/types.ts', [
  [
`export type ZoneChangeReason =
  | 'move'
  | 'cast'
  | 'resolve'
  | 'cost'
  | 'sba'
  | 'replacement'
  | 'token-cease'
  | 'copy-cease'
  | 'discard'
  | 'mill'
  | 'sacrifice'
  | 'destroy';`,
`export type ZoneChangeReason =
  | 'move'
  | 'cast'
  | 'resolve'
  | 'cost'
  | 'sba'
  | 'replacement'
  | 'token-cease'
  | 'copy-cease'
  | 'discard'
  | 'mill'
  | 'sacrifice'
  | 'destroy';

export type EventProcessRef =
  | { kind: 'resolution'; id: string; role: 'effect' | 'lifecycle' }
  | {
      kind: 'action';
      id: string;
      actionType: 'cast' | 'activate' | 'mana' | 'other-formal';
      role: 'action' | 'cost';
      parentResolutionId?: string;
    }
  | { kind: 'system'; id: string };

export interface ProcessOriginSnapshot {
  kind: EventProcessRef['kind'];
  id: string;
  controllerId?: string;
  displaySnapshot?: {
    sourceName?: string;
    text?: string;
  };
}`,
  ],
  [
`  causeCommandId?: string;
  reason: ZoneChangeReason;`,
`  causeCommandId?: string;
  process?: EventProcessRef;
  reason: ZoneChangeReason;`,
  ],
  [
`  causeCommandId?: string;
  causeEventId?: string;`,
`  causeCommandId?: string;
  process?: EventProcessRef;
  causeEventId?: string;`,
  ],
  [
`  battlefield: ObjectSnapshot[];
  simultaneousGroupId?: never;`,
`  battlefield: ObjectSnapshot[];
  process?: EventProcessRef;
  simultaneousGroupId?: never;`,
  ],
  [
`  causeCommandId?: string;
  target: EventTargetRef;`,
`  causeCommandId?: string;
  process?: EventProcessRef;
  target: EventTargetRef;`,
  ],
  [
`export interface ActivatedManaAbilityEvent {
  type: 'activatedManaAbility';
  eventId: string;
  sequence: number;`,
`export interface ActivatedManaAbilityEvent {
  type: 'activatedManaAbility';
  eventId: string;
  sequence: number;
  process?: EventProcessRef;`,
  ],
  [
`export interface ManaAddedEvent {
  type: 'manaAdded';
  eventId: string;
  sequence: number;`,
`export interface ManaAddedEvent {
  type: 'manaAdded';
  eventId: string;
  sequence: number;
  process?: EventProcessRef;`,
  ],
  [
`export interface DefeatAdvisoryEvent {
  type: 'defeatAdvisory';
  eventId: string;
  sequence: number;`,
`export interface DefeatAdvisoryEvent {
  type: 'defeatAdvisory';
  eventId: string;
  sequence: number;
  process?: EventProcessRef;`,
  ],
  [
`export interface VentureEvent {
  type: 'venture';
  eventId: string;
  sequence: number;`,
`export interface VentureEvent {
  type: 'venture';
  eventId: string;
  sequence: number;
  process?: EventProcessRef;`,
  ],
  [
`  condition?: TriggerCondition;
  resolutionText?: string;`,
`  condition?: TriggerCondition;
  originProcess?: ProcessOriginSnapshot;
  resolutionText?: string;`,
  ],
]);

patch('src/engine/cockpitR31.ts', [
  [
`import { applyTableOperation, type CockpitTable, type TableOperation } from './cockpitTable';
import type { ZoneChangeReason, ZoneId } from './types';`,
`import { applyTableOperation, type CockpitTable, type TableOperation } from './cockpitTable';
import { triggerTrace } from './cockpitTriggers';
import type { EventProcessRef, ZoneChangeReason, ZoneId } from './types';`,
  ],
  [
`export type EventProcessRef =
  | {
      kind: 'resolution';
      id: string;
      role: 'effect' | 'lifecycle';
    }
  | {
      kind: 'action';
      id: string;
      actionType: 'cast' | 'activate' | 'mana' | 'other-formal';
      role: 'action' | 'cost';
      parentResolutionId?: string;
    }
  | {
      kind: 'system';
      id: string;
    };

export type ProcessOriginSnapshot = {
  kind: EventProcessRef['kind'];
  id: string;
  controllerId?: string;
  displaySnapshot?: {
    sourceName?: string;
    text?: string;
  };
};

type LegacyResolutionOperation = Extract<TableOperation, { type: 'resolve.begin' | 'resolve.end' }>;
type NonResolutionOperation = Exclude<TableOperation, LegacyResolutionOperation>;

export type R31TableOperation =
  | NonResolutionOperation
  | { type: 'resolve.begin'; entryId: string }
  | { type: 'resolve.end'; entryId: string; to: ZoneId };`,
`type ReplacedOperation = Extract<
  TableOperation,
  { type: 'resolve.begin' | 'resolve.end' | 'move' }
>;
type UnchangedOperation = Exclude<TableOperation, ReplacedOperation>;

export type R31TableOperation =
  | UnchangedOperation
  | { type: 'resolve.begin'; entryId: string }
  | { type: 'resolve.end'; entryId: string; to: ZoneId }
  | {
      type: 'move';
      ids: string[];
      to: ZoneId;
      position: 'top' | 'bottom';
      reason?: ManualZoneMeaning;
    };`,
  ],
  [
`export function applyR31TableOperation(
  table: CockpitTable,
  request: R31OperationRequest,
  commandId?: string,
): CockpitTable {
  const { operation, context } = request;

  if (operation.type === 'resolve.begin') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    return applyTableOperation(table, { type: 'resolve.begin' }, commandId);
  }

  if (operation.type === 'resolve.end') {
    if (context.kind !== 'resolution' || context.entryId !== operation.entryId)
      throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    return applyTableOperation(table, { type: 'resolve.end', to: operation.to }, commandId);
  }

  if (operation.type === 'resolve.finish' || operation.type === 'resolve.fetch') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    return applyTableOperation(table, operation, commandId);
  }

  requireExpectedInteractionContext(table, context);
  return applyTableOperation(table, operation, commandId);
}`,
`function traceFor(
  table: CockpitTable,
  commandId: string | undefined,
  process: EventProcessRef,
) {
  return triggerTrace(
    table,
    commandId ?? `local-${(table.triggers?.sequence ?? 0) + 1}`,
    process,
  );
}

export function applyR31TableOperation(
  table: CockpitTable,
  request: R31OperationRequest,
  commandId?: string,
): CockpitTable {
  const { operation, context } = request;

  if (operation.type === 'resolve.begin') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    return applyTableOperation(table, { type: 'resolve.begin' }, commandId);
  }

  if (operation.type === 'resolve.end') {
    if (context.kind !== 'resolution' || context.entryId !== operation.entryId)
      throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    const process = resolutionProcess(operation.entryId, 'lifecycle');
    return applyTableOperation(
      table,
      { type: 'resolve.end', to: operation.to },
      commandId,
      traceFor(table, commandId, process),
    );
  }

  if (operation.type === 'resolve.finish' || operation.type === 'resolve.fetch') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    const process = resolutionProcess(operation.entryId, 'lifecycle');
    return applyTableOperation(
      table,
      operation,
      commandId,
      traceFor(table, commandId, process),
    );
  }

  requireExpectedInteractionContext(table, context);
  const process =
    context.kind === 'resolution' ? resolutionProcess(context.entryId, 'effect') : undefined;
  const trace = process ? traceFor(table, commandId, process) : undefined;

  if (operation.type === 'move' && operation.reason)
    validateManualZoneMeaning(table, operation.ids, operation.reason);

  return applyTableOperation(table, operation, commandId, trace);
}`,
  ],
]);

patch('src/engine/cockpitTable.ts', [
  [
`  | { type: 'move'; ids: string[]; to: ZoneId; position: 'top' | 'bottom' }`,
`  | {
      type: 'move';
      ids: string[];
      to: ZoneId;
      position: 'top' | 'bottom';
      reason?: 'move' | 'discard' | 'mill' | 'sacrifice' | 'destroy';
    }`,
  ],
  [
`    case 'move':
      requireTable(operation.to !== 'stack', 'Stackへは唱える・能力登録から進んでください。');
      move(table, operation.ids, operation.to, operation.position, trace);`,
`    case 'move':
      requireTable(operation.to !== 'stack', 'Stackへは唱える・能力登録から進んでください。');
      move(
        table,
        operation.ids,
        operation.to,
        operation.position,
        trace,
        operation.reason ?? 'move',
        operation.reason ?? 'move',
      );`,
  ],
]);

patch('src/engine/cockpitTriggers.ts', [
  [
`  type DamageEvent,
  type ObjectSnapshot,
  type OncePerTurnTriggerLedger,
  type PendingTrigger,
  type ZoneChangeReason,`,
`  type DamageEvent,
  type EventProcessRef,
  type ObjectSnapshot,
  type OncePerTurnTriggerLedger,
  type PendingTrigger,
  type ProcessOriginSnapshot,
  type ZoneChangeReason,`,
  ],
  [
`export interface TableTriggerTrace {
  id: string;
  last: CockpitTable;
  index: number;
  damage?: Pick<DamageEvent, 'source' | 'target' | 'amount' | 'combatDamage'>[];
}
export function triggerTrace(before: CockpitTable, id: string): TableTriggerTrace {
  return { id, last: structuredClone(before), index: 0 };
}`,
`export interface TableTriggerTrace {
  id: string;
  last: CockpitTable;
  index: number;
  process?: EventProcessRef;
  damage?: Pick<DamageEvent, 'source' | 'target' | 'amount' | 'combatDamage'>[];
}
export function triggerTrace(
  before: CockpitTable,
  id: string,
  process?: EventProcessRef,
): TableTriggerTrace {
  return { id, last: structuredClone(before), index: 0, process };
}
function processOriginSnapshot(
  before: CockpitTable,
  table: CockpitTable,
  process: EventProcessRef | undefined,
): ProcessOriginSnapshot | undefined {
  if (!process) return undefined;
  const base: ProcessOriginSnapshot = { kind: process.kind, id: process.id };
  if (process.kind !== 'resolution') return base;
  const entry =
    (before.resolution?.id === process.id ? before.resolution : undefined) ??
    before.stack.find((item) => item.id === process.id) ??
    (table.resolution?.id === process.id ? table.resolution : undefined) ??
    table.stack.find((item) => item.id === process.id);
  if (!entry) return base;
  base.controllerId = entry.controllerId;
  const sourcePublic =
    !entry.source.faceDown && !['hand', 'library'].includes(entry.source.zone);
  if (sourcePublic) {
    const def = table.defs[entry.source.defId] ?? before.defs[entry.source.defId];
    base.displaySnapshot = {
      sourceName: def?.printedName ?? def?.name,
      text: entry.text,
    };
  }
  return base;
}`,
  ],
  [
`    simultaneousGroupId: group,
    causeCommandId: trace.id,
  });`,
`    simultaneousGroupId: group,
    causeCommandId: trace.id,
    ...(trace.process ? { process: trace.process } : {}),
  });`,
  ],
  [
`      battlefield: Object.values(table.cards)
        .filter((c) => c.zone === 'battlefield')
        .map((c) => tableObjectSnapshot(table, c)),
    });`,
`      battlefield: Object.values(table.cards)
        .filter((c) => c.zone === 'battlefield')
        .map((c) => tableObjectSnapshot(table, c)),
      ...(trace.process ? { process: trace.process } : {}),
    });`,
  ],
  [
`      status: 'pending',
      requiresManualRuling: review,
    });`,
`      status: 'pending',
      requiresManualRuling: review,
      originProcess: processOriginSnapshot(before, table, trace.process),
    });`,
  ],
]);

patch('src/online/cloudflare/cockpitSession.ts', [
  [
`          } else {
            if (
              record.multiplayer &&`,
`          } else {
            if (
              !body.context &&
              body.operation.type === 'move' &&
              body.operation.reason !== undefined
            )
              return response({ error: 'INVALID_REQUEST' }, 400);
            if (
              record.multiplayer &&`,
  ],
]);

patch('src/components/game/CockpitSelectionTools.tsx', [
  [
`    await send({ type: 'move', ids, to: 'graveyard', position: 'top' });`,
`    await send({ type: 'move', ids, to: 'graveyard', position: 'top', reason: 'mill' });`,
  ],
]);

patch('src/engine/__tests__/cockpitR31.test.ts', [
  [
`  it('keeps manual zone meaning finite and structurally compatible with the source zone', () => {
    const table = createCockpitTable(makeDeck(30), 1);
    const handId = table.seats[0].zones.hand[0];

    expect(validateManualZoneMeaning(table, [handId], 'discard')).toBe('discard');
    expect(() => validateManualZoneMeaning(table, [handId], 'sacrifice')).toThrow(
      'INVALID_ZONE_MEANING',
    );
    expect(validateManualZoneMeaning(table, [handId], 'move')).toBe('move');
  });`,
`  it('keeps manual zone meaning finite and structurally compatible with the source zone', () => {
    const table = createCockpitTable(makeDeck(30), 1);
    const handId = table.seats[0].zones.hand[0];

    expect(validateManualZoneMeaning(table, [handId], 'discard')).toBe('discard');
    expect(() => validateManualZoneMeaning(table, [handId], 'sacrifice')).toThrow(
      'INVALID_ZONE_MEANING',
    );
    expect(validateManualZoneMeaning(table, [handId], 'move')).toBe('move');
  });

  it('persists resolution process provenance on events and explicit zone meaning', () => {
    const table = withStackEntry('A');
    const resolving = applyR31TableOperation(
      table,
      {
        context: { kind: 'unbound' },
        operation: { type: 'resolve.begin', entryId: 'A' },
      },
      'begin-A',
    );
    const handId = resolving.seats[0].zones.hand[1];
    const next = applyR31TableOperation(
      resolving,
      {
        context: { kind: 'resolution', entryId: 'A' },
        operation: {
          type: 'move',
          ids: [handId],
          to: 'graveyard',
          position: 'top',
          reason: 'discard',
        },
      },
      'discard-A',
    );
    const event = next.triggers?.events.find(
      (item) => item.type === 'zoneChange' && item.physicalCardId === handId,
    );
    expect(event).toMatchObject({
      type: 'zoneChange',
      reason: 'discard',
      process: { kind: 'resolution', id: 'A', role: 'effect' },
    });
  });

  it('snapshots the originating resolution on pending trigger candidates', () => {
    const table = withStackEntry('A');
    const enteringId = table.seats[0].zones.hand[1];
    const enteringDef = table.defs[table.cards[enteringId].defId];
    enteringDef.faces[0].oracleText = `When ${enteringDef.name} enters the battlefield, draw a card.`;
    const resolving = applyR31TableOperation(table, {
      context: { kind: 'unbound' },
      operation: { type: 'resolve.begin', entryId: 'A' },
    });
    const next = applyR31TableOperation(resolving, {
      context: { kind: 'resolution', entryId: 'A' },
      operation: { type: 'move', ids: [enteringId], to: 'battlefield', position: 'top' },
    });
    const candidate = next.triggers?.candidates.find((item) => item.status === 'pending');
    expect(candidate?.originProcess).toMatchObject({
      kind: 'resolution',
      id: 'A',
    });
  });`,
  ],
]);

console.log('R3.1 provenance patch applied');
