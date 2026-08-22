import { describe, expect, it } from 'vitest';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import type { OnlineDeckResolvedEntryV2 } from '../../deckSubmission/index';
import {
  buildDynamicRoomGenesisV2,
  type DynamicGenesisInputV2,
  type DynamicGenesisSeatInputV2,
} from '../index';

const SCRYFALL_ID = '5da14d86-0780-4821-a799-96f64b377df4';
const ORACLE_ID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';

function definition(name = 'Outside Catalog DFC'): CardDef {
  return {
    scryfallId: SCRYFALL_ID,
    oracleId: ORACLE_ID,
    name,
    printedName: '表示専用名',
    lang: 'ja',
    layout: 'transform',
    cmc: 3,
    colorIdentity: ['G', 'U', 'G'],
    typeLine: 'Creature — Human',
    keywords: ['Flying', 'Ward', 'Flying'],
    producedMana: ['C', 'W', 'C'],
    faces: [
      {
        name: 'Outside Catalog Front',
        printedName: '表面表示名',
        manaCost: '{1}{G}{U}',
        typeLine: 'Creature — Human',
        oracleText: 'Front oracle.',
        power: '2',
        toughness: '3',
        imageUrl: 'https://image.invalid/front.jpg',
      },
      {
        name: 'Outside Catalog Back',
        printedName: '裏面表示名',
        typeLine: 'Creature — Beast',
        oracleText: 'Back oracle.',
        power: '4',
        toughness: '4',
        imageUrl: 'https://image.invalid/back.jpg',
      },
    ],
  };
}

function entry(
  index: number,
  section: 'commander' | 'main',
  quantity: number,
  card = definition(),
): OnlineDeckResolvedEntryV2 {
  return Object.freeze({
    index,
    section,
    quantity,
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    definition: card,
  });
}

function seat(
  seatIndex: 0 | 1 | 2 | 3,
  entries: readonly OnlineDeckResolvedEntryV2[],
): DynamicGenesisSeatInputV2 {
  const serialized = JSON.stringify({ entries });
  const digest = coreSha256HexV1(serialized);
  return Object.freeze({
    seatIndex,
    corePlayerId: `P${seatIndex + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: `participant-${seatIndex + 1}`,
    seatCapability: `seat_${String(seatIndex + 1).repeat(40)}`,
    revision: 1,
    submissionId: `submission-${seatIndex + 1}`,
    contentDigest: String(seatIndex + 1).repeat(64),
    snapshotDigest: digest,
    snapshot: Object.freeze({ entries, serialized, digest }),
  });
}

function input(
  seats: DynamicGenesisInputV2['seats'] = [
    seat(0, [entry(0, 'main', 2)]),
    seat(1, [entry(0, 'commander', 2), entry(1, 'main', 1)]),
    seat(2, [entry(0, 'main', 1), entry(1, 'main', 2)]),
    seat(3, [entry(0, 'main', 2)]),
  ],
): DynamicGenesisInputV2 {
  return Object.freeze({
    roomId: 'room-o4p07b-genesis',
    serverBuildId: 'o4p-07b-server',
    seats,
    tableParticipantId: 'table-o4p07b-genesis',
    tableCapability: `observer_${'T'.repeat(40)}`,
  });
}

describe('O4P-07B dynamic genesis Judge acceptance', () => {
  it('preserves arbitrary sections, copies, DFC order, shared definitions, and seat-scoped IDs', () => {
    const first = buildDynamicRoomGenesisV2(input());
    const second = buildDynamicRoomGenesisV2(input());
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) throw new Error('Expected dynamic genesis');

    const registry =
      first.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(Object.keys(registry.cardDefinitions)).toEqual([SCRYFALL_ID]);
    expect(Object.keys(registry.physicalCards).sort()).toEqual([
      'P1-card-000001',
      'P1-card-000002',
      'P2-card-000001',
      'P2-card-000002',
      'P2-card-000003',
      'P3-card-000001',
      'P3-card-000002',
      'P3-card-000003',
      'P4-card-000001',
      'P4-card-000002',
    ]);
    expect(registry.zones.byPlayer['P1' as never]?.library).toEqual([
      'P1-card-000001:0',
      'P1-card-000002:0',
    ]);
    expect(registry.zones.byPlayer['P2' as never]?.library).toEqual(['P2-card-000003:0']);
    expect(registry.zones.byPlayer['P3' as never]?.library).toEqual([
      'P3-card-000001:0',
      'P3-card-000002:0',
      'P3-card-000003:0',
    ]);
    expect(registry.zones.shared.command).toEqual([
      'P2-card-000001:0',
      'P2-card-000002:0',
    ]);
    expect(first.coreRoot.commanders.map((commander) => commander.physicalCardId)).toEqual([
      'P2-card-000001',
      'P2-card-000002',
    ]);

    const canonical = registry.cardDefinitions[SCRYFALL_ID as never];
    expect(canonical).toMatchObject({
      source: { kind: 'scryfall', scryfallId: SCRYFALL_ID, oracleId: ORACLE_ID },
      name: 'Outside Catalog DFC',
      colorIdentity: ['U', 'G'],
      keywords: ['Flying', 'Ward'],
      producedMana: ['W', 'C'],
    });
    expect(canonical?.faces.map((face) => face.name)).toEqual([
      'Outside Catalog Front',
      'Outside Catalog Back',
    ]);
    expect(JSON.stringify(canonical)).not.toMatch(/表示専用|image\.invalid|printedName|imageUrl/);
    expect(first.measurements.coreRoot).toBeLessThanOrEqual(1_048_576);
    expect(first.measurements.protocolState).toBeLessThanOrEqual(1_048_576);
    expect(first.measurements.initializeEnvelope).toBeLessThanOrEqual(1_048_576);
    expect(first.protocolState.coreRoot).toEqual(first.coreRoot);
    expect(first.replay).toMatchObject({ ok: true, events: [], finalStateDigest: first.coreDigest });
    if (first.replay.ok) expect(first.replay.finalRoot).toEqual(first.coreRoot);
  });

  it('rejects huge safe quantities before expansion and rejects same-print definition collisions', () => {
    const hugeEntries = Object.freeze([entry(0, 'main', Number.MAX_SAFE_INTEGER)]);
    const hugeInput = input([
      seat(0, hugeEntries),
      seat(1, [entry(0, 'main', 1)]),
      seat(2, [entry(0, 'main', 1)]),
      seat(3, [entry(0, 'main', 1)]),
    ]);
    const before = JSON.stringify(hugeInput);
    expect(buildDynamicRoomGenesisV2(hugeInput)).toMatchObject({
      ok: false,
      issues: [{ code: 'ROOM_GENESIS_TOO_LARGE' }],
    });
    expect(JSON.stringify(hugeInput)).toBe(before);

    const collision = input([
      seat(0, [entry(0, 'main', 1)]),
      seat(1, [entry(0, 'main', 1, definition('Conflicting Definition'))]),
      seat(2, [entry(0, 'main', 1)]),
      seat(3, [entry(0, 'main', 1)]),
    ]);
    expect(buildDynamicRoomGenesisV2(collision)).toMatchObject({
      ok: false,
      issues: [{ code: 'CONSTRUCTION_FAILED' }],
    });
  });
});
