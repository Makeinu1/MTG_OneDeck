import { describe, expect, it } from 'vitest';
import { buildDynamicRoomGenesisV2, type DynamicGenesisInputV2 } from '../index';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../../../engine/core/object/objectRegistryStateV2';
import type { CardDef } from '../../../types/card';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const DFC = '00000000-0000-4000-8000-000000000001';
const DFC_ORACLE = '00000000-0000-4000-8000-000000000002';

function card(id = SID, oracleId = OID): CardDef {
  return Object.freeze({ scryfallId: id, oracleId, name: id === DFC ? 'Front // Back' : 'Dynamic Card', lang: 'en', layout: id === DFC ? 'transform' : 'normal', cmc: 2, colorIdentity: [], typeLine: 'Creature', faces: id === DFC ? [{ name: 'Front', typeLine: 'Creature', manaCost: '{1}', oracleText: 'Front' }, { name: 'Back', typeLine: 'Creature', oracleText: 'Back' }] : [{ name: 'Dynamic Card', typeLine: 'Creature', oracleText: 'Dynamic' }] });
}

function input(entries: DynamicGenesisInputV2['seats'][number]['snapshot']['entries']): DynamicGenesisInputV2 {
  return Object.freeze({ roomId: 'dynamic-room', serverBuildId: 'build-v2', seats: [0, 1, 2, 3].map((seatIndex) => {
    const serialized = JSON.stringify({ entries });
    const snapshotDigest = coreSha256HexV1(serialized);
    return Object.freeze({ seatIndex: seatIndex as 0 | 1 | 2 | 3, corePlayerId: `P${seatIndex + 1}` as 'P1' | 'P2' | 'P3' | 'P4', participantId: `player-${seatIndex + 1}`, seatCapability: `seat_${String(seatIndex).repeat(32)}`, revision: 1, submissionId: `submission-${seatIndex + 1}`, contentDigest: 'a'.repeat(64), snapshotDigest, snapshot: Object.freeze({ entries, serialized, digest: snapshotDigest }) });
  }) as unknown as DynamicGenesisInputV2['seats'], tableParticipantId: 'table-observer', tableCapability: `observer_${'t'.repeat(32)}` });
}

describe('dynamic Room genesis v2', () => {
  it('preserves duplicate decks, zero/multiple commanders, DFC faces, and seat-scoped IDs', () => {
    const entries = [
      { section: 'main' as const, quantity: 2, scryfallId: DFC, oracleId: DFC_ORACLE, index: 0, definition: card(DFC, DFC_ORACLE) },
      { section: 'commander' as const, quantity: 2, scryfallId: SID, oracleId: OID, index: 1, definition: card() },
    ];
    const result = buildDynamicRoomGenesisV2(input(entries));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.physicalCards)).toContain('P1-card-000001');
    expect(Object.keys(result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.physicalCards)).toContain('P2-card-000001');
    expect(result.coreRoot.commanders).toHaveLength(8);
    const registry: ModeNeutralCoreObjectRegistryStateV2 = result.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    const definitions = registry.cardDefinitions as unknown as Record<string, { readonly faces?: readonly unknown[] }>;
    expect(definitions[DFC]?.faces).toHaveLength(2);
    expect(result.room.participants).toHaveLength(5);
    expect(result.replay.ok).toBe(true);
  });

  it('accepts a deck with zero commanders and rejects bounded hostile quantities', () => {
    const noCommander = buildDynamicRoomGenesisV2(input([{ section: 'main', quantity: 1, scryfallId: SID, oracleId: OID, index: 0, definition: card() }]));
    expect(noCommander.ok).toBe(true);
    const huge = buildDynamicRoomGenesisV2(input([{ section: 'main', quantity: Number.MAX_SAFE_INTEGER, scryfallId: SID, oracleId: OID, index: 0, definition: card() }]));
    expect(huge).toMatchObject({ ok: false, issues: [{ code: 'ROOM_GENESIS_TOO_LARGE' }] });
  });
});
