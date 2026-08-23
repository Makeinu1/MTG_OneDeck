import { describe, expect, it } from 'vitest';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { projectOnlineVariableProtocolV2 } from '../../projection/index';
import { validateOnlineVariableProtocolStateV2 } from '../../protocol/index';
import {
  buildVariableRoomGenesisV3,
  type VariableGenesisInputV3,
  type VariableGenesisSeatInputV3,
} from '../index';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function definition(): CardDef {
  return Object.freeze({
    scryfallId: SID, oracleId: OID, name: 'Variable Review Card', lang: 'en',
    layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Artifact',
    faces: [{ name: 'Variable Review Card', typeLine: 'Artifact', oracleText: '' }],
  });
}

function seat(index: number, total: number): VariableGenesisSeatInputV3 {
  const entries = Object.freeze([Object.freeze({
    index: 0, section: 'main' as const, quantity: total,
    scryfallId: SID, oracleId: OID, definition: definition(),
  })]);
  const serialized = JSON.stringify({ entries });
  const digest = coreSha256HexV1(serialized);
  return Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: `participant-o4p08c-${index + 1}`,
    seatCapability: `seat_${String(index + 1).repeat(40)}`,
    snapshot: Object.freeze({ entries, serialized, digest }),
  });
}

function input(
  playerCount: 2 | 4,
  startingLife: 20 | 40,
  totals: readonly number[],
): VariableGenesisInputV3 {
  return Object.freeze({
    roomId: `room-o4p08c-${playerCount}-${startingLife}`,
    serverBuildId: 'o4p-08c-review-build',
    configuration: Object.freeze({ playerCount, startingLife }),
    seats: Object.freeze(totals.map((total, index) => seat(index, total))),
    tableParticipantId: 'table-o4p08c-review',
    tableCapability: `observer_${'T'.repeat(40)}`,
  });
}

describe('O4P-08C Judge: exact variable roster genesis and replay', () => {
  it.each([[20, [40, 60]], [40, [100, 40]]] as const)(
    'builds two-player %i life with arbitrary totals and no phantom P3/P4',
    (startingLife, totals) => {
      const result = buildVariableRoomGenesisV3(input(2, startingLife, totals));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected two-player variable genesis');
      const root = result.coreRoot;
      const registry = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
      expect(Object.keys(registry.players)).toEqual(['P1', 'P2']);
      expect(registry.turnOrder).toEqual(['P1', 'P2']);
      expect(Object.keys(registry.zones.byPlayer)).toEqual(['P1', 'P2']);
      expect(root.playerLifecycle.players.map((entry) => entry.playerId)).toEqual(['P1', 'P2']);
      expect(root.commanderDamage.defendingPlayerIds).toEqual(['P1', 'P2']);
      expect(root.commanderDamageProvenance.defendingPlayerIds).toEqual(['P1', 'P2']);
      expect(Object.values(registry.players).map((player) => player.life)).toEqual([
        startingLife, startingLife,
      ]);
      expect(root.commanders).toEqual([]);
      expect(result.room.configuration).toEqual({ playerCount: 2, startingLife });
      expect(result.room.seats).toHaveLength(2);
      expect(result.room.participants.filter((entry) => entry.role === 'player')).toHaveLength(2);
      expect(result.protocolState.configuration).toEqual(result.room.configuration);
      const projection = projectOnlineVariableProtocolV2(
        result.protocolState,
        'participant-o4p08c-1',
      );
      expect(projection.game.turnOrder).toEqual(['P1', 'P2']);
      expect(projection.game.players.map((entry) => entry.playerId)).toEqual(['P1', 'P2']);
      expect(projectOnlineVariableProtocolV2(
        result.protocolState,
        'table-o4p08c-review',
      )).toMatchObject({ participantId: 'table-o4p08c-review' });
      expect(() => projectOnlineVariableProtocolV2(
        result.protocolState,
        'participant-o4p08c-unknown',
      )).toThrow('Participant not found');
      expect(JSON.stringify({ root, projection })).not.toMatch(/"P[34]"/);
      expect(result.replay).toMatchObject({ ok: true, finalStateDigest: result.coreDigest });
      if (result.replay.ok) expect(result.replay.finalRoot).toEqual(root);
    },
  );

  it('preserves four-player 40 and rejects invalid four-player 20', () => {
    const four = buildVariableRoomGenesisV3(input(4, 40, [40, 60, 100, 40]));
    expect(four.ok).toBe(true);
    if (!four.ok) throw new Error('Expected four-player variable genesis');
    const registry = four.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.turnOrder).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(Object.values(registry.players).map((player) => player.life)).toEqual([40, 40, 40, 40]);
    expect(four.room.seats).toHaveLength(4);
    expect(buildVariableRoomGenesisV3(input(4, 20, [40, 40, 40, 40]))).toMatchObject({
      ok: false,
      issues: [{ code: 'INVALID_INPUT' }],
    });
  });

  it('rejects persisted protocol state whose Core roster exceeds the configured seats', () => {
    const result = buildVariableRoomGenesisV3(input(2, 20, [40, 60]));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected two-player variable genesis');
    const malformed: unknown = JSON.parse(JSON.stringify(result.protocolState));
    const protocol = malformed as Record<string, unknown>;
    const coreRoot = protocol.coreRoot as Record<string, unknown>;
    const ruleAuthority = coreRoot.ruleAuthority as Record<string, unknown>;
    const turnPriorityBundle = ruleAuthority.turnPriorityBundle as Record<string, unknown>;
    const stackBundle = turnPriorityBundle.stackBundle as Record<string, unknown>;
    const registry = stackBundle.objectRegistry as Record<string, unknown>;
    Reflect.set(registry, 'turnOrder', ['P1', 'P2', 'P3']);
    expect(validateOnlineVariableProtocolStateV2(malformed)).toMatchObject({
      ok: false,
      issues: [{ code: 'INVALID_PROTOCOL_STATE' }],
    });
  });

  it('fails closed on extra fields, contradictory snapshot aliases, and partial table authority', () => {
    const base = input(2, 20, [40, 60]);
    expect(buildVariableRoomGenesisV3({ ...base, unexpected: true } as unknown as VariableGenesisInputV3)).toMatchObject({ ok: false });
    const firstSeat = base.seats[0];
    const otherSeat = input(2, 20, [100, 60]).seats[0];
    if (firstSeat === undefined || otherSeat?.snapshot === undefined) throw new Error('Missing review seat');
    expect(buildVariableRoomGenesisV3({
      ...base,
      seats: [{ ...firstSeat, unexpected: true }, base.seats[1]],
    } as unknown as VariableGenesisInputV3)).toMatchObject({ ok: false });
    expect(buildVariableRoomGenesisV3({
      ...base,
      seats: [{ ...firstSeat, acceptedSnapshot: otherSeat.snapshot }, base.seats[1]],
    })).toMatchObject({ ok: false });
    expect(buildVariableRoomGenesisV3({
      roomId: base.roomId,
      serverBuildId: base.serverBuildId,
      configuration: base.configuration,
      seats: base.seats,
      tableParticipantId: 'table-without-capability',
    })).toMatchObject({ ok: false });
    const snapshotWithExtra = { ...firstSeat.snapshot, unexpectedSnapshot: true };
    expect(buildVariableRoomGenesisV3({
      ...base,
      seats: [{ ...firstSeat, snapshot: snapshotWithExtra }, base.seats[1]],
    } as unknown as VariableGenesisInputV3)).toMatchObject({ ok: false });
    const snapshot = firstSeat.snapshot;
    if (snapshot === undefined || snapshot.entries[0] === undefined) throw new Error('Missing review snapshot');
    const entryWithExtra = { ...snapshot.entries[0], unexpectedEntry: true };
    const entriesWithExtra = [entryWithExtra];
    const serializedWithExtra = JSON.stringify({ entries: entriesWithExtra });
    expect(buildVariableRoomGenesisV3({
      ...base,
      seats: [{
        ...firstSeat,
        snapshot: {
          entries: entriesWithExtra,
          serialized: serializedWithExtra,
          digest: coreSha256HexV1(serializedWithExtra),
        },
      }, base.seats[1]],
    })).toMatchObject({ ok: false });
    expect(buildVariableRoomGenesisV3({
      ...base,
      seats: [{ ...firstSeat, revision: 'bad' }, base.seats[1]],
    } as unknown as VariableGenesisInputV3)).toMatchObject({ ok: false });
  });
});
