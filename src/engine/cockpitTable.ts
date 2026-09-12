import type { CardDef, ManaColor } from '../types/card';
import type {
  CardInstance,
  CombatState,
  LinkedExileRecord,
  ManaPool,
  Phase,
  ZoneId,
} from './types';
import { PHASE_ORDER } from './types';
import type { InitDeckCard } from './init';
import { createRng, shuffledOrder } from './random';
import {
  autoTapCommands,
  manaActivationChoices,
  planManaPayment,
  type ManaResources,
  type AutoTapPlan,
} from './autotap';
import { parseManaCost } from './mana';
import { planTableManaTriggers } from './manaTransaction';
import type { GameCommand } from './commands';
import { tableAbilityChoices, type TableManualCosts } from './cockpitAbilities';

export const tableZones: readonly ZoneId[] = [
  'library',
  'hand',
  'battlefield',
  'graveyard',
  'exile',
  'command',
  'stack',
];
export const manaColors: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
export const emptyTableMana = (): ManaPool => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
export interface TableSeat {
  id: string;
  label: string;
  controller: 'human' | 'passive';
  life: number;
  mana: ManaPool;
  counters: Record<string, number>;
  commanderDamage: Record<string, number>;
  maximumHandSize: number | null;
  zones: Record<ZoneId, string[]>;
  kept: boolean;
  mulligans: number;
  eliminated: boolean;
}
export interface TableStackEntry {
  id: string;
  kind: 'spell' | 'activated' | 'triggered';
  source: CardInstance;
  controllerId: string;
  targets: string[];
  targetSnapshots?: Record<string, CardInstance>;
  paid: GameCommand[];
  text: string;
  costNote?: string;
  stackCardId?: string;
  copied?: boolean;
}
export interface TableGrant {
  id: string;
  cardId: string;
  keyword: string;
  value: string;
  duration: string;
  sourceId: string | null;
  sourceSnapshot?: CardInstance;
}
export interface TableModifier {
  id: string;
  cardId: string;
  power: number;
  toughness: number;
  duration: string;
  sourceId: string | null;
  sourceSnapshot?: CardInstance;
}
export interface TableCombat {
  legacyDeclaration?: CombatState;
  attackers: { cardId: string; objectId: string; targetId: string; defendingSeatId?: string }[];
  blockers: { cardId: string; objectId: string; attackerIds: string[] }[];
  assignments: { sourceId: string; targetId: string; targetObjectId?: string; amount: number }[];
  damageApplied: boolean;
  damageStep?: 1 | 2;
}
export interface CockpitTable {
  version: 1;
  defs: Record<string, CardDef>;
  cards: Record<string, CardInstance>;
  seats: TableSeat[];
  turn: number;
  phase: Phase;
  activeSeatId: string;
  stack: TableStackEntry[];
  resolution: TableStackEntry | null;
  grants: TableGrant[];
  commanderCasts: Record<string, number>;
  modifiers: TableModifier[];
  linkedExiles: (LinkedExileRecord & { duration?: string })[];
  visibility: Record<string, string[]>;
  combat: TableCombat | null;
  hold: boolean;
  ended: boolean;
}
export interface TableTokenCharacteristics {
  name: string;
  typeLine: string;
  power: string;
  toughness: string;
  text: string;
  colors?: ManaColor[];
}
export type TableOperation =
  | { type: 'token.edit'; cardId: string; definitionId: string; value: TableTokenCharacteristics }
  | { type: 'copyStack'; entryId: string; id: string; controllerId: string; targets: string[] }
  | { type: 'hold'; held: boolean }
  | { type: 'end' }
  | { type: 'eliminate'; seatId: string }
  | { type: 'shortcut' }
  | { type: 'emptyMana'; seatIds: string[] }
  | { type: 'commanderCount'; cardId: string; count: number }
  | { type: 'battle.attack'; attackers: { cardId: string; targetId: string }[]; tapIds: string[] }
  | {
      type: 'battle.block';
      defendingSeatId?: string;
      blockers: { cardId: string; attackerIds: string[] }[];
    }
  | { type: 'battle.assign'; assignments: { sourceId: string; targetId: string; amount: number }[] }
  | { type: 'battle.apply' }
  | { type: 'battle.nextDamage' }
  | { type: 'battle.end' }
  | {
      type: 'cleanup';
      damageIds: string[];
      grantIds: string[];
      modifierIds: string[];
      discardIds: string[];
      seatId: string;
    }
  | {
      type: 'activate';
      id: string;
      sourceId: string;
      choice: string;
      text: string;
      targets: string[];
      manualCosts: TableManualCosts | null;
      paymentPlan: GameCommand[];
    }
  | { type: 'draw'; seatId: string; count: number }
  | { type: 'shuffle'; seatId: string; seed: number }
  | { type: 'randomDiscard'; seatId: string; count: number; seed: number }
  | { type: 'mulligan'; seatId: string; seed: number }
  | {
      type: 'arrange';
      seatId: string;
      examined: string[];
      top: string[];
      bottom: string[];
      graveyard: string[];
    }
  | { type: 'counter'; ids: string[]; seatIds: string[]; name: string; delta: number }
  | { type: 'damage'; ids: string[]; delta: number }
  | { type: 'proliferate'; ids: string[]; seatIds: string[] }
  | { type: 'modifier'; modifier: TableModifier; remove: boolean }
  | { type: 'control'; ids: string[]; seatId: string }
  | { type: 'attach'; cardId: string; targetId: string | null }
  | { type: 'face'; cardId: string; faceIndex: number; faceDown: boolean }
  | { type: 'visibility'; ids: string[]; seatIds: string[] }
  | { type: 'link'; sourceId: string; ids: string[]; duration: string; remove: boolean }
  | {
      type: 'token';
      id: string;
      seatId: string;
      name: string;
      typeLine: string;
      power: string;
      toughness: string;
      text: string;
      colors?: ManaColor[];
    }
  | { type: 'copyPermanent'; id: string; seatId: string; sourceId: string }
  | { type: 'move'; ids: string[]; to: ZoneId; position: 'top' | 'bottom' }
  | { type: 'tap'; ids: string[]; tapped: boolean }
  | { type: 'life'; seatIds: string[]; delta: number }
  | { type: 'mana'; seatId: string; color: ManaColor; delta: number }
  | { type: 'generate'; cardId: string; commands: GameCommand[] }
  | { type: 'generateBatch'; entries: { cardId: string; commands: GameCommand[] }[] }
  | {
      type: 'cast';
      cardId: string;
      targets: string[];
      x: number;
      excludedSourceIds?: string[];
      manualManaCost?: string | null;
      costNote?: string;
      paymentPlan: GameCommand[];
    }
  | { type: 'keyword'; grant: TableGrant; remove: boolean }
  | { type: 'stack.remove'; entryId: string; to: ZoneId }
  | { type: 'resolve.begin' }
  | { type: 'resolve.end'; to: ZoneId }
  | { type: 'keep'; seatId: string; bottom?: string[] }
  | { type: 'phase' }
  | { type: 'turn' };

function validateTokenCharacteristics(value: TableTokenCharacteristics) {
  for (const text of [value.name, value.typeLine, value.power, value.toughness, value.text])
    requireTable(
      typeof text === 'string' && text.length <= 2000,
      'トークンの特徴を確認してください。',
    );
  requireTable(
    value.name.trim() && value.typeLine.trim(),
    'トークン名とタイプを指定してください。',
  );
  requireTable(
    value.colors === undefined ||
      (Array.isArray(value.colors) &&
        value.colors.every((color) => color !== 'C' && manaColors.includes(color))),
    'トークンの色を確認してください。',
  );
}

function requireTable(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function integer(value: number, min = -100000, max = 100000): void {
  requireTable(
    Number.isSafeInteger(value) && value >= min && value <= max,
    '数値を確認してください。',
  );
}
export function tableSeat(table: CockpitTable, id: string): TableSeat {
  const seat = table.seats.find((item) => item.id === id);
  requireTable(seat && !seat.eliminated, '操作できない席です。');
  return seat;
}
function cardOf(table: CockpitTable, id: string): CardInstance {
  const card = Object.hasOwn(table.cards, id) ? table.cards[id] : undefined;
  requireTable(card, '対象のカードがありません。');
  return card;
}
function distinct(ids: string[]): void {
  requireTable(
    Array.isArray(ids) && ids.length > 0 && ids.length <= 500 && new Set(ids).size === ids.length,
    '対象の選択を確認してください。',
  );
}
function move(table: CockpitTable, ids: string[], to: ZoneId, position: 'top' | 'bottom'): void {
  distinct(ids);
  requireTable(
    tableZones.includes(to) && ['top', 'bottom'].includes(position),
    '移動先を確認してください。',
  );
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const card = cardOf(table, id);
    const owner = tableSeat(table, card.ownerId);
    for (const seat of table.seats)
      for (const zone of tableZones)
        seat.zones[zone] = seat.zones[zone].filter((entry) => entry !== id);
    if (card.zone !== to) {
      card.zoneChangeCounter += 1;
      card.counters = {};
      card.damageMarked = 0;
      card.hasDeathtouchDamage = false;
      card.tapped = false;
      card.faceDown = false;
      card.manualKeywords = [];
      delete card.attachedTo;
      table.grants = table.grants.filter((grant) => grant.cardId !== id);
      table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== id);
      delete table.visibility[id];
      for (const other of Object.values(table.cards))
        if (other.attachedTo === id) delete other.attachedTo;
      card.controllerId = card.ownerId;
      card.enteredTurn = to === 'battlefield' ? table.turn : 0;
    }
    card.zone = to;
    const group = groups.get(owner.id) ?? [];
    group.push(id);
    groups.set(owner.id, group);
  }
  for (const [ownerId, group] of groups) {
    const zone = tableSeat(table, ownerId).zones[to];
    if (position === 'top') zone.unshift(...group);
    else zone.push(...group);
  }
}

export function tableManaResources(table: CockpitTable, seatId: string): ManaResources {
  const battlefield = table.seats.flatMap((seat) => seat.zones.battlefield);
  const turnSeats = table.seats.filter((seat) => !seat.eliminated);
  // The current manual turn operation rotates these seats once per turn (CR 302.6).
  const turnsSinceSeatStart =
    (turnSeats.findIndex((seat) => seat.id === table.activeSeatId) -
      turnSeats.findIndex((seat) => seat.id === seatId) +
      turnSeats.length) %
    turnSeats.length;
  const seatTurnStarted = table.turn - turnsSinceSeatStart;
  return {
    cards: table.cards,
    defs: table.defs,
    battlefield,
    commanderIds: Object.values(table.cards)
      .filter((card) => card.isCommander && card.ownerId === seatId)
      .map((card) => card.id),
    manaPool: tableSeat(table, seatId).mana,
    unavailableSourceIds: battlefield.filter((id) => {
      const card = table.cards[id];
      const def = table.defs[card.defId];
      const face = def.faces[card.faceIndex] ?? def.faces[0];
      return (
        /Creature/.test(face.typeLine) &&
        card.enteredTurn >= seatTurnStarted &&
        !card.manualKeywords?.includes('haste') &&
        !def.keywords?.some((word) => word.toLowerCase() === 'haste')
      );
    }),
  };
}

/** Only server-generated, recognized cost commands enter here. Never public arbitrary commands. */
function applyManaCost(table: CockpitTable, command: GameCommand, seatId: string): void {
  const seat = tableSeat(table, seatId);
  switch (command.type) {
    case 'setTapped': {
      const card = cardOf(table, command.cardId);
      requireTable(
        card.zone === 'battlefield' && card.controllerId === seatId && !card.tapped,
        'マナ源を再確認してください。',
      );
      card.tapped = command.tapped;
      return;
    }
    case 'addMana':
      integer(command.amount, 0);
      tableSeat(table, command.playerId ?? seatId).mana[command.color] += command.amount;
      return;
    case 'payMana':
      for (const color of manaColors) {
        integer(command.payment[color], 0);
        requireTable(seat.mana[color] >= command.payment[color], 'マナが不足しています。');
        seat.mana[color] -= command.payment[color];
      }
      return;
    case 'adjustLife':
      integer(command.delta);
      requireTable(seat.life + command.delta >= 0, 'ライフの支払いができません。');
      seat.life += command.delta;
      return;
    case 'dealDamage':
      requireTable(command.targetPlayerId === seatId, '未対応のマナ付随処理です。');
      integer(command.amount, 0);
      seat.life -= command.amount;
      return;
    case 'moveCard':
      requireTable(
        cardOf(table, command.cardId).controllerId === seatId,
        'コストの対象を確認してください。',
      );
      requireTable(
        command.position === undefined ||
          command.position === 'top' ||
          command.position === 'bottom',
        'コストの移動順を確認してください。',
      );
      move(table, [command.cardId], command.to, command.position ?? 'top');
      return;
    case 'addCounters': {
      const card = cardOf(table, command.cardId);
      requireTable(card.controllerId === seatId, 'コストの対象を確認してください。');
      integer(command.delta, -100000, 0);
      const amount = (card.counters[command.counterType] ?? 0) + command.delta;
      integer(amount, 0);
      card.counters[command.counterType] = amount;
      return;
    }
    default:
      throw new Error('このマナ能力のコストは手動確認が必要です。');
  }
}

export function tableActivationPayment(
  table: CockpitTable,
  sourceId: string,
  choiceKey: string,
  manual: TableManualCosts | null,
): { paid: GameCommand[]; text: string; costNote: string } {
  const source = cardOf(table, sourceId);
  const choice = tableAbilityChoices(table, sourceId).find((item) => item.key === choiceKey);
  requireTable(
    choice || choiceKey === 'manual' || choiceKey === 'triggered',
    '起動する能力を確認してください。',
  );
  requireTable(!choice?.manual || manual, '非マナコストを明示してください。');
  let commands = choice?.commands ?? [];
  let manaCost = choice?.manaCost ?? '';
  if (manual) {
    requireTable(
      typeof manual.note === 'string' && manual.note.length <= 2000,
      '手動コストの記録を確認してください。',
    );
    manaCost = manual.manaCost;
    commands = [];
    const allMoves = [
      ...manual.sacrificeIds,
      ...manual.discardIds,
      ...manual.returnIds,
      ...manual.exileIds,
    ];
    if (allMoves.length) distinct(allMoves);
    if (manual.tapIds.length) distinct(manual.tapIds);
    for (const id of manual.tapIds) {
      requireTable(
        cardOf(table, id).zone === 'battlefield',
        'タップするコストの対象を確認してください。',
      );
      commands.push({ type: 'setTapped', cardId: id, tapped: true });
    }
    const moves = [
      { ids: manual.sacrificeIds, from: 'battlefield', to: 'graveyard' },
      { ids: manual.discardIds, from: 'hand', to: 'graveyard' },
      { ids: manual.returnIds, from: 'battlefield', to: 'hand' },
      { ids: manual.exileIds, from: null, to: 'exile' },
    ] as const;
    for (const group of moves)
      for (const id of group.ids) {
        const card = cardOf(table, id);
        requireTable(!group.from || card.zone === group.from, 'コストの領域が変わりました。');
        commands.push({ type: 'moveCard', cardId: id, to: group.to, position: 'top' });
      }
    integer(manual.life, 0);
    if (manual.life)
      commands.push({ type: 'adjustLife', delta: -manual.life, playerId: source.controllerId });
    for (const counter of manual.counters) {
      integer(counter.count, 1);
      requireTable(
        typeof counter.name === 'string' &&
          counter.name.length > 0 &&
          counter.name.length <= 100 &&
          !['__proto__', 'constructor', 'prototype'].includes(counter.name),
        'カウンター名を確認してください。',
      );
      commands.push({
        type: 'addCounters',
        cardId: counter.cardId,
        counterType: counter.name,
        delta: -counter.count,
      });
    }
  }
  requireTable(
    typeof manaCost === 'string' &&
      /^(?:\{(?:\d+|[WUBRGC]|[WUBRG]\/[WUBRG]|2\/[WUBRG])\})*$/.test(manaCost),
    'マナコストを具体的な値で指定してください。',
  );
  const resources = tableManaResources(table, source.controllerId);
  // Reserve tap costs so the same object is not tapped again by auto payment.
  resources.unavailableSourceIds = [
    ...(resources.unavailableSourceIds ?? []),
    ...commands.filter((command) => command.type === 'setTapped').map((command) => command.cardId),
  ];
  const plan = planManaPayment(resources, parseManaCost(manaCost), 0, source.controllerId, true);
  requireTable(plan.ok, '対応済みのマナでは支払いが不足します。');
  const paid: GameCommand[] = [...tableAutoPayment(table, plan, source.controllerId), ...commands];
  // Validate the complete proposal on a throwaway copy; no cost is paid here.
  const preview = structuredClone(table);
  for (const command of paid) applyManaCost(preview, command, source.controllerId);
  return {
    paid,
    text: choice?.text ?? '',
    costNote: manual
      ? `${choice?.costText ?? ''} / 手動確認: ${manual.note}`
      : (choice?.costText ?? ''),
  };
}

function manaTriggerResources(table: CockpitTable) {
  return {
    cards: table.cards,
    defs: table.defs,
    battlefield: Object.values(table.cards)
      .filter((card) => card.zone === 'battlefield')
      .map((card) => card.id),
  };
}
function generateTableMana(
  table: CockpitTable,
  cardId: string,
  commands: GameCommand[],
): GameCommand[] {
  const card = cardOf(table, cardId);
  const choices = manaActivationChoices(
    tableManaResources(table, card.controllerId),
    card.controllerId,
    card.id,
  );
  requireTable(
    choices.some((choice) => JSON.stringify(choice) === JSON.stringify(commands)),
    'マナ生成案を確認し直してください。',
  );
  const before = structuredClone(table);
  for (const command of commands) applyManaCost(table, command, card.controllerId);
  const triggered = planTableManaTriggers(
    manaTriggerResources(before),
    manaTriggerResources(table),
    cardId,
    commands,
  );
  for (const command of triggered) applyManaCost(table, command, card.controllerId);
  return [...commands, ...triggered];
}

/** Build the same complete proposal in the browser and on the server before committing. */
export function tableAutoPayment(
  table: CockpitTable,
  plan: AutoTapPlan,
  seatId: string,
): GameCommand[] {
  const preview = structuredClone(table);
  const commands: GameCommand[] = [];
  for (const activation of plan.activations) {
    commands.push(
      ...generateTableMana(
        preview,
        activation.cardId,
        autoTapCommands({ activations: [activation] }, seatId),
      ),
    );
  }
  commands.push({ type: 'payMana', payment: plan.payment, playerId: seatId });
  return commands;
}

export function tableCastPayment(
  table: CockpitTable,
  cardId: string,
  x: number,
  excludedSourceIds: string[] = [],
  manualManaCost: string | null = null,
  costNote = '',
): GameCommand[] {
  const card = cardOf(table, cardId);
  const face = table.defs[card.defId].faces[card.faceIndex];
  integer(x, 0, 1000);
  const declaredCost = manualManaCost ?? face?.manaCost;
  requireTable(
    manualManaCost === null ||
      (typeof manualManaCost === 'string' &&
        typeof costNote === 'string' &&
        costNote.trim().length > 0 &&
        costNote.length <= 2000),
    '手動の最終コストと確認記録を指定してください。',
  );
  requireTable(
    face && !/Land/.test(face.typeLine) && declaredCost !== undefined,
    'このカードは通常のマナ支払いでは唱えられません。',
  );
  requireTable(
    /^(?:\{(?:\d+|[WUBRGCX]|[WUBRG]\/[WUBRG]|2\/[WUBRG])\})*$/.test(declaredCost),
    'このコストは手動確認が必要です。',
  );
  requireTable(Array.isArray(excludedSourceIds), 'マナ源の選択を確認してください。');
  if (excludedSourceIds.length) distinct(excludedSourceIds);
  for (const id of excludedSourceIds) cardOf(table, id);
  const cost = parseManaCost(declaredCost);
  if (manualManaCost === null && card.isCommander && card.zone === 'command')
    cost.generic += 2 * (table.commanderCasts[card.id] ?? 0);
  const resources = tableManaResources(table, card.controllerId);
  resources.unavailableSourceIds = [...resources.unavailableSourceIds, ...excludedSourceIds];
  const plan = planManaPayment(resources, cost, x, card.controllerId, true);
  requireTable(plan.ok, '対応済みのマナ源では支払いが不足します。');
  return tableAutoPayment(table, plan, card.controllerId);
}

function finishTableStack(table: CockpitTable, entry: TableStackEntry, to: ZoneId): void {
  requireTable(tableZones.includes(to) && to !== 'stack', '処理後の領域を確認してください。');
  const stackId = entry.stackCardId ?? (entry.kind === 'spell' ? entry.source.id : undefined);
  if (stackId && table.cards[stackId]?.zone === 'stack') {
    if (entry.kind === 'spell' && (!entry.copied || to === 'battlefield')) {
      move(table, [stackId], to, 'top');
      if (entry.copied) table.cards[stackId].isToken = true;
    } else {
      for (const seat of table.seats)
        seat.zones.stack = seat.zones.stack.filter((id) => id !== stackId);
      delete table.cards[stackId];
    }
  }
  table.stack = table.stack.filter((item) => item.id !== entry.id);
  if (table.resolution?.id === entry.id) table.resolution = null;
}
function snapshotTableTargets(table: CockpitTable, ids: string[]): Record<string, CardInstance> {
  return Object.fromEntries(
    ids.flatMap((id) => {
      const card = table.cards[id] ?? table.stack.find((entry) => entry.id === id)?.source;
      return card ? [[id, structuredClone(card)]] : [];
    }),
  );
}

function validTableTarget(table: CockpitTable, id: string): boolean {
  return (
    typeof id === 'string' &&
    (Object.hasOwn(table.cards, id) ||
      table.stack.some((entry) => entry.id === id) ||
      table.seats.some((seat) => seat.id === id && !seat.eliminated))
  );
}

export function applyTableOperation(before: CockpitTable, operation: TableOperation): CockpitTable {
  requireTable(!before.ended, '終了したセッションです。');
  const table = structuredClone(before);
  switch (operation.type) {
    case 'eliminate': {
      const departing = tableSeat(table, operation.seatId);
      requireTable(
        !Object.values(table.cards).some(
          (card) => card.controllerId === departing.id && card.ownerId !== departing.id,
        ),
        '退出前に他のプレイヤーのカードの制御を手動で戻してください。',
      );
      departing.eliminated = true;
      const removed = new Set(
        Object.values(table.cards)
          .filter((card) => card.ownerId === departing.id)
          .map((card) => card.id),
      );
      for (const id of removed) delete table.cards[id];
      for (const seat of table.seats)
        for (const zone of tableZones)
          seat.zones[zone] = seat.zones[zone].filter((id) => !removed.has(id));
      for (const card of Object.values(table.cards)) {
        if (card.attachedTo && removed.has(card.attachedTo)) delete card.attachedTo;
      }
      table.stack = table.stack.filter(
        (entry) =>
          entry.controllerId !== departing.id &&
          !(entry.kind === 'spell' && removed.has(entry.stackCardId ?? entry.source.id)),
      );
      if (
        table.resolution?.controllerId === departing.id ||
        (table.resolution?.kind === 'spell' &&
          removed.has(table.resolution.stackCardId ?? table.resolution.source.id))
      )
        table.resolution = null;
      table.grants = table.grants.filter((entry) => !removed.has(entry.cardId));
      table.modifiers = table.modifiers.filter((entry) => !removed.has(entry.cardId));
      if (table.combat) {
        const combat = table.combat;
        combat.attackers = combat.attackers.filter(
          (entry) =>
            !removed.has(entry.cardId) &&
            entry.targetId !== departing.id &&
            entry.defendingSeatId !== departing.id &&
            !removed.has(entry.targetId),
        );
        combat.blockers = combat.blockers
          .filter((entry) => !removed.has(entry.cardId))
          .map((entry) => ({
            ...entry,
            attackerIds: entry.attackerIds.filter((id) =>
              combat.attackers.some((attacker) => attacker.cardId === id),
            ),
          }))
          .filter((entry) => entry.attackerIds.length);
        const remaining = new Set(
          [...combat.attackers, ...combat.blockers].map((entry) => entry.cardId),
        );
        combat.assignments = combat.assignments.filter(
          (entry) =>
            remaining.has(entry.sourceId) &&
            entry.targetId !== departing.id &&
            !removed.has(entry.targetId),
        );
        if (!combat.attackers.length) table.combat = null;
      }
      table.linkedExiles = table.linkedExiles
        .filter((entry) => !removed.has(entry.sourcePhysicalId))
        .map((entry) => {
          const kept = entry.exiledPhysicalIds
            .map((id, index) => ({ id, objectId: entry.exiledObjectIds[index] }))
            .filter(({ id }) => !removed.has(id));
          return {
            ...entry,
            exiledPhysicalIds: kept.map(({ id }) => id),
            exiledObjectIds: kept.map(({ objectId }) => objectId),
          };
        })
        .filter((entry) => entry.exiledPhysicalIds.length);
      if (table.seats.filter((seat) => !seat.eliminated).length <= 1) {
        table.ended = true;
        table.hold = true;
      }
      break;
    }
    case 'end':
      table.ended = true;
      table.hold = true;
      break;
    case 'copyStack': {
      const original = table.stack.find((entry) => entry.id === operation.entryId);
      requireTable(
        original &&
          typeof operation.id === 'string' &&
          /^[a-zA-Z0-9-]{1,80}$/.test(operation.id) &&
          !table.stack.some((entry) => entry.id === operation.id) &&
          !Object.hasOwn(table.cards, operation.id) &&
          !table.seats.some((seat) => seat.id === operation.id),
        'コピー元と生成IDを確認してください。',
      );
      const controller = tableSeat(table, operation.controllerId);
      requireTable(
        Array.isArray(operation.targets) &&
          operation.targets.every((id) => validTableTarget(table, id)),
        'コピーの対象を確認してください。',
      );
      let stackCardId: string | undefined;
      if (original.kind === 'spell') {
        const spell = cardOf(table, original.stackCardId ?? original.source.id);
        requireTable(spell.zone === 'stack', 'コピーする呪文がStackにありません。');
        stackCardId = operation.id;
        table.cards[stackCardId] = {
          ...structuredClone(spell),
          id: stackCardId,
          ownerId: controller.id,
          controllerId: controller.id,
          isCommander: false,
          isToken: false,
          isCopy: true,
          sourceId: spell.id,
          tapped: false,
          counters: {},
          damageMarked: 0,
        };
        controller.zones.stack.unshift(stackCardId);
      }
      table.stack.unshift({
        ...structuredClone(original),
        id: operation.id,
        controllerId: controller.id,
        targets: [...operation.targets],
        targetSnapshots: snapshotTableTargets(before, operation.targets),
        paid: [],
        costNote: 'Stackのコピー。唱えた回数・支払いは増やしません。',
        copied: true,
        stackCardId,
      });
      break;
    }
    case 'hold':
      requireTable(typeof operation.held === 'boolean', '停止状態を確認してください。');
      table.hold = operation.held;
      break;
    case 'emptyMana':
      distinct(operation.seatIds);
      for (const id of operation.seatIds) tableSeat(table, id).mana = emptyTableMana();
      break;
    case 'commanderCount':
      requireTable(cardOf(table, operation.cardId).isCommander, '統率者を選んでください。');
      integer(operation.count, 0, 1000);
      table.commanderCasts[operation.cardId] = operation.count;
      break;
    case 'shortcut': {
      requireTable(
        !table.hold && !table.resolution && !table.stack.length && table.phase === 'untap',
        'アンタップ開始時だけ使用できます。停止や未完処理を確認してください。',
      );
      const seat = tableSeat(table, table.activeSeatId);
      requireTable(seat.kept && seat.zones.library.length > 0, 'キープと山札を確認してください。');
      for (const card of Object.values(table.cards))
        if (card.zone === 'battlefield' && card.controllerId === seat.id) card.tapped = false;
      move(table, seat.zones.library.slice(0, 1), 'hand', 'bottom');
      table.phase = 'main1';
      break;
    }
    case 'battle.attack': {
      requireTable(
        !table.hold && !table.resolution && !table.stack.length && !table.combat,
        '停止・未完処理・進行中の戦闘を確認してください。',
      );
      distinct(operation.attackers.map((entry) => entry.cardId));
      const ids = new Set(operation.attackers.map((entry) => entry.cardId));
      requireTable(
        operation.tapIds.every((id) => ids.has(id)) &&
          new Set(operation.tapIds).size === operation.tapIds.length,
        '攻撃のタップ対象を確認してください。',
      );
      const attackers = operation.attackers.map((entry) => {
        const card = cardOf(table, entry.cardId);
        requireTable(
          card.zone === 'battlefield' && card.controllerId === table.activeSeatId,
          '攻撃する席の戦場を選んでください。',
        );
        const targetSeat = table.seats.find(
          (seat) => seat.id === entry.targetId && !seat.eliminated,
        );
        const targetCard = Object.hasOwn(table.cards, entry.targetId)
          ? table.cards[entry.targetId]
          : undefined;
        requireTable(
          (targetSeat && targetSeat.id !== card.controllerId) ||
            (targetCard?.zone === 'battlefield' && targetCard.controllerId !== card.controllerId),
          '攻撃先を確認してください。',
        );
        if (operation.tapIds.includes(card.id)) card.tapped = true;
        return {
          ...entry,
          objectId: `${card.id}:${card.zoneChangeCounter}`,
          defendingSeatId: targetSeat?.id ?? targetCard!.controllerId,
        };
      });
      table.combat = { attackers, blockers: [], assignments: [], damageApplied: false };
      table.phase = 'combat';
      break;
    }
    case 'battle.block': {
      const combat = table.combat;
      requireTable(
        combat && !combat.damageApplied && (combat.damageStep ?? 1) === 1,
        'ブロックを登録できる戦闘がありません。',
      );
      if (operation.blockers.length) distinct(operation.blockers.map((entry) => entry.cardId));
      const defendingSeatId = operation.defendingSeatId;
      if (defendingSeatId) tableSeat(table, defendingSeatId);
      const retained = defendingSeatId
        ? combat.blockers.filter(
            (entry) => table.cards[entry.cardId]?.controllerId !== defendingSeatId,
          )
        : [];
      combat.blockers = [
        ...retained,
        ...operation.blockers.map((entry) => {
          const card = cardOf(table, entry.cardId);
          requireTable(
            card.zone === 'battlefield' &&
              card.controllerId !== table.activeSeatId &&
              (!defendingSeatId || card.controllerId === defendingSeatId),
            '防御する席の戦場を選んでください。',
          );
          distinct(entry.attackerIds);
          requireTable(
            entry.attackerIds.every((id) =>
              combat.attackers.some(
                (attacker) =>
                  attacker.cardId === id &&
                  (attacker.defendingSeatId
                    ? attacker.defendingSeatId === card.controllerId
                    : attacker.targetId === card.controllerId ||
                      table.cards[attacker.targetId]?.controllerId === card.controllerId),
              ),
            ),
            'ブロックする攻撃カードを確認してください。',
          );
          return {
            cardId: card.id,
            objectId: `${card.id}:${card.zoneChangeCounter}`,
            attackerIds: [...entry.attackerIds],
          };
        }),
      ];
      combat.assignments = [];
      break;
    }
    case 'battle.assign': {
      const combat = table.combat;
      requireTable(combat && !combat.damageApplied, 'ダメージ割当を確認してください。');
      requireTable(
        Array.isArray(operation.assignments) && operation.assignments.length <= 500,
        '割当数を確認してください。',
      );
      const participants = [...combat.attackers, ...combat.blockers];
      for (const assignment of operation.assignments) {
        integer(assignment.amount, 0);
        const source = cardOf(table, assignment.sourceId);
        requireTable(
          source.zone === 'battlefield' &&
            participants.some(
              (entry) => entry.objectId === `${source.id}:${source.zoneChangeCounter}`,
            ),
          '戦闘の発生源が変わりました。',
        );
        const seat = table.seats.find(
          (seat) => seat.id === assignment.targetId && !seat.eliminated,
        );
        const target = Object.hasOwn(table.cards, assignment.targetId)
          ? table.cards[assignment.targetId]
          : undefined;
        requireTable(seat || target?.zone === 'battlefield', 'ダメージの対象を確認してください。');
      }
      combat.assignments = operation.assignments.map((entry) => ({
        ...entry,
        ...(Object.hasOwn(table.cards, entry.targetId)
          ? { targetObjectId: `${entry.targetId}:${table.cards[entry.targetId].zoneChangeCounter}` }
          : {}),
      }));
      break;
    }
    case 'battle.apply': {
      const combat = table.combat;
      requireTable(
        combat &&
          !combat.damageApplied &&
          combat.assignments.length > 0 &&
          !table.hold &&
          !table.resolution &&
          !table.stack.length,
        '割当と未完処理を確認してください。',
      );
      for (const assignment of combat.assignments) {
        const source = cardOf(table, assignment.sourceId);
        requireTable(
          source.zone === 'battlefield' &&
            [...combat.attackers, ...combat.blockers].some(
              (entry) => entry.objectId === `${source.id}:${source.zoneChangeCounter}`,
            ),
          '戦闘の発生源が変わりました。',
        );
        const seat = table.seats.find((seat) => seat.id === assignment.targetId);
        if (seat) {
          tableSeat(table, seat.id).life -= assignment.amount;
          if (source.isCommander)
            seat.commanderDamage[source.id] =
              (seat.commanderDamage[source.id] ?? 0) + assignment.amount;
        } else {
          const card = cardOf(table, assignment.targetId);
          requireTable(
            card.zone === 'battlefield' &&
              assignment.targetObjectId === `${card.id}:${card.zoneChangeCounter}`,
            'ダメージの対象が移動しました。',
          );
          const type = card.faceDown
            ? 'Creature'
            : (table.defs[card.defId]?.faces[card.faceIndex]?.typeLine ?? '');
          if (/Planeswalker/.test(type))
            card.counters.loyalty = Math.max(0, (card.counters.loyalty ?? 0) - assignment.amount);
          if (/Battle/.test(type))
            card.counters.defense = Math.max(0, (card.counters.defense ?? 0) - assignment.amount);
          if (/Creature/.test(type) || !/Planeswalker|Battle/.test(type))
            card.damageMarked += assignment.amount;
        }
      }
      combat.damageApplied = true;
      break;
    }
    case 'battle.nextDamage': {
      const combat = table.combat;
      requireTable(
        combat &&
          combat.damageApplied &&
          (combat.damageStep ?? 1) === 1 &&
          !table.hold &&
          !table.resolution &&
          !table.stack.length,
        '次のダメージ段階へ進める状態ではありません。',
      );
      combat.damageStep = 2;
      combat.damageApplied = false;
      combat.assignments = [];
      break;
    }
    case 'battle.end':
      table.combat = null;
      break;
    case 'cleanup': {
      requireTable(
        table.phase === 'cleanup' &&
          !table.hold &&
          !table.combat &&
          !table.resolution &&
          table.stack.length === 0,
        'クリンナップに進み、停止・未完処理を確認してください。',
      );
      const seat = tableSeat(table, operation.seatId);
      if (operation.damageIds.length) distinct(operation.damageIds);
      for (const id of operation.damageIds) {
        const card = cardOf(table, id);
        card.damageMarked = 0;
        card.hasDeathtouchDamage = false;
      }
      for (const id of operation.grantIds) {
        const grant = table.grants.find((entry) => entry.id === id);
        requireTable(grant, '解除するキーワードが変わりました。');
        const card = cardOf(table, grant.cardId);
        table.grants = table.grants.filter((entry) => entry.id !== id);
        if (
          !table.grants.some((entry) => entry.cardId === card.id && entry.keyword === grant.keyword)
        )
          card.manualKeywords = card.manualKeywords?.filter((keyword) => keyword !== grant.keyword);
      }
      requireTable(
        operation.modifierIds.every((id) => table.modifiers.some((entry) => entry.id === id)),
        '解除する修整が変わりました。',
      );
      table.modifiers = table.modifiers.filter(
        (entry) => !operation.modifierIds.includes(entry.id),
      );
      if (operation.discardIds.length) {
        distinct(operation.discardIds);
        requireTable(
          operation.discardIds.every((id) => seat.zones.hand.includes(id)),
          '手札調整の対象を確認してください。',
        );
        move(table, operation.discardIds, 'graveyard', 'top');
      }
      break;
    }
    case 'activate': {
      requireTable(
        typeof operation.id === 'string' &&
          /^[a-zA-Z0-9-]{1,80}$/.test(operation.id) &&
          !table.stack.some((entry) => entry.id === operation.id) &&
          !Object.hasOwn(table.cards, operation.id) &&
          !table.seats.some((seat) => seat.id === operation.id),
        'Stack IDを確認してください。',
      );
      requireTable(
        Array.isArray(operation.targets) &&
          operation.targets.every((id) => validTableTarget(table, id)),
        '対象を確認してください。',
      );
      requireTable(
        typeof operation.text === 'string' && operation.text.length <= 5000,
        '能力本文を確認してください。',
      );
      const source = structuredClone(cardOf(table, operation.sourceId));
      const proposal = tableActivationPayment(
        table,
        source.id,
        operation.choice,
        operation.manualCosts,
      );
      requireTable(
        JSON.stringify(operation.paymentPlan) === JSON.stringify(proposal.paid),
        '支払い案を確認し直してください。',
      );
      for (const command of proposal.paid) applyManaCost(table, command, source.controllerId);
      table.stack.unshift({
        id: operation.id,
        kind: operation.choice === 'triggered' ? 'triggered' : 'activated',
        source,
        controllerId: source.controllerId,
        targets: [...operation.targets],
        targetSnapshots: snapshotTableTargets(before, operation.targets),
        paid: proposal.paid,
        costNote: proposal.costNote,
        text: proposal.text || operation.text,
      });
      break;
    }
    case 'modifier': {
      const modifier = operation.modifier;
      requireTable(
        cardOf(table, modifier.cardId).zone === 'battlefield',
        '戦場のカードを選んでください。',
      );
      requireTable(
        typeof modifier.id === 'string' &&
          modifier.id.length > 0 &&
          modifier.id.length <= 100 &&
          typeof modifier.duration === 'string' &&
          modifier.duration.length <= 200,
        '修整の期間を確認してください。',
      );
      integer(modifier.power);
      integer(modifier.toughness);
      if (!operation.remove && modifier.sourceId !== null) cardOf(table, modifier.sourceId);
      table.modifiers = table.modifiers.filter((entry) => entry.id !== modifier.id);
      if (!operation.remove)
        table.modifiers.push({
          ...structuredClone(modifier),
          sourceSnapshot: modifier.sourceId
            ? structuredClone(cardOf(table, modifier.sourceId))
            : undefined,
        });
      break;
    }
    case 'control':
      distinct(operation.ids);
      tableSeat(table, operation.seatId);
      for (const id of operation.ids) {
        const card = cardOf(table, id);
        requireTable(card.zone === 'battlefield', '戦場のカードを選んでください。');
        if (card.controllerId !== operation.seatId) {
          card.controllerId = operation.seatId;
          card.enteredTurn = table.turn;
        }
      }
      break;
    case 'attach': {
      const card = cardOf(table, operation.cardId);
      requireTable(card.zone === 'battlefield', '戦場のカードを選んでください。');
      if (operation.targetId === null) delete card.attachedTo;
      else {
        const target = cardOf(table, operation.targetId);
        requireTable(
          target.zone === 'battlefield' && target.id !== card.id,
          '添付先を確認してください。',
        );
        // Attachment chains may not cycle, even in manual mode.
        const seen = new Set([card.id]);
        let next: CardInstance | undefined = target;
        while (next) {
          requireTable(!seen.has(next.id), '添付関係が循環しています。');
          seen.add(next.id);
          next = next.attachedTo ? table.cards[next.attachedTo] : undefined;
        }
        card.attachedTo = target.id;
      }
      break;
    }
    case 'face': {
      const card = cardOf(table, operation.cardId);
      integer(operation.faceIndex, 0, table.defs[card.defId].faces.length - 1);
      requireTable(typeof operation.faceDown === 'boolean', '表裏を確認してください。');
      card.faceIndex = operation.faceIndex;
      card.faceDown = operation.faceDown;
      break;
    }
    case 'visibility':
      distinct(operation.ids);
      requireTable(
        Array.isArray(operation.seatIds) &&
          new Set(operation.seatIds).size === operation.seatIds.length,
        '閲覧席を確認してください。',
      );
      operation.seatIds.forEach((id) => tableSeat(table, id));
      for (const id of operation.ids) {
        cardOf(table, id);
        table.visibility[id] = [...operation.seatIds];
      }
      break;
    case 'link': {
      const source = cardOf(table, operation.sourceId);
      distinct(operation.ids);
      requireTable(
        typeof operation.duration === 'string' && operation.duration.length <= 200,
        '関連の期間を確認してください。',
      );
      const objectId = `${source.id}:${source.zoneChangeCounter}`;
      if (operation.remove) {
        for (const link of table.linkedExiles) {
          if (link.sourcePhysicalId !== source.id) continue;
          const keep = link.exiledPhysicalIds
            .map((id, index) => ({ id, objectId: link.exiledObjectIds[index] }))
            .filter((entry) => !operation.ids.includes(entry.id));
          link.exiledPhysicalIds = keep.map((entry) => entry.id);
          link.exiledObjectIds = keep.map((entry) => entry.objectId);
        }
        table.linkedExiles = table.linkedExiles.filter((link) => link.exiledPhysicalIds.length);
      } else {
        const cards = operation.ids.map((id) => cardOf(table, id));
        requireTable(
          cards.every((card) => card.zone === 'exile'),
          '関連付ける追放カードを選んでください。',
        );
        const face = table.defs[source.defId].faces[source.faceIndex];
        table.linkedExiles.push({
          linkId: `${objectId}:${table.linkedExiles.length}:${operation.ids.join(',')}`,
          purpose: 'exiled-with-source',
          sourceObjectId: objectId,
          sourcePhysicalId: source.id,
          exiledPhysicalIds: [...operation.ids],
          exiledObjectIds: cards.map((card) => `${card.id}:${card.zoneChangeCounter}`),
          snapshot: {
            physicalCardId: source.id,
            objectId,
            defId: source.defId,
            zone: source.zone,
            ownerId: source.ownerId,
            controllerId: source.controllerId,
            isToken: source.isToken,
            isCommander: source.isCommander,
            faceIndex: source.faceIndex,
            tapped: source.tapped,
            counters: { ...source.counters },
            typeLine: face.typeLine,
            power: face.power,
            toughness: face.toughness,
          },
          createdSequence: table.turn,
          duration: operation.duration,
        });
      }
      break;
    }
    case 'token.edit': {
      const card = cardOf(table, operation.cardId);
      requireTable(
        card.isToken && card.zone === 'battlefield' && !card.faceDown,
        '表向きのトークンを選んでください。',
      );
      validateTokenCharacteristics(operation.value);
      const previous = table.defs[card.defId];
      const defId = operation.definitionId;
      requireTable(
        typeof defId === 'string' &&
          /^[a-zA-Z0-9-]{1,80}$/.test(defId) &&
          !Object.hasOwn(table.defs, defId),
        '変更先の定義を確認してください。',
      );
      const value = operation.value;
      table.defs[defId] = {
        ...structuredClone(previous),
        scryfallId: defId,
        oracleId: defId,
        name: value.name,
        printedName: value.name,
        typeLine: value.typeLine,
        ...(value.text !== previous.faces[card.faceIndex]?.oracleText
          ? { keywords: [], producedMana: undefined }
          : {}),
        faces: [
          {
            ...previous.faces[card.faceIndex],
            name: value.name,
            printedName: value.name,
            typeLine: value.typeLine,
            printedTypeLine: undefined,
            oracleText: value.text,
            printedText: undefined,
            power: value.power,
            toughness: value.toughness,
            colors: [...(value.colors ?? [])],
          },
        ],
      };
      card.defId = defId;
      card.faceIndex = 0;
      break;
    }
    case 'token':
    case 'copyPermanent': {
      const owner = tableSeat(table, operation.seatId);
      requireTable(
        typeof operation.id === 'string' &&
          /^[a-zA-Z0-9-]{1,80}$/.test(operation.id) &&
          !Object.hasOwn(table.cards, operation.id) &&
          !table.stack.some((entry) => entry.id === operation.id) &&
          !table.seats.some((seat) => seat.id === operation.id) &&
          !Object.hasOwn(table.defs, operation.id),
        '生成IDを確認してください。',
      );
      let def: CardDef;
      if (operation.type === 'copyPermanent') {
        const source = cardOf(table, operation.sourceId);
        requireTable(
          source.zone === 'battlefield' && !source.faceDown,
          '表向きのパーマネントを選んでください。',
        );
        const original = table.defs[source.defId];
        const face = structuredClone(original.faces[source.faceIndex]);
        def = {
          ...structuredClone(original),
          scryfallId: operation.id,
          oracleId: operation.id,
          name: face.name,
          printedName: face.printedName,
          layout: 'normal',
          typeLine: face.typeLine,
          faces: [face],
        };
      } else {
        validateTokenCharacteristics(operation);
        def = {
          scryfallId: operation.id,
          oracleId: operation.id,
          name: operation.name,
          printedName: operation.name,
          lang: 'ja',
          layout: 'token',
          cmc: 0,
          colorIdentity: [],
          typeLine: operation.typeLine,
          faces: [
            {
              name: operation.name,
              typeLine: operation.typeLine,
              power: operation.power,
              toughness: operation.toughness,
              oracleText: operation.text,
              colors: [...(operation.colors ?? [])],
            },
          ],
        };
      }
      table.defs[operation.id] = def;
      table.cards[operation.id] = {
        id: operation.id,
        defId: operation.id,
        zone: 'battlefield',
        ownerId: owner.id,
        controllerId: owner.id,
        zoneChangeCounter: 0,
        tapped: false,
        faceIndex: 0,
        faceDown: false,
        counters: {},
        damageMarked: 0,
        hasDeathtouchDamage: false,
        isToken: true,
        isCommander: false,
        enteredTurn: table.turn,
        ...(operation.type === 'copyPermanent'
          ? { isCopy: true, sourceId: operation.sourceId }
          : {}),
      };
      owner.zones.battlefield.push(operation.id);
      break;
    }
    case 'shuffle': {
      integer(operation.seed, 0, 0xffffffff);
      const seat = tableSeat(table, operation.seatId);
      seat.zones.library = shuffledOrder(seat.zones.library, createRng(operation.seed));
      break;
    }
    case 'randomDiscard': {
      integer(operation.seed, 0, 0xffffffff);
      integer(operation.count, 1, 500);
      const seat = tableSeat(table, operation.seatId);
      requireTable(operation.count <= seat.zones.hand.length, '手札の枚数を確認してください。');
      move(
        table,
        shuffledOrder(seat.zones.hand, createRng(operation.seed)).slice(0, operation.count),
        'graveyard',
        'top',
      );
      break;
    }
    case 'mulligan': {
      const seat = tableSeat(table, operation.seatId);
      requireTable(!seat.kept, 'キープ済みです。');
      requireTable(seat.mulligans < 8, 'これ以上は引き直せません。');
      integer(operation.seed, 0, 0xffffffff);
      requireTable(
        seat.zones.library.length + seat.zones.hand.length >= 7,
        '7枚の初手を用意できません。',
      );
      if (seat.zones.hand.length) move(table, [...seat.zones.hand], 'library', 'bottom');
      seat.zones.library = shuffledOrder(seat.zones.library, createRng(operation.seed));
      move(table, seat.zones.library.slice(0, 7), 'hand', 'bottom');
      seat.mulligans += 1;
      break;
    }
    case 'arrange': {
      const seat = tableSeat(table, operation.seatId);
      distinct(operation.examined);
      requireTable(
        JSON.stringify(seat.zones.library.slice(0, operation.examined.length)) ===
          JSON.stringify(operation.examined),
        '山札上の候補が変わりました。',
      );
      const ordered = [...operation.top, ...operation.bottom, ...operation.graveyard];
      distinct(ordered);
      requireTable(
        ordered.length === operation.examined.length &&
          ordered.every((id) => operation.examined.includes(id)),
        '候補の行き先を確認してください。',
      );
      if (operation.graveyard.length) move(table, operation.graveyard, 'graveyard', 'top');
      if (operation.bottom.length) move(table, operation.bottom, 'library', 'bottom');
      if (operation.top.length) move(table, operation.top, 'library', 'top');
      break;
    }
    case 'counter':
    case 'proliferate': {
      const ids = [...operation.ids, ...operation.seatIds];
      distinct(ids);
      if (operation.type === 'counter') {
        requireTable(
          typeof operation.name === 'string' &&
            operation.name.trim().length > 0 &&
            operation.name.length <= 100 &&
            !['__proto__', 'constructor', 'prototype'].includes(operation.name),
          'カウンター名を確認してください。',
        );
        integer(operation.delta);
      }
      const targets = [
        ...operation.ids.map((id) => cardOf(table, id)),
        ...operation.seatIds.map((id) => tableSeat(table, id)),
      ];
      for (const target of targets) {
        if (operation.type === 'counter') {
          const amount = (target.counters[operation.name] ?? 0) + operation.delta;
          integer(amount, 0);
          target.counters[operation.name] = amount;
        } else {
          requireTable(
            !('zone' in target) || target.zone === 'battlefield',
            '増殖するパーマネントを選んでください。',
          );
          requireTable(
            Object.values(target.counters).some((n) => n > 0),
            'カウンターがある候補を選んでください。',
          );
          for (const name of Object.keys(target.counters))
            if (target.counters[name] > 0) {
              integer(target.counters[name] + 1, 0);
              target.counters[name] += 1;
            }
        }
      }
      break;
    }
    case 'damage':
      distinct(operation.ids);
      integer(operation.delta);
      for (const id of operation.ids) {
        const card = cardOf(table, id);
        requireTable(card.zone === 'battlefield', '戦場の対象を選んでください。');
        integer(card.damageMarked + operation.delta, 0);
        card.damageMarked += operation.delta;
      }
      break;
    case 'draw': {
      integer(operation.count, 1, 500);
      const ids = tableSeat(table, operation.seatId).zones.library.slice(0, operation.count);
      requireTable(ids.length === operation.count, 'ライブラリーの枚数が不足しています。');
      move(table, ids, 'hand', 'bottom');
      break;
    }
    case 'move':
      requireTable(operation.to !== 'stack', 'Stackへは唱える・能力登録から進んでください。');
      move(table, operation.ids, operation.to, operation.position);
      table.stack = table.stack.filter(
        (entry) =>
          !operation.ids.includes(
            entry.stackCardId ?? (entry.kind === 'spell' ? entry.source.id : ''),
          ),
      );
      break;
    case 'tap':
      distinct(operation.ids);
      requireTable(typeof operation.tapped === 'boolean', 'タップ状態を確認してください。');
      for (const id of operation.ids) {
        const card = cardOf(table, id);
        requireTable(card.zone === 'battlefield', '戦場のカードを選んでください。');
        card.tapped = operation.tapped;
      }
      break;
    case 'life':
      distinct(operation.seatIds);
      integer(operation.delta);
      for (const id of operation.seatIds) tableSeat(table, id).life += operation.delta;
      break;
    case 'mana': {
      requireTable(manaColors.includes(operation.color), 'マナの色を確認してください。');
      integer(operation.delta);
      const pool = tableSeat(table, operation.seatId).mana;
      requireTable(pool[operation.color] + operation.delta >= 0, 'マナが不足しています。');
      pool[operation.color] += operation.delta;
      break;
    }
    case 'generate': {
      generateTableMana(table, operation.cardId, operation.commands);
      break;
    }
    case 'generateBatch':
      distinct(operation.entries.map((entry) => entry.cardId));
      for (const entry of operation.entries) generateTableMana(table, entry.cardId, entry.commands);
      break;
    case 'cast': {
      const card = cardOf(table, operation.cardId);
      requireTable(
        card.zone === 'hand' || card.zone === 'command',
        '手札か統率領域から選んでください。',
      );
      integer(operation.x, 0, 1000);
      requireTable(
        Array.isArray(operation.targets) &&
          operation.targets.every((id) => validTableTarget(table, id)),
        '対象を確認してください。',
      );
      const face = table.defs[card.defId].faces[card.faceIndex];
      const paid = tableCastPayment(
        table,
        card.id,
        operation.x,
        operation.excludedSourceIds ?? [],
        operation.manualManaCost ?? null,
        operation.costNote ?? '',
      );
      requireTable(
        JSON.stringify(operation.paymentPlan) === JSON.stringify(paid),
        '支払い案が変わりました。確認し直してください。',
      );
      const source = { ...structuredClone(card), announcedX: operation.x };
      for (const command of paid) applyManaCost(table, command, source.controllerId);
      if (card.isCommander && card.zone === 'command')
        table.commanderCasts[card.id] = (table.commanderCasts[card.id] ?? 0) + 1;
      move(table, [card.id], 'stack', 'top');
      card.announcedX = operation.x;
      table.stack.unshift({
        id: `${card.id}:${card.zoneChangeCounter}`,
        kind: 'spell',
        source,
        stackCardId: card.id,
        controllerId: source.controllerId,
        targets: [...operation.targets],
        targetSnapshots: snapshotTableTargets(before, operation.targets),
        paid,
        costNote:
          operation.manualManaCost != null
            ? `手動指定した最終マナコスト ${operation.manualManaCost || '0'} / ${operation.costNote}`
            : '印刷マナコスト・X・統率者税から計算',
        text: face.oracleText ?? '',
      });
      break;
    }
    case 'keyword': {
      const grant = operation.grant;
      const card = cardOf(table, grant.cardId);
      requireTable(
        card.zone === 'battlefield' &&
          typeof grant.id === 'string' &&
          grant.id.length <= 100 &&
          typeof grant.keyword === 'string' &&
          grant.keyword.length <= 100 &&
          typeof grant.value === 'string' &&
          grant.value.length <= 100 &&
          typeof grant.duration === 'string' &&
          grant.duration.length <= 200,
        'キーワード設定を確認してください。',
      );
      requireTable(
        grant.keyword !== 'ward' || grant.value.trim().length > 0,
        '護法の値を指定してください。',
      );
      if (!operation.remove && grant.sourceId !== null) cardOf(table, grant.sourceId);
      const previousGranted = new Set(
        table.grants.filter((entry) => entry.cardId === card.id).map((entry) => entry.keyword),
      );
      const retained = (card.manualKeywords ?? []).filter(
        (keyword) => !previousGranted.has(keyword),
      );
      table.grants = table.grants.filter((entry) => entry.id !== grant.id);
      if (!operation.remove)
        table.grants.push({
          ...structuredClone(grant),
          sourceSnapshot: grant.sourceId
            ? structuredClone(cardOf(table, grant.sourceId))
            : undefined,
        });
      card.manualKeywords = [
        ...new Set([
          ...retained,
          ...table.grants.filter((entry) => entry.cardId === card.id).map((entry) => entry.keyword),
        ]),
      ];
      break;
    }
    case 'resolve.begin':
      requireTable(
        table.resolution === null && table.stack.length > 0,
        '処理するStackがありません。',
      );
      table.resolution = structuredClone(table.stack[0]);
      break;
    case 'resolve.end': {
      requireTable(table.resolution, '処理中ではありません。');
      finishTableStack(table, table.resolution, operation.to);
      break;
    }
    case 'stack.remove': {
      const entry = table.stack.find((entry) => entry.id === operation.entryId);
      requireTable(entry, '取り除くStackが見つかりません。');
      finishTableStack(table, entry, operation.to);
      break;
    }
    case 'keep': {
      const seat = tableSeat(table, operation.seatId);
      requireTable(!seat.kept, 'キープ済みです。');
      const bottom = operation.bottom ?? [];
      // This EDH practice session explicitly offers one free mulligan.
      const count = Math.min(7, Math.max(0, seat.mulligans - 1));
      requireTable(
        bottom.length === count && bottom.every((id) => seat.zones.hand.includes(id)),
        '初手から戻すカードを選んでください。',
      );
      if (bottom.length) move(table, bottom, 'library', 'bottom');
      seat.kept = true;
      break;
    }
    case 'phase':
      requireTable(
        !table.hold && !table.combat && !table.resolution && table.stack.length === 0,
        '停止または未完の処理があります。',
      );
      table.phase =
        PHASE_ORDER[Math.min(PHASE_ORDER.length - 1, PHASE_ORDER.indexOf(table.phase) + 1)];
      break;
    case 'turn': {
      requireTable(
        !table.hold && !table.combat && !table.resolution && table.stack.length === 0,
        '停止または未完の処理があります。',
      );
      const currentIndex = table.seats.findIndex((seat) => seat.id === table.activeSeatId);
      const next = Array.from(
        { length: table.seats.length },
        (_, offset) => table.seats[(currentIndex + offset + 1) % table.seats.length],
      ).find((seat) => !seat.eliminated);
      requireTable(next, '参加中の席がありません。');
      table.activeSeatId = next.id;
      table.turn += 1;
      table.phase = 'untap';
      break;
    }
    default:
      throw new Error('未対応の操作です。');
  }
  return table;
}

export function createCockpitTable(
  deck: InitDeckCard[],
  seed: number,
  multiplayerDecks?: InitDeckCard[][],
): CockpitTable {
  requireTable(
    Array.isArray(deck) && deck.length > 0 && deck.length <= 500,
    'デッキの枚数を確認してください。',
  );
  const island: CardDef = {
    scryfallId: 'practice-island',
    oracleId: 'practice-island',
    name: 'Island',
    printedName: '島',
    lang: 'ja',
    layout: 'normal',
    cmc: 0,
    colorIdentity: ['U'],
    typeLine: 'Basic Land — Island',
    producedMana: ['U'],
    faces: [
      {
        name: 'Island',
        printedName: '島',
        typeLine: 'Basic Land — Island',
        oracleText: '({T}: Add {U}.)',
      },
    ],
  };
  const table: CockpitTable = {
    version: 1,
    defs: {},
    cards: {},
    seats: [],
    turn: 1,
    phase: 'untap',
    activeSeatId: 'P1',
    stack: [],
    resolution: null,
    grants: [],
    commanderCasts: {},
    modifiers: [],
    linkedExiles: [],
    visibility: {},
    combat: null,
    hold: false,
    ended: false,
  };
  const rng = createRng(seed);
  for (const [index, entries] of (
    multiplayerDecks ?? [
      deck,
      Array.from({ length: 100 }, () => ({ def: island, isCommander: false })),
    ]
  ).entries()) {
    const id = `P${index + 1}`;
    const seat: TableSeat = {
      id,
      label: multiplayerDecks ? `プレイヤー${index + 1}` : index === 0 ? 'あなた' : '受け身Bot',
      controller: multiplayerDecks || index === 0 ? 'human' : 'passive',
      life: 40,
      mana: emptyTableMana(),
      counters: {},
      commanderDamage: {},
      maximumHandSize: 7,
      zones: {
        library: [],
        hand: [],
        battlefield: [],
        graveyard: [],
        exile: [],
        command: [],
        stack: [],
      },
      kept: !multiplayerDecks && index !== 0,
      mulligans: 0,
      eliminated: false,
    };
    table.seats.push(seat);
    entries.forEach((entry, cardIndex) => {
      requireTable(
        entry.def &&
          typeof entry.def.scryfallId === 'string' &&
          entry.def.scryfallId.length > 0 &&
          !['__proto__', 'constructor', 'prototype'].includes(entry.def.scryfallId) &&
          Array.isArray(entry.def.faces) &&
          entry.def.faces.length > 0,
        '読込みできないカードがあります。',
      );
      requireTable(typeof entry.isCommander === 'boolean', '統率者の指定を確認してください。');
      assertCockpitCardDef(entry.def);
      const known = table.defs[entry.def.scryfallId];
      requireTable(
        !known || JSON.stringify(known) === JSON.stringify(entry.def),
        '同じカードIDの定義が一致しません。',
      );
      const cardId = `${id}c${cardIndex + 1}`;
      const zone = entry.isCommander ? 'command' : 'library';
      table.defs[entry.def.scryfallId] = structuredClone(entry.def);
      table.cards[cardId] = {
        id: cardId,
        defId: entry.def.scryfallId,
        zone,
        ownerId: id,
        controllerId: id,
        zoneChangeCounter: 0,
        tapped: false,
        faceIndex: 0,
        faceDown: false,
        counters: {},
        damageMarked: 0,
        hasDeathtouchDamage: false,
        isToken: false,
        isCommander: entry.isCommander,
        enteredTurn: 0,
      };
      seat.zones[zone].push(cardId);
    });
    seat.zones.library = shuffledOrder(seat.zones.library, rng);
    const hand = seat.zones.library.slice(0, Math.min(7, seat.zones.library.length));
    if (hand.length) move(table, hand, 'hand', 'bottom');
  }
  return table;
}

export function assertCockpitCardDef(def: CardDef): void {
  const text = (value: unknown, optional = false, max = 20000) =>
    (optional && value === undefined) || (typeof value === 'string' && value.length <= max);
  requireTable(
    def &&
      text(def.name, false, 500) &&
      text(def.printedName, true, 500) &&
      text(def.oracleId, false, 200) &&
      text(def.scryfallId, false, 200) &&
      text(def.typeLine) &&
      text(def.layout, false, 100) &&
      ['ja', 'en'].includes(def.lang) &&
      Number.isFinite(def.cmc) &&
      def.cmc >= 0,
    'カード定義を確認できません。',
  );
  requireTable(
    Array.isArray(def.colorIdentity) &&
      def.colorIdentity.every((color) => manaColors.includes(color as ManaColor)) &&
      (!def.producedMana ||
        (Array.isArray(def.producedMana) &&
          def.producedMana.every((color) => manaColors.includes(color)))) &&
      (!def.keywords ||
        (Array.isArray(def.keywords) && def.keywords.every((word) => text(word, false, 200)))),
    'カードの色・キーワード情報が不正です。',
  );
  requireTable(
    Array.isArray(def.faces) && def.faces.length > 0 && def.faces.length <= 8,
    'カードの面情報が不正です。',
  );
  for (const face of def.faces) {
    requireTable(
      face.colors === undefined ||
        (Array.isArray(face.colors) &&
          face.colors.every((color) => color !== 'C' && manaColors.includes(color))),
      'カードの色を確認してください。',
    );
    requireTable(
      face && text(face.name, false, 500) && text(face.typeLine),
      'カードの本文を確認できません。',
    );
    for (const field of [
      'printedName',
      'manaCost',
      'printedTypeLine',
      'oracleText',
      'printedText',
      'power',
      'toughness',
      'loyalty',
      'defense',
    ] as const)
      requireTable(text(face[field], true), 'カードの本文を確認できません。');
    for (const field of ['imageUrl', 'imageUrlSmall'] as const)
      requireTable(
        face[field] === undefined ||
          (typeof face[field] === 'string' && /^(https?:\/\/|\/[^/])/.test(face[field])),
        'カード画像の参照が不正です。',
      );
  }
}
