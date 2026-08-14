// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import {
  buildOnlineDisplayPairingViewV1,
  type OnlineDisplayPairingInputV1,
} from '../../../online/displayPairing/index';

function pair(): OnlineDisplayPairingInputV1 {
  type Zone = { count: number; entries: unknown[] };
  type MutableProjection = {
    participantId: string;
    role: string;
    corePlayerId: string | null;
    revision: number;
    room: { participants: Array<Record<string, unknown>> };
    game: { zones: { byPlayer: Array<{ zones: Record<'library' | 'hand', Zone> }> } };
  };
  const personal = JSON.parse(JSON.stringify(fixture)) as MutableProjection;
  const room = personal.room;
  room.participants.push({ participantId: 'table-display', role: 'table', presence: 'connected', seatIndex: null });
  const table = JSON.parse(JSON.stringify(personal)) as MutableProjection;
  table.participantId = 'table-display';
  table.role = 'table';
  table.corePlayerId = null;
  const groups = table.game.zones.byPlayer;
  for (const group of groups) {
    for (const name of ['library', 'hand'] as const) group.zones[name].entries = Array.from({ length: group.zones[name].count }, () => ({ kind: 'hidden-card' }));
  }
  return { personalProjection: personal, tableProjection: table, focusedPlayerId: null };
}

describe('OnlineDisplayPairing', () => {
  it('creates a synchronized public pair and rejects a revision drift', () => {
    const input = pair();
    const view = buildOnlineDisplayPairingViewV1(input);
    expect(view.revision).toBe(12);
    expect(view.opponents.map((opponent) => opponent.playerId)).toEqual(['P2', 'P3', 'P4']);
    (input.tableProjection as Record<string, unknown>).revision = 13;
    expect(() => buildOnlineDisplayPairingViewV1(input)).toThrow('Display pairing is unavailable');
  });
});
