import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  claimOnlineFormingLobbySeatV1,
  createOnlineFormingLobbyV1,
  setOnlineFormingLobbySeatReadyV1,
  submitOnlineFormingLobbyDeckV1,
} from '../index';
import { startOnlineFormingLobbyV1, startOnlineFormingLobbyWithTableV1 } from '../fixtures/fixedStartV1';

const participantIds = ['host-table-test', 'player-table-test-2', 'player-table-test-3', 'player-table-test-4'] as const;
const seatCapabilities = ['seat_' + 'A'.repeat(40), 'seat_' + 'B'.repeat(40), 'seat_' + 'C'.repeat(40), 'seat_' + 'D'.repeat(40)] as const;
const inviteCapabilities = ['invite_' + 'E'.repeat(40), 'invite_' + 'F'.repeat(40), 'invite_' + 'G'.repeat(40)] as const;
const deckNames = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;

function readyLobby() {
  let lobby = createOnlineFormingLobbyV1({
    roomId: 'room-table-start-test',
    serverBuildId: 'build-table-start-test',
    hostParticipantId: participantIds[0],
    seatCapabilities,
    inviteCapabilities,
  });
  for (let index = 1; index < 4; index += 1) {
    const claimed = claimOnlineFormingLobbySeatV1(lobby, { participantId: participantIds[index], inviteCapability: inviteCapabilities[index - 1] });
    lobby = claimed.lobby;
  }
  for (let index = 0; index < 4; index += 1) {
    lobby = submitOnlineFormingLobbyDeckV1(lobby, {
      participantId: participantIds[index],
      seatCapability: seatCapabilities[index],
      deckId: `deck-table-start-${index}`,
      deckText: readFileSync(`Mydeck/${deckNames[index]}.txt`, 'utf8'),
    });
    lobby = setOnlineFormingLobbySeatReadyV1(lobby, { participantId: participantIds[index], seatCapability: seatCapabilities[index], ready: true });
  }
  return lobby;
}

describe('table-capable forming lobby start', () => {
  it('reuses the deterministic four-player Core root and adds exactly one observer', () => {
    const lobby = readyLobby();
    const legacy = startOnlineFormingLobbyV1(lobby, { hostParticipantId: participantIds[0], seatCapability: seatCapabilities[0] });
    const withTable = startOnlineFormingLobbyWithTableV1(lobby, {
      hostParticipantId: participantIds[0],
      seatCapability: seatCapabilities[0],
      tableParticipantId: 'table-start-test',
      tableCapability: 'table_' + 'T'.repeat(40),
    });
    expect(legacy.genesis.ok).toBe(true);
    expect(withTable.genesis.ok).toBe(true);
    if (!legacy.genesis.ok || !withTable.genesis.ok) return;
    expect(JSON.stringify(withTable.genesis.coreRoot)).toBe(JSON.stringify(legacy.genesis.coreRoot));
    expect(withTable.genesis.room.participants).toHaveLength(5);
    expect(withTable.genesis.room.participants.at(-1)?.role).toBe('table');
    expect(withTable.genesis.room.participants.at(-1)?.seatIndex).toBeNull();
    expect(withTable.genesis.protocolState.observerAuthorizations).toEqual([{ participantId: 'table-start-test', observerCapability: 'table_' + 'T'.repeat(40) }]);
    expect(new TextEncoder().encode(JSON.stringify(withTable.genesis.protocolState)).length).toBeLessThanOrEqual(1_048_576);
  }, 60000);

  it('rejects capability collisions before any bootstrap work', () => {
    expect(() => startOnlineFormingLobbyWithTableV1(readyLobby(), {
      hostParticipantId: participantIds[0],
      seatCapability: seatCapabilities[0],
      tableParticipantId: 'table-start-test',
      tableCapability: seatCapabilities[0],
    })).toThrow();
  });

  it('rejects reverse-direction table capability fragments', () => {
    const lobby = readyLobby();
    expect(() => startOnlineFormingLobbyWithTableV1(lobby, {
      hostParticipantId: participantIds[0],
      seatCapability: seatCapabilities[0],
      tableParticipantId: 'table-start-test',
      tableCapability: 'table_' + seatCapabilities[0].slice(6, 14) + 'T'.repeat(40),
    })).toThrow();
  });
});
