import {
  validateOnlineParticipantProjectionV1,
  type OnlineParticipantProjectionV1,
  type OnlineProjectedPlayerV1,
  type OnlineProjectedZoneEntryV1,
  type OnlineProjectedZoneV1,
} from '../projection/index';
import { TableDisplayProjectionErrorV1 } from './errors';
import {
  TABLE_DISPLAY_SCHEMA_VERSION_V1,
  type TableDisplayCardV1,
  type TableDisplayCounterV1,
  type TableDisplayManaV1,
  type TableDisplayPlayerSummaryV1,
  type TableDisplayViewV1,
  type TableDisplayZoneV1,
} from './types';

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function unavailable(): never {
  throw new TableDisplayProjectionErrorV1();
}

function counters(
  source: readonly Readonly<{ readonly kind: string; readonly count: number }>[],
): readonly TableDisplayCounterV1[] {
  return source.map((counter) => freezeDeep({ kind: counter.kind, count: counter.count }));
}

function card(entry: OnlineProjectedZoneEntryV1, zoneName: 'battlefield' | 'stack' | 'exile' | 'command'): TableDisplayCardV1 {
  if (entry.kind === 'hidden-card') return unavailable();

  if (entry.kind === 'concealed-object') {
    return freezeDeep({
      kind: 'concealed-card' as const,
      objectId: entry.objectId,
      label: '《裏向きのカード》' as const,
      tapped: entry.runtime.tapped,
      phasedOut: entry.runtime.phasedOut,
      counters: counters(entry.runtime.counters),
      markedDamage: entry.runtime.markedDamage,
    });
  }

  if (
    entry.objectKind === 'spell-copy' ||
    entry.objectKind === 'activated-ability' ||
    entry.objectKind === 'triggered-ability'
  ) {
    if (zoneName !== 'stack') return unavailable();
    const labels = {
      'spell-copy': '呪文のコピー',
      'activated-ability': '起動型能力',
      'triggered-ability': '誘発型能力',
    } as const;
    return freezeDeep({
      kind: 'stack-object' as const,
      objectId: entry.objectId,
      objectKind: entry.objectKind,
      label: labels[entry.objectKind],
      controllerPlayerId: entry.controllerPlayerId,
    });
  }

  if (entry.definition === null || entry.runtime === null || entry.runtime.faceIndex === null) return unavailable();
  const face = entry.definition.faces[entry.runtime.faceIndex];
  if (face === undefined) return unavailable();
  return freezeDeep({
    kind: 'visible-card' as const,
    objectId: entry.objectId,
    label: `《${entry.definition.name}》`,
    typeLine: face.typeLine,
    ownerPlayerId: entry.ownerPlayerId,
    controllerPlayerId: entry.controllerPlayerId,
    commander: entry.commander,
    tapped: entry.runtime.tapped,
    phasedOut: entry.runtime.phasedOut,
    counters: counters(entry.runtime.counters),
    markedDamage: entry.runtime.markedDamage,
  });
}

function zone(source: OnlineProjectedZoneV1, zoneName: 'battlefield' | 'stack' | 'exile' | 'command'): TableDisplayZoneV1 {
  if (source.count !== source.entries.length) return unavailable();
  return freezeDeep({ count: source.count, cards: source.entries.map((entry) => card(entry, zoneName)) });
}

function mana(source: OnlineProjectedPlayerV1['manaPool']): TableDisplayManaV1 {
  return freezeDeep({ W: source.W, U: source.U, B: source.B, R: source.R, G: source.G, C: source.C });
}

function tablePresence(projection: OnlineParticipantProjectionV1): 'connected' | 'disconnected' {
  if (projection.role !== 'table' || projection.corePlayerId !== null) return unavailable();
  const audience = projection.room.participants.filter((participant) => participant.participantId === projection.participantId);
  const participant = audience[0];
  if (
    audience.length !== 1 ||
    participant === undefined ||
    participant.role !== 'table' ||
    participant.seatIndex !== null
  ) return unavailable();
  return participant.presence;
}

function playerSummaries(projection: OnlineParticipantProjectionV1): readonly TableDisplayPlayerSummaryV1[] {
  const { turnOrder, players, zones } = projection.game;
  const { seats, participants } = projection.room;
  if (turnOrder.length !== 4 || players.length !== 4 || seats.length !== 4 || zones.byPlayer.length !== 4) return unavailable();

  return turnOrder.map((playerId, index) => {
    const player = players[index];
    const seat = seats[index];
    const playerZones = zones.byPlayer[index];
    if (
      player === undefined ||
      seat === undefined ||
      playerZones === undefined ||
      player.playerId !== playerId ||
      seat.seatIndex !== index ||
      seat.corePlayerId !== playerId ||
      playerZones.playerId !== playerId ||
      seat.participantId === null
    ) return unavailable();
    const matches = participants.filter((participant) => participant.participantId === seat.participantId);
    const participant = matches[0];
    if (
      matches.length !== 1 ||
      participant === undefined ||
      participant.role !== 'player' ||
      participant.seatIndex !== seat.seatIndex
    ) return unavailable();
    return freezeDeep({
      playerId,
      seatIndex: seat.seatIndex,
      isActive: playerId === projection.game.turn.activePlayerId,
      presence: participant.presence,
      outcome: seat.outcome,
      life: player.life,
      poison: player.poison,
      energy: player.energy,
      experience: player.experience,
      mana: mana(player.manaPool),
      status: player.status,
      handCount: playerZones.zones.hand.count,
      libraryCount: playerZones.zones.library.count,
      graveyardCount: playerZones.zones.graveyard.count,
    });
  });
}

export function buildTableDisplayViewV1(input: unknown): TableDisplayViewV1 {
  try {
    const firstValidation = validateOnlineParticipantProjectionV1(input);
    if (!firstValidation.ok) return unavailable();
    const secondValidation = validateOnlineParticipantProjectionV1(firstValidation.value);
    if (!secondValidation.ok) return unavailable();
    const projection = secondValidation.value;
    const presence = tablePresence(projection);
    return freezeDeep({
      kind: 'table-display-view-v1' as const,
      schemaVersion: TABLE_DISPLAY_SCHEMA_VERSION_V1,
      revision: projection.revision,
      roomLifecycle: projection.room.lifecycle,
      tablePresence: presence,
      turn: {
        activePlayerId: projection.game.turn.activePlayerId,
        turnNumber: projection.game.turn.turnNumber,
        phase: projection.game.turn.position.phase,
        step: projection.game.turn.position.step,
      },
      players: playerSummaries(projection),
      zones: {
        battlefield: zone(projection.game.zones.battlefield, 'battlefield'),
        stack: zone(projection.game.zones.stack, 'stack'),
        exile: zone(projection.game.zones.exile, 'exile'),
        command: zone(projection.game.zones.command, 'command'),
      },
    });
  } catch {
    return unavailable();
  }
}
