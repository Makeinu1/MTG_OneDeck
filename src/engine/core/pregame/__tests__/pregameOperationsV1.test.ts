import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import { buildVariableRoomGenesisV3 } from '../../../../online/genesis/index';

const card = (scryfallId: string, oracleId: string, name: string, typeLine: string) => ({
  scryfallId, oracleId, name, lang: 'en' as const, layout: 'normal' as const, cmc: 2,
  colorIdentity: [], typeLine, faces: [{ name, typeLine, oracleText: '' }],
});

function genesis(mainQuantity = 20) {
  const entries = Object.freeze([
    Object.freeze({ index: 0, section: 'commander' as const, quantity: 1, scryfallId: '00000000-0000-4000-8000-000000000001', oracleId: '00000000-0000-4000-8000-000000000101', definition: card('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Commander', 'Legendary Creature') }),
    Object.freeze({ index: 1, section: 'main' as const, quantity: mainQuantity, scryfallId: '00000000-0000-4000-8000-000000000002', oracleId: '00000000-0000-4000-8000-000000000102', definition: card('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 'Main', 'Artifact') }),
  ]);
  const serialized = JSON.stringify({ entries });
  const snapshot = Object.freeze({ entries, serialized, digest: Core.coreSha256HexV1(serialized) });
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: `core-pregame-${String(mainQuantity)}`, serverBuildId: 'core-pregame-test', configuration: { playerCount: 2 as const, startingLife: 40 as const },
    seats: [0, 1].map((index) => Object.freeze({ seatIndex: index as 0 | 1, corePlayerId: `P${String(index + 1)}` as 'P1' | 'P2' | 'P3' | 'P4', participantId: `core-pregame-participant-${String(index + 1)}`, seatCapability: `seat_${String(index + 1).repeat(40)}`, snapshot })),
    tableParticipantId: 'core-pregame-table', tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  if (!result.ok) throw new Error('Genesis fixture failed');
  return result.protocolState.coreRoot;
}

function orders(root: Core.ModeNeutralCoreRootV1, round = 0) {
  const registry = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  return registry.turnOrder.map((playerId, playerIndex) => {
    const zones = registry.zones.byPlayer[playerId];
    const source = round === 0 ? zones.library : [...zones.library, ...zones.hand];
    const ids = source.map((objectId) => registry.objects[objectId]);
    const physical = ids.map((object) => { if (object?.kind !== 'card') throw new Error('Expected card object'); return object.physicalCardId; });
    return { playerId, order: [...physical.slice((round + playerIndex) % physical.length), ...physical.slice(0, (round + playerIndex) % physical.length)] };
  });
}

describe('Core Pregame atomic setup operations', () => {
  it('rotates the active player and turn order without advancing commands', () => {
    const root = genesis();
    const rotated = Core.rotateCorePregameTurnOrderV1(root, 'P2' as Core.CorePlayerId);
    expect(rotated.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder).toEqual(['P2', 'P1']);
    expect(rotated.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId).toBe('P2');
    expect(rotated.acceptedCommandCount).toBe(0);
  });

  it('deals exactly seven, preserves drawnThisTurn, and rejects insufficient opening cards atomically', () => {
    const root = genesis();
    const dealt = Core.dealCorePregameOpeningHandsV1(root, orders(root));
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) throw new Error('Opening deal rejected');
    const registry = dealt.value.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    for (const playerId of registry.turnOrder) {
      expect(registry.zones.byPlayer[playerId].hand).toHaveLength(7);
      expect(registry.players[playerId].drawnThisTurn).toBe(0);
    }
    const short = genesis(6);
    const rejected = Core.dealCorePregameOpeningHandsV1(short, orders(short));
    expect(rejected.ok).toBe(false);
    expect(Core.coreCanonicalDigestFromValueV1(short)).toBe(Core.coreCanonicalDigestFromValueV1(rejected.ok ? rejected.value : short));
  });

  it('applies a simultaneous mulligan wave, increments counters, reincarnates cards, and commits bottoms in listed order', () => {
    const root = genesis();
    const dealt = Core.dealCorePregameOpeningHandsV1(root, orders(root));
    if (!dealt.ok) throw new Error('Opening deal rejected');
    const before = dealt.value;
    const wave = Core.applyCorePregameMulliganWaveV1(before, orders(before, 1));
    expect(wave.ok).toBe(true);
    if (!wave.ok) throw new Error('Mulligan wave rejected');
    const registry = wave.value.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    for (const playerId of registry.turnOrder) {
      expect(registry.zones.byPlayer[playerId].hand).toHaveLength(7);
      expect(registry.players[playerId].mulliganCount).toBe(1);
      expect(registry.players[playerId].drawnThisTurn).toBe(0);
    }
    const p1 = 'P1' as Core.CorePlayerId;
    const bottomIds = registry.zones.byPlayer[p1].hand.slice(0, 2);
    const submittedPhysical = bottomIds.map((objectId) => {
      const separator = objectId.lastIndexOf(':');
      return { physicalId: objectId.slice(0, separator), incarnation: Number(objectId.slice(separator + 1)) };
    });
    expect(submittedPhysical.every((entry) => Number.isSafeInteger(entry.incarnation) && entry.incarnation >= 1)).toBe(true);
    const bottom = Core.commitCorePregameBottomBatchV1(wave.value, [{ playerId: 'P1' as Core.CorePlayerId, objectIds: bottomIds }]);
    expect(bottom.ok).toBe(true);
    if (!bottom.ok) throw new Error('Bottom commit rejected');
    const bottomRegistry = bottom.value.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(bottomRegistry.zones.byPlayer[p1].hand).toHaveLength(5);
    expect(bottomRegistry.zones.byPlayer[p1].library.slice(-2)).toEqual(submittedPhysical.map((entry) => `${entry.physicalId}:${String(entry.incarnation + 1)}`));
    expect(bottom.value.acceptedCommandCount).toBe(0);
  });

  it('rejects empty or duplicate mulligan input before mutating the root', () => {
    const root = genesis();
    expect(Core.applyCorePregameMulliganWaveV1(root, [])).toMatchObject({ ok: false });
    const one = orders(root)[0];
    if (one === undefined) throw new Error('Missing order');
    const duplicate = Core.applyCorePregameMulliganWaveV1(root, [one, one]);
    expect(duplicate).toMatchObject({ ok: false });
    expect(Core.coreCanonicalDigestFromValueV1(root)).toBe(Core.coreCanonicalDigestFromValueV1(duplicate.ok ? duplicate.value : root));
  });
});
