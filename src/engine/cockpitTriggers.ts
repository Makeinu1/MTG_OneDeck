import type { CockpitTable } from './cockpitTable';
import { initGame } from './init';
import { collectPendingTriggerUpdate } from './triggers';
import { splitAbilityLines } from './grammar';
import {
  objectIdOf,
  type CardInstance,
  type GameEvent,
  type GameState,
  type LogEntry,
  type DamageEvent,
  type EventProcessRef,
  type ObjectSnapshot,
  type OncePerTurnTriggerLedger,
  type PendingTrigger,
  type ProcessOriginSnapshot,
  type ZoneChangeReason,
} from './types';

export interface TableTrigger extends PendingTrigger {
  source: CardInstance;
  text: string;
  status: 'pending' | 'placed' | 'linked' | 'dismissed' | 'resolved' | 'removed';
  requiresManualRuling: boolean;
  entryId?: string;
  reason?: string;
  operatorId?: string;
}
export interface TableTriggerState {
  sequence: number;
  events: GameEvent[];
  feed: LogEntry[];
  candidates: TableTrigger[];
  ledger: OncePerTurnTriggerLedger;
  drawn: Record<string, number>;
  turn: number;
}
export function emptyTableTriggers(turn: number): TableTriggerState {
  return {
    sequence: 0,
    events: [],
    feed: [],
    candidates: [],
    ledger: { turn, consumedKeys: [] },
    drawn: {},
    turn,
  };
}
export function tableObjectSnapshot(table: CockpitTable, card: CardInstance): ObjectSnapshot {
  const face = table.defs[card.defId]?.faces[card.faceIndex];
  return {
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    defId: card.defId,
    zone: card.zone,
    ownerId: card.ownerId,
    controllerId: card.controllerId,
    isToken: card.isToken,
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: face?.typeLine ?? '',
    power: face?.power,
    toughness: face?.toughness,
  };
}
export function tableObjectReference(table: CockpitTable, card: CardInstance) {
  return {
    kind: 'object' as const,
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    snapshot: tableObjectSnapshot(table, card),
  };
}
/** Canonical all-seat input to the existing detector; never a UI projection or command engine. */
function triggerState(table: CockpitTable, events: GameEvent[]): GameState {
  const base = initGame([], 0);
  const own = table.seats.find((s) => s.id === table.activeSeatId)!;
  const records = table.triggers ?? emptyTableTriggers(table.turn);
  return {
    ...base,
    defs: table.defs,
    cards: Object.fromEntries(Object.entries(table.cards).filter(([, c]) => !c.faceDown)),
    zones: {
      ...own.zones,
      battlefield: Object.values(table.cards)
        .filter((c) => c.zone === 'battlefield' && !c.faceDown)
        .map((c) => c.id),
    },
    zonesByPlayer: Object.fromEntries(
      table.seats.map((s) => [
        s.id,
        { library: s.zones.library, hand: s.zones.hand, graveyard: s.zones.graveyard },
      ]),
    ),
    players: Object.fromEntries(
      table.seats.map((s) => [
        s.id,
        {
          ...base.players.P1!,
          id: s.id,
          label: s.label,
          life: s.life,
          manaPool: s.mana,
          drawnThisTurn: records.drawn[s.id] ?? 0,
        },
      ]),
    ),
    turnOrder: table.seats
      .filter((s) => !s.eliminated && s.controller !== 'passive')
      .map((s) => s.id),
    activePlayerId: own.id,
    localPlayerId: own.id,
    turn: table.turn,
    phase: table.phase,
    life: own.life,
    manaPool: own.mana,
    drawnThisTurn: records.drawn[own.id] ?? 0,
    eventLog: events,
    pendingTriggers: records.candidates.filter((c) => c.status === 'pending'),
    oncePerTurnTriggerLedger: records.ledger,
    log: [],
    effectsAuto: false,
  };
}
export interface TableTriggerTrace {
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
}
/** Called at semantic operation boundaries, including each cost and zone batch. */
export function checkpointTableTriggers(
  table: CockpitTable,
  trace: TableTriggerTrace | undefined,
  meaning: string,
  reason: ZoneChangeReason = 'move',
): void {
  if (!trace) return;
  const before = trace.last;
  table.triggers ??= emptyTableTriggers(table.turn);
  const records = table.triggers;
  if (records.turn !== table.turn) {
    records.turn = table.turn;
    records.drawn = {};
    records.ledger = { turn: table.turn, consumedKeys: [] };
  }
  const events: GameEvent[] = [];
  const group = `${trace.id}:${trace.index++}`;
  const envelope = () => ({
    eventId: `${group}:${events.length}`,
    sequence: ++records.sequence,
    simultaneousGroupId: group,
    causeCommandId: trace.id,
    ...(trace.process ? { process: trace.process } : {}),
  });
  for (const card of Object.values(table.cards)) {
    const previous = before.cards[card.id] ?? (card.zone === 'battlefield' ? card : undefined);
    if (!previous || (before.cards[card.id] && previous.zone === card.zone)) continue;
    const event: GameEvent = {
      ...envelope(),
      type: 'zoneChange',
      reason,
      physicalCardId: card.id,
      oldObjectId: objectIdOf(previous),
      newObjectId: objectIdOf(card),
      fromZone: previous.zone,
      toZone: card.zone,
      before: tableObjectSnapshot(before, previous),
      after: tableObjectSnapshot(table, card),
    };
    events.push(event);
    if (meaning === 'draw' && previous.zone === 'library' && card.zone === 'hand') {
      const ordinal = (records.drawn[card.ownerId] = (records.drawn[card.ownerId] ?? 0) + 1);
      events.push({
        ...envelope(),
        type: 'draw',
        cause: { type: 'command', commandType: meaning },
        playerId: card.ownerId,
        result: 'drawn',
        drawOrdinal: ordinal,
        physicalCardId: card.id,
        before: event.before,
        after: event.after,
        zoneChangeEventId: event.eventId,
      });
    }
  }
  for (const seat of table.seats) {
    const old = before.seats.find((s) => s.id === seat.id);
    if (old && old.life !== seat.life)
      events.push({
        ...envelope(),
        type: 'lifeChange',
        cause: { type: 'command', commandType: meaning },
        playerId: seat.id,
        delta: seat.life - old.life,
        previousLife: old.life,
        nextLife: seat.life,
        direction: seat.life > old.life ? 'gain' : 'loss',
      });
  }
  for (const card of Object.values(table.cards)) {
    const old = before.cards[card.id];
    if (!old || objectIdOf(old) !== objectIdOf(card)) continue;
    for (const name of new Set([...Object.keys(old.counters), ...Object.keys(card.counters)])) {
      const delta = (card.counters[name] ?? 0) - (old.counters[name] ?? 0);
      if (delta)
        events.push({
          ...envelope(),
          type: 'counterChange',
          target: tableObjectReference(table, card),
          counterType: name,
          delta,
          before: old.counters[name] ?? 0,
          after: card.counters[name] ?? 0,
        });
    }
  }
  if (meaning === 'battle.attack' && table.combat)
    events.push({
      type: 'attackDeclaration',
      eventId: `${group}:${events.length}`,
      sequence: ++records.sequence,
      turn: table.turn,
      combatId: `${trace.id}:combat`,
      attackingPlayerId: table.activeSeatId,
      attackers: table.combat.attackers.map((a) =>
        tableObjectSnapshot(table, table.cards[a.cardId]),
      ),
      battlefield: Object.values(table.cards)
        .filter((c) => c.zone === 'battlefield')
        .map((c) => tableObjectSnapshot(table, c)),
      ...(trace.process ? { process: trace.process } : {}),
    });
  if (meaning === 'battle.apply' && table.combat && !before.combat?.damageApplied) {
    for (const assignment of table.combat.assignments) {
      if (!assignment.amount) continue;
      const source = before.cards[assignment.sourceId];
      const target = before.cards[assignment.targetId];
      events.push({
        ...envelope(),
        type: 'damage',
        cause: { type: 'command', commandType: meaning },
        source: tableObjectReference(before, source),
        target: target
          ? tableObjectReference(before, target)
          : { kind: 'player', playerId: assignment.targetId },
        amount: assignment.amount,
        combatDamage: true,
      });
    }
  }
  for (const damage of trace.damage ?? [])
    if (damage.amount > 0)
      events.push({
        ...envelope(),
        ...damage,
        type: 'damage',
        cause: { type: 'command', commandType: meaning },
      });
  trace.damage = [];
  const previousState = triggerState(before, []);
  const nextState = triggerState(table, events);
  // CR 603.10: simultaneous departures also see the other departing watchers.
  if (
    events.some(
      (e) => e.type === 'zoneChange' && e.fromZone === 'battlefield' && e.toZone !== 'battlefield',
    )
  ) {
    for (const id of previousState.zones.battlefield) {
      if (nextState.zones.battlefield.includes(id)) continue;
      nextState.cards[id] = previousState.cards[id];
      nextState.zones.battlefield.push(id);
    }
  }
  const update = collectPendingTriggerUpdate(previousState, nextState);
  records.ledger = update.state.oncePerTurnTriggerLedger;
  for (const pending of update.pendingTriggers) {
    const source =
      before.cards[pending.sourceId] &&
      objectIdOf(before.cards[pending.sourceId]) === pending.sourceObjectId
        ? before.cards[pending.sourceId]
        : table.cards[pending.sourceId];
    if (!source || source.faceDown) continue;
    const line = splitAbilityLines(table.defs[pending.sourceSnapshot.defId])[
      pending.abilityLineIndex ?? -1
    ];
    const text = line?.text ?? pending.label;
    if (['trigger.upkeep', 'trigger.end-step', 'trigger.draw-step'].includes(pending.triggerId)) {
      const condition = text.split(',')[0];
      if (/\byour\b/i.test(condition) && pending.controllerId !== table.activeSeatId) continue;
      if (/\bopponent(?:'s|s')?\b/i.test(condition) && pending.controllerId === table.activeSeatId)
        continue;
    }
    const id = /\bone or more\b/i.test(text)
      ? `${group}:${pending.sourceObjectId}:${pending.abilityLineIndex}`
      : `${group}:${pending.pendingTriggerId}`;
    if (records.candidates.some((c) => c.pendingTriggerId === id)) continue;
    // Unsupported qualifiers are review candidates, never evidence of automatic adjudication.
    const review = /\bif\b|\bnext\b|\bone or more\b/i.test(text) || !line;
    records.candidates.push({
      ...pending,
      pendingTriggerId: id,
      source: structuredClone(source),
      text,
      status: 'pending',
      requiresManualRuling: review,
      originProcess: processOriginSnapshot(before, table, trace.process),
    });
  }
  const zoneLabel = {
    library: '山札',
    hand: '手札',
    battlefield: '戦場',
    graveyard: '墓地',
    exile: '追放',
    command: '統率領域',
    stack: 'スタック',
  };
  const messages = events.flatMap((event): string[] => {
    if (event.type === 'draw')
      return [`${table.seats.find((s) => s.id === event.playerId)?.label ?? ''}：ドロー`];
    if (event.type === 'lifeChange')
      return [
        `${table.seats.find((s) => s.id === event.playerId)?.label ?? ''}：ライフ ${event.delta > 0 ? '+' : ''}${event.delta}`,
      ];
    if (
      event.type === 'zoneChange' &&
      event.after &&
      meaning !== 'draw' &&
      (!['hand', 'library'].includes(event.fromZone) ||
        !['hand', 'library'].includes(event.toZone!))
    ) {
      const hidden =
        before.cards[event.physicalCardId]?.faceDown || table.cards[event.physicalCardId]?.faceDown;
      const def = table.defs[event.after.defId];
      return [
        `${hidden ? 'カード' : `《${def?.printedName ?? def?.name ?? 'カード'}》`}：${zoneLabel[event.toZone!]}`,
      ];
    }
    return [];
  });
  records.feed = [
    ...(records.feed ?? []),
    ...messages.map((message, index) => ({
      seq: records.sequence - messages.length + index + 1,
      turn: table.turn,
      phase: table.phase,
      message,
    })),
  ].slice(-24);
  records.events = [...records.events, ...events].slice(-32);
  const retained = (c: TableTrigger) =>
    c.status === 'pending' || table.stack.some((e) => e.id === c.entryId);
  const completed = records.candidates.filter((c) => !retained(c)).slice(-24);
  records.candidates = [...records.candidates.filter(retained), ...completed];
  trace.last = structuredClone(table);
}
export function readyTableTriggers(table: CockpitTable): TableTrigger[] {
  return table.resolution
    ? []
    : (table.triggers?.candidates ?? []).filter(
        (c) => c.status === 'pending' && !c.requiresManualRuling,
      );
}
export function nextTriggerController(table: CockpitTable): string | undefined {
  const pending = readyTableTriggers(table);
  const seats = table.seats.filter((s) => !s.eliminated);
  const active = seats.findIndex((s) => s.id === table.activeSeatId);
  return [...seats.slice(active), ...seats.slice(0, active)].find((s) =>
    pending.some((c) => c.controllerId === s.id),
  )?.id;
}
export type TriggerOperation =
  | { type: 'trigger.place'; candidateId: string; id: string; targets: string[]; text?: string }
  | { type: 'trigger.link'; candidateId: string; entryId: string }
  | { type: 'trigger.dismiss'; candidateId: string; reason: string };
