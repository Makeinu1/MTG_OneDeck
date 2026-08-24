import { describe, expect, it } from 'vitest';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { buildOnlineDisplayPairingViewV1 } from '../../displayPairing/index';
import { buildVariableRoomGenesisV3, type VariableGenesisSeatInputV3 } from '../../genesis/index';
import { buildOnlineGuidedActionsViewV1 } from '../../guidedActions/index';
import { buildTableDisplayViewV1 } from '../../tableDisplay/index';
import { buildPersonalWorkbenchViewV1 } from '../../workbench/index';
import {
  projectOnlineVariableProtocolV3,
  validateOnlineParticipantProjectionV3,
} from '../index';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function definition(): CardDef {
  return Object.freeze({
    scryfallId: SID,
    oracleId: OID,
    name: 'O4P-08D Review Card',
    lang: 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{ name: 'O4P-08D Review Card', typeLine: 'Artifact', oracleText: '' }],
  });
}

function seat(index: number): VariableGenesisSeatInputV3 {
  const entries = Object.freeze([Object.freeze({
    index: 0,
    section: 'main' as const,
    quantity: 40,
    scryfallId: SID,
    oracleId: OID,
    definition: definition(),
  })]);
  const serialized = JSON.stringify({ entries });
  return Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: `participant-o4p08d-${index + 1}`,
    seatCapability: `seat_${String(index + 1).repeat(40)}`,
    snapshot: Object.freeze({ entries, serialized, digest: coreSha256HexV1(serialized) }),
  });
}

function genesis(playerCount: 2 | 4, startingLife: 20 | 40) {
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: `room-o4p08d-${playerCount}-${startingLife}`,
    serverBuildId: 'o4p-08d-review-build',
    configuration: Object.freeze({ playerCount, startingLife }),
    seats: Object.freeze(Array.from({ length: playerCount }, (_, index) => seat(index))),
    tableParticipantId: 'table-o4p08d-review',
    tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected variable genesis');
  return result;
}

describe('O4P-08D Judge: full exact-roster browser surfaces', () => {
  it.each([20, 40] as const)(
    'renders exactly one opponent and no P3/P4 for two-player %i life',
    (startingLife) => {
      const result = genesis(2, startingLife);
      const personal = projectOnlineVariableProtocolV3(
        result.protocolState,
        'participant-o4p08d-1',
      );
      const table = projectOnlineVariableProtocolV3(
        result.protocolState,
        'table-o4p08d-review',
      );
      expect(validateOnlineParticipantProjectionV3(personal)).toMatchObject({ ok: true });
      expect(validateOnlineParticipantProjectionV3(table)).toMatchObject({ ok: true });
      expect(personal.configuration).toEqual({ playerCount: 2, startingLife });
      expect(personal.game.turnOrder).toEqual(['P1', 'P2']);

      const workbench = buildPersonalWorkbenchViewV1(personal);
      const tableView = buildTableDisplayViewV1(table);
      const pairing = buildOnlineDisplayPairingViewV1({
        personalProjection: personal,
        tableProjection: table,
        focusedPlayerId: 'P2',
      });
      const guided = buildOnlineGuidedActionsViewV1(personal);
      expect(workbench.players.map((player) => player.playerId)).toEqual(['P1', 'P2']);
      expect(tableView.players.map((player) => player.playerId)).toEqual(['P1', 'P2']);
      expect(pairing.opponents.map((player) => player.playerId)).toEqual(['P2']);
      expect(guided.players.map((player) => player.playerId)).toEqual(['P1', 'P2']);
      expect(guided.combat.defendingPlayers.map((player) => player.playerId)).toEqual(['P2']);
      expect(JSON.stringify({ personal, table, workbench, tableView, pairing, guided }))
        .not.toMatch(/"P[34]"/);
      expect(JSON.stringify({ personal, table })).not.toMatch(
        /(?:seat|invite|admission|observer)_[A-Za-z0-9_-]{8}/,
      );
    },
  );

  it('preserves the exact four-player 40 surface order', () => {
    const result = genesis(4, 40);
    const personal = projectOnlineVariableProtocolV3(result.protocolState, 'participant-o4p08d-1');
    const table = projectOnlineVariableProtocolV3(result.protocolState, 'table-o4p08d-review');
    expect(buildPersonalWorkbenchViewV1(personal).players.map((player) => player.playerId))
      .toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(buildTableDisplayViewV1(table).players.map((player) => player.playerId))
      .toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(buildOnlineDisplayPairingViewV1({
      personalProjection: personal,
      tableProjection: table,
      focusedPlayerId: null,
    }).opponents.map((player) => player.playerId)).toEqual(['P2', 'P3', 'P4']);
  });

  it('fails closed when configuration and exact roster disagree', () => {
    const result = genesis(2, 20);
    const projection: unknown = JSON.parse(JSON.stringify(
      projectOnlineVariableProtocolV3(result.protocolState, 'participant-o4p08d-1'),
    ));
    const mutable = projection as { configuration: { playerCount: number } };
    mutable.configuration.playerCount = 4;
    expect(validateOnlineParticipantProjectionV3(projection)).toMatchObject({ ok: false });
    expect(() => buildPersonalWorkbenchViewV1(projection)).toThrow();
  });
});
