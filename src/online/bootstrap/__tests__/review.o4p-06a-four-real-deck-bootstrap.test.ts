import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseDeckList } from '../../../data/deckParser';
import type { CorePlayerId } from '../../../engine/core/index';
import {
  deserializeOnlineCloudflareProtocolStateV1,
  serializeOnlineCloudflareProtocolStateV1,
} from '../../cloudflare/codec';
import {
  ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
} from '../../cloudflare/types';
import {
  O4P06A_CARD_CATALOG_V1,
  bootstrapFourDeckGenesisV1,
  catalogIssuesV1,
  evaluateO4P06ASerializedArtifactsV1,
  type FourDeckBootstrapInputV1,
} from '../index';

const DECKS = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
const ENTRY_COUNTS = [99, 83, 103, 96] as const;
const CARD_COUNTS = [100, 100, 104, 100] as const;
const LIVE_NAMES = [
  'Angelic Renewal',
  "Blue Sun's Zenith",
  'Bounty Agent',
  'Capsize',
  'Censor',
  'Desecrated Tomb',
  'Dispel',
  'Emergence Zone',
  'Ice Tunnel',
  'Jeweled Amulet',
  "Mage's Guile",
  'Magosi, the Waterveil',
  'Malakir Rebirth',
  'Megrim',
  'Scholar of the Lost Trove',
  'Whispering Madness',
  'Zagoth Triome',
] as const;

function realInput(): FourDeckBootstrapInputV1 {
  return {
    roomId: 'o4p06a-room',
    serverBuildId: 'o4p06a-build',
    seats: DECKS.map((deck, seatIndex) => ({
      seatIndex,
      corePlayerId: `P${seatIndex + 1}`,
      participantId: seatIndex === 0 ? 'host' : `player-${seatIndex + 1}`,
      seatCapability: `seat_capability_${String.fromCharCode(65 + seatIndex).repeat(16)}`,
      deckId: `deck-${deck.toLowerCase()}`,
      deckText: readFileSync(`Mydeck/${deck}.txt`, 'utf8'),
    })),
  };
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}

describe('review O4P-06A four-real-deck bootstrap', () => {
  it('pins the complete offline catalog and rejects provenance corruption', () => {
    expect(O4P06A_CARD_CATALOG_V1).toMatchObject({
      kind: 'o4p-06a-four-deck-card-catalog-v1',
      schemaVersion: 1,
      corpusManifest: {
        api: 'https://api.scryfall.com/cards/search',
        query: 'game:paper date>=2021-06-19',
        unique: 'cards',
        includeExtras: false,
        includeMultilingual: false,
        includeVariations: false,
        order: 'name',
      },
      corpusSavedCards: 17491,
    });
    expect(O4P06A_CARD_CATALOG_V1.entries).toHaveLength(336);
    expect(O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'pinned-exact')).toHaveLength(308);
    expect(O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'pinned-front-face')).toHaveLength(11);
    const live = O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'live-collection');
    expect(live.map((entry) => entry.lookupName)).toEqual(LIVE_NAMES);
    expect(new Set(live.map((entry) => entry.definition.source.kind === 'scryfall' ? entry.definition.source.scryfallId : '')).size).toBe(17);

    const names = O4P06A_CARD_CATALOG_V1.entries.map((entry) => entry.lookupName);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(336);
    const parsedNames = new Set<string>();
    for (const deck of DECKS) {
      for (const entry of parseDeckList(readFileSync(`Mydeck/${deck}.txt`, 'utf8')).entries) parsedNames.add(entry.name);
    }
    expect(names).toEqual([...parsedNames].sort());

    const frontFaces = O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'pinned-front-face');
    expect(frontFaces.every((entry) => ['transform', 'modal_dfc', 'prepare'].includes(entry.definition.layout))).toBe(true);
    expect(frontFaces.filter((entry) => entry.definition.layout === 'prepare').map((entry) => entry.lookupName)).toEqual(['Naktamun Lorespinner']);
    expect(frontFaces.every((entry) => entry.definition.faces[0]?.name === entry.lookupName)).toBe(true);

    const malakir = live.find((entry) => entry.lookupName === 'Malakir Rebirth');
    expect(malakir).toMatchObject({
      resolution: 'live-collection',
      definition: {
        source: { scryfallId: '609d3ecf-f88d-4268-a8d3-4bf2bcf5df60' },
        name: 'Malakir Rebirth // Malakir Mire',
        layout: 'modal_dfc',
      },
    });
    expect(malakir?.definition.faces.map((face) => face.name)).toEqual(['Malakir Rebirth', 'Malakir Mire']);
    assertDeepFrozen(O4P06A_CARD_CATALOG_V1);

    const corrupt = structuredClone(O4P06A_CARD_CATALOG_V1) as unknown as {
      entries: Array<{ lookupName: string; resolution: string; definition: { source: { scryfallId: string } } }>;
    };
    const firstLive = corrupt.entries.find((entry) => entry.resolution === 'live-collection');
    const secondLive = corrupt.entries.filter((entry) => entry.resolution === 'live-collection')[1];
    expect(firstLive).toBeDefined();
    expect(secondLive).toBeDefined();
    if (firstLive !== undefined && secondLive !== undefined) secondLive.definition.source.scryfallId = firstLive.definition.source.scryfallId;
    expect(catalogIssuesV1(corrupt).some((issue) => issue.code === 'CATALOG_DUPLICATE_SOURCE_ID')).toBe(true);

    for (const source of ['catalog/catalogV1.ts', 'fourDeckBootstrapV1.ts', 'sizeGateV1.ts']) {
      const text = readFileSync(`src/online/bootstrap/${source}`, 'utf8');
      expect(text).not.toContain('fetch(');
      expect(text).not.toContain('/tmp/o4p06a');
      expect(text).not.toContain('research/scryfall-rules');
    }
  });

  it('builds the exact deterministic revision-zero Core, Room, Protocol, and replay', () => {
    for (const [index, deck] of DECKS.entries()) {
      const parsed = parseDeckList(readFileSync(`Mydeck/${deck}.txt`, 'utf8'));
      expect(parsed.errors).toEqual([]);
      expect(parsed.entries).toHaveLength(ENTRY_COUNTS[index]);
      expect(parsed.entries.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(CARD_COUNTS[index]);
      expect(parsed.entries.filter((entry) => entry.section === 'commander')).toHaveLength(1);
      expect(parsed.entries.find((entry) => entry.section === 'commander')?.quantity).toBe(1);
    }

    const input = realInput();
    const inputBefore = structuredClone(input);
    const first = bootstrapFourDeckGenesisV1(input);
    const second = bootstrapFourDeckGenesisV1(structuredClone(input));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(input).toEqual(inputBefore);
    if (!first.ok || !second.ok) return;

    expect(first.coreCanonical).toBe(second.coreCanonical);
    expect(first.coreDigest).toBe(second.coreDigest);
    expect(JSON.stringify(first.protocolState)).toBe(JSON.stringify(second.protocolState));
    expect(first.coreRoot.acceptedCommandCount).toBe(0);
    expect(first.coreRoot.commanders.map((commander) => [commander.physicalCardId, commander.ownerPlayerId])).toEqual([
      ['P1-card-0001', 'P1'],
      ['P2-card-0001', 'P2'],
      ['P3-card-0001', 'P3'],
      ['P4-card-0001', 'P4'],
    ]);
    expect(first.coreRoot.playerLifecycle.players).toEqual([
      { playerId: 'P1', status: 'active', exitCause: null },
      { playerId: 'P2', status: 'active', exitCause: null },
      { playerId: 'P3', status: 'active', exitCause: null },
      { playerId: 'P4', status: 'active', exitCause: null },
    ]);

    const bundle = first.coreRoot.ruleAuthority.turnPriorityBundle;
    const registry = bundle.stackBundle.objectRegistry;
    expect(registry.turnOrder).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(registry.activePlayerId).toBe('P1');
    expect(Object.keys(registry.physicalCards)).toHaveLength(404);
    expect(Object.keys(registry.objects)).toHaveLength(404);
    expect(new Set(Object.keys(registry.objects)).size).toBe(404);
    expect(registry.zones.shared.command).toHaveLength(4);
    expect(registry.zones.shared.battlefield).toEqual([]);
    expect(registry.zones.shared.stack).toEqual([]);
    expect(registry.zones.shared.exile).toEqual([]);

    for (const [seatIndex, deck] of DECKS.entries()) {
      const playerId = `P${seatIndex + 1}` as CorePlayerId;
      const parsed = parseDeckList(readFileSync(`Mydeck/${deck}.txt`, 'utf8'));
      const main = parsed.entries.filter((entry) => entry.section === 'main').flatMap((entry) => Array.from({ length: entry.quantity }, () => entry));
      const zone = registry.zones.byPlayer[playerId];
      expect(zone?.hand).toEqual([]);
      expect(zone?.graveyard).toEqual([]);
      expect(zone?.library).toHaveLength(CARD_COUNTS[seatIndex] - 1);
      for (const [index, objectId] of (zone?.library ?? []).entries()) {
        const object = registry.objects[objectId];
        expect(object?.kind).toBe('card');
        if (object?.kind !== 'card') continue;
        expect(object.physicalCardId).toBe(`${playerId}-card-${String(index + 2).padStart(4, '0')}`);
        const physical = registry.physicalCards[object.physicalCardId];
        expect(physical?.ownerPlayerId).toBe(playerId);
        expect(physical?.isCommander).toBe(false);
        const catalog = O4P06A_CARD_CATALOG_V1.entries.find((entry) => entry.lookupName === main[index]?.name);
        expect(physical?.definitionId).toBe(catalog?.definition.source.kind === 'scryfall' ? catalog.definition.source.scryfallId : undefined);
      }
    }

    expect(bundle.lifecycle).toEqual({
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'beginning', step: 'untap' },
      window: { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P1' },
    });
    expect(bundle.pendingTriggers).toMatchObject({ pendingObjectIds: [], byObject: {} });
    expect(first.room.lifecycle).toBe('active');
    expect(first.room.hostParticipantId).toBe('host');
    expect(first.room.participants.map((participant) => participant.participantId)).toEqual(['host', 'player-2', 'player-3', 'player-4']);
    expect(first.room.seats.map((seat) => [seat.corePlayerId, seat.participantId, seat.ready, seat.outcome])).toEqual([
      ['P1', 'host', true, 'pending'],
      ['P2', 'player-2', true, 'pending'],
      ['P3', 'player-3', true, 'pending'],
      ['P4', 'player-4', true, 'pending'],
    ]);
    expect(first.protocolState).toMatchObject({
      kind: 'online-protocol-state-v1',
      schemaVersion: 1,
      serverBuildId: 'o4p06a-build',
      revision: 0,
      observerAuthorizations: [],
      receipts: [],
    });
    expect(first.protocolState.room).toEqual(first.room);
    expect(first.protocolState.coreRoot).toEqual(first.coreRoot);
    expect(first.replay.ok).toBe(true);
    if (first.replay.ok) {
      expect(first.replay.events).toEqual([]);
      expect(first.replay.finalStateDigest).toBe(first.coreDigest);
      expect(first.replay.finalRoot).toEqual(first.coreRoot);
    }
    assertDeepFrozen(first);
  }, 60_000);

  it('prints exact production-size evidence and fails closed at every boundary', () => {
    const result = bootstrapFourDeckGenesisV1(realInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sizeEvidence).toEqual({
      kind: 'o4p-06a-size-evidence-v1',
      limitBytes: 1_048_576,
      measurement: 'TextEncoder-UTF-8',
      artifacts: [
        { id: 'canonical-core-root', bytes: 405_521, withinLimit: true },
        { id: 'online-protocol-state', bytes: 406_753, withinLimit: true },
        { id: 'cloudflare-initialize-envelope', bytes: 406_827, withinLimit: true },
      ],
    });
    console.log(JSON.stringify(result.sizeEvidence));

    const protocol = serializeOnlineCloudflareProtocolStateV1(result.protocolState);
    expect(deserializeOnlineCloudflareProtocolStateV1(protocol)).toEqual(result.protocolState);
    const envelope = JSON.stringify({
      kind: 'online-cloudflare-room-initialize-v1',
      schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
      state: result.protocolState,
    });
    expect(new TextEncoder().encode(result.coreCanonical)).toHaveLength(405_521);
    expect(new TextEncoder().encode(protocol)).toHaveLength(406_753);
    expect(new TextEncoder().encode(envelope)).toHaveLength(406_827);
    expect(result.measurements.every((measurement) => measurement.bytes <= ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1)).toBe(true);
    expect(result.sizeEvidence.artifacts[2]?.bytes).toBe(new TextEncoder().encode(envelope).length);

    const exact = 'x'.repeat(ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1);
    const exactResult = evaluateO4P06ASerializedArtifactsV1(exact, exact, exact);
    expect(exactResult.ok).toBe(true);
    if (exactResult.ok) {
      expect(exactResult.kind).toBe('o4p-06a-size-probe-v1');
      expect(exactResult.measurements.every((measurement) => measurement.bytes === 1_048_576 && measurement.withinLimit)).toBe(true);
      expect(exactResult).not.toHaveProperty('evidence');
      expect(exactResult).not.toHaveProperty('serialized');
    }
    const over = `${exact}x`;
    const overResult = evaluateO4P06ASerializedArtifactsV1(over, over, over);
    expect(overResult).toEqual({
      ok: false,
      issues: [
        { code: 'CORE_ROOT_SIZE_LIMIT_EXCEEDED', path: '/measurements/canonical-core-root', message: 'measuredBytes=1048577; limitBytes=1048576' },
        { code: 'PROTOCOL_STATE_SIZE_LIMIT_EXCEEDED', path: '/measurements/online-protocol-state', message: 'measuredBytes=1048577; limitBytes=1048576' },
        { code: 'INITIALIZE_ENVELOPE_SIZE_LIMIT_EXCEEDED', path: '/measurements/cloudflare-initialize-envelope', message: 'measuredBytes=1048577; limitBytes=1048576' },
      ],
    });
  }, 60_000);

  it('returns deterministic complete issues without partial state or capability fragments', () => {
    const input = realInput();
    const seats = input.seats.map((seat) => ({ ...seat }));
    seats[0] = {
      ...seats[0],
      participantId: 'bad id',
      seatCapability: 'secret-capability-fragment',
      deckText: 'Commander\n2 Celes, Rune Knight\nDeck\n0 Missing\n1 Not A Real Card\n',
    };
    seats[1] = {
      ...seats[1],
      deckId: seats[0].deckId,
      deckText: seats[0].deckText,
    };
    const invalid = { ...input, roomId: 'bad room id', serverBuildId: 'bad build id', seats };
    const first = bootstrapFourDeckGenesisV1(invalid);
    const second = bootstrapFourDeckGenesisV1(structuredClone(invalid));
    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first).not.toHaveProperty('coreRoot');
    expect(first).not.toHaveProperty('protocolState');
    expect(first).not.toHaveProperty('replayPackage');
    expect(first).not.toHaveProperty('measurements');
    expect(first.issues.some((issue) => issue.code === 'INVALID_ID' && issue.path === '/roomId')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'INVALID_BUILD_ID' && issue.path === '/serverBuildId')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'INVALID_CAPABILITY')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'DUPLICATE_DECK_ID')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'DUPLICATE_DECK_TEXT')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'COMMANDER_QUANTITY_INVALID')).toBe(true);
    expect(first.issues.some((issue) => issue.code === 'CARD_UNRESOLVED')).toBe(true);
    expect(new Set(first.issues.map((issue) => `${issue.path}\u0000${issue.code}\u0000${issue.message}`)).size).toBe(first.issues.length);
    const ordered = [...first.issues].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : left.code < right.code ? -1 : left.code > right.code ? 1 : left.message < right.message ? -1 : left.message > right.message ? 1 : 0);
    expect(first.issues).toEqual(ordered);
    expect(JSON.stringify(first)).not.toContain('secret-capability-fragment');

    const reachable = realInput();
    const capability = reachable.seats[0]?.seatCapability;
    expect(capability).toBeDefined();
    if (capability === undefined) return;
    const collision = bootstrapFourDeckGenesisV1({ ...reachable, roomId: capability });
    expect(collision.ok).toBe(false);
    if (!collision.ok) {
      expect(collision.issues).toContainEqual({
        code: 'CAPABILITY_FRAGMENT_IN_IDENTIFIER',
        path: '/roomId',
        message: 'Identifier contains configured capability data',
      });
      expect(collision.issues.some((issue) => issue.code === 'BOOTSTRAP_CONSTRUCTION_FAILED')).toBe(false);
      expect(JSON.stringify(collision)).not.toContain(capability);
    }
  });
});
