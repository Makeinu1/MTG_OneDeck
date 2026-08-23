import { describe, expect, it } from 'vitest';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { buildVariableRoomGenesisV3, type VariableGenesisInputV3 } from '../index';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const card = (): CardDef => Object.freeze({ scryfallId: SID, oracleId: OID, name: 'Variable Card', lang: 'en', layout: 'normal', cmc: 2, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Variable Card', typeLine: 'Creature', oracleText: 'Variable' }] });

function input(playerCount: 2 | 4, startingLife: 20 | 40, quantity = 40): VariableGenesisInputV3 {
  const entries = [{ section: 'main' as const, quantity, scryfallId: SID, oracleId: OID, index: 0, definition: card() }];
  const serialized = JSON.stringify({ entries });
  const digest = coreSha256HexV1(serialized);
  return { roomId: `variable-${playerCount}-${startingLife}`, serverBuildId: 'build-v3', configuration: { playerCount, startingLife }, seats: Array.from({ length: playerCount }, (_, index) => ({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4', participantId: `player-${index + 1}`, seatCapability: `seat_${String(index).repeat(32)}`, snapshot: { entries, serialized, digest } })) };
}

describe('variable roster genesis v3', () => {
  it.each([[2, 20], [2, 40], [4, 40]] as const)('constructs exact %ip/%i-life roots', (playerCount, startingLife) => {
    const result = buildVariableRoomGenesisV3(input(playerCount, startingLife));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configuration).toEqual({ playerCount, startingLife });
    expect(result.room.seats).toHaveLength(playerCount);
    expect(result.room.seats.map((seat) => seat.corePlayerId)).toEqual(Array.from({ length: playerCount }, (_, index) => `P${index + 1}`));
    expect(result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder).toEqual(Array.from({ length: playerCount }, (_, index) => `P${index + 1}`));
    expect(result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players['P1' as never]?.life).toBe(startingLife);
    expect(result.replay.ok).toBe(true);
  });

  it('rejects four players at twenty life and preserves zero-commanders', () => {
    expect(buildVariableRoomGenesisV3(input(4, 20))).toMatchObject({ ok: false, issues: [{ code: 'INVALID_INPUT' }] });
    const result = buildVariableRoomGenesisV3(input(2, 20));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coreRoot.commanders).toHaveLength(0);
  });

  it.each([40, 60, 100])('accepts a %i-card zero-commander two-seat snapshot', (quantity) => {
    const result = buildVariableRoomGenesisV3(input(2, 20, quantity));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const registry = result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
      expect(registry.turnOrder).toEqual(['P1', 'P2']);
      expect(registry.zones.byPlayer['P1' as never]?.library).toHaveLength(quantity);
      expect(result.coreRoot.commanders).toHaveLength(0);
    }
  });
});
