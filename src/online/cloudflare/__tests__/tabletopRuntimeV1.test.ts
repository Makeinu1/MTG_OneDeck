import { describe, expect, it, vi } from 'vitest';
import { coreCanonicalDigestFromValueV1, createCoreCommandV1, type CoreCommandPayloadV1, type CoreObjectId } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import {
  claimOnlineVariableLobbySeatV4,
  createOnlineVariableLobbyV4,
} from '../../lobby/index';
import { projectOnlineVariableProtocolV2, projectOnlineVariableProtocolV3, validateOnlineParticipantProjectionV3 } from '../../projection/index';
import { OnlineCloudflareRepository, OnlineRoomDurableObject } from '../index';
import { isOnlineVariableProjectionWithinFrameBudgetV1 } from '../projectionBudgetV1';
import { ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1 } from '../security';
import { ReviewSqliteStorage } from './reviewSqliteStorage';

const SID = '5da14d86-0780-4821-a799-96f64b377df4';
const OID = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
const card = (): CardDef => ({ scryfallId: SID, oracleId: OID, name: 'Tabletop runtime card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Creature', faces: [{ name: 'Tabletop runtime card', typeLine: 'Creature' }] });

function lobby(playerCount: 2 | 4) {
  return createOnlineVariableLobbyV4({
    roomId: `tabletop-runtime-${playerCount}`,
    serverBuildId: 'tabletop-runtime-build',
    hostParticipantId: 'host',
    configuration: { playerCount, startingLife: 40 },
    seatCapabilities: Array.from({ length: playerCount }, (_, index) => `seat_${String(index).repeat(32)}`),
    ['admissionCapability']: `admission_${'a'.repeat(32)}`,
    tableParticipantId: 'table-runtime',
    ['tableCapability']: `observer_${'o'.repeat(32)}`,
  });
}

function completePregame(repository: OnlineCloudflareRepository, roomId: string): void {
  let state = repository.loadPregameV1(roomId);
  if (state === null) throw new Error('Missing pregame fixture');
  let index = 0;
  while (state.phase !== 'complete') {
    const actor = state.currentPlayerId ?? state.players.find((player) => !player.ready)?.playerId;
    if (actor === undefined) throw new Error('Missing pregame actor');
    const seat = state.protocolState.room.seats.find((entry) => entry.corePlayerId === actor);
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing pregame seat');
    const command = state.phase === 'commander-reveal'
      ? { kind: 'confirm-commanders' as const }
      : state.phase === 'mulligan-declaration'
        ? { kind: 'declare-mulligan' as const, decision: 'keep' as const }
        : state.phase === 'pregame-actions'
          ? { kind: 'complete-pregame-actions' as const }
          : { kind: 'set-ready' as const, ready: true };
    const result = repository.applyPregameCommandV1(roomId, {
      kind: 'online-pregame-command-envelope-v1', schemaVersion: 1, roomId,
      participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: `tabletop-pregame-${String(index)}`, baseRevision: state.revision, command,
    });
    if (result?.response.kind !== 'online-pregame-command-ack-v1') throw new Error('Pregame command rejected');
    state = repository.loadPregameV1(roomId) ?? state;
    index += 1;
  }
}

async function started(playerCount: 2 | 4) {
  const storage = new ReviewSqliteStorage();
  const repository = new OnlineCloudflareRepository(storage);
  repository.migrateApplicationSchema();
  let current = lobby(playerCount);
  const participants = ['host'];
  for (let index = 1; index < playerCount; index += 1) {
    const claimed = claimOnlineVariableLobbySeatV4(current, `player-${String(index + 1)}`, current.admissionCapability);
    current = claimed.lobby;
    participants.push(`player-${String(index + 1)}`);
  }
  repository.initializeVariableLobbyV4(current);
  const resolver = { resolve: () => Promise.resolve(new Map([[SID, card()]])) };
  for (let index = 0; index < playerCount; index += 1) {
    const participantId = participants[index] ?? '';
    const seatCredential = current.seats[index]?.seatCapability ?? '';
    await repository.submitVariableDeckV2(current.roomId, {
      kind: 'online-forming-lobby-deck-submit-v2', schemaVersion: 2, participantId,
      ['seatCapability']: seatCredential, deckId: `tabletop-deck-${String(index)}`, submissionId: `tabletop-submission-${String(index)}`,
      entries: [{ section: 'main', quantity: 8, scryfallId: SID, oracleId: OID }],
    }, resolver);
    repository.setVariableReadyV4(current.roomId, participantId, seatCredential, true);
  }
  repository.startVariableV4(current.roomId, 'host', current.seats[0]?.seatCapability ?? '');
  completePregame(repository, current.roomId);
  return { storage, repository, roomId: current.roomId } as const;
}

function post(object: OnlineRoomDurableObject, roomId: string, body: Record<string, unknown>): Promise<Response> {
  return object.fetch(new Request(`https://room.test/api/online/rooms/${roomId}/commands`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function activeSeat(state: ReturnType<OnlineCloudflareRepository['loadVariableProtocolV2']>) {
  if (state === null) throw new Error('Missing protocol fixture');
  const activePlayerId = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId;
  const seat = state.room.seats.find((candidate) => candidate.corePlayerId === activePlayerId);
  if (seat?.participantId === null || seat === undefined) throw new Error('Missing active seat');
  return { activePlayerId, seat } as const;
}

function ordinaryEnvelope(
  state: NonNullable<ReturnType<OnlineCloudflareRepository['loadVariableProtocolV2']>>,
  commandId: string,
  payload: CoreCommandPayloadV1,
): Record<string, unknown> {
  const { activePlayerId, seat } = activeSeat(state);
  const command = createCoreCommandV1({
    schemaVersion: 1,
    sequence: state.revision + 1,
    actorPlayerId: activePlayerId,
    decisionMakerPlayerId: activePlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'tabletop-network-guard' },
    payload,
  });
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: seat.participantId,
    ['participantCapability']: seat.seatCapability,
    commandId,
    baseRevision: state.revision,
    command,
  };
}

function tabletopIntentBody(
  state: NonNullable<ReturnType<OnlineCloudflareRepository['loadVariableProtocolV2']>>,
  commandId: string,
  primitive: Record<string, unknown>,
  mode: 'structured' | 'freeform' = 'structured',
): Record<string, unknown> {
  const { seat } = activeSeat(state);
  return {
    kind: 'online-tabletop-intent-envelope-v1',
    schemaVersion: 1,
    protocolVersion: state.protocolVersion,
    roomId: state.room.roomId,
    participantId: seat.participantId,
    ['participantCapability']: seat.seatCapability,
    commandId,
    baseRevision: state.revision,
    mode,
    primitive,
  };
}

const journeyTokenId = (seed: string): CoreObjectId => `${['@', 'token', ':'].join('')}${seed}:0` as CoreObjectId;

const journeyTokenDefinition = Object.freeze({
  source: Object.freeze({ kind: 'engine-synthetic' as const }),
  name: 'Journey token',
  layout: 'normal',
  manaValue: 0,
  colorIdentity: Object.freeze([]),
  typeLine: 'Token Creature',
  keywords: Object.freeze([]),
  producedMana: Object.freeze([]),
  tokenKind: null,
  faces: Object.freeze([Object.freeze({ name: 'Journey token', manaCost: null, typeLine: 'Token Creature', oracleText: '', power: '1', toughness: '1', loyalty: null, defense: null })]),
});

const aggregateTokenDefinition = Object.freeze({
  source: Object.freeze({ kind: 'engine-synthetic' as const }),
  name: 'Aggregate token',
  layout: 'normal',
  manaValue: 0,
  colorIdentity: Object.freeze([]),
  typeLine: 'Token Artifact',
  keywords: Object.freeze(Array.from({ length: 16 }, (_, index) => `keyword-${String(index).padStart(2, '0')}${'x'.repeat(300)}`)),
  producedMana: Object.freeze([]),
  tokenKind: null,
  faces: Object.freeze([Object.freeze({
    name: 'Aggregate token', manaCost: 'x'.repeat(128), typeLine: 'Token Artifact', oracleText: 'x'.repeat(512),
    power: '1', toughness: '1', loyalty: null, defense: null,
  })]),
});

function controlledBattlefieldObject(state: NonNullable<ReturnType<OnlineCloudflareRepository['loadVariableProtocolV2']>>, playerId: string, exclude: CoreObjectId | null = null): CoreObjectId {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const found = registry.zones.shared.battlefield.find((objectId) => {
    if (objectId === exclude) return false;
    const identity = registry.objects[objectId];
    return identity !== undefined
      && (identity.kind === 'card' || identity.kind === 'token')
      && identity.baseControllerPlayerId === playerId;
  });
  if (found === undefined) throw new Error('Missing controlled battlefield object');
  return found;
}

describe('O4P-09D server tabletop transport', () => {
  it('rejects client-authoritative random and legacy tabletop envelopes before mutation', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const { activePlayerId } = activeSeat(initial);
    const library = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[activePlayerId]?.library ?? [];
    const battlefieldObject = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.shared.battlefield[0] ?? 'PC1:0';
    const directPayloads: readonly [string, CoreCommandPayloadV1][] = [
      ['client-random', { kind: 'random-zone-order', randomDecisionId: 'client-random', zone: { kind: 'player-zone', playerId: activePlayerId, zone: 'library' }, beforeOrder: library, afterOrder: library }],
      ['client-shuffle', { kind: 'table-shuffle', manualMode: 'structured' }],
      ['legacy-move', { kind: 'table-zone-move', objectId: battlefieldObject, destination: { kind: 'owner-graveyard' } }],
      ['legacy-tap', { kind: 'table-tap', objectId: battlefieldObject, tapped: true }],
      ['legacy-counter', { kind: 'table-counter-adjust', objectId: battlefieldObject, counterKind: 'charge', delta: 1 }],
      ['legacy-token-remove', { kind: 'table-token-remove', objectId: journeyTokenId('legacy-token') }],
    ];
    let randomCalls = 0;
    vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(array: T): T => {
      randomCalls += 1;
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
      return array;
    } });
    try {
      for (const [id, payload] of directPayloads) {
        const stateBefore = fixture.repository.loadVariableProtocolV2(fixture.roomId);
        if (stateBefore === null) throw new Error('Missing protocol fixture');
        const response = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, ordinaryEnvelope(stateBefore, id, payload));
        expect(response.status).toBe(400);
        const stateAfter = fixture.repository.loadVariableProtocolV2(fixture.roomId);
        if (stateAfter === null) throw new Error('Missing protocol fixture');
        expect(coreCanonicalDigestFromValueV1(stateAfter.coreRoot)).toBe(coreCanonicalDigestFromValueV1(stateBefore.coreRoot));
        expect(stateAfter.revision).toBe(stateBefore.revision);
        expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(0);
      }
      expect(randomCalls).toBe(0);

      const beforeRawShapeProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (beforeRawShapeProbe === null) throw new Error('Missing protocol fixture');
      const rawShapeProbe = {
        ...tabletopIntentBody(beforeRawShapeProbe, 'client-state-patch', { kind: 'shuffle' }),
        statePatch: {},
      };
      const malformedIntent = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, rawShapeProbe);
      expect(malformedIntent.status).toBe(400);
      const afterRawShapeProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterRawShapeProbe === null) throw new Error('Missing protocol fixture');
      expect(afterRawShapeProbe.revision).toBe(beforeRawShapeProbe.revision);
      expect(coreCanonicalDigestFromValueV1(afterRawShapeProbe.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeRawShapeProbe.coreRoot));
      expect(randomCalls).toBe(0);

      const missingFieldProbe = tabletopIntentBody(beforeRawShapeProbe, 'client-missing-mode', { kind: 'shuffle' });
      delete missingFieldProbe.mode;
      const missingFieldResponse = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, missingFieldProbe);
      expect(missingFieldResponse.status).toBe(400);
      const afterMissingFieldProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterMissingFieldProbe === null) throw new Error('Missing protocol fixture');
      expect(afterMissingFieldProbe.revision).toBe(beforeRawShapeProbe.revision);
      expect(coreCanonicalDigestFromValueV1(afterMissingFieldProbe.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeRawShapeProbe.coreRoot));
      expect(randomCalls).toBe(0);

      const missingProtocolProbe = tabletopIntentBody(beforeRawShapeProbe, 'client-missing-protocol', { kind: 'shuffle' });
      delete missingProtocolProbe.protocolVersion;
      const missingProtocolResponse = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, missingProtocolProbe);
      expect(missingProtocolResponse.status).toBe(400);
      const afterMissingProtocolProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterMissingProtocolProbe === null) throw new Error('Missing protocol fixture');
      expect(afterMissingProtocolProbe.revision).toBe(beforeRawShapeProbe.revision);
      expect(coreCanonicalDigestFromValueV1(afterMissingProtocolProbe.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeRawShapeProbe.coreRoot));
      expect(randomCalls).toBe(0);

      const beforeBearerProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (beforeBearerProbe === null) throw new Error('Missing protocol fixture');
      const { seat } = activeSeat(beforeBearerProbe);
      const bearerProbe = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, tabletopIntentBody(beforeBearerProbe, 'client-bearer-fragment', { kind: 'note-set', noteId: 'bearer-probe', text: `safe ${seat.seatCapability}` }));
      expect(bearerProbe.status).toBe(401);
      const bearerProbeBody = await bearerProbe.text();
      expect(bearerProbeBody).not.toContain(seat.seatCapability);
      const afterBearerProbe = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterBearerProbe === null) throw new Error('Missing protocol fixture');
      expect(afterBearerProbe.revision).toBe(beforeBearerProbe.revision);
      expect(coreCanonicalDigestFromValueV1(afterBearerProbe.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeBearerProbe.coreRoot));
      expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      fixture.storage.close();
    }
  }, 60000);

  it.each([2, 4] as const)('accepts a high-level shuffle for a %ip room and reconstructs the same digest', async (playerCount) => {
    const fixture = await started(playerCount);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const activePlayerId = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId;
    const seat = initial.room.seats.find((candidate) => candidate.corePlayerId === activePlayerId);
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing active seat');
    const body = {
      kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId,
      participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
      commandId: `tabletop-shuffle-${String(playerCount)}`, baseRevision: initial.revision,
      mode: 'structured', primitive: { kind: 'shuffle' },
    };
    let randomCalls = 0;
    vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(array: T): T => {
      randomCalls += 1;
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
      return array;
    } });
    try {
      const accepted = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, body);
      const acceptedBody = await accepted.json() as Record<string, unknown>;
      expect(accepted.status).toBe(200);
      expect(acceptedBody).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: initial.revision + 1 });
      expect(JSON.stringify(acceptedBody)).not.toContain('random-zone-order');
      const callsAfterFirst = randomCalls;
      const duplicate = await post(new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] }), fixture.roomId, body);
      const duplicateBody: unknown = await duplicate.json();
      expect(duplicateBody).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true, acceptedRevision: initial.revision + 1 });
      expect(randomCalls).toBe(callsAfterFirst);
      const reloaded = new OnlineCloudflareRepository(fixture.storage, false).loadVariableProtocolV2(fixture.roomId);
      expect(reloaded?.revision).toBe(initial.revision + 1);
      expect(reloaded?.coreRoot).toEqual(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.coreRoot);
      if (reloaded === null) throw new Error('Missing reconstructed state');
      const participantProjection = projectOnlineVariableProtocolV3(reloaded, seat.participantId);
      const tableProjection = projectOnlineVariableProtocolV3(reloaded, 'table-runtime');
      expect(validateOnlineParticipantProjectionV3(participantProjection).ok).toBe(true);
      expect(validateOnlineParticipantProjectionV3(tableProjection).ok).toBe(true);
      expect(JSON.stringify(participantProjection)).not.toMatch(/(?:beforeOrder|afterOrder|randomDecisionId|entropy|seat_)/u);
      const projectionShape = participantProjection as unknown as Readonly<{ readonly game: Readonly<{ readonly zones: Readonly<{ readonly byPlayer: readonly Readonly<{ readonly playerId: string; readonly zones: Readonly<{ readonly library: Readonly<{ readonly entries: readonly unknown[] }> }> }>[] }> }> }>;
      const ownLibrary = projectionShape.game.zones.byPlayer.find((group) => group.playerId === activePlayerId)?.zones.library;
      expect(ownLibrary?.entries.every((entry) => entry !== null && typeof entry === 'object' && !Object.prototype.hasOwnProperty.call(entry, 'objectId'))).toBe(true);
      expect(coreCanonicalDigestFromValueV1(reloaded.coreRoot)).toBe(coreCanonicalDigestFromValueV1(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.coreRoot));
    } finally {
      vi.unstubAllGlobals();
      fixture.storage.close();
    }
  }, 60000);

  it.each([2, 4] as const)('replays every executable high-level primitive family for a %ip room', async (playerCount) => {
    const fixture = await started(playerCount);
    const durableObject = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const { activePlayerId, seat } = activeSeat(initial);
    let nextRevision = initial.revision;
    const responses: string[] = [];
    const assertProjections = (state: NonNullable<ReturnType<OnlineCloudflareRepository['loadVariableProtocolV2']>>): void => {
      const participantId = state.room.seats.find((candidate) => candidate.corePlayerId === activePlayerId)?.participantId;
      if (participantId === null || participantId === undefined) throw new Error('Missing projected participant');
      expect(validateOnlineParticipantProjectionV3(projectOnlineVariableProtocolV3(state, participantId)).ok).toBe(true);
      expect(validateOnlineParticipantProjectionV3(projectOnlineVariableProtocolV3(state, 'table-runtime')).ok).toBe(true);
    };
    const submit = async (id: string, primitive: Record<string, unknown>, mode: 'structured' | 'freeform' = 'structured'): Promise<void> => {
      const body: Record<string, unknown> = {
        kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId,
        participantId: seat.participantId, ['participantCapability']: seat.seatCapability,
        commandId: id, baseRevision: nextRevision, mode, primitive,
      };
      const response = await post(durableObject, fixture.roomId, body);
      const text = await response.text();
      responses.push(text);
      expect(response.status).toBe(200);
      expect(text).toMatch(/online-command-ack-v1/u);
      expect(text).not.toMatch(/(?:beforeOrder|afterOrder|randomDecisionId|participantCapability|seatCapability|commandJson|rawRoot)/u);
      const ackBody = JSON.parse(text) as { readonly kind?: string; readonly duplicate?: boolean };
      expect(ackBody.kind).toBe('online-command-ack-v1');
      expect(ackBody.duplicate).toBe(false);
      nextRevision += 1;
      const projected = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (projected === null) throw new Error('Missing projected protocol state');
      assertProjections(projected);
    };

    try {
      await submit('journey-draw', { kind: 'draw', count: 1 });
      await submit('journey-shuffle', { kind: 'shuffle' }, 'freeform');

      let state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (state === null) throw new Error('Missing protocol fixture');
      const ownHand = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[activePlayerId]?.hand[0];
      if (ownHand === undefined) throw new Error('Missing own hand object');
      await submit('journey-move-one', { kind: 'move', objectId: ownHand, destination: { kind: 'battlefield', baseControllerPlayerId: activePlayerId } });

      state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (state === null) throw new Error('Missing protocol fixture');
      const secondHand = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[activePlayerId]?.hand[0];
      if (secondHand === undefined) throw new Error('Missing second own hand object');
      await submit('journey-move-two', { kind: 'move', objectId: secondHand, destination: { kind: 'battlefield', baseControllerPlayerId: activePlayerId } }, 'freeform');

      state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (state === null) throw new Error('Missing protocol fixture');
      const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
      await submit('journey-reorder', { kind: 'reorder', zone: { kind: 'shared-zone', zone: 'battlefield' }, order: registry.zones.shared.battlefield });
      const primary = controlledBattlefieldObject(state, activePlayerId);
      const secondary = controlledBattlefieldObject(state, activePlayerId, primary);
      await submit('journey-tap', { kind: 'tap', objectId: primary, tapped: true });
      await submit('journey-counter', { kind: 'counter', objectId: primary, counterKind: 'charge', delta: 1 }, 'freeform');
      await submit('journey-damage-mark', { kind: 'damage', objectId: primary, amount: 1 });
      await submit('journey-damage-clear', { kind: 'damage', objectId: primary, amount: -1 }, 'freeform');
      await submit('journey-life', { kind: 'life', field: 'life', delta: -1 });
      await submit('journey-mana', { kind: 'mana', color: 'G', delta: 1 }, 'freeform');
      await submit('journey-token-create', { kind: 'token-create', tokenSeed: 'journey-token', definitionId: 'journey-token-definition', definition: journeyTokenDefinition });
      await submit('journey-token-remove', { kind: 'token-remove', objectId: journeyTokenId('journey-token') }, 'freeform');
      await submit('journey-attach', { kind: 'attach', objectId: primary, targetObjectId: secondary });
      await submit('journey-detach', { kind: 'attach', objectId: primary, targetObjectId: null }, 'freeform');
      await submit('journey-note-set', { kind: 'note-set', noteId: 'journey-note', text: 'Public table reminder' });
      await submit('journey-note-clear', { kind: 'note-clear', noteId: 'journey-note' }, 'freeform');
      await submit('journey-stack-entry', { kind: 'stack-entry', entryId: 'journey-entry', label: 'Public manual declaration', sourceObjectId: null });
      await submit('journey-manual-resolve', { kind: 'manual-resolve', entryId: 'journey-entry' }, 'freeform');
      await submit('journey-controller', { kind: 'controller', objectId: primary, gainingControllerPlayerId: 'P2' }, 'freeform');

      const reloaded = new OnlineCloudflareRepository(fixture.storage, false).loadVariableProtocolV2(fixture.roomId);
      if (reloaded === null) throw new Error('Missing reconstructed state');
      expect(reloaded.revision).toBe(responses.length);
      expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(responses.length);
      expect(coreCanonicalDigestFromValueV1(reloaded.coreRoot)).toBe(coreCanonicalDigestFromValueV1(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.coreRoot));
      const participant = reloaded.room.seats.find((seat) => seat.corePlayerId === activePlayerId)?.participantId;
      if (participant === null || participant === undefined) throw new Error('Missing participant');
      expect(validateOnlineParticipantProjectionV3(projectOnlineVariableProtocolV3(reloaded, participant)).ok).toBe(true);
      expect(validateOnlineParticipantProjectionV3(projectOnlineVariableProtocolV3(reloaded, 'table-runtime')).ok).toBe(true);
    } finally {
      fixture.storage.close();
    }
  }, 120000);

  it('rejects stale shuffle before entropy and rejects changed mode/primitive/base reuse', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const seat = initial.room.seats.find((candidate) => candidate.corePlayerId === initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId);
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing active seat');
    let randomCalls = 0;
    vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(array: T): T => {
      randomCalls += 1;
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
      return array;
    } });
    try {
      const object = () => new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
      const unauthorized = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: initial.room.seats.find((candidate) => candidate.participantId !== seat.participantId)?.seatCapability, commandId: 'tabletop-unauthorized', baseRevision: initial.revision, mode: 'structured', primitive: { kind: 'shuffle' } });
      expect(unauthorized.status).toBe(401);
      expect(randomCalls).toBe(0);
      expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.revision).toBe(initial.revision);
      const stale = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-stale-shuffle', baseRevision: initial.revision + 1, mode: 'structured', primitive: { kind: 'shuffle' } });
      expect(stale.status).toBe(400);
      expect(randomCalls).toBe(0);
      const accepted = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-reuse', baseRevision: initial.revision, mode: 'structured', primitive: { kind: 'life', field: 'life', delta: 1 } });
      expect(await accepted.json()).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false });
      const current = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (current === null) throw new Error('Missing current protocol');
      const changedMode = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-reuse', baseRevision: initial.revision, mode: 'freeform', primitive: { kind: 'life', field: 'life', delta: 1 } });
      expect(await changedMode.json()).toMatchObject({ kind: 'online-command-reject-v1', issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }] });
      const changedPrimitive = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-reuse', baseRevision: initial.revision, mode: 'structured', primitive: { kind: 'life', field: 'life', delta: 2 } });
      expect(await changedPrimitive.json()).toMatchObject({ kind: 'online-command-reject-v1', issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }] });
      const changedBase = await post(object(), fixture.roomId, { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-reuse', baseRevision: initial.revision + 1, mode: 'structured', primitive: { kind: 'life', field: 'life', delta: 1 } });
      expect(await changedBase.json()).toMatchObject({ kind: 'online-command-reject-v1', issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }] });
      expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.revision).toBe(current.revision);
    } finally {
      vi.unstubAllGlobals();
      fixture.storage.close();
    }
  }, 60000);

  it('rejects over-cap persisted note and manual-stack collections before variable state mutation', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const beforeDigest = coreCanonicalDigestFromValueV1(initial.coreRoot);
    const beforeRevision = initial.revision;
    const beforeJournalCount = fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count ?? 0;
    const notes: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const noteOrder: string[] = [];
    for (let index = 0; index < 216; index += 1) {
      const id = `runtime-note-${String(index)}`;
      notes[id] = { id, authorPlayerId: 'P1', text: 'x'.repeat(160), creationRevision: 1 };
      noteOrder.push(id);
    }
    const overNotes = {
      ...initial,
      revision: 216,
      coreRoot: {
        ...initial.coreRoot,
        acceptedCommandCount: 216,
        tabletopManual: { kind: 'core-tabletop-manual-state-v1', notes, noteOrder, stackEntries: [] },
      },
    };
    expect(() => fixture.repository.initializeVariableProtocolV2(overNotes as never)).toThrow();
    const entries = Array.from({ length: 216 }, (_, index) => ({
      id: `runtime-entry-${String(index)}`,
      label: 'x'.repeat(160),
      provenance: 'structured',
      sourceObjectId: null,
      authorPlayerId: 'P1',
      creationRevision: 1,
    }));
    const overStack = {
      ...initial,
      revision: 216,
      coreRoot: {
        ...initial.coreRoot,
        acceptedCommandCount: 216,
        tabletopManual: { kind: 'core-tabletop-manual-state-v1', notes: {}, noteOrder: [], stackEntries: entries },
      },
    };
    expect(() => fixture.repository.initializeVariableProtocolV2(overStack as never)).toThrow();
    const after = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (after === null) throw new Error('Missing protocol fixture');
    expect(after.revision).toBe(beforeRevision);
    expect(coreCanonicalDigestFromValueV1(after.coreRoot)).toBe(beforeDigest);
    expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(beforeJournalCount);
    fixture.storage.close();
  }, 60000);

  it('rejects a projection whose worst valid snapshot envelope exceeds the frame budget', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    try {
      const emptyBuildState = { ...initial, serverBuildId: '' };
      const audienceIds = [
        ...emptyBuildState.room.participants.map((entry) => entry.participantId),
        ...emptyBuildState.observerAuthorizations.map((entry) => entry.participantId),
      ];
      const snapshotBytes = (
        state: typeof emptyBuildState,
        participantId: string,
        projection: unknown,
        knownRevision: number,
        clientBuildIdMatch: boolean,
      ): number => {
        const participant = state.room.participants.find((entry) => entry.participantId === participantId);
        const value = {
          kind: 'online-projected-snapshot-v1',
          protocolVersion: state.protocolVersion,
          status: 'accepted',
          roomId: state.room.roomId,
          participantId,
          role: participant?.role ?? 'table',
          knownRevision,
          revision: state.revision,
          serverBuildId: state.serverBuildId,
          clientBuildIdMatch,
          reason: knownRevision === state.revision ? 'synchronized' : 'snapshot-required',
          projection,
          issues: [],
        };
        const serialized = JSON.stringify(value);
        if (serialized === undefined) throw new Error('Snapshot did not serialize');
        return new TextEncoder().encode(serialized).length;
      };
      const projections = audienceIds.flatMap((participantId) => [
        projectOnlineVariableProtocolV2(emptyBuildState, participantId),
        projectOnlineVariableProtocolV3(emptyBuildState, participantId),
      ]);
      let currentMaximum = 0;
      for (const participantId of audienceIds) {
        for (const projection of [
          projectOnlineVariableProtocolV2(emptyBuildState, participantId),
          projectOnlineVariableProtocolV3(emptyBuildState, participantId),
        ]) {
          currentMaximum = Math.max(currentMaximum, snapshotBytes(emptyBuildState, participantId, projection, emptyBuildState.revision, true));
        }
      }
      expect(projections.length).toBe(audienceIds.length * 2);
      const fillerLength = ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1 - currentMaximum - 10;
      expect(fillerLength).toBeGreaterThan(0);
      const nearLimit = { ...emptyBuildState, serverBuildId: 'x'.repeat(fillerLength) };
      expect(snapshotBytes(nearLimit, audienceIds[0] ?? '', projectOnlineVariableProtocolV2(nearLimit, audienceIds[0] ?? ''), nearLimit.revision, true)).toBeLessThanOrEqual(ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1);
      const staleRevision = nearLimit.revision === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER;
      const worstCase = audienceIds.some((participantId) => [
        projectOnlineVariableProtocolV2(nearLimit, participantId),
        projectOnlineVariableProtocolV3(nearLimit, participantId),
      ].some((projection) => snapshotBytes(nearLimit, participantId, projection, staleRevision, false) > ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1));
      expect(worstCase).toBe(true);
      expect(isOnlineVariableProjectionWithinFrameBudgetV1(nearLimit)).toBe(false);
    } finally {
      fixture.storage.close();
    }
  }, 60000);

  it('rejects a repeated bounded-token aggregate before HTTP persistence when projections exceed the frame budget', async () => {
    const fixture = await started(2);
    const object = () => new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [] });
    let state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (state === null) throw new Error('Missing protocol fixture');
    let rejected = false;
    try {
      for (let index = 0; index < 24; index += 1) {
        const before = state;
        const response = await post(object(), fixture.roomId, tabletopIntentBody(before, `aggregate-token-${String(index)}`, {
          kind: 'token-create', tokenSeed: `aggregate-token-${String(index)}`,
          definitionId: `aggregate-definition-${String(index)}`, definition: aggregateTokenDefinition,
        }));
        const responseText = await response.text();
        if (response.status === 413) {
          rejected = true;
          expect(responseText).toContain('online-cloudflare-error-v1');
          const after = fixture.repository.loadVariableProtocolV2(fixture.roomId);
          if (after === null) throw new Error('Missing protocol fixture');
          expect(after.revision).toBe(before.revision);
          expect(coreCanonicalDigestFromValueV1(after.coreRoot)).toBe(coreCanonicalDigestFromValueV1(before.coreRoot));
          expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(before.revision);
          break;
        }
        expect(response.status).toBe(200);
        state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
        if (state === null) throw new Error('Missing protocol fixture');
      }
      expect(rejected).toBe(true);
    } finally {
      fixture.storage.close();
    }
  }, 120000);

  it('rejects a repeated bounded-token aggregate before WebSocket persistence when projections exceed the frame budget', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const active = activeSeat(initial);
    let attachment: unknown;
    const sent: string[] = [];
    const socket = {
      send: (data: string) => { sent.push(data); },
      serializeAttachment: (value: unknown) => { attachment = value; },
      deserializeAttachment: () => attachment,
    };
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [socket] });
    const client = Object.freeze({ side: 'client' });
    class FakePair { readonly 0 = client; readonly 1 = socket; }
    class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { readonly webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    vi.stubGlobal('WebSocketPair', FakePair);
    vi.stubGlobal('Response', CloudflareResponse);
    try {
      expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/websocket`, { headers: { upgrade: 'websocket' } }))).status).toBe(101);
    } finally {
      vi.unstubAllGlobals();
    }
    object.webSocketMessage(socket, JSON.stringify({
      kind: 'online-client-hello-v1', protocolVersion: 1, roomId: fixture.roomId,
      participantId: active.seat.participantId, ['participantCapability']: active.seat.seatCapability,
      clientBuildId: initial.serverBuildId,
    }));
    let state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (state === null) throw new Error('Missing protocol fixture');
    let rejected = false;
    try {
      for (let index = 0; index < 24; index += 1) {
        const before = state;
        const beforeMessages = sent.length;
        object.webSocketMessage(socket, JSON.stringify(tabletopIntentBody(before, `aggregate-ws-token-${String(index)}`, {
          kind: 'token-create', tokenSeed: `aggregate-ws-token-${String(index)}`,
          definitionId: `aggregate-ws-definition-${String(index)}`, definition: aggregateTokenDefinition,
        })));
        const last = JSON.parse(sent.at(-1) ?? '{}') as { readonly kind?: string; readonly code?: string };
        if (last.kind === 'online-cloudflare-websocket-error-v1') {
          rejected = true;
          expect(last.code).toBe('INVALID_MESSAGE');
          expect(sent.length).toBe(beforeMessages + 1);
          const after = fixture.repository.loadVariableProtocolV2(fixture.roomId);
          if (after === null) throw new Error('Missing protocol fixture');
          expect(after.revision).toBe(before.revision);
          expect(coreCanonicalDigestFromValueV1(after.coreRoot)).toBe(coreCanonicalDigestFromValueV1(before.coreRoot));
          expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(before.revision);
          break;
        }
        const ack = JSON.parse(sent.at(-2) ?? '{}') as { readonly kind?: string; readonly duplicate?: boolean };
        expect(ack.kind).toBe('online-command-ack-v1');
        expect(ack.duplicate).toBe(false);
        state = fixture.repository.loadVariableProtocolV2(fixture.roomId);
        if (state === null) throw new Error('Missing protocol fixture');
      }
      expect(rejected).toBe(true);
    } finally {
      fixture.storage.close();
    }
  }, 120000);

  it('accepts the high-level intent on the authenticated WebSocket and keeps the lease for a normal command', async () => {
    const fixture = await started(2);
    const initial = fixture.repository.loadVariableProtocolV2(fixture.roomId);
    if (initial === null) throw new Error('Missing protocol fixture');
    const activePlayerId = initial.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.activePlayerId;
    const seat = initial.room.seats.find((candidate) => candidate.corePlayerId === activePlayerId);
    if (seat?.participantId === null || seat === undefined) throw new Error('Missing active seat');
    let attachment: unknown;
    const sent: string[] = [];
    const socket = {
      send: (data: string) => { sent.push(data); },
      serializeAttachment: (value: unknown) => { attachment = value; },
      deserializeAttachment: () => attachment,
    };
    const object = new OnlineRoomDurableObject({ id: { name: fixture.roomId }, storage: fixture.storage, acceptWebSocket: () => undefined, getWebSockets: () => [socket] });
    const client = Object.freeze({ side: 'client' });
    class FakePair { readonly 0 = client; readonly 1 = socket; }
    class CloudflareResponse { readonly status: number; readonly webSocket: unknown; constructor(_body: BodyInit | null, init: ResponseInit & { readonly webSocket?: unknown } = {}) { this.status = init.status ?? 200; this.webSocket = init.webSocket; } }
    vi.stubGlobal('WebSocketPair', FakePair);
    vi.stubGlobal('Response', CloudflareResponse);
    try {
      expect((await object.fetch(new Request(`https://room.test/api/online/rooms/${fixture.roomId}/websocket`, { headers: { upgrade: 'websocket' } }))).status).toBe(101);
    } finally {
      vi.unstubAllGlobals();
    }
    object.webSocketMessage(socket, JSON.stringify({ kind: 'online-client-hello-v1', protocolVersion: 1, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, clientBuildId: initial.serverBuildId }));
    const shuffle = { kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, protocolVersion: initial.protocolVersion, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-ws-shuffle', baseRevision: 0, mode: 'freeform', primitive: { kind: 'shuffle' } };
    let randomCalls = 0;
    vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(array: T): T => { randomCalls += 1; new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0); return array; } });
    try {
      const beforeDirect = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (beforeDirect === null) throw new Error('Missing protocol fixture');
      const direct = ordinaryEnvelope(beforeDirect, 'tabletop-ws-client-random', {
        kind: 'random-zone-order', randomDecisionId: 'tabletop-ws-client-random',
        zone: { kind: 'player-zone', playerId: activePlayerId, zone: 'library' }, beforeOrder: [], afterOrder: [],
      });
      const beforeMessages = sent.length;
      object.webSocketMessage(socket, JSON.stringify(direct));
      expect(sent).toHaveLength(beforeMessages + 1);
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1' });
      const afterDirect = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterDirect === null) throw new Error('Missing protocol fixture');
      expect(afterDirect.revision).toBe(beforeDirect.revision);
      expect(coreCanonicalDigestFromValueV1(afterDirect.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeDirect.coreRoot));
      expect(fixture.storage.all<{ count: number }>('SELECT COUNT(*) AS count FROM online_accepted_command')[0]?.count).toBe(0);
      expect(randomCalls).toBe(0);
      const beforeMalformedIntent = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (beforeMalformedIntent === null) throw new Error('Missing protocol fixture');
      const malformedIntent = { ...shuffle, statePatch: {} };
      const beforeMalformedMessages = sent.length;
      object.webSocketMessage(socket, JSON.stringify(malformedIntent));
      expect(sent).toHaveLength(beforeMalformedMessages + 1);
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1' });
      const afterMalformedIntent = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterMalformedIntent === null) throw new Error('Missing protocol fixture');
      expect(afterMalformedIntent.revision).toBe(beforeMalformedIntent.revision);
      expect(coreCanonicalDigestFromValueV1(afterMalformedIntent.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeMalformedIntent.coreRoot));
      expect(randomCalls).toBe(0);
      const missingFieldIntent = { ...shuffle } as Record<string, unknown>;
      delete missingFieldIntent.mode;
      const beforeMissingFieldMessages = sent.length;
      object.webSocketMessage(socket, JSON.stringify(missingFieldIntent));
      expect(sent).toHaveLength(beforeMissingFieldMessages + 1);
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1' });
      const afterMissingFieldIntent = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterMissingFieldIntent === null) throw new Error('Missing protocol fixture');
      expect(afterMissingFieldIntent.revision).toBe(beforeMalformedIntent.revision);
      expect(coreCanonicalDigestFromValueV1(afterMissingFieldIntent.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeMalformedIntent.coreRoot));
      expect(randomCalls).toBe(0);
      const missingProtocolIntent = { ...shuffle } as Record<string, unknown>;
      delete missingProtocolIntent.protocolVersion;
      const beforeMissingProtocolMessages = sent.length;
      object.webSocketMessage(socket, JSON.stringify(missingProtocolIntent));
      expect(sent).toHaveLength(beforeMissingProtocolMessages + 1);
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-websocket-error-v1' });
      const afterMissingProtocolIntent = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (afterMissingProtocolIntent === null) throw new Error('Missing protocol fixture');
      expect(afterMissingProtocolIntent.revision).toBe(beforeMalformedIntent.revision);
      expect(coreCanonicalDigestFromValueV1(afterMissingProtocolIntent.coreRoot)).toBe(coreCanonicalDigestFromValueV1(beforeMalformedIntent.coreRoot));
      expect(randomCalls).toBe(0);
      object.webSocketMessage(socket, JSON.stringify(shuffle));
      expect(JSON.parse(sent.at(-2) ?? '{}')).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 1 });
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-cloudflare-revision-v1', revision: 1 });
      const callsAfterFirst = randomCalls;
      object.webSocketMessage(socket, JSON.stringify(shuffle));
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-command-ack-v1', duplicate: true, acceptedRevision: 1 });
      expect(randomCalls).toBe(callsAfterFirst);
      object.webSocketMessage(socket, JSON.stringify({ kind: 'online-projection-request-v1', protocolVersion: 1, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, knownRevision: 1, clientBuildId: initial.serverBuildId }));
      expect(JSON.parse(sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projected-snapshot-v1', revision: 1 });
      const current = fixture.repository.loadVariableProtocolV2(fixture.roomId);
      if (current === null) throw new Error('Missing current protocol');
      const normal = createCoreCommandV1({ schemaVersion: 1, sequence: 2, actorPlayerId: activePlayerId, decisionMakerPlayerId: activePlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-ws-normal' }, payload: { kind: 'correct-player-life', playerId: activePlayerId, replacementLifeTotal: 39, expectedBeforeStateDigest: coreCanonicalDigestFromValueV1(current.coreRoot), reason: 'tabletop websocket test' } });
      object.webSocketMessage(socket, JSON.stringify({ kind: 'online-command-envelope-v1', protocolVersion: 1, roomId: fixture.roomId, participantId: seat.participantId, ['participantCapability']: seat.seatCapability, commandId: 'tabletop-ws-normal', baseRevision: 1, command: normal }));
      expect(JSON.parse(sent.at(-2) ?? '{}')).toMatchObject({ kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: 2 });
      expect(fixture.repository.loadVariableProtocolV2(fixture.roomId)?.revision).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      fixture.storage.close();
    }
  }, 60000);
});
