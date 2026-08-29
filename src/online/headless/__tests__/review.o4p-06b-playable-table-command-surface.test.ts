import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import * as Bootstrap from '../../bootstrap/index';
import * as Projection from '../../projection/index';
import * as Protocol from '../../protocol/index';
import * as Room from '../../room/index';
import {
  CORE_PLAYERS,
  PARTICIPANTS,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import { CURRENT_CONTRACT_VERSIONS } from '../../../versioning/index';

const DECKS = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
const PARTICIPANT_IDS = ['o4p06b-p1', 'o4p06b-p2', 'o4p06b-p3', 'o4p06b-p4'] as const;
const CAPABILITIES = [
  'o4p06b_seat_AAAAAAAAAAAAAAAAAAAA',
  'o4p06b_seat_BBBBBBBBBBBBBBBBBBBB',
  'o4p06b_seat_CCCCCCCCCCCCCCCCCCCC',
  'o4p06b_seat_DDDDDDDDDDDDDDDDDDDD',
] as const;
const CLIENT_BUILD_ID = 'o4p06b-client';
const P1 = 'P1' as Core.CorePlayerId;
const P2 = 'P2' as Core.CorePlayerId;
const P3 = 'P3' as Core.CorePlayerId;

type AcceptedTransition = Protocol.OnlineCommandTransitionV1 & {
  readonly response: Protocol.OnlineCommandAckV1;
};

let cachedBootstrap: Bootstrap.FourDeckBootstrapSuccessV1 | null = null;

function bootstrap(): Bootstrap.FourDeckBootstrapSuccessV1 {
  if (cachedBootstrap !== null) return cachedBootstrap;
  const result = Bootstrap.bootstrapFourDeckGenesisV1({
    roomId: 'o4p06b-room',
    serverBuildId: 'o4p06b-server',
    seats: DECKS.map((deck, seatIndex) => ({
      seatIndex,
      corePlayerId: CORE_PLAYERS[seatIndex],
      participantId: PARTICIPANT_IDS[seatIndex],
      seatCapability: CAPABILITIES[seatIndex],
      deckId: `o4p06b-${deck.toLowerCase()}`,
      deckText: readFileSync(`Mydeck/${deck}.txt`, 'utf8'),
    })),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('O4P-06B requires the shipped O4P-06A bootstrap');
  cachedBootstrap = result;
  return result;
}

function command(
  state: Protocol.OnlineProtocolStateV1,
  seatIndex: number,
  payload: Core.CoreCommandV1['payload'],
  sequence = state.revision + 1,
): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: CORE_PLAYERS[seatIndex] as Core.CorePlayerId,
    decisionMakerPlayerId: CORE_PLAYERS[seatIndex] as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: `o4p06b-${String(sequence)}` },
    payload,
  });
}

function envelope(
  state: Protocol.OnlineProtocolStateV1,
  seatIndex: number,
  commandId: string,
  coreCommand: Core.CoreCommandV1,
  baseRevision = state.revision,
): Protocol.OnlineCommandEnvelopeV1 {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANT_IDS[seatIndex] as Room.OnlineRoomParticipantIdV1,
    participantCapability:
      CAPABILITIES[seatIndex] as Room.OnlineRoomSeatCapabilityV1,
    commandId: commandId as Protocol.OnlineProtocolCommandIdV1,
    baseRevision,
    command: coreCommand,
  };
}

function accept(
  state: Protocol.OnlineProtocolStateV1,
  seatIndex: number,
  commandId: string,
  coreCommand: Core.CoreCommandV1,
): AcceptedTransition {
  const transition = Protocol.handleOnlineCommandEnvelopeV1(
    state,
    envelope(state, seatIndex, commandId, coreCommand),
  );
  expect(transition.response).toMatchObject({
    kind: 'online-command-ack-v1',
    status: 'accepted',
    duplicate: false,
  });
  if (transition.response.kind !== 'online-command-ack-v1') {
    throw new Error(`Expected accepted O4P-06B command ${commandId}`);
  }
  expect(transition.state.revision).toBe(state.revision + 1);
  expect(transition.state.coreRoot.acceptedCommandCount).toBe(state.revision + 1);
  expect(transition.state.receipts).toHaveLength(state.receipts.length + 1);
  assertDeepFrozen(transition);
  return transition as AcceptedTransition;
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

function tokenDefinition(): Core.CoreCardDefinitionSnapshotV1 {
  return Object.freeze({
    source: Object.freeze({ kind: 'engine-synthetic' as const }),
    name: 'O4P-06B Bear',
    layout: 'token',
    manaValue: 0,
    colorIdentity: Object.freeze([]),
    typeLine: 'Token Creature — Bear',
    keywords: Object.freeze([]),
    producedMana: Object.freeze([]),
    tokenKind: null,
    faces: Object.freeze([Object.freeze({
      name: 'O4P-06B Bear',
      manaCost: null,
      typeLine: 'Token Creature — Bear',
      oracleText: '',
      power: '2',
      toughness: '2',
      loyalty: null,
      defense: null,
    })]),
  });
}

function capabilityFragments(): readonly string[] {
  return Object.freeze(CAPABILITIES.flatMap((capability) =>
    Array.from({ length: capability.length - 7 }, (_, index) => capability.slice(index, index + 8))));
}

function expectNoCapabilityEvidence(value: unknown): void {
  const serialized = JSON.stringify(value);
  const fragments = new Set(capabilityFragments());
  let found: string | null = null;
  for (let index = 0; index <= serialized.length - 8; index += 1) {
    const candidate = serialized.slice(index, index + 8);
    if (fragments.has(candidate)) {
      found = candidate;
      break;
    }
  }
  expect(found).toBeNull();
}

describe('review O4P-06B playable tabletop command surface', () => {
  it('executes all frozen meanings through four real decks and replays the exact final Core state', () => {
    const genesis = bootstrap();
    const initialRoot = genesis.coreRoot;
    let state = genesis.protocolState;
    const acceptedCommands: Core.CoreCommandV1[] = [];
    const submit = (
      seatIndex: number,
      commandId: string,
      payload: Core.CoreCommandV1['payload'],
    ): void => {
      const current = command(state, seatIndex, payload);
      const transition = accept(state, seatIndex, commandId, current);
      acceptedCommands.push(current);
      state = transition.state;
    };

    submit(0, 'o4p06b-turn', {
      kind: 'table-turn-progress',
      transition: { kind: 'checkpoint' },
    });
    submit(0, 'o4p06b-draw', { kind: 'table-draw', count: 1 });

    const p2LibraryBefore = state.coreRoot.ruleAuthority.turnPriorityBundle
      .stackBundle.objectRegistry.zones.byPlayer[P2].library;
    const p2Card = p2LibraryBefore[0];
    expect(p2Card).toBeDefined();
    if (p2Card === undefined) throw new Error('P2 real deck must have a library card');
    submit(1, 'o4p06b-zone', {
      kind: 'table-zone-move',
      objectId: p2Card,
      destination: { kind: 'battlefield', baseControllerPlayerId: P2 },
    });
    const movedCard = state.coreRoot.ruleAuthority.turnPriorityBundle
      .stackBundle.objectRegistry.zones.shared.battlefield[0];
    expect(movedCard).toBeDefined();
    if (movedCard === undefined) throw new Error('Zone command must create a new battlefield object');

    submit(2, 'o4p06b-mana', { kind: 'table-mana-adjust', color: 'G', delta: 2 });
    submit(3, 'o4p06b-token', {
      kind: 'table-token-create',
      tokenSeed: 'o4p06b-bear',
      definitionId: 'o4p06b-bear-definition' as Core.CoreCardDefinitionId,
      definition: tokenDefinition(),
    });

    const collision = command(state, 3, {
      kind: 'table-token-create',
      tokenSeed: 'o4p06b-bear',
      definitionId: 'o4p06b-bear-definition-2' as Core.CoreCardDefinitionId,
      definition: tokenDefinition(),
    });
    const collisionTransition = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 3, 'o4p06b-token-collision', collision),
    );
    expect(collisionTransition.response).toMatchObject({
      kind: 'online-command-reject-v1',
      currentRevision: state.revision,
      duplicate: false,
    });
    expect(collisionTransition.state.coreRoot).toBe(state.coreRoot);
    expect(collisionTransition.state.revision).toBe(state.revision);
    state = collisionTransition.state;

    submit(0, 'o4p06b-tap', { kind: 'table-tap', objectId: movedCard, tapped: true });
    submit(1, 'o4p06b-counter', {
      kind: 'table-counter-adjust',
      objectId: movedCard,
      counterKind: 'charge',
      delta: 2,
    });
    submit(2, 'o4p06b-token-remove', {
      kind: 'table-token-remove',
      objectId: '@token:o4p06b-bear:0' as Core.CoreObjectId,
    });

    expect(new Set(acceptedCommands.map((entry) => entry.actorPlayerId))).toEqual(
      new Set(CORE_PLAYERS as readonly string[]),
    );
    expect(acceptedCommands.map((entry) => entry.payload.kind)).toEqual([
      'table-turn-progress',
      'table-draw',
      'table-zone-move',
      'table-mana-adjust',
      'table-token-create',
      'table-tap',
      'table-counter-adjust',
      'table-token-remove',
    ]);

    const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    const runtime = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRuntime;
    expect(registry.zones.byPlayer[P1].library).toHaveLength(
      initialRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[P1]
        .library.length - 1,
    );
    expect(registry.zones.byPlayer[P1].hand).toHaveLength(1);
    expect(registry.zones.byPlayer[P2].library).toHaveLength(p2LibraryBefore.length - 1);
    expect(registry.zones.shared.battlefield).toContain(movedCard);
    expect(runtime.byObject[movedCard]?.orientation.tapped).toBe(true);
    expect(runtime.byObject[movedCard]?.counterDamage.counters).toEqual([
      { kind: 'charge', count: 2 },
    ]);
    expect(registry.players[P3].manaPool.G).toBe(2);
    expect(registry.objects['@token:o4p06b-bear:0' as Core.CoreObjectId]).toBeUndefined();
    expect(runtime.byObject['@token:o4p06b-bear:0' as Core.CoreObjectId]).toBeUndefined();
    expect(state.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle.position).toEqual({
      phase: 'beginning',
      step: 'upkeep',
    });

    let replayRoot = initialRoot;
    let journal: readonly Core.CoreCommandJournalEntryV1[] = Object.freeze([]);
    const replayEvents: Core.CoreDomainEventV1[] = [];
    for (const acceptedCommand of acceptedCommands) {
      const result = Core.applyCoreCommandV1(replayRoot, acceptedCommand);
      expect(result.status).toBe('accepted');
      if (result.status === 'rejected') throw new Error('Accepted Protocol command must replay in Core');
      journal = Core.appendCoreCommandJournalEntryV1(journal, acceptedCommand, result);
      replayEvents.push(...result.events);
      replayRoot = result.root;
    }
    const replay = Core.replayCoreCommandsFromRootV1(initialRoot, journal);
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error('O4P-06B replay must be deterministic');
    expect(replay.finalStateDigest).toBe(Core.coreCanonicalDigestFromValueV1(state.coreRoot));
    expect(replay.finalStateDigest).toBe(Core.coreCanonicalDigestFromValueV1(replayRoot));
    expect(replay.eventTranscriptDigest).toBe(Core.coreCanonicalDigestFromValueV1(replayEvents));
    expectNoCapabilityEvidence({ journal, replay, events: replayEvents });
    assertDeepFrozen(state);
    assertDeepFrozen(journal);

    for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
      const projected = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
        kind: 'online-projection-request-v1',
        protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
        roomId: state.room.roomId,
        participantId: PARTICIPANT_IDS[seatIndex] as Room.OnlineRoomParticipantIdV1,
        participantCapability:
          CAPABILITIES[seatIndex] as Protocol.OnlineProtocolParticipantCapabilityV1,
        knownRevision: state.revision,
        clientBuildId: CLIENT_BUILD_ID,
        decisionContext: null,
      });
      expect(projected.response.status).toBe('accepted');
      expectNoCapabilityEvidence(projected.response);
      assertDeepFrozen(projected);
    }
  }, 240_000);

  it('fails closed for authority, revision, duplicate, role, hidden-zone, and underflow cases', () => {
    const genesis = bootstrap();
    let state = genesis.protocolState;
    const mana = command(state, 2, { kind: 'table-mana-adjust', color: 'U', delta: 1 });
    const acceptedMana = accept(state, 2, 'o4p06b-duplicate', mana);
    state = acceptedMana.state;

    const duplicate = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 2, 'o4p06b-duplicate', mana, 0),
    );
    expect(duplicate.state).toBe(state);
    expect(duplicate.response).toMatchObject({
      kind: 'online-command-ack-v1',
      duplicate: true,
      acceptedRevision: 1,
      currentRevision: 1,
    });

    const actorMismatch = command(state, 1, { kind: 'table-mana-adjust', color: 'U', delta: 1 });
    const actorMismatchTransition = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 0, 'o4p06b-actor-mismatch', actorMismatch),
    );
    expect(actorMismatchTransition.state).toBe(state);
    expect(actorMismatchTransition.response).toMatchObject({
      kind: 'online-command-reject-v1',
      issues: [{ code: 'ACTOR_MISMATCH' }],
    });

    const staleCommand = command(state, 3, { kind: 'table-mana-adjust', color: 'C', delta: 1 }, 1);
    const stale = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 3, 'o4p06b-stale', staleCommand, 0),
    );
    expect(stale.state.coreRoot).toBe(state.coreRoot);
    expect(stale.state.revision).toBe(state.revision);
    expect(stale.response).toMatchObject({
      kind: 'online-command-reject-v1',
      resyncRequired: true,
    });
    state = stale.state;

    const p2Hidden = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry
      .zones.byPlayer[P2].library[0];
    expect(p2Hidden).toBeDefined();
    if (p2Hidden === undefined) throw new Error('P2 library is required');
    const hidden = command(state, 0, {
      kind: 'table-zone-move',
      objectId: p2Hidden,
      destination: { kind: 'owner-hand' },
    });
    const hiddenTransition = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 0, 'o4p06b-hidden', hidden),
    );
    expect(hiddenTransition.state.coreRoot).toBe(state.coreRoot);
    expect(hiddenTransition.state.revision).toBe(state.revision);
    expect(hiddenTransition.response).toMatchObject({ kind: 'online-command-reject-v1' });
    state = hiddenTransition.state;

    const underflow = command(state, 2, { kind: 'table-mana-adjust', color: 'U', delta: -2 });
    const underflowTransition = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 2, 'o4p06b-underflow', underflow),
    );
    expect(underflowTransition.state.coreRoot).toBe(state.coreRoot);
    expect(underflowTransition.state.revision).toBe(state.revision);

    const invalidTurn = command(state, 1, {
      kind: 'table-turn-progress',
      transition: { kind: 'checkpoint' },
    });
    const invalidTurnTransition = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 1, 'o4p06b-invalid-turn', invalidTurn),
    );
    expect(invalidTurnTransition.state.coreRoot).toBe(state.coreRoot);
    expect(invalidTurnTransition.state.revision).toBe(state.revision);

    const tableId = 'o4p06b-table' as Room.OnlineRoomParticipantIdV1;
    const tableCapability =
      'o4p06b_table_TTTTTTTTTTTTTTTTTTTT' as Protocol.OnlineProtocolObserverCapabilityV1;
    let room = Room.joinOnlineRoomV1(readyAllPlayers(), { participantId: tableId, role: 'table' });
    room = Room.startOnlineRoomV1(room, PARTICIPANTS[0]);
    const tableRoot = genesis.coreRoot;
    room = Room.activateOnlineRoomV1(room, { hostParticipantId: PARTICIPANTS[0], coreRoot: tableRoot });
    const tableState = Protocol.createOnlineProtocolStateV1({
      serverBuildId: 'o4p06b-table-server',
      room,
      coreRoot: tableRoot,
      observerAuthorizations: [{ participantId: tableId, observerCapability: tableCapability }],
    });
    const tableCommand = Core.createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      decisionContext: { kind: 'decision', decisionKey: 'o4p06b-table-role' },
      payload: { kind: 'table-draw', count: 1 },
    });
    const tableTransition = Protocol.handleOnlineCommandEnvelopeV1(tableState, {
      kind: 'online-command-envelope-v1',
      protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
      roomId: tableState.room.roomId,
      participantId: tableId,
      participantCapability: tableCapability,
      commandId: 'o4p06b-table-role' as Protocol.OnlineProtocolCommandIdV1,
      baseRevision: 0 as Protocol.OnlineProtocolRevisionV1,
      command: tableCommand,
    });
    expect(tableTransition.state).toBe(tableState);
    expect(tableTransition.response).toMatchObject({
      kind: 'online-command-reject-v1',
      issues: [{ code: 'ROLE_NOT_ALLOWED' }],
    });
    expectNoCapabilityEvidence(tableTransition.response);
  }, 30_000);

  it('rejects hostile command graphs without throwing or widening the closed algebra', () => {
    const genesis = bootstrap();
    const valid = command(genesis.protocolState, 0, {
      kind: 'table-token-create',
      tokenSeed: 'o4p06b-hostile-token',
      definitionId: 'o4p06b-hostile-definition' as Core.CoreCardDefinitionId,
      definition: tokenDefinition(),
    });
    const raw = JSON.parse(JSON.stringify(valid)) as Record<string, unknown>;
    const validPayload = raw.payload as Record<string, unknown>;
    const validDefinition = validPayload.definition as Record<string, unknown>;

    const accessorPayload = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorPayload, 'kind', {
      enumerable: true,
      get: () => 'table-draw',
    });
    const accessor = { ...raw, payload: accessorPayload };
    const withSymbol = structuredClone(raw) as Record<PropertyKey, unknown>;
    (withSymbol.payload as Record<PropertyKey, unknown>)[Symbol('hostile')] = true;
    const exotic = { ...raw, payload: new (class HostilePayload {
      readonly kind = 'table-draw';
      readonly count = 1;
    })() };
    const sparseFaces = structuredClone(raw);
    const sparseDefinition = (sparseFaces.payload as Record<string, unknown>)
      .definition as Record<string, unknown>;
    const sparse = Array<unknown>(1);
    sparseDefinition.faces = sparse;
    const oversizedFaces = structuredClone(raw);
    const oversizedDefinition = (oversizedFaces.payload as Record<string, unknown>)
      .definition as Record<string, unknown>;
    oversizedDefinition.faces = Array<unknown>(0xffff_ffff);
    const revoked = Proxy.revocable<unknown[]>([], {});
    revoked.revoke();
    const revokedFaces = structuredClone(raw);
    ((revokedFaces.payload as Record<string, unknown>).definition as Record<string, unknown>)
      .faces = revoked.proxy;
    const cyclic = structuredClone(raw);
    const cyclicDefinition = (cyclic.payload as Record<string, unknown>)
      .definition as Record<string, unknown>;
    cyclicDefinition.faces = [cyclicDefinition];

    const cases: readonly unknown[] = [
      { ...raw, extra: true },
      { ...raw, payload: { kind: 'table-draw' } },
      accessor,
      withSymbol,
      exotic,
      sparseFaces,
      oversizedFaces,
      revokedFaces,
      cyclic,
      { ...raw, payload: { kind: 'table-mana-adjust', color: 'G', delta: Number.NaN } },
      { ...raw, payload: { kind: 'table-mana-adjust', color: 'G', delta: -0 } },
      { ...raw, decisionContext: { kind: 'decision', decisionKey: 'hostile', turnNumber: -0 } },
      { ...raw, payload: { kind: 'table-counter-adjust', objectId: 'not-an-object', counterKind: 'x', delta: 1 } },
      { ...raw, payload: { kind: 'table-zone-move', objectId: 'PC1:0', destination: { kind: 'battlefield', baseControllerPlayerId: 'constructor' } } },
      { ...raw, payload: { ...validPayload, tokenSeed: '__proto__' } },
      { ...raw, payload: { ...validPayload, definitionId: 'constructor' } },
      { ...raw, payload: { ...validPayload, definition: { ...validDefinition, source: { kind: 'scryfall' } } } },
      { ...raw, payload: { kind: 'unbounded-state-patch', state: genesis.coreRoot } },
    ];
    for (const candidate of cases) {
      expect(() => Core.validateCoreCommandV1(candidate)).not.toThrow();
      expect(Core.validateCoreCommandV1(candidate).ok).toBe(false);
    }

    const tainted = structuredClone(raw);
    const fragment = CAPABILITIES[0].slice(5, 13);
    const taintedDefinition = (tainted.payload as Record<string, unknown>)
      .definition as Record<string, unknown>;
    taintedDefinition.name = `Bear-${fragment}`;
    const transition = Protocol.handleOnlineCommandEnvelopeV1(
      genesis.protocolState,
      envelope(
        genesis.protocolState,
        0,
        'o4p06b-fragment',
        Core.createCoreCommandV1({
          schemaVersion: 1,
          sequence: 1,
          actorPlayerId: 'P1' as Core.CorePlayerId,
          decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
          decisionContext: { kind: 'decision', decisionKey: 'o4p06b-fragment' },
          payload: (tainted.payload as Core.CoreCommandV1['payload']),
        }),
      ),
    );
    expect(transition.state).toBe(genesis.protocolState);
    expect(transition.response).toMatchObject({
      kind: 'online-command-reject-v1',
      issues: [{ code: 'INVALID_CAPABILITY', path: '/command' }],
    });
    expect(JSON.stringify(transition.response)).not.toContain(fragment);
    expect(JSON.stringify(transition.state.coreRoot)).not.toContain(fragment);
  }, 30_000);
});
