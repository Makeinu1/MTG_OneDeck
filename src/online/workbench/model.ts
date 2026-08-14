import {
  validateOnlineParticipantProjectionV1,
  type OnlineParticipantProjectionV1,
  type OnlineProjectedPlayerV1,
  type OnlineProjectedZoneEntryV1,
  type OnlineProjectedZoneV1,
} from '../projection/index';
import { PersonalWorkbenchProjectionErrorV1 } from './errors';
import {
  PERSONAL_WORKBENCH_SCHEMA_VERSION_V1,
  type PersonalWorkbenchCardV1,
  type PersonalWorkbenchCounterV1,
  type PersonalWorkbenchManaV1,
  type PersonalWorkbenchPlayerSummaryV1,
  type PersonalWorkbenchViewV1,
  type PersonalWorkbenchZoneV1,
} from './types';

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function unavailable(): never {
  throw new PersonalWorkbenchProjectionErrorV1();
}

function counters(
  source: readonly Readonly<{ readonly kind: string; readonly count: number }>[],
): readonly PersonalWorkbenchCounterV1[] {
  return source.map((counter) => freezeDeep({ kind: counter.kind, count: counter.count }));
}

function card(entry: OnlineProjectedZoneEntryV1, allowStackObject: boolean): PersonalWorkbenchCardV1 {
  if (entry.kind === 'hidden-card') return freezeDeep({ kind: 'hidden-card' as const });

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
    allowStackObject &&
    (entry.objectKind === 'spell-copy' ||
      entry.objectKind === 'activated-ability' ||
      entry.objectKind === 'triggered-ability')
  ) {
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

  if (entry.definition === null || entry.runtime === null || entry.runtime.faceIndex === null) {
    return unavailable();
  }
  const face = entry.definition.faces[entry.runtime.faceIndex];
  if (face === undefined) return unavailable();
  return freezeDeep({
    kind: 'visible-card' as const,
    objectId: entry.objectId,
    label: `《${entry.definition.name}》`,
    typeLine: face.typeLine,
    manaCost: face.manaCost,
    oracleText: face.oracleText,
    ownerPlayerId: entry.ownerPlayerId,
    controllerPlayerId: entry.controllerPlayerId,
    commander: entry.commander,
    tapped: entry.runtime.tapped,
    phasedOut: entry.runtime.phasedOut,
    counters: counters(entry.runtime.counters),
    markedDamage: entry.runtime.markedDamage,
  });
}

function zone(source: OnlineProjectedZoneV1, allowStackObject = false): PersonalWorkbenchZoneV1 {
  return freezeDeep({
    count: source.count,
    cards: source.entries.map((entry) => card(entry, allowStackObject)),
  });
}

function mana(source: OnlineProjectedPlayerV1['manaPool']): PersonalWorkbenchManaV1 {
  return freezeDeep({
    W: source.W,
    U: source.U,
    B: source.B,
    R: source.R,
    G: source.G,
    C: source.C,
  });
}

function ownParticipant(projection: OnlineParticipantProjectionV1): Readonly<{
  readonly seatIndex: number;
  readonly presence: string;
  readonly outcome: string;
}> {
  if (projection.role !== 'player' || projection.corePlayerId === null) return unavailable();
  const participants = projection.room.participants.filter(
    (participant) => participant.participantId === projection.participantId,
  );
  if (
    participants.length !== 1 ||
    participants[0]?.role !== 'player' ||
    participants[0].presence !== 'connected' ||
    participants[0].seatIndex === null
  ) return unavailable();

  const seats = projection.room.seats.filter(
    (seat) => seat.participantId === projection.participantId && seat.corePlayerId === projection.corePlayerId,
  );
  const seat = seats[0];
  if (
    seats.length !== 1 ||
    seat === undefined ||
    seat.seatIndex !== participants[0].seatIndex ||
    seat.outcome !== 'pending' ||
    (projection.room.lifecycle !== 'active' && projection.room.lifecycle !== 'finished')
  ) return unavailable();

  return freezeDeep({ seatIndex: seat.seatIndex, presence: participants[0].presence, outcome: seat.outcome });
}

function playerSummaries(projection: OnlineParticipantProjectionV1): readonly PersonalWorkbenchPlayerSummaryV1[] {
  if (projection.corePlayerId === null) return unavailable();
  return projection.game.turnOrder.map((playerId) => {
    const player = projection.game.players.find((candidate) => candidate.playerId === playerId);
    const playerZones = projection.game.zones.byPlayer.find((candidate) => candidate.playerId === playerId);
    if (player === undefined || playerZones === undefined) return unavailable();
    return freezeDeep({
      playerId,
      isSelf: playerId === projection.corePlayerId,
      isActive: playerId === projection.game.turn.activePlayerId,
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

export function buildPersonalWorkbenchViewV1(input: unknown): PersonalWorkbenchViewV1 {
  const validated = validateOnlineParticipantProjectionV1(input);
  if (!validated.ok) return unavailable();

  const projection = validated.value;
  const participant = ownParticipant(projection);
  if (projection.corePlayerId === null) return unavailable();
  const ownZones = projection.game.zones.byPlayer.find(
    (entry) => entry.playerId === projection.corePlayerId,
  );
  if (ownZones === undefined) return unavailable();

  return freezeDeep({
    kind: 'personal-workbench-view-v1' as const,
    schemaVersion: PERSONAL_WORKBENCH_SCHEMA_VERSION_V1,
    revision: projection.revision,
    corePlayerId: projection.corePlayerId,
    seatIndex: participant.seatIndex,
    roomLifecycle: projection.room.lifecycle,
    presence: participant.presence,
    outcome: participant.outcome,
    turn: {
      activePlayerId: projection.game.turn.activePlayerId,
      turnNumber: projection.game.turn.turnNumber,
      phase: projection.game.turn.position.phase,
      step: projection.game.turn.position.step,
    },
    players: playerSummaries(projection),
    zones: {
      ownHand: zone(ownZones.zones.hand),
      ownLibraryCount: ownZones.zones.library.count,
      ownGraveyard: zone(ownZones.zones.graveyard),
      battlefield: zone(projection.game.zones.battlefield),
      stack: zone(projection.game.zones.stack, true),
      exile: zone(projection.game.zones.exile),
      command: zone(projection.game.zones.command),
    },
    authorityCounts: {
      visibilityGrants: projection.game.visibilityGrants.length,
      searchSessions: projection.game.searchSessions.length,
      playPermissions: projection.game.playPermissions.length,
    },
  });
}
