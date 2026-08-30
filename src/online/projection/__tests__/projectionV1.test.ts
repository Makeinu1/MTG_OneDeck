import { describe, expect, it } from 'vitest';
import * as Core from '../../../engine/core/index';
import { coreSha256HexV1 } from '../../../engine/core/index';
import type { CardDef } from '../../../types/card';
import { buildVariableRoomGenesisV3, type VariableGenesisSeatInputV3 } from '../../genesis/index';
import { createOnlineProtocolStateV1 } from '../../protocol/index';
import { activateOnlineRoomV1, joinOnlineRoomV1, startOnlineRoomV1 } from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  assertDeepFrozen,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  ONLINE_PROJECTION_SCHEMA_VERSION_V1,
  handleOnlineProjectedSnapshotRequestV1,
  validateOnlineParticipantProjectionV2,
  validateOnlineParticipantProjectionV1,
  validateOnlineParticipantProjectionV3,
  validateOnlineParticipantProjectionV4,
  validateOnlineProjectionRequestV1,
  projectOnlineVariableProtocolV3,
  projectOnlineVariableProtocolV4,
} from '../index';

function state() {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(
    startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]),
    { hostParticipantId: PARTICIPANTS[0], coreRoot },
  );
  return createOnlineProtocolStateV1({
    serverBuildId: 'server-o4p-02d',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function stateFromCoreRoot(coreRoot: Core.ModeNeutralCoreRootV1) {
  const room = activateOnlineRoomV1(
    startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]),
    { hostParticipantId: PARTICIPANTS[0], coreRoot },
  );
  return createOnlineProtocolStateV1({
    serverBuildId: 'server-o4p-02d',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function variableState() {
  const scryfallId = '5da14d86-0780-4821-a799-96f64b377df4';
  const oracleId = 'd8ad23a1-0b43-48ea-9fbe-d89b29194509';
  const definition: CardDef = { scryfallId, oracleId, name: 'V4 Projection Card', lang: 'en', layout: 'normal', cmc: 1, colorIdentity: [], typeLine: 'Artifact', faces: [{ name: 'V4 Projection Card', typeLine: 'Artifact', oracleText: '' }] };
  const commanderScryfallId = '5da14d86-0780-4821-a799-96f64b3779df';
  const commanderOracleId = 'd8ad23a1-0b43-48ea-9fbe-d89b2919459f';
  const commanderDefinition: CardDef = { scryfallId: commanderScryfallId, oracleId: commanderOracleId, name: 'V4 Projection Commander', lang: 'en', layout: 'normal', cmc: 3, colorIdentity: [], typeLine: 'Legendary Creature', faces: [{ name: 'V4 Projection Commander', typeLine: 'Legendary Creature', oracleText: '' }] };
  const entries = Object.freeze([
    Object.freeze({ index: 0, section: 'commander' as const, quantity: 1, scryfallId: commanderScryfallId, oracleId: commanderOracleId, definition: commanderDefinition }),
    Object.freeze({ index: 1, section: 'main' as const, quantity: 40, scryfallId, oracleId, definition }),
  ]);
  const serialized = JSON.stringify({ entries });
  const seats = Object.freeze(Array.from({ length: 4 }, (_, index) => Object.freeze({
    seatIndex: index as 0 | 1 | 2 | 3,
    corePlayerId: `P${index + 1}` as 'P1' | 'P2' | 'P3' | 'P4',
    participantId: `v4-player-${index + 1}`,
    seatCapability: `seat_${String(index + 1).repeat(40)}`,
    snapshot: Object.freeze({ entries, serialized, digest: coreSha256HexV1(serialized) }),
  } satisfies VariableGenesisSeatInputV3)));
  const result = buildVariableRoomGenesisV3(Object.freeze({
    roomId: 'v4-projection-room', serverBuildId: 'v4-projection-build', configuration: Object.freeze({ playerCount: 4, startingLife: 40 }), seats,
    tableParticipantId: 'v4-table', tableCapability: `observer_${'T'.repeat(40)}`,
  }));
  if (!result.ok) throw new Error('Expected variable state');
  return result.protocolState;
}

function rootWithRuleAuthority(
  root: Core.ModeNeutralCoreRootV1,
  overrides: Partial<Core.CoreRuleAuthorityBundleV1>,
): Core.ModeNeutralCoreRootV1 {
  const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
    ...root.ruleAuthority,
    ...overrides,
  });
  return Core.createModeNeutralCoreRootV1({
    versions: root.versions,
    acceptedCommandCount: root.acceptedCommandCount,
    ruleAuthority,
    playerLifecycle: root.playerLifecycle,
    commanders: root.commanders,
    commanderCastLedgers: root.commanderCastLedgers,
    commanderDamage: root.commanderDamage,
    commanderDamageProvenance: root.commanderDamageProvenance,
    combatContext: root.combatContext,
  });
}

const TABLE_CAPABILITY = 'observer_capability_TTTTTTTTTTTTT';
const SPECTATOR_CAPABILITY = 'observer_capability_SSSSSSSSSSSSS';
function observerState(coreRoot: Core.ModeNeutralCoreRootV1 = makeCoreRoot()) {
  let room = readyAllPlayers();
  room = joinOnlineRoomV1(room, { participantId: 'table-display', role: 'table' });
  room = joinOnlineRoomV1(room, { participantId: 'spectator-a', role: 'spectator' });
  room = activateOnlineRoomV1(startOnlineRoomV1(room, PARTICIPANTS[0]), {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
  return createOnlineProtocolStateV1({
    serverBuildId: 'server-o4p-02d',
    room,
    coreRoot,
    observerAuthorizations: [
      { participantId: 'table-display', observerCapability: TABLE_CAPABILITY },
      { participantId: 'spectator-a', observerCapability: SPECTATOR_CAPABILITY },
    ],
  });
}

function request(capability: string = CAPABILITIES[0]): unknown {
  return {
    kind: 'online-projection-request-v1',
    protocolVersion: 1,
    roomId: 'room-02b',
    participantId: PARTICIPANTS[0],
    participantCapability: capability,
    knownRevision: 0,
    clientBuildId: 'client-o4p-02d',
    decisionContext: null,
  };
}

describe('O4P-02D audience projection', () => {
  it('validates a fresh exact request and rejects descriptor-hostile values', () => {
    expect(ONLINE_PROJECTION_SCHEMA_VERSION_V1).toBe(1);
    const input = request();
    const result = validateOnlineProjectionRequestV1(input);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('Expected valid request');
    expect(result.value).not.toBe(input);
    assertDeepFrozen(result);

    let getterCalled = false;
    const hostile = { ...(input as Record<string, unknown>) };
    Object.defineProperty(hostile, 'participantCapability', {
      enumerable: true,
      get() { getterCalled = true; return CAPABILITIES[0]; },
    });
    const rejected = validateOnlineProjectionRequestV1(hostile);
    expect(rejected).toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);
    assertDeepFrozen(rejected);

    const ordinaryUnknownInput = request() as Record<string, unknown>;
    ordinaryUnknownInput.extra = true;
    const ordinaryUnknown = validateOnlineProjectionRequestV1(ordinaryUnknownInput);
    expect(ordinaryUnknown.ok).toBe(false);
    if (ordinaryUnknown.ok) throw new Error('Expected ordinary unknown-field rejection');
    expect(ordinaryUnknown.issues.some((issue) => issue.path === '/extra')).toBe(true);

    const secretKeyInput = request('invalid-capability') as Record<string, unknown>;
    Object.defineProperty(secretKeyInput, CAPABILITIES[0], { enumerable: true, value: true });
    const secretKeyResult = validateOnlineProjectionRequestV1(secretKeyInput);
    expect(secretKeyResult.ok).toBe(false);
    if (secretKeyResult.ok) throw new Error('Expected capability-shaped unknown-field rejection');
    expect(secretKeyResult.issues.some(
      (issue) => issue.code === 'UNKNOWN_FIELD' && issue.path === '/<unknown-field>',
    )).toBe(true);
    expect(JSON.stringify(secretKeyResult)).not.toContain(CAPABILITIES[0]);
  });

  it('rejects assisted fields on legacy v1 and accepts the explicit v2 wire', () => {
    const initial = state();
    const transition = handleOnlineProjectedSnapshotRequestV1(initial, request());
    if (transition.response.status !== 'accepted') throw new Error('Expected accepted projection');
    const legacy = transition.response.projection;
    const enriched = {
      ...legacy,
      kind: 'online-participant-projection-v2' as const,
      schemaVersion: 2 as const,
      game: {
        ...legacy.game,
        priorityHolds: [],
        assistedPriority: {
          holderPlayerId: null,
          stewardPlayerId: null,
          windowKind: 'sba-check-required',
          holds: [],
          responseWindow: null,
          topStackObjectId: null,
        },
      },
    };
    expect(validateOnlineParticipantProjectionV1({ ...enriched, kind: 'online-participant-projection-v1', schemaVersion: 1 })).toMatchObject({ ok: false });
    expect(validateOnlineParticipantProjectionV2(enriched)).toMatchObject({ ok: true });
  });

  it('keeps causal assisted priority V4-only and validates bounded public context', () => {
    const initial = variableState();
    const legacy = projectOnlineVariableProtocolV3(initial, 'v4-player-1');
    const assisted = projectOnlineVariableProtocolV4(initial, 'v4-player-1');
    expect(validateOnlineParticipantProjectionV3(legacy)).toMatchObject({ ok: true });
    expect(validateOnlineParticipantProjectionV4(assisted)).toMatchObject({ ok: true });
    expect(assisted.game.assistedPriority).toMatchObject({
      sourceObjectId: null,
      targetObjectIds: [],
      targetPlayerIds: [],
      undoAuthorizedPlayerId: 'P1',
      recentResolution: null,
    });
    const malformed = structuredClone(assisted) as unknown as Record<string, unknown>;
    const malformedGame = malformed.game as Record<string, unknown>;
    malformedGame.assistedPriority = {
      ...(malformedGame.assistedPriority as Record<string, unknown>),
      targetObjectIds: ['not-a-core-object-id'],
    };
    expect(validateOnlineParticipantProjectionV4(malformed)).toMatchObject({ ok: false });
  });

  it('projects the shared combat, damage, outcome, and checkpoint facts without private identity', () => {
    const initial = variableState();
    const assisted = projectOnlineVariableProtocolV4(initial, 'v4-player-1');
    expect(assisted.game.combat).toBeNull();
    expect(assisted.game.commanderDamage).toEqual([]);
    expect(assisted.game.winnerPlayerId).toBeNull();
    expect(assisted.game.checkpoint).toEqual({ available: false, informationExposureWarning: false });
    expect(JSON.stringify(assisted.game.combat)).not.toMatch(/physicalCardId|definitionId|private|snapshot/u);
    expect(JSON.stringify(assisted.game.commanderDamage)).not.toMatch(/physicalCardId|definitionId/u);
  });

  it('keeps commander damage against a seated defender after that seat is marked defeated', () => {
    const initial = variableState();
    const commanderPhysicalCardId = initial.coreRoot.commanders.find((entry) => entry.ownerPlayerId === 'P1')?.physicalCardId;
    if (commanderPhysicalCardId === undefined) throw new Error('Expected P1 commander');
    const commanderDamage = Core.recordCoreCommanderDamageV1(initial.coreRoot.commanderDamage, {
      commanderPhysicalCardId,
      defendingPlayerId: 'P2',
      damage: 7,
    });
    const coreRoot = Core.createModeNeutralCoreRootV1({ ...initial.coreRoot, commanderDamage });
    const projected = projectOnlineVariableProtocolV4({ ...initial, coreRoot }, 'v4-player-1');
    const eliminated = {
      ...projected,
      room: {
        ...projected.room,
        seats: projected.room.seats.map((seat) => seat.corePlayerId === 'P2' ? { ...seat, outcome: 'defeated' as const } : seat),
      },
    };
    expect(eliminated.game.commanderDamage).toContainEqual({
      commanderOwnerPlayerId: 'P1', commanderSlot: 0, defendingPlayerId: 'P2', damage: 7,
    });
    expect(validateOnlineParticipantProjectionV4(eliminated)).toMatchObject({ ok: true });
  });

  it('projects an authenticated player and hides all library identities', () => {
    const initial = state();
    const transition = handleOnlineProjectedSnapshotRequestV1(initial, request());
    expect(transition.response).toMatchObject({
      status: 'accepted',
      role: 'player',
      reason: 'synchronized',
      knownRevision: 0,
      revision: 0,
    });
    if (transition.response.status !== 'accepted') throw new Error('Expected accepted projection');
    expect(transition.response.projection.corePlayerId).toBe('P1');
    expect(transition.response.projection.game.zones.byPlayer[0]?.zones.library.entries.every(
      (entry) => entry.kind === 'hidden-card',
    )).toBe(true);
    expect(validateOnlineParticipantProjectionV1(transition.response.projection)).toMatchObject({ ok: true });
    expect(JSON.stringify(transition.response)).not.toContain(CAPABILITIES[0]);
    assertDeepFrozen(transition);
  });

  it('returns the same generic rejection for wrong seat capabilities', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request(CAPABILITIES[1]));
    expect(transition.response).toMatchObject({
      status: 'rejected',
      roomId: null,
      participantId: null,
      role: null,
      issues: [{ code: 'AUTHORIZATION_REJECTED' }],
    });
    expect(transition.log).toEqual({
      kind: 'online-projection-log-v1',
      status: 'rejected',
      revision: 0,
      role: null,
      reason: null,
      issueCodes: ['AUTHORIZATION_REJECTED'],
    });
    expect(JSON.stringify(transition.response)).not.toContain(CAPABILITIES[0]);
    expect(JSON.stringify(transition.response)).not.toContain(CAPABILITIES[1]);
    expect(JSON.stringify(transition.log)).not.toContain(CAPABILITIES[0]);
    expect(JSON.stringify(transition.log)).not.toContain(CAPABILITIES[1]);
    assertDeepFrozen(transition);
  });

  it('gives Table and Spectator byte-equivalent public games', () => {
    const initial = observerState();
    const project = (participantId: string, participantCapability: string) =>
      handleOnlineProjectedSnapshotRequestV1(initial, {
        ...(request(participantCapability) as Record<string, unknown>),
        participantId,
      });
    const table = project('table-display', TABLE_CAPABILITY);
    const spectator = project('spectator-a', SPECTATOR_CAPABILITY);
    expect(table.response.status).toBe('accepted');
    expect(spectator.response.status).toBe('accepted');
    if (table.response.status !== 'accepted' || spectator.response.status !== 'accepted') {
      throw new Error('Expected observer projections');
    }
    expect(table.response.projection.role).toBe('table');
    expect(spectator.response.projection.role).toBe('spectator');
    expect(table.response.projection.corePlayerId).toBeNull();
    expect(JSON.stringify(table.response.projection.game)).toBe(
      JSON.stringify(spectator.response.projection.game),
    );
    expect(table.response.projection.game.searchSessions).toEqual([]);
    expect(table.response.projection.game.playPermissions).toEqual([]);
  });

  it('widens observer identity for public Reveal while withholding grant metadata', () => {
    const root = makeCoreRoot();
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['public-reveal'] as never,
      byGrant: {
        'public-reveal': {
          subject: { kind: 'top-of-library', playerId: 'P1', count: 1 },
          audience: { kind: 'all-players' },
          mode: 'reveal',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      } as never,
    });
    const revealedRoot = rootWithRuleAuthority(root, { visibility });
    const initial = observerState(revealedRoot);
    const project = (participantId: string, networkValue: string) =>
      handleOnlineProjectedSnapshotRequestV1(initial, {
        ...(request(networkValue) as Record<string, unknown>),
        participantId,
      });
    const observer = project('table-display', TABLE_CAPABILITY);
    const player = project(PARTICIPANTS[0], CAPABILITIES[0]);
    expect(observer.response.status).toBe('accepted');
    expect(player.response.status).toBe('accepted');
    if (observer.response.status !== 'accepted' || player.response.status !== 'accepted') throw new Error('Expected Reveal projections');
    expect(observer.response.projection.game.zones.byPlayer[0]?.zones.library.entries[0]?.kind).toBe('visible-object');
    expect(observer.response.projection.game.visibilityGrants).toEqual([]);
    expect(player.response.projection.game.visibilityGrants).toHaveLength(1);
    expect(player.response.projection.game.visibilityGrants[0]).toMatchObject({ mode: 'reveal', subject: { kind: 'top-of-library', playerId: 'P1', count: 1 } });
  });

  it('rejects any observer visibility-grant entry, including an empty Reveal audience', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(observerState(), {
      ...(request(TABLE_CAPABILITY) as Record<string, unknown>),
      participantId: 'table-display',
    });
    if (transition.response.status !== 'accepted') throw new Error('Expected observer projection');
    const tampered = structuredClone(transition.response.projection) as unknown as {
      game: { visibilityGrants: unknown[] };
    };
    tampered.game.visibilityGrants.push({
      effectiveForPlayerIds: [],
      mode: 'reveal',
      subject: { kind: 'top-of-library', playerId: 'P1', count: 1 },
      duration: { kind: 'indefinite' },
    });
    const checked = validateOnlineParticipantProjectionV1(tampered);
    expect(checked.ok).toBe(false);
    if (checked.ok) throw new Error('Expected observer grant rejection');
    expect(checked.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/game/visibilityGrants/0', code: 'INVALID_RELATION' }),
    ]));
  });

  it('rejects relation drift and returns a fresh frozen canonical wire value', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const projection = transition.response.projection;
    const valid = validateOnlineParticipantProjectionV1(projection);
    expect(valid.ok).toBe(true);
    if (!valid.ok) throw new Error('Expected valid projection');
    expect(valid.value).not.toBe(projection);
    assertDeepFrozen(valid.value);

    const drifted = structuredClone(projection) as unknown as {
      game: { zones: { byPlayer: unknown[] }; players: unknown[] };
    };
    drifted.game.zones.byPlayer.pop();
    drifted.game.players.pop();
    const first = validateOnlineParticipantProjectionV1(drifted);
    const second = validateOnlineParticipantProjectionV1(drifted);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: false });
    if (first.ok) throw new Error('Expected relation rejection');
    expect(first.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_RELATION', path: '/game/players' }),
      expect.objectContaining({ code: 'INVALID_RELATION', path: '/game/zones/byPlayer' }),
    ]));
    assertDeepFrozen(first);
  });

  it('never executes nested accessors or Proxy get traps during wire validation', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');

    const accessorProjection = structuredClone(transition.response.projection);
    const visible = accessorProjection.game.zones.battlefield.entries[0];
    if (visible?.kind !== 'visible-object') throw new Error('Expected visible battlefield object');
    let getterCalls = 0;
    Object.defineProperty(visible, 'commander', {
      enumerable: true,
      get() { getterCalls += 1; return false; },
    });
    expect(validateOnlineParticipantProjectionV1(accessorProjection)).toMatchObject({ ok: false });
    expect(getterCalls).toBe(0);

    const proxiedProjection = structuredClone(transition.response.projection) as unknown as {
      game: { turnOrder: string[] };
    };
    let getTrapCalls = 0;
    proxiedProjection.game.turnOrder = new Proxy(proxiedProjection.game.turnOrder, {
      get(target, property, receiver) {
        getTrapCalls += 1;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    expect(validateOnlineParticipantProjectionV1(proxiedProjection)).toMatchObject({ ok: true });
    expect(getTrapCalls).toBe(0);
  });

  it('orders effective viewers by Core turn order when a later player controls an earlier player', () => {
    const root = makeCoreRoot();
    const decisionAuthorities = Core.createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: ['control-earlier'] as never,
      byAuthority: {
        'control-earlier': {
          controlledPlayerId: 'P1',
          decisionMakerPlayerId: 'P3',
          sourceObjectId: null,
          scope: { kind: 'decision', decisionKey: 'control-earlier' },
        },
      } as never,
    });
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['ordered-viewers'] as never,
      byGrant: {
        'ordered-viewers': {
          subject: { kind: 'zone', zone: { kind: 'player-zone', playerId: 'P1', zone: 'hand' } },
          audience: { kind: 'players', playerIds: ['P1', 'P3'] },
          mode: 'look',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      } as never,
    });
    const controlledRoot = rootWithRuleAuthority(root, { decisionAuthorities, visibility });
    const transition = handleOnlineProjectedSnapshotRequestV1(stateFromCoreRoot(controlledRoot), {
      ...(request(CAPABILITIES[2]) as Record<string, unknown>),
      participantId: PARTICIPANTS[2],
      decisionContext: { kind: 'decision', decisionKey: 'control-earlier' },
    });
    expect(transition.response.status).toBe('accepted');
    if (transition.response.status !== 'accepted') throw new Error('Expected controlled-player projection');
    expect(transition.response.projection.game.visibilityGrants[0]?.effectiveForPlayerIds).toEqual([
      'P1',
      'P3',
    ]);
    expect(validateOnlineParticipantProjectionV1(transition.response.projection)).toMatchObject({ ok: true });
  });

  it('rejects hidden-card placement and visible-object definition/runtime matrix drift', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const projection = transition.response.projection;

    const hiddenBattlefield = structuredClone(projection) as unknown as {
      game: { zones: { battlefield: { entries: unknown[] } } };
    };
    hiddenBattlefield.game.zones.battlefield.entries[0] = { kind: 'hidden-card' };
    expect(validateOnlineParticipantProjectionV1(hiddenBattlefield)).toMatchObject({ ok: false });

    for (const field of ['definition', 'runtime'] as const) {
      const drifted = structuredClone(projection) as unknown as {
        game: { zones: { battlefield: { entries: Array<Record<string, unknown>> } } };
      };
      const entry = drifted.game.zones.battlefield.entries[0];
      if (entry === undefined) throw new Error('Expected battlefield entry');
      entry[field] = null;
      const result = validateOnlineParticipantProjectionV1(drifted);
      expect(result).toMatchObject({ ok: false });
      if (result.ok) throw new Error(`Expected ${field} matrix rejection`);
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: `/game/zones/battlefield/entries/0/${field}` }),
      ]));
    }
  });

  it('rejects a concealed exile object whose projected runtime is not face down', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { zones: { exile: { entries: Array<{
        kind: string;
        runtime?: { faceDown: boolean };
      }> } } };
    };
    const index = drifted.game.zones.exile.entries.findIndex(
      (entry) => entry.kind === 'concealed-object',
    );
    const concealed = drifted.game.zones.exile.entries[index];
    if (concealed?.runtime === undefined) throw new Error('Expected concealed exile runtime');
    concealed.runtime.faceDown = false;
    const result = validateOnlineParticipantProjectionV1(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected concealed runtime rejection');
    expect(result.issues.some(
      (issue) => issue.path === `/game/zones/exile/entries/${index}/runtime/faceDown`,
    )).toBe(true);
  });

  it('rejects a visible spell copy carrying projected runtime', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    type MutableEntry = {
      kind: string;
      objectKind?: string;
      runtime?: Record<string, unknown> | null;
    };
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { zones: {
        battlefield: { entries: MutableEntry[] };
        stack: { entries: MutableEntry[] };
      } };
    };
    const card = drifted.game.zones.battlefield.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.runtime !== null,
    );
    const spellCopyIndex = drifted.game.zones.stack.entries.findIndex(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'spell-copy',
    );
    const spellCopy = drifted.game.zones.stack.entries[spellCopyIndex];
    if (card?.runtime == null || spellCopy === undefined) {
      throw new Error('Expected visible card runtime and spell copy');
    }
    spellCopy.runtime = structuredClone(card.runtime);
    const result = validateOnlineParticipantProjectionV1(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected spell-copy runtime rejection');
    expect(result.issues.some(
      (issue) => issue.path === `/game/zones/stack/entries/${spellCopyIndex}/runtime`,
    )).toBe(true);
  });

  it('rejects noncanonical projected counter kinds and non-positive counts completely', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { zones: { battlefield: { entries: Array<{
        kind: string;
        runtime?: { counters: Array<{ kind: string; count: number }> } | null;
      }> } } };
    };
    const index = drifted.game.zones.battlefield.entries.findIndex(
      (entry) => entry.kind === 'visible-object' && entry.runtime !== null,
    );
    const card = drifted.game.zones.battlefield.entries[index];
    if (card?.runtime == null) throw new Error('Expected visible card runtime');
    card.runtime.counters = [{ kind: ' charge ', count: 0 }];
    const result = validateOnlineParticipantProjectionV1(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected counter canonicalization rejection');
    expect(result.issues.some(
      (issue) => issue.path === `/game/zones/battlefield/entries/${index}/runtime/counters/0/kind`,
    )).toBe(true);
    expect(result.issues.some(
      (issue) => issue.path === `/game/zones/battlefield/entries/${index}/runtime/counters/0/count`,
    )).toBe(true);
  });

  it('rejects a projected definition with noncanonical color identity order', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { zones: { battlefield: { entries: Array<{
        kind: string;
        definition?: { colorIdentity: string[] } | null;
      }> } } };
    };
    const index = drifted.game.zones.battlefield.entries.findIndex(
      (entry) => entry.kind === 'visible-object' && entry.definition !== null,
    );
    const card = drifted.game.zones.battlefield.entries[index];
    if (card?.definition == null) throw new Error('Expected visible card definition');
    card.definition.colorIdentity = ['U', 'W'];
    const result = validateOnlineParticipantProjectionV1(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected color identity order rejection');
    expect(result.issues.some(
      (issue) => issue.path === `/game/zones/battlefield/entries/${index}/definition/colorIdentity/1`,
    )).toBe(true);
  });

  it('rejects a projected definition whose attacker-controlled snapshot exceeds the bounded frame budget', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    type MutableDefinition = { faces: Array<Record<string, unknown>> };
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { zones: { battlefield: { entries: Array<{ kind: string; definition?: MutableDefinition | null }> } } };
    };
    const card = drifted.game.zones.battlefield.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.definition !== null,
    );
    if (card?.definition == null) throw new Error('Expected visible card definition');
    const face = card.definition.faces[0];
    if (face === undefined) throw new Error('Expected visible card face');
    face.oracleText = 'x'.repeat(100_000);
    const result = validateOnlineParticipantProjectionV1(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected oversized definition rejection');
    expect(result.issues.some(
      (issue) => issue.path.endsWith('/definition/faces/0/oracleText'),
    )).toBe(true);
  });

  it('rejects over-cap public notes and manual-stack collections', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const drifted = structuredClone(transition.response.projection) as unknown as {
      game: { notes?: unknown[]; manualStack?: unknown[] };
    };
    drifted.game.notes = Array.from({ length: 216 }, (_, index) => ({
      id: `projection-note-${String(index)}`,
      authorPlayerId: 'P1',
      text: 'x'.repeat(160),
      creationRevision: 1,
    }));
    expect(validateOnlineParticipantProjectionV1(drifted).ok).toBe(false);
    drifted.game.notes = [];
    drifted.game.manualStack = Array.from({ length: 216 }, (_, index) => ({
      id: `projection-entry-${String(index)}`,
      label: 'x'.repeat(160),
      provenance: 'structured',
      sourceObjectId: null,
      authorPlayerId: 'P1',
      creationRevision: 1,
    }));
    expect(validateOnlineParticipantProjectionV1(drifted).ok).toBe(false);
  });

  it('accepts a semantically identical search candidate with reversed property insertion order', () => {
    const root = makeCoreRoot();
    const searchSessions = Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: ['search-library'] as never,
      bySession: {
        'search-library': {
          rulesActorPlayerId: 'P1',
          selectorPlayerId: 'P1',
          zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' },
          portion: { kind: 'all' },
          candidateObjectIds: ['PC1:0'],
          criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
          revealFound: false,
          shuffleAfter: false,
        },
      } as never,
    });
    const searchRoot = rootWithRuleAuthority(root, { searchSessions });
    const transition = handleOnlineProjectedSnapshotRequestV1(stateFromCoreRoot(searchRoot), request());
    expect(transition.response.status).toBe('accepted');
    if (transition.response.status !== 'accepted') throw new Error('Expected search projection');
    const mutable = structuredClone(transition.response.projection) as unknown as {
      game: { searchSessions: Array<{ candidates: Array<Record<string, unknown>> }> };
    };
    const candidate = mutable.game.searchSessions[0]?.candidates[0];
    if (candidate === undefined) throw new Error('Expected search candidate');
    const searchSession = mutable.game.searchSessions[0];
    if (searchSession === undefined) throw new Error('Expected search session');
    searchSession.candidates[0] = Object.fromEntries(
      Object.entries(candidate).reverse(),
    );
    expect(validateOnlineParticipantProjectionV1(mutable)).toMatchObject({ ok: true });
  });

  it('accepts a rotated game turn order when player and zone arrays follow it', () => {
    const transition = handleOnlineProjectedSnapshotRequestV1(state(), request());
    if (transition.response.status !== 'accepted') throw new Error('Expected projection');
    const mutable = structuredClone(transition.response.projection) as unknown as {
      game: { turnOrder: string[]; players: unknown[]; zones: { byPlayer: unknown[] } };
    };
    const rotate = <T>(values: readonly T[]): T[] => [...values.slice(1), ...values.slice(0, 1)];
    mutable.game.turnOrder = rotate(mutable.game.turnOrder);
    mutable.game.players = rotate(mutable.game.players);
    mutable.game.zones.byPlayer = rotate(mutable.game.zones.byPlayer);
    expect(validateOnlineParticipantProjectionV1(mutable)).toMatchObject({ ok: true });
  });
});
