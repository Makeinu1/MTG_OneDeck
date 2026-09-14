import { sameCockpitCardDefinition } from '../../engine/cockpitCardIdentity';
import {
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import type { InitDeckCard } from '../../engine/init';
import type { CardInstance, ZoneId } from '../../engine/types';

export const COCKPIT_PRESENCE_MS = 30_000;
export interface CockpitMember {
  token: string;
  connectionId: string;
  lastSeen: number;
  kicked: boolean;
  peek: { seatId: string; zone: 'hand' | 'library'; count?: number } | null;
}
export interface CockpitMultiplayer {
  invitation: string;
  members: Record<string, CockpitMember>;
  started: boolean;
  masterId: string;
  holds: string[];
  borrowedFrom: string | null;
}
export type CockpitControl =
  | { type: 'start' }
  | { type: 'hold'; held: boolean }
  | { type: 'grant'; seatId: string }
  | { type: 'return' }
  | { type: 'reclaim' }
  | { type: 'peek'; seatId: string; zone: 'hand' | 'library' | null; count?: number }
  | { type: 'kick'; seatId: string }
  | { type: 'eliminate'; seatId: string };
export interface CockpitMultiplayerView {
  ownSeatId: string;
  ownerId: string;
  masterId: string;
  started: boolean;
  paused: boolean;
  holds: string[];
  borrowedFrom: string | null;
  canOperate: boolean;
  invitation: string | null;
  members: { seatId: string; connected: boolean; kicked: boolean }[];
  counts: Record<string, Record<ZoneId, number>>;
  peek: CockpitMember['peek'];
}
export function cockpitActor(multi: CockpitMultiplayer, token: string): string | undefined {
  return Object.keys(multi.members).find(
    (id) => multi.members[id].token === token && !multi.members[id].kicked,
  );
}
export function cockpitOwnerPresent(multi: CockpitMultiplayer, now: number): boolean {
  return now - multi.members.P1.lastSeen < COCKPIT_PRESENCE_MS;
}
export function addCockpitDeck(
  table: CockpitTable,
  deck: InitDeckCard[],
  seatId: string,
  seed: number,
): CockpitTable {
  const index = table.seats.findIndex((seat) => seat.id === seatId);
  if (index < 0 || table.seats[index].zones.library.length || table.seats[index].zones.hand.length)
    throw new Error('SEAT_UNAVAILABLE');
  const built = createCockpitTable(
    deck,
    seed,
    table.seats.map((_, i) => (i === index ? deck : [])),
  );
  const result = structuredClone(table);
  for (const [id, def] of Object.entries(built.defs)) {
    if (result.defs[id] && !sameCockpitCardDefinition(result.defs[id], def))
      throw new Error('CARD_DEFINITION_CONFLICT');
    result.defs[id] ??= def;
  }
  Object.assign(result.cards, built.cards);
  result.seats[index] = built.seats[index];
  return result;
}

/** Only the addressed audience is serialized; hidden card identities and deck definitions never leave storage. */
export function projectCockpit(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  now: number,
): { table: CockpitTable; multiplayer: CockpitMultiplayerView } {
  const projected = structuredClone(table);
  projected.hold ||= multi.holds.length > 0;
  const peek =
    multi.masterId === actor && !table.seats.find((s) => s.id === actor)?.eliminated
      ? multi.members[actor].peek
      : null;
  const visible = new Set<string>();
  const counts = Object.fromEntries(
    table.seats.map((seat) => [
      seat.id,
      Object.fromEntries(Object.entries(seat.zones).map(([zone, ids]) => [zone, ids.length])),
    ]),
  ) as CockpitMultiplayerView['counts'];
  for (const seat of projected.seats) {
    for (const zone of Object.keys(seat.zones) as ZoneId[]) {
      seat.zones[zone] = seat.zones[zone].filter((id, index) => {
        const permitted =
          !['hand', 'library'].includes(zone) ||
          (zone === 'hand' && seat.id === actor) ||
          (peek?.seatId === seat.id &&
            peek.zone === zone &&
            (peek.count === undefined || index < peek.count)) ||
          table.visibility[id]?.includes(actor);
        if (permitted) visible.add(id);
        return permitted;
      });
    }
  }
  projected.cards = Object.fromEntries(
    Object.entries(projected.cards).filter(([id]) => visible.has(id)),
  );
  const knownDefs = new Set<string>();
  // Historical public sources remain public after moving. A hidden historical
  // source is masked independently of whether its current physical card is visible.
  const present = (card: CardInstance, privateRead = false): CardInstance => {
    const hiddenFace =
      card.faceDown && card.controllerId !== actor && !table.visibility[card.id]?.includes(actor);
    const hiddenZone =
      !privateRead &&
      ['hand', 'library'].includes(card.zone) &&
      card.ownerId !== actor &&
      !table.visibility[card.id]?.includes(actor);
    const result: CardInstance =
      hiddenFace || hiddenZone
        ? {
            id: card.id,
            defId: 'cockpit-hidden',
            zone: card.zone,
            ownerId: card.ownerId,
            controllerId: card.controllerId,
            zoneChangeCounter: card.zoneChangeCounter,
            tapped: card.tapped,
            faceIndex: 0,
            faceDown: true,
            counters: card.counters,
            damageMarked: card.damageMarked,
            hasDeathtouchDamage: card.hasDeathtouchDamage,
            isToken: card.isToken,
            isCommander: false,
            enteredTurn: card.enteredTurn,
          }
        : { ...card };
    // These legacy envelopes can contain nested snapshots and card definitions.
    // The public stack entry already has its effect, costs and selected targets.
    delete result.sourceSnapshot;
    delete result.targetSelections;
    delete result.activationEnvelope;
    delete result.triggerCondition;
    knownDefs.add(result.defId);
    return result;
  };
  for (const card of Object.values(projected.cards)) {
    // The current authorized peek may show private-zone cards to its holder.
    const authorized = peek?.seatId === card.ownerId && peek.zone === card.zone;
    projected.cards[card.id] = present(card, authorized);
  }
  for (const entry of [
    ...projected.stack,
    ...(projected.resolution ? [projected.resolution] : []),
  ]) {
    entry.source = present(entry.source);
    if (entry.targetSnapshots)
      entry.targetSnapshots = Object.fromEntries(
        Object.entries(entry.targetSnapshots).map(([id, snapshot]) => [id, present(snapshot)]),
      );
  }
  if (projected.triggers) {
    // Detection reads the full table. Clients receive only permitted candidate context.
    projected.triggers.events = [];
    projected.triggers.ledger = { turn: table.turn, consumedKeys: [] };
    projected.triggers.drawn = {};
    projected.triggers.sequence = 0;
    projected.triggers.feed = (projected.triggers.feed ?? []).map((item, seq) => ({
      ...item,
      seq,
    }));
    projected.triggers.candidates = projected.triggers.candidates
      .filter(
        (candidate) =>
          !candidate.source.faceDown &&
          (!['hand', 'library'].includes(candidate.source.zone) ||
            candidate.controllerId === actor),
      )
      .map((candidate) => {
        candidate.source = present(candidate.source);
        return candidate;
      });
  }
  projected.grants = projected.grants
    .filter((grant) => visible.has(grant.cardId))
    .map((grant) => ({ ...grant, sourceSnapshot: undefined }));
  projected.modifiers = projected.modifiers
    .filter((modifier) => visible.has(modifier.cardId))
    .map((modifier) => ({ ...modifier, sourceSnapshot: undefined }));
  projected.linkedExiles = projected.linkedExiles.flatMap((link) => {
    const indices = link.exiledPhysicalIds
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => visible.has(id));
    if (
      !indices.length ||
      !visible.has(link.sourcePhysicalId) ||
      projected.cards[link.sourcePhysicalId]?.defId === 'cockpit-hidden'
    )
      return [];
    knownDefs.add(link.snapshot.defId);
    return [
      {
        ...link,
        exiledPhysicalIds: indices.map(({ id }) => id),
        exiledObjectIds: indices.map(({ index }) => link.exiledObjectIds[index]),
      },
    ];
  });
  projected.visibility = Object.fromEntries(
    Object.entries(projected.visibility).filter(([id]) => visible.has(id)),
  );
  projected.commanderCasts = Object.fromEntries(
    Object.entries(projected.commanderCasts).filter(([id]) => visible.has(id)),
  );
  projected.defs = Object.fromEntries(
    Object.entries(projected.defs).filter(([id]) => knownDefs.has(id)),
  );
  if (knownDefs.has('cockpit-hidden'))
    projected.defs['cockpit-hidden'] = {
      scryfallId: 'cockpit-hidden',
      oracleId: 'cockpit-hidden',
      name: '非公開カード',
      lang: 'ja',
      layout: 'normal',
      cmc: 0,
      colorIdentity: [],
      typeLine: '',
      faces: [{ name: '非公開カード', typeLine: '', oracleText: '' }],
    };
  const paused = !cockpitOwnerPresent(multi, now);
  return {
    table: projected,
    multiplayer: {
      ownSeatId: actor,
      ownerId: 'P1',
      masterId: multi.masterId,
      started: multi.started,
      paused,
      holds: [...multi.holds],
      borrowedFrom: multi.borrowedFrom,
      canOperate:
        multi.started &&
        !paused &&
        multi.masterId === actor &&
        !table.ended &&
        !table.seats.find((s) => s.id === actor)?.eliminated,
      invitation: actor === 'P1' && !multi.started ? multi.invitation : null,
      members: Object.entries(multi.members).map(([seatId, member]) => ({
        seatId,
        connected: !member.kicked && now - member.lastSeen < COCKPIT_PRESENCE_MS,
        kicked: member.kicked,
      })),
      counts,
      peek,
    },
  };
}

export function authorizeCockpitOperation(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  operation: TableOperation | { type: 'undo' } | { type: 'redo' },
  now: number,
): boolean {
  if (
    !cockpitOwnerPresent(multi, now) ||
    table.ended ||
    table.seats.find((s) => s.id === actor)?.eliminated
  )
    return false;
  if (!multi.started)
    return (
      (operation.type === 'keep' || operation.type === 'mulligan') && operation.seatId === actor
    );
  if (operation.type === 'redo' || operation.type === 'hold' || operation.type === 'turn.ready')
    return false;
  if (
    multi.holds.length &&
    [
      'turn',
      'phase',
      'shortcut',
      'turn.ready',
      'resolve.finish',
      'resolve.fetch',
      'resolve.begin',
      'resolve.end',
      'battle.apply',
      'battle.attack',
      'undo',
      'trigger.place',
      'trigger.link',
    ].includes(operation.type)
  )
    return false;
  if (actor === multi.masterId) return true;
  return operation.type === 'battle.block' && operation.defendingSeatId === actor;
}
