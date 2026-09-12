import {
  createCockpitTable,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import type { InitDeckCard } from '../../engine/init';
import type { ZoneId } from '../../engine/types';

export const COCKPIT_PRESENCE_MS = 30_000;
export interface CockpitMember {
  token: string;
  connectionId: string;
  lastSeen: number;
  kicked: boolean;
  peek: { seatId: string; zone: 'hand' | 'library' } | null;
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
  | { type: 'peek'; seatId: string; zone: 'hand' | 'library' | null }
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
    if (result.defs[id] && JSON.stringify(result.defs[id]) !== JSON.stringify(def))
      throw new Error('CARD_DEFINITION_CONFLICT');
    result.defs[id] = def;
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
      seat.zones[zone] = seat.zones[zone].filter((id) => {
        const permitted =
          !['hand', 'library'].includes(zone) ||
          (zone === 'hand' && seat.id === actor) ||
          (peek?.seatId === seat.id && peek.zone === zone) ||
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
  for (const card of Object.values(projected.cards)) {
    if (
      card.faceDown &&
      card.controllerId !== actor &&
      !table.visibility[card.id]?.includes(actor)
    ) {
      projected.cards[card.id] = {
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
      };
    }
    // Nested legacy selections may retain private snapshots. The shared Stack carries its own public context.
    delete projected.cards[card.id].sourceSnapshot;
    delete projected.cards[card.id].targetSelections;
    knownDefs.add(projected.cards[card.id].defId);
  }
  for (const entry of [
    ...projected.stack,
    ...(projected.resolution ? [projected.resolution] : []),
  ]) {
    knownDefs.add(entry.source.defId);
    delete entry.source.sourceSnapshot;
    delete entry.source.targetSelections;
    if (entry.targetSnapshots)
      entry.targetSnapshots = Object.fromEntries(
        Object.entries(entry.targetSnapshots)
          .filter(([id]) => visible.has(id))
          .map(([id, snapshot]) => [
            id,
            projected.cards[id]?.defId === 'cockpit-hidden' ? projected.cards[id] : snapshot,
          ]),
      );
    for (const snapshot of Object.values(entry.targetSnapshots ?? {}))
      knownDefs.add(snapshot.defId);
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
  if (operation.type === 'redo' || operation.type === 'hold') return false;
  if (
    multi.holds.length &&
    [
      'turn',
      'phase',
      'shortcut',
      'resolve.begin',
      'resolve.end',
      'battle.apply',
      'battle.attack',
      'undo',
    ].includes(operation.type)
  )
    return false;
  if (actor === multi.masterId) return true;
  return operation.type === 'battle.block' && operation.defendingSeatId === actor;
}
