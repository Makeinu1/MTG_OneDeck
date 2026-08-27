import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import * as Protocol from '../../protocol/index';
import * as Room from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  assertDeepFrozen,
  joinAllPlayers,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import * as Projection from '../index';

const TABLE_ID = 'table-projection';
const SPECTATOR_ID = 'spectator-projection';
const TABLE_CAPABILITY = 'observer_capability_TTTTTTTTTTTTT';
const SPECTATOR_CAPABILITY = 'observer_capability_SSSSSSSSSSSSS';
const SERVER_BUILD_ID = 'server-o4p-02d';
const CLIENT_BUILD_ID = 'client-o4p-02d';
const CONFIGURED_CAPABILITIES = [...CAPABILITIES, TABLE_CAPABILITY, SPECTATOR_CAPABILITY];

type MutableTurnBundle = {
  stackBundle: {
    objectRegistry: {
      turnOrder: string[];
      zones: {
        byPlayer: Record<string, { library: string[]; hand: string[]; graveyard: string[] }>;
        shared: Record<string, string[]>;
      };
      objects: Record<string, Record<string, unknown>>;
      physicalCards: Record<string, Record<string, unknown>>;
      cardDefinitions: Record<string, Record<string, unknown>>;
    };
    objectRuntime: { byObject: Record<string, Record<string, unknown>> };
  };
};

type DeepMutable<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
      : T;

type Audience = Readonly<{
  participantId: string;
  capability: string;
  role: 'player' | 'table' | 'spectator';
  corePlayerId: string | null;
}>;

const AUDIENCES: readonly Audience[] = Object.freeze([
  ...PARTICIPANTS.map((participantId, index) => Object.freeze({
    participantId,
    capability: CAPABILITIES[index],
    role: 'player' as const,
    corePlayerId: `P${index + 1}`,
  })),
  Object.freeze({
    participantId: TABLE_ID,
    capability: TABLE_CAPABILITY,
    role: 'table' as const,
    corePlayerId: null,
  }),
  Object.freeze({
    participantId: SPECTATOR_ID,
    capability: SPECTATOR_CAPABILITY,
    role: 'spectator' as const,
    corePlayerId: null,
  }),
]);

function jsonClone<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>;
}

function sentinelDefinition(label: string): Record<string, unknown> {
  return {
    source: { kind: 'engine-synthetic' },
    name: `NAME-${label}`,
    layout: 'normal',
    manaValue: 1,
    colorIdentity: [],
    typeLine: `TYPE-${label}`,
    keywords: [],
    producedMana: [],
    tokenKind: null,
    faces: [{
      name: `FACE-${label}`,
      manaCost: '{1}',
      typeLine: `FACE-TYPE-${label}`,
      oracleText: `ORACLE-${label}`,
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
    }],
  };
}

function makeSentinelRoot(): Core.ModeNeutralCoreRootV1 {
  const base = makeCoreRoot();
  const raw = jsonClone(base.ruleAuthority.turnPriorityBundle) as unknown as MutableTurnBundle;
  const registry = raw.stackBundle.objectRegistry;
  const runtime = raw.stackBundle.objectRuntime;
  const hiddenCards = [
    ['P1', 'library', 'PC1'],
    ['P1', 'hand', 'PC2'],
    ['P2', 'library', 'PC7'],
    ['P2', 'hand', 'PC3'],
    ['P3', 'library', 'PC8'],
    ['P3', 'hand', 'PC9'],
    ['P4', 'library', 'PC10'],
    ['P4', 'hand', 'PC11'],
  ] as const;
  const templateRuntime = jsonClone(runtime.byObject['PC2:0']);
  for (const [playerId, zone, physicalCardId] of hiddenCards) {
    const objectId = `${physicalCardId}:0`;
    const definitionId = `def.hidden-${playerId}-${zone}`;
    registry.zones.byPlayer[playerId][zone] = [objectId];
    registry.objects[objectId] = {
      kind: 'card',
      physicalCardId,
      incarnation: 0,
      baseControllerPlayerId: null,
    };
    registry.physicalCards[physicalCardId] = {
      definitionId,
      ownerPlayerId: playerId,
      isCommander: false,
    };
    registry.cardDefinitions[definitionId] = sentinelDefinition(`${playerId}-${zone}`);
    runtime.byObject[objectId] = jsonClone(templateRuntime);
  }
  const faceDownBattlefieldRuntime = runtime.byObject['PC6:0'] as {
    orientation: Record<string, unknown>;
    attachment: Record<string, unknown>;
  };
  faceDownBattlefieldRuntime.orientation.faceDown = true;
  faceDownBattlefieldRuntime.orientation.tapped = true;
  faceDownBattlefieldRuntime.attachment.attachedTo = { kind: 'object', objectId: 'PC2:0' };

  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1(raw as never);
  const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: base.ruleAuthority.control,
    visibility: base.ruleAuthority.visibility,
    searchSessions: base.ruleAuthority.searchSessions,
    playPermissions: base.ruleAuthority.playPermissions,
    decisionAuthorities: base.ruleAuthority.decisionAuthorities,
  });
  return Core.createModeNeutralCoreRootV1({ ...base, ruleAuthority });
}

function withRuleSlices(
  base: Core.ModeNeutralCoreRootV1,
  slices: Partial<Pick<
    Core.CoreRuleAuthorityBundleV1,
    'visibility' | 'searchSessions' | 'playPermissions' | 'decisionAuthorities'
  >>,
): Core.ModeNeutralCoreRootV1 {
  const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: base.ruleAuthority.turnPriorityBundle,
    control: base.ruleAuthority.control,
    visibility: slices.visibility ?? base.ruleAuthority.visibility,
    searchSessions: slices.searchSessions ?? base.ruleAuthority.searchSessions,
    playPermissions: slices.playPermissions ?? base.ruleAuthority.playPermissions,
    decisionAuthorities: slices.decisionAuthorities ?? base.ruleAuthority.decisionAuthorities,
  });
  return Core.createModeNeutralCoreRootV1({ ...base, ruleAuthority });
}

function activeRoom(root: Core.ModeNeutralCoreRootV1): Room.OnlineRoomV1 {
  let room = joinAllPlayers();
  room = Room.joinOnlineRoomV1(room, { participantId: TABLE_ID, role: 'table' });
  room = Room.joinOnlineRoomV1(room, { participantId: SPECTATOR_ID, role: 'spectator' });
  room = readyAllPlayers(room);
  room = Room.startOnlineRoomV1(room, PARTICIPANTS[0]);
  return Room.activateOnlineRoomV1(room, { hostParticipantId: PARTICIPANTS[0], coreRoot: root });
}

function protocolState(
  root: Core.ModeNeutralCoreRootV1 = makeSentinelRoot(),
  room: Room.OnlineRoomV1 = activeRoom(root),
): Protocol.OnlineProtocolStateV1 {
  return Protocol.createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD_ID,
    room,
    coreRoot: root,
    observerAuthorizations: [
      { participantId: TABLE_ID, observerCapability: TABLE_CAPABILITY },
      { participantId: SPECTATOR_ID, observerCapability: SPECTATOR_CAPABILITY },
    ],
  });
}

function request(
  audience: Audience = AUDIENCES[0],
  decisionContext: Core.CoreDecisionContextV1 | null = null,
  knownRevision = 0,
): Record<string, unknown> {
  return {
    kind: 'online-projection-request-v1',
    protocolVersion: 1,
    roomId: 'room-02b',
    participantId: audience.participantId,
    participantCapability: audience.capability,
    knownRevision,
    clientBuildId: CLIENT_BUILD_ID,
    decisionContext,
  };
}

type AcceptedProjectionTransition = Projection.OnlineProjectedSnapshotTransitionV1 & {
  readonly response: Projection.OnlineProjectedSnapshotAcceptedV1;
};

function isAcceptedProjectionTransition(
  transition: Projection.OnlineProjectedSnapshotTransitionV1,
): transition is AcceptedProjectionTransition {
  return transition.response.status === 'accepted';
}

function accepted(
  state: Protocol.OnlineProtocolStateV1,
  audience: Audience,
  decisionContext: Core.CoreDecisionContextV1 | null = null,
): AcceptedProjectionTransition {
  const transition = Projection.handleOnlineProjectedSnapshotRequestV1(
    state,
    request(audience, decisionContext, state.revision),
  );
  expect(transition.response.status).toBe('accepted');
  if (!isAcceptedProjectionTransition(transition)) throw new Error('Expected accepted projection');
  return transition;
}

function playerZones(
  projection: Projection.OnlineParticipantProjectionV1,
  playerId: string,
): Projection.OnlineProjectedPlayerZonesV1 {
  const group = projection.game.zones.byPlayer.find((entry) => entry.playerId === playerId);
  if (group === undefined) throw new Error(`Missing projected zones for ${playerId}`);
  return group.zones;
}

function visibleName(entry: Projection.OnlineProjectedZoneEntryV1 | undefined): string | null {
  return entry?.kind === 'visible-object' ? entry.definition?.name ?? null : null;
}

function assertExactKeys(value: object, keys: readonly string[]): void {
  expect(Reflect.ownKeys(value)).toEqual(keys);
}

function assertNoSecrets(value: unknown, extra: readonly string[] = []): void {
  const serialized = JSON.stringify(value);
  for (const secret of [...CONFIGURED_CAPABILITIES, ...extra]) expect(serialized).not.toContain(secret);
  expect(serialized).not.toMatch(/seatCapability|observerCapability|observerAuthorizations/);
  expect(serialized).not.toMatch(/physicalCardId|definitionId|requestDigest|receipts/);
  expect(serialized).not.toMatch(/acceptedCommandCount|ruleAuthority|events|warnings|payload|stackTrace/);
}

function issueCodes(result: Projection.OnlineParticipantProjectionValidationResultV1): readonly string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('O4P-02D judge-owned audience projection evidence', () => {
  it('projects four Players, one Table, and one Spectator through exact frozen allowlists', () => {
    const state = protocolState();
    const before = JSON.stringify(state);
    const transitions = AUDIENCES.map((audience) => accepted(state, audience));

    for (const [index, transition] of transitions.entries()) {
      const audience = AUDIENCES[index];
      expect(transition.state).toBe(state);
      expect(transition.response).toMatchObject({
        kind: 'online-projected-snapshot-v1',
        protocolVersion: 1,
        status: 'accepted',
        roomId: state.room.roomId,
        participantId: audience.participantId,
        role: audience.role,
        knownRevision: 0,
        revision: 0,
        serverBuildId: SERVER_BUILD_ID,
        clientBuildIdMatch: false,
        reason: 'synchronized',
        issues: [],
      });
      expect(transition.response.projection).toMatchObject({
        kind: 'online-participant-projection-v1',
        schemaVersion: Projection.ONLINE_PROJECTION_SCHEMA_VERSION_V1,
        protocolVersion: 1,
        role: audience.role,
        corePlayerId: audience.corePlayerId,
        revision: 0,
      });
      assertExactKeys(transition.response.projection.room, [
        'lifecycle', 'hostParticipantId', 'participants', 'seats',
      ]);
      for (const participant of transition.response.projection.room.participants) {
        assertExactKeys(participant, ['participantId', 'role', 'presence', 'seatIndex']);
      }
      for (const seat of transition.response.projection.room.seats) {
        assertExactKeys(seat, ['seatIndex', 'corePlayerId', 'participantId', 'ready', 'outcome']);
      }
      expect(Projection.validateOnlineParticipantProjectionV1(
        transition.response.projection,
      )).toMatchObject({ ok: true });
      assertNoSecrets(transition.response);
      assertNoSecrets(transition.log);
      assertDeepFrozen(transition);
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(transitions[4].response.projection.game)).toBe(
      JSON.stringify(transitions[5].response.projection.game),
    );
  });

  it('shows each hand only to its owner and hides every library from all audiences by default', () => {
    const state = protocolState();
    const expectedHands = ['NAME-P1-hand', 'NAME-P2-hand', 'NAME-P3-hand', 'NAME-P4-hand'];
    for (const audience of AUDIENCES) {
      const projection = accepted(state, audience).response.projection;
      for (let index = 0; index < 4; index += 1) {
        const playerId = `P${index + 1}`;
        const zones = playerZones(projection, playerId);
        expect(zones.library.entries).toEqual([{ kind: 'hidden-card' }]);
        const hand = zones.hand.entries[0];
        if (audience.corePlayerId === playerId) {
          expect(hand?.kind).toBe('visible-object');
          expect(visibleName(hand)).toBe(expectedHands[index]);
        } else {
          expect(hand).toEqual({ kind: 'hidden-card' });
        }
        for (const hidden of [zones.library.entries[0], audience.corePlayerId === playerId ? null : hand]) {
          if (hidden === null || hidden === undefined) continue;
          assertExactKeys(hidden, ['kind']);
          expect(JSON.stringify(hidden)).not.toMatch(/objectId|definition|physical|runtime|owner|controller/);
        }
      }
      assertNoSecrets(projection, [
        'NAME-P1-library', 'NAME-P2-library', 'NAME-P3-library', 'NAME-P4-library',
        'ORACLE-P1-library', 'ORACLE-P2-library', 'ORACLE-P3-library', 'ORACLE-P4-library',
      ]);
    }
  });

  it('uses visible and concealed public-zone variants at the audience identity boundary', () => {
    const state = protocolState();
    for (const audience of AUDIENCES) {
      const game = accepted(state, audience).response.projection.game;
      const publicStackCard = game.zones.stack.entries.find(
        (entry) => entry.kind !== 'hidden-card' && entry.objectId === 'PC5:1',
      );
      expect(publicStackCard?.kind).toBe('visible-object');

      const battlefield = game.zones.battlefield.entries[0];
      if (audience.corePlayerId === 'P3') {
        expect(battlefield).toMatchObject({
          kind: 'visible-object', objectId: 'PC6:0', ownerPlayerId: 'P3',
          controllerPlayerId: 'P3', commander: true,
        });
      } else {
        expect(battlefield).toMatchObject({ kind: 'concealed-object', objectId: 'PC6:0' });
        assertExactKeys(battlefield, ['kind', 'objectId', 'objectKind', 'runtime']);
      }
      const exile = game.zones.exile.entries[0];
      expect(exile).toMatchObject({ kind: 'concealed-object', objectId: 'PC4:0' });
      expect(JSON.stringify(exile)).not.toMatch(/definition|ownerPlayerId|controllerPlayerId/);
    }
  });

  it('filters object, zone, and top-library grants in source order and normalizes source duration', () => {
    const base = makeSentinelRoot();
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['p2-exile-look', 'p3-hand-reveal', 'p4-top-reveal', 'all-look'],
      byGrant: {
        'p2-exile-look': {
          subject: { kind: 'object', objectId: 'PC4:0' as Core.CoreObjectId },
          audience: { kind: 'players', playerIds: ['P2' as Core.CorePlayerId] },
          mode: 'look', sourceObjectId: 'PC2:0' as Core.CoreObjectId,
          duration: { kind: 'while-source-exists', sourceObjectId: 'PC2:0' as Core.CoreObjectId },
        },
        'p3-hand-reveal': {
          subject: {
            kind: 'zone',
            zone: { kind: 'player-zone', playerId: 'P3' as Core.CorePlayerId, zone: 'hand' },
          },
          audience: { kind: 'all-players' }, mode: 'reveal', sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
        'p4-top-reveal': {
          subject: { kind: 'top-of-library', playerId: 'P4' as Core.CorePlayerId, count: 1 },
          audience: { kind: 'all-players' }, mode: 'reveal', sourceObjectId: null,
          duration: { kind: 'until-end-of-turn', turnNumber: 4 },
        },
        'all-look': {
          subject: { kind: 'object', objectId: 'PC4:0' as Core.CoreObjectId },
          audience: { kind: 'all-players' }, mode: 'look', sourceObjectId: null,
          duration: { kind: 'manual' },
        },
      },
    });
    const state = protocolState(withRuleSlices(base, { visibility }));
    const p2 = accepted(state, AUDIENCES[1]).response.projection.game;
    expect(p2.visibilityGrants.map((grant) => [grant.mode, grant.subject.kind])).toEqual([
      ['look', 'object'], ['reveal', 'zone'], ['reveal', 'top-of-library'], ['look', 'object'],
    ]);
    expect(p2.visibilityGrants[0]).toMatchObject({
      effectiveForPlayerIds: ['P2'], duration: { kind: 'source-bound' },
    });
    expect(p2.zones.exile.entries[0]?.kind).toBe('visible-object');
    for (const observer of [AUDIENCES[4], AUDIENCES[5]]) {
      const game = accepted(state, observer).response.projection.game;
      expect(game.visibilityGrants).toEqual([]);
      expect(visibleName(playerZones({ game } as never, 'P3').hand.entries[0])).toBe('NAME-P3-hand');
      expect(visibleName(playerZones({ game } as never, 'P4').library.entries[0])).toBe('NAME-P4-library');
      expect(game.zones.exile.entries[0]?.kind).toBe('concealed-object');
      expect(JSON.stringify(game.visibilityGrants)).not.toMatch(/p2-exile-look|sourceObjectId|PC2:0/);
    }
  });

  it('reveals an open search only to its distinct actor and selector, never to observers or bystanders', () => {
    const base = makeSentinelRoot();
    let authorities = Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} });
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'search-control', {
      controlledPlayerId: 'P2' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      sourceObjectId: null,
      scope: { kind: 'search-session', searchSessionId: 'search-p2' },
    }).value;
    const sessions = Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: ['search-p2'],
      bySession: {
        'search-p2': {
          rulesActorPlayerId: 'P2' as Core.CorePlayerId,
          selectorPlayerId: 'P1' as Core.CorePlayerId,
          zone: {
            kind: 'player-zone', playerId: 'P2' as Core.CorePlayerId, zone: 'library',
          },
          portion: { kind: 'all' },
          candidateObjectIds: ['PC7:0' as Core.CoreObjectId],
          criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
          revealFound: false,
          shuffleAfter: true,
        },
      },
    });
    const root = withRuleSlices(base, {
      decisionAuthorities: authorities,
      searchSessions: sessions,
    });
    const state = protocolState(root);
    for (const audience of AUDIENCES) {
      const sessions = accepted(state, audience).response.projection.game.searchSessions;
      if (audience.corePlayerId === 'P1' || audience.corePlayerId === 'P2') {
        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
          sessionId: 'search-p2', rulesActorPlayerId: 'P2', selectorPlayerId: 'P1',
          revealFound: false, shuffleAfter: true,
          criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
        });
        expect(sessions[0]?.candidates.map((entry) => entry.objectId)).toEqual(['PC7:0']);
        expect(visibleName(sessions[0]?.candidates[0])).toBe('NAME-P2-library');
      } else {
        expect(sessions).toEqual([]);
        expect(JSON.stringify(accepted(state, audience).response)).not.toContain('search-p2');
      }
    }
  });

  it('scopes controlled-player private information to exact in-game decision context', () => {
    const base = makeSentinelRoot();
    let authorities = Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} });
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'decision-control', {
      controlledPlayerId: 'P2' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      sourceObjectId: null,
      scope: { kind: 'decision', decisionKey: 'choose-mode' },
    }).value;
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'turn-control', {
      controlledPlayerId: 'P3' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      sourceObjectId: null,
      scope: { kind: 'active-turn', turnNumber: 1 },
    }).value;
    const state = protocolState(withRuleSlices(base, { decisionAuthorities: authorities }));
    const p1 = AUDIENCES[0];
    const p2Hand = (context: Core.CoreDecisionContextV1 | null) =>
      visibleName(playerZones(accepted(state, p1, context).response.projection, 'P2').hand.entries[0]);
    expect(p2Hand({ kind: 'decision', decisionKey: 'choose-mode' })).toBe('NAME-P2-hand');
    expect(p2Hand(null)).toBeNull();
    expect(p2Hand({ kind: 'decision', decisionKey: 'wrong-key' })).toBeNull();
    expect(p2Hand({ kind: 'search-session', searchSessionId: 'choose-mode' })).toBeNull();
    const p3MatchingTurn = accepted(
      state, p1, { kind: 'decision', decisionKey: 'irrelevant', turnNumber: 1 },
    ).response.projection;
    expect(visibleName(playerZones(p3MatchingTurn, 'P3').hand.entries[0])).toBe('NAME-P3-hand');
    const p3WrongTurn = accepted(
      state, p1, { kind: 'decision', decisionKey: 'irrelevant', turnNumber: 2 },
    ).response.projection;
    expect(visibleName(playerZones(p3WrongTurn, 'P3').hand.entries[0])).toBeNull();
    for (const observer of [AUDIENCES[4], AUDIENCES[5]]) {
      expect(visibleName(playerZones(
        accepted(state, observer, { kind: 'decision', decisionKey: 'choose-mode' }).response.projection,
        'P2',
      ).hand.entries[0])).toBeNull();
    }
    const outside = Projection.validateOnlineProjectionRequestV1({
      ...request(p1),
      decisionContext: { kind: 'outside-game', decisionKey: 'choose-mode' },
    });
    expect(outside.ok).toBe(false);
    if (outside.ok) throw new Error('Expected outside-game context rejection');
    expect(outside.issues.map((issue) => issue.code)).toContain('INVALID_LITERAL');
  });

  it('exposes only currently attemptable permissions and never claims full legality', () => {
    const base = makeSentinelRoot();
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['p2-exile-look'],
      byGrant: {
        'p2-exile-look': {
          subject: { kind: 'object', objectId: 'PC4:0' as Core.CoreObjectId },
          audience: { kind: 'players', playerIds: ['P2' as Core.CorePlayerId] },
          mode: 'look', sourceObjectId: null, duration: { kind: 'indefinite' },
        },
      },
    });
    let permissions = Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} });
    permissions = Core.addCorePlayPermissionV1(permissions, 'exile-play', {
      allowedPlayerId: 'P2' as Core.CorePlayerId, action: 'play-card',
      subject: { kind: 'object', objectId: 'PC4:0' as Core.CoreObjectId, expectedZone: { kind: 'shared-zone', zone: 'exile' } },
      sourceObjectId: 'PC2:0' as Core.CoreObjectId,
      duration: { kind: 'while-source-exists', sourceObjectId: 'PC2:0' as Core.CoreObjectId },
    }).value;
    permissions = Core.addCorePlayPermissionV1(permissions, 'top-play', {
      allowedPlayerId: 'P2' as Core.CorePlayerId, action: 'cast-spell',
      subject: { kind: 'top-of-library', playerId: 'P3' as Core.CorePlayerId },
      sourceObjectId: null, duration: { kind: 'single-use' },
    }).value;
    let authorities = Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} });
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'permission-control', {
      controlledPlayerId: 'P2' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
      sourceObjectId: null,
      scope: { kind: 'decision', decisionKey: 'permission-choice' },
    }).value;
    const state = protocolState(withRuleSlices(base, { visibility, playPermissions: permissions, decisionAuthorities: authorities }));
    for (const [audience, context] of [
      [AUDIENCES[1], null],
      [AUDIENCES[0], { kind: 'decision', decisionKey: 'permission-choice' }],
    ] as const) {
      const projected = accepted(state, audience, context)
        .response.projection.game.playPermissions;
      expect(projected.map((entry) => entry.permissionId)).toEqual(['exile-play', 'top-play']);
      expect(projected[0]).toEqual({
        permissionId: 'exile-play', allowedPlayerId: 'P2', action: 'play-card',
        subject: { kind: 'object', objectId: 'PC4:0', expectedZone: { kind: 'shared-zone', zone: 'exile' } },
        duration: { kind: 'source-bound' },
      });
      expect(projected[1]?.subject).toEqual({ kind: 'top-of-library', playerId: 'P3', topObjectId: null });
      expect(JSON.stringify(projected)).not.toMatch(/legal|timing|typeCheck|cost|sourceObjectId/);
    }
    expect(accepted(state, AUDIENCES[0]).response.projection.game.playPermissions).toEqual([]);
    expect(accepted(state, AUDIENCES[4]).response.projection.game.playPermissions).toEqual([]);

    const noVisibility = protocolState(withRuleSlices(base, { playPermissions: permissions }));
    expect(accepted(noVisibility, AUDIENCES[1]).response.projection.game.playPermissions
      .map((entry) => entry.permissionId)).toEqual(['top-play']);
  });

  it('normalizes visible and concealed runtime facts and hides non-public attachment targets', () => {
    const state = protocolState();
    const p3Battlefield = accepted(state, AUDIENCES[2]).response.projection.game.zones.battlefield.entries[0];
    expect(p3Battlefield).toMatchObject({
      kind: 'visible-object',
      runtime: {
        faceIndex: 0, faceDown: true, tapped: true, flipped: false, phasedOut: true,
        counters: [{ kind: 'shield', count: 1 }], markedDamage: 3,
        attachment: { kind: 'concealed' },
      },
    });
    const p1Battlefield = accepted(state, AUDIENCES[0]).response.projection.game.zones.battlefield.entries[0];
    expect(p1Battlefield).toMatchObject({
      kind: 'concealed-object',
      runtime: {
        faceIndex: null, faceDown: true, tapped: true, flipped: null, phasedOut: true,
        counters: [{ kind: 'shield', count: 1 }], markedDamage: 3,
        attachment: { kind: 'object', objectId: 'PC2:0' },
      },
    });
    const observerBattlefield = accepted(state, AUDIENCES[4]).response.projection.game.zones.battlefield.entries[0];
    expect(observerBattlefield).toMatchObject({
      kind: 'concealed-object', runtime: { faceIndex: null, flipped: null, attachment: { kind: 'concealed' } },
    });
    const ability = accepted(state, AUDIENCES[5]).response.projection.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'activated-ability',
    );
    expect(ability).toMatchObject({
      kind: 'visible-object', ownerPlayerId: null, controllerPlayerId: 'P3', definition: null, runtime: null,
    });
  });

  it('authenticates every role, rejects cross-role capabilities generically, and reconnects atomically', () => {
    const state = protocolState();
    for (const audience of AUDIENCES) expect(accepted(state, audience).response.role).toBe(audience.role);
    const wrongs = [
      { ...request(AUDIENCES[0]), participantCapability: CAPABILITIES[1] },
      { ...request(AUDIENCES[4]), participantCapability: SPECTATOR_CAPABILITY },
      { ...request(AUDIENCES[5]), participantCapability: TABLE_CAPABILITY },
    ];
    const rejected = wrongs.map((value) => Projection.handleOnlineProjectedSnapshotRequestV1(state, value));
    for (const transition of rejected) {
      expect(transition.state).toBe(state);
      expect(transition.response).toMatchObject({
        status: 'rejected', roomId: null, participantId: null, role: null,
        knownRevision: null, clientBuildIdMatch: null, reason: null, projection: null,
        issues: [{ code: 'AUTHORIZATION_REJECTED' }],
      });
      expect(transition.log).toEqual({
        kind: 'online-projection-log-v1', status: 'rejected', revision: 0,
        role: null, reason: null, issueCodes: ['AUTHORIZATION_REJECTED'],
      });
      assertNoSecrets(transition.response);
      assertNoSecrets(transition.log);
    }

    for (const audience of [AUDIENCES[1], AUDIENCES[4]]) {
      const disconnectedRoom = Room.disconnectOnlineRoomParticipantV1(state.room, audience.participantId);
      const disconnected = protocolState(state.coreRoot, disconnectedRoom);
      const coreDigest = Core.coreCanonicalDigestFromValueV1(disconnected.coreRoot);
      const roomBefore = jsonClone(disconnected.room);
      const transition = Projection.handleOnlineProjectedSnapshotRequestV1(disconnected, request(audience));
      expect(transition.response).toMatchObject({ status: 'accepted', role: audience.role, reason: 'rejoined' });
      expect(transition.state.room.participants.find(
        (entry) => entry.participantId === audience.participantId,
      )?.presence).toBe('connected');
      expect(Core.coreCanonicalDigestFromValueV1(transition.state.coreRoot)).toBe(coreDigest);
      expect(transition.state.revision).toBe(disconnected.revision);
      expect(transition.state.receipts).toEqual(disconnected.receipts);
      expect(transition.state.room.seats).toEqual(roomBefore.seats);
      expect(transition.state.room.participants.map(({ participantId, role, seatIndex }) => ({ participantId, role, seatIndex })))
        .toEqual(roomBefore.participants.map(({ participantId, role, seatIndex }) => ({ participantId, role, seatIndex })));
    }
  });

  it('rejects descriptor-hostile requests completely and deterministically without executing getters', () => {
    const valid = request();
    const before = JSON.stringify(valid);
    const canonical = Projection.validateOnlineProjectionRequestV1(valid);
    expect(canonical).toMatchObject({ ok: true });
    if (!canonical.ok) throw new Error('Expected valid request');
    expect(canonical.value).not.toBe(valid);
    assertDeepFrozen(canonical);
    expect(JSON.stringify(valid)).toBe(before);

    let getterCalls = 0;
    const accessor = { ...valid };
    Object.defineProperty(accessor, 'participantCapability', {
      enumerable: true,
      get() { getterCalls += 1; return CAPABILITIES[0]; },
    });
    const accessorResult = Projection.validateOnlineProjectionRequestV1(accessor);
    expect(accessorResult.ok).toBe(false);
    if (accessorResult.ok) throw new Error('Expected accessor rejection');
    expect(accessorResult.issues).toContainEqual(expect.objectContaining({
      code: 'INVALID_DESCRIPTOR', path: '/participantCapability',
    }));
    expect(getterCalls).toBe(0);

    const hostile = new Proxy({}, { ownKeys() { throw new Error('RAW-OWNKEYS-SECRET'); } });
    expect(() => Projection.validateOnlineProjectionRequestV1(hostile)).not.toThrow();
    expect(Projection.validateOnlineProjectionRequestV1(hostile)).toMatchObject({
      ok: false, issues: [{ code: 'INVALID_DESCRIPTOR' }],
    });
    const multi: Record<string, unknown> = {
      ...valid, protocolVersion: 99, knownRevision: -1, extra: true,
    };
    delete multi.roomId;
    const first = Projection.validateOnlineProjectionRequestV1(multi);
    const second = Projection.validateOnlineProjectionRequestV1(multi);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: false });
    if (first.ok) throw new Error('Expected rejected request');
    expect(first.issues.map((issue) => [issue.path, issue.code])).toEqual([
      ['/extra', 'UNKNOWN_FIELD'],
      ['/knownRevision', 'INVALID_INTEGER'],
      ['/protocolVersion', 'PROTOCOL_VERSION_MISMATCH'],
      ['/roomId', 'INVALID_ID'],
      ['/roomId', 'MISSING_FIELD'],
    ]);
    assertDeepFrozen(first);

    const nonEnumerable = { ...valid };
    Object.defineProperty(nonEnumerable, 'clientBuildId', { value: CLIENT_BUILD_ID, enumerable: false });
    expect(Projection.validateOnlineProjectionRequestV1(nonEnumerable)).toMatchObject({ ok: false });
    const symbol = { ...valid, [Symbol('secret')]: true };
    expect(Projection.validateOnlineProjectionRequestV1(symbol)).toMatchObject({ ok: false });
    const exotic = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, valid);
    expect(Projection.validateOnlineProjectionRequestV1(exotic)).toMatchObject({ ok: false });
    const absentContext = { ...valid };
    delete absentContext.decisionContext;
    const absentResult = Projection.validateOnlineProjectionRequestV1(absentContext);
    expect(absentResult.ok).toBe(false);
    if (absentResult.ok) throw new Error('Expected missing context rejection');
    expect(absentResult.issues.map((issue) => issue.path)).toContain('/decisionContext');
  });

  it('falsifies closed projection validation across arrays, relations, runtime, and candidate coverage', () => {
    const state = protocolState();
    const value = accepted(state, AUDIENCES[0]).response.projection;
    const good = Projection.validateOnlineParticipantProjectionV1(value);
    expect(good).toMatchObject({ ok: true });
    assertDeepFrozen(good);

    const mutations: readonly Readonly<{ value: unknown; code: string }>[] = [
      {
        value: (() => { const v = jsonClone(value); v.role = 'spectator'; return v; })(),
        code: 'INVALID_RELATION',
      },
      {
        value: (() => { const v = jsonClone(value); v.room.seats[0].seatIndex = 1; return v; })(),
        code: 'INVALID_RELATION',
      },
      {
        value: (() => {
          const v = jsonClone(value);
          v.game.turnOrder[1] = 'P1' as Core.CorePlayerId;
          return v;
        })(),
        code: 'DUPLICATE_VALUE',
      },
      {
        value: (() => { const v = jsonClone(value); v.game.zones.battlefield.count = 99; return v; })(),
        code: 'INVALID_RELATION',
      },
      {
        value: (() => {
          const v = jsonClone(value);
          const entry = v.game.zones.battlefield.entries[0];
          if (entry?.kind !== 'concealed-object') throw new Error('Expected concealed object');
          entry.runtime.faceIndex = 0;
          entry.runtime.attachment = { kind: 'object', objectId: 'not-an-object' as never };
          return v;
        })(),
        code: 'INVALID_ID',
      },
      {
        value: (() => {
          const v = jsonClone(value);
          const entry = v.game.zones.stack.entries.find((candidate) => candidate.kind === 'visible-object');
          if (entry?.kind !== 'visible-object' || entry.definition === null) throw new Error('Expected definition');
          entry.definition.faces[0].oracleText = 7 as never;
          return v;
        })(),
        code: 'INVALID_TYPE',
      },
    ];
    for (const mutation of mutations) {
      const result = Projection.validateOnlineParticipantProjectionV1(mutation.value);
      expect(result).toMatchObject({ ok: false });
      expect(issueCodes(result)).toContain(mutation.code);
      assertDeepFrozen(result);
    }

    const sparse = jsonClone(value);
    const sparseOrder = new Array<unknown>(sparse.game.turnOrder.length);
    sparseOrder[0] = sparse.game.turnOrder[0];
    sparseOrder[2] = sparse.game.turnOrder[2];
    sparseOrder[3] = sparse.game.turnOrder[3];
    (sparse.game as unknown as { turnOrder: unknown[] }).turnOrder = sparseOrder;
    expect(issueCodes(Projection.validateOnlineParticipantProjectionV1(sparse))).toContain('NON_DENSE_ARRAY');
    const extraArray = jsonClone(value);
    Object.defineProperty(extraArray.game.turnOrder, 'extra', { value: true, enumerable: true });
    expect(issueCodes(Projection.validateOnlineParticipantProjectionV1(extraArray))).toContain('UNKNOWN_FIELD');

    const duplicateHandle = jsonClone(value);
    const visible = duplicateHandle.game.zones.stack.entries.find((entry) => entry.kind === 'visible-object');
    if (visible === undefined) throw new Error('Expected visible stack entry');
    (duplicateHandle.game.zones.command.entries as unknown as Projection.OnlineProjectedZoneEntryV1[])
      .push(jsonClone(visible));
    duplicateHandle.game.zones.command.count = 1;
    expect(issueCodes(Projection.validateOnlineParticipantProjectionV1(duplicateHandle))).toContain('DUPLICATE_VALUE');

    const searchState = (() => {
      const base = makeSentinelRoot();
      const sessions = Core.createModeNeutralCoreSearchSessionSliceV1({
        sessionOrder: ['manual-search'],
        bySession: {
          'manual-search': {
            rulesActorPlayerId: 'P1' as Core.CorePlayerId,
            selectorPlayerId: 'P1' as Core.CorePlayerId,
            zone: {
              kind: 'player-zone', playerId: 'P1' as Core.CorePlayerId, zone: 'library',
            },
            portion: { kind: 'all' }, candidateObjectIds: ['PC1:0' as Core.CoreObjectId],
            criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false,
          },
        },
      });
      return protocolState(withRuleSlices(base, { searchSessions: sessions }));
    })();
    const coverage = jsonClone(accepted(searchState, AUDIENCES[0]).response.projection);
    const candidate = coverage.game.searchSessions[0]?.candidates[0];
    if (candidate === undefined) throw new Error('Expected search candidate');
    candidate.objectId = 'PC99:0' as Core.CoreObjectId;
    expect(issueCodes(Projection.validateOnlineParticipantProjectionV1(coverage))).toContain('INVALID_RELATION');

    let getterCalls = 0;
    const projectionAccessor = jsonClone(value) as unknown as Record<string, unknown>;
    Object.defineProperty(projectionAccessor, 'game', { enumerable: true, get() { getterCalls += 1; return {}; } });
    expect(() => Projection.validateOnlineParticipantProjectionV1(projectionAccessor)).not.toThrow();
    expect(Projection.validateOnlineParticipantProjectionV1(projectionAccessor)).toMatchObject({ ok: false });
    expect(getterCalls).toBe(0);
    const trap = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('RAW-DESCRIPTOR-SECRET'); } });
    expect(() => Projection.validateOnlineParticipantProjectionV1(trap)).not.toThrow();
    assertNoSecrets(Projection.validateOnlineParticipantProjectionV1(trap), ['RAW-DESCRIPTOR-SECRET']);
  });

  it('keeps every public result serializable and fails closed on capability-shaped projected data', () => {
    const state = protocolState();
    const acceptedTransition = accepted(state, AUDIENCES[0]);
    const rejectedTransition = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
      ...request(), participantCapability: CAPABILITIES[1],
    });
    const invalidProjection = Projection.validateOnlineParticipantProjectionV1({ secret: 'HIDDEN-ORACLE-SENTINEL' });
    let operationError: unknown;
    try {
      Projection.handleOnlineProjectedSnapshotRequestV1({ invalid: true }, request());
    } catch (error: unknown) {
      operationError = error;
    }
    expect(operationError).toBeInstanceOf(Projection.OnlineProjectionOperationErrorV1);
    for (const value of [
      Projection.validateOnlineProjectionRequestV1({ bad: true }),
      Projection.validateOnlineParticipantProjectionV1(acceptedTransition.response.projection),
      invalidProjection,
      acceptedTransition.response,
      acceptedTransition.log,
      rejectedTransition.response,
      rejectedTransition.log,
      operationError,
    ]) {
      expect(() => JSON.stringify(value)).not.toThrow();
      assertNoSecrets(value, [
        'HIDDEN-ORACLE-SENTINEL', 'RAW-OWNKEYS-SECRET', 'RAW-DESCRIPTOR-SECRET',
        'Actor and payload player must match',
      ]);
      assertDeepFrozen(value);
    }
    const validRequest = Projection.validateOnlineProjectionRequestV1(request());
    expect(validRequest).toMatchObject({ ok: true });
    expect(() => JSON.stringify(validRequest)).not.toThrow();
    assertDeepFrozen(validRequest);

    const capabilityRoot = makeSentinelRoot();
    const rawTurn = jsonClone(capabilityRoot.ruleAuthority.turnPriorityBundle) as unknown as MutableTurnBundle;
    rawTurn.stackBundle.objectRegistry.cardDefinitions['def.hidden-P1-hand'].name = CAPABILITIES[0];
    const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1(rawTurn as never);
    const dangerousRoot = Core.createModeNeutralCoreRootV1({
      ...capabilityRoot,
      ruleAuthority: Core.createCoreRuleAuthorityBundleV1({
        ...capabilityRoot.ruleAuthority,
        turnPriorityBundle,
      }),
    });
    const dangerousState = protocolState(dangerousRoot);
    const rejected = Projection.handleOnlineProjectedSnapshotRequestV1(dangerousState, request());
    expect(rejected.response).toMatchObject({
      status: 'rejected', projection: null, issues: [{ code: 'PROJECTION_REJECTED' }],
    });
    expect(rejected.log).toEqual({
      kind: 'online-projection-log-v1', status: 'rejected', revision: 0,
      role: null, reason: null, issueCodes: ['PROJECTION_REJECTED'],
    });
    assertNoSecrets(rejected.response);
    assertNoSecrets(rejected.log);
  });

  it('never invokes nested accessors or Proxy get traps while rejecting hostile projections', () => {
    const projection = accepted(protocolState(), AUDIENCES[0]).response.projection;
    const nestedAccessor = jsonClone(projection);
    const visible = nestedAccessor.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectId === 'PC5:1',
    );
    if (visible?.kind !== 'visible-object') throw new Error('Expected visible stack card');
    const originalDefinition = visible.definition;
    let getterCalls = 0;
    Object.defineProperty(visible, 'definition', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return originalDefinition;
      },
    });
    const accessorResult = Projection.validateOnlineParticipantProjectionV1(nestedAccessor);
    expect(accessorResult.ok).toBe(false);
    expect(getterCalls).toBe(0);
    assertDeepFrozen(accessorResult);

    const proxyWrapped = jsonClone(projection);
    const sourceOrder = [...proxyWrapped.game.turnOrder];
    let getTrapCalls = 0;
    const descriptorSafeOrder = new Proxy(sourceOrder, {
      get() {
        getTrapCalls += 1;
        throw new Error('HOSTILE-TURN-ORDER-GET');
      },
    });
    (proxyWrapped.game as unknown as { turnOrder: unknown }).turnOrder = descriptorSafeOrder;
    let proxyResult: Projection.OnlineParticipantProjectionValidationResultV1 | null = null;
    expect(() => {
      proxyResult = Projection.validateOnlineParticipantProjectionV1(proxyWrapped);
    }).not.toThrow();
    expect(proxyResult).toMatchObject({ ok: true });
    expect(getTrapCalls).toBe(0);
    assertDeepFrozen(proxyResult);

    let hostileGetCalls = 0;
    const hostileProjection = jsonClone(projection);
    const hostileOrder = new Proxy([...hostileProjection.game.turnOrder], {
      get() {
        hostileGetCalls += 1;
        throw new Error('HOSTILE-TURN-ORDER-GET');
      },
      ownKeys() {
        throw new Error('HOSTILE-TURN-ORDER-OWNKEYS');
      },
    });
    (hostileProjection.game as unknown as { turnOrder: unknown }).turnOrder = hostileOrder;
    const hostileResult = Projection.validateOnlineParticipantProjectionV1(hostileProjection);
    expect(hostileResult.ok).toBe(false);
    expect(hostileGetCalls).toBe(0);
    assertNoSecrets(hostileResult, [
      'HOSTILE-TURN-ORDER-GET', 'HOSTILE-TURN-ORDER-OWNKEYS',
    ]);
    assertDeepFrozen(hostileResult);
  });

  it('orders an earlier controlled player before its P3 decision maker in projected grants', () => {
    const base = makeSentinelRoot();
    let authorities = Core.createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: [],
      byAuthority: {},
    });
    authorities = Core.addCoreDecisionAuthorityV1(authorities, 'p1-controlled-by-p3', {
      controlledPlayerId: 'P1' as Core.CorePlayerId,
      decisionMakerPlayerId: 'P3' as Core.CorePlayerId,
      sourceObjectId: null,
      scope: { kind: 'decision', decisionKey: 'earlier-player-choice' },
    }).value;
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['all-player-battlefield'],
      byGrant: {
        'all-player-battlefield': {
          subject: { kind: 'zone', zone: { kind: 'shared-zone', zone: 'battlefield' } },
          audience: { kind: 'all-players' },
          mode: 'reveal',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      },
    });
    const state = protocolState(withRuleSlices(base, {
      decisionAuthorities: authorities,
      visibility,
    }));
    const projection = accepted(
      state,
      AUDIENCES[2],
      { kind: 'decision', decisionKey: 'earlier-player-choice' },
    ).response.projection;
    expect(projection.game.visibilityGrants).toHaveLength(1);
    expect(projection.game.visibilityGrants[0]?.effectiveForPlayerIds).toEqual(['P1', 'P3']);
    const validation = Projection.validateOnlineParticipantProjectionV1(projection);
    expect(validation).toMatchObject({ ok: true });
    assertDeepFrozen(validation);
  });

  it('redacts a configured capability used as an unknown key on a failed request', () => {
    const hostile = {
      ...request(),
      participantCapability: 'invalid',
      [CAPABILITIES[0]]: true,
    };
    const result = Projection.validateOnlineProjectionRequestV1(hostile);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failed request validation');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['INVALID_CAPABILITY', 'UNKNOWN_FIELD']),
    );
    expect(JSON.stringify(result.issues)).not.toContain(CAPABILITIES[0]);
    assertDeepFrozen(result);
  });

  it('rejects hidden cards in public zones and visible cards missing definition or runtime', () => {
    const projection = accepted(protocolState(), AUDIENCES[0]).response.projection;
    const hiddenBattlefield = jsonClone(projection);
    (hiddenBattlefield.game.zones.battlefield.entries as unknown as unknown[])[0] = {
      kind: 'hidden-card',
    };
    const hiddenResult = Projection.validateOnlineParticipantProjectionV1(hiddenBattlefield);
    expect(hiddenResult.ok).toBe(false);
    assertDeepFrozen(hiddenResult);

    for (const missing of ['definition', 'runtime'] as const) {
      const malformed = jsonClone(projection);
      const card = malformed.game.zones.stack.entries.find(
        (entry) => entry.kind === 'visible-object' && entry.objectId === 'PC5:1',
      );
      if (card?.kind !== 'visible-object') throw new Error('Expected visible stack card');
      (card as unknown as Record<typeof missing, unknown>)[missing] = null;
      const result = Projection.validateOnlineParticipantProjectionV1(malformed);
      expect(result.ok).toBe(false);
      assertDeepFrozen(result);
    }
  });

  it('compares search candidates structurally rather than by property insertion order', () => {
    const base = makeSentinelRoot();
    const sessions = Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: ['reverse-order-search'],
      bySession: {
        'reverse-order-search': {
          rulesActorPlayerId: 'P1' as Core.CorePlayerId,
          selectorPlayerId: 'P1' as Core.CorePlayerId,
          zone: {
            kind: 'player-zone', playerId: 'P1' as Core.CorePlayerId, zone: 'library',
          },
          portion: { kind: 'all' },
          candidateObjectIds: ['PC1:0' as Core.CoreObjectId],
          criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
          revealFound: false,
          shuffleAfter: false,
        },
      },
    });
    const state = protocolState(withRuleSlices(base, { searchSessions: sessions }));
    const projection = jsonClone(accepted(state, AUDIENCES[0]).response.projection);
    const candidate = projection.game.searchSessions[0]?.candidates[0];
    if (candidate === undefined) throw new Error('Expected projected search candidate');
    const reversed: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(candidate).reverse()) {
      if (typeof key !== 'string') throw new Error('Expected string candidate key');
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (descriptor === undefined || !('value' in descriptor)) {
        throw new Error('Expected candidate data property');
      }
      const fieldValue: unknown = descriptor.value;
      reversed[key] = fieldValue;
    }
    (projection.game.searchSessions[0].candidates as unknown as unknown[])[0] = reversed;
    expect(Reflect.ownKeys(reversed)).toEqual(Reflect.ownKeys(candidate).reverse());
    const result = Projection.validateOnlineParticipantProjectionV1(projection);
    expect(result).toMatchObject({ ok: true });
    assertDeepFrozen(result);
  });

  it('rejects every O4P-02D-M01-R hostile runtime and definition mutation', () => {
    const canonical = accepted(protocolState(), AUDIENCES[0]).response.projection;
    expect(Projection.validateOnlineParticipantProjectionV1(canonical)).toMatchObject({ ok: true });

    const concealedFaceUp = jsonClone(canonical);
    const concealedExile = concealedFaceUp.game.zones.exile.entries[0];
    if (concealedExile?.kind !== 'concealed-object') {
      throw new Error('Expected concealed Exile object');
    }
    concealedExile.runtime.faceDown = false;

    const spellCopyRuntime = jsonClone(canonical);
    const spellCopy = spellCopyRuntime.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'spell-copy',
    );
    const card = spellCopyRuntime.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'card',
    );
    if (spellCopy?.kind !== 'visible-object' || card?.kind !== 'visible-object' || card.runtime === null) {
      throw new Error('Expected visible spell-copy and card runtime');
    }
    spellCopy.runtime = jsonClone(card.runtime);

    const invalidCounter = jsonClone(canonical);
    const counterCard = invalidCounter.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'card',
    );
    if (counterCard?.kind !== 'visible-object' || counterCard.runtime === null) {
      throw new Error('Expected visible card runtime');
    }
    (counterCard.runtime.counters as unknown as Array<{ kind: string; count: number }>).push({
      kind: 'bad-counter',
      count: 0,
    });

    const unsortedColors = jsonClone(canonical);
    const definitionCard = unsortedColors.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.objectKind === 'card',
    );
    if (definitionCard?.kind !== 'visible-object' || definitionCard.definition === null) {
      throw new Error('Expected visible card definition');
    }
    (definitionCard.definition as unknown as { colorIdentity: string[] }).colorIdentity = ['U', 'W'];

    for (const [label, hostile] of [
      ['concealed exile faceDown=false', concealedFaceUp],
      ['spell-copy with card runtime', spellCopyRuntime],
      ['bad-counter with zero count', invalidCounter],
      ['unsorted color identity', unsortedColors],
    ] as const) {
      const result = Projection.validateOnlineParticipantProjectionV1(hostile);
      expect.soft(result.ok, label).toBe(false);
      assertDeepFrozen(result);
    }
  });

  it('rejects every hostile nested scalar without invoking implicit-coercion Proxy traps', () => {
    const canonical = accepted(protocolState(), AUDIENCES[0]).response.projection;
    const visibility = Core.createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['coercion-grant'],
      byGrant: {
        'coercion-grant': {
          subject: { kind: 'zone', zone: { kind: 'shared-zone', zone: 'battlefield' } },
          audience: { kind: 'all-players' },
          mode: 'reveal',
          sourceObjectId: null,
          duration: { kind: 'indefinite' },
        },
      },
    });
    const withGrant = accepted(
      protocolState(withRuleSlices(makeSentinelRoot(), { visibility })),
      AUDIENCES[0],
    ).response.projection;
    const cases: readonly Readonly<{
      label: string;
      source: Projection.OnlineParticipantProjectionV1;
      mutate: (value: Projection.OnlineParticipantProjectionV1, scalar: unknown) => void;
    }>[] = [
      {
        label: 'audience participant relation', source: canonical,
        mutate: (value, scalar) => {
          (value as unknown as { participantId: unknown }).participantId = scalar;
        },
      },
      {
        label: 'host participant relation', source: canonical,
        mutate: (value, scalar) => {
          (value.room as unknown as { hostParticipantId: unknown }).hostParticipantId = scalar;
        },
      },
      {
        label: 'active player relation', source: canonical,
        mutate: (value, scalar) => {
          (value.game.turn as unknown as { activePlayerId: unknown }).activePlayerId = scalar;
        },
      },
      {
        label: 'zone-group player relation', source: canonical,
        mutate: (value, scalar) => {
          (value.game.zones.byPlayer[0] as unknown as { playerId: unknown }).playerId = scalar;
        },
      },
      {
        label: 'effective-player ordering', source: withGrant,
        mutate: (value, scalar) => {
          (value.game.visibilityGrants[0].effectiveForPlayerIds as unknown as unknown[]).push(scalar);
        },
      },
      {
        label: 'duration kind dispatch', source: withGrant,
        mutate: (value, scalar) => {
          (value.game.visibilityGrants[0].duration as unknown as { kind: unknown }).kind = scalar;
        },
      },
      {
        label: 'keyword ordering', source: canonical,
        mutate: (value, scalar) => {
          const visible = value.game.zones.stack.entries.find(
            (entry) => entry.kind === 'visible-object' && entry.definition !== null,
          );
          if (visible?.kind !== 'visible-object' || visible.definition === null) {
            throw new Error('Expected visible definition');
          }
          (visible.definition as unknown as { keywords: unknown[] }).keywords = ['Alpha', scalar];
        },
      },
    ];

    for (const { label, source, mutate } of cases) {
      const hostile = jsonClone(source);
      let getCalls = 0;
      mutate(hostile, new Proxy({}, {
        get() {
          getCalls += 1;
          throw new Error(`HOSTILE-NESTED-SCALAR-GET:${label}`);
        },
      }));

      const first = Projection.validateOnlineParticipantProjectionV1(hostile);
      const second = Projection.validateOnlineParticipantProjectionV1(hostile);
      expect(first, label).toEqual(second);
      expect(first.ok, label).toBe(false);
      expect(getCalls, label).toBe(0);
      assertDeepFrozen(first);
      assertDeepFrozen(second);
    }
  });

  it('rejects non-UUID Scryfall definition source identifiers', () => {
    const hostile = jsonClone(accepted(protocolState(), AUDIENCES[0]).response.projection);
    const visibleIndex = hostile.game.zones.stack.entries.findIndex(
      (entry) => entry.kind === 'visible-object' && entry.definition !== null,
    );
    const visible = hostile.game.zones.stack.entries[visibleIndex];
    if (visible?.kind !== 'visible-object' || visible.definition === null) {
      throw new Error('Expected visible definition');
    }
    visible.definition.source = {
      kind: 'scryfall',
      scryfallId: 'not-a-uuid',
      oracleId: '',
    };

    const result = Projection.validateOnlineParticipantProjectionV1(hostile);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid Scryfall source rejection');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'INVALID_ID',
        path: `/game/zones/stack/entries/${visibleIndex}/definition/source/oracleId`,
      }),
      expect.objectContaining({
        code: 'INVALID_ID',
        path: `/game/zones/stack/entries/${visibleIndex}/definition/source/scryfallId`,
      }),
    ]));
    assertDeepFrozen(result);
  });

  it('projects and self-validates a Core-accepted keyword containing a carriage return', () => {
    const base = makeSentinelRoot();
    const raw = jsonClone(base.ruleAuthority.turnPriorityBundle) as unknown as MutableTurnBundle;
    raw.stackBundle.objectRegistry.cardDefinitions['def.fixture-card'].keywords = ['Alpha\rBeta'];
    const coreValidation = Core.validateCoreTurnPriorityBundleV1(raw);
    expect(coreValidation).toMatchObject({ ok: true });
    if (!coreValidation.ok) throw new Error('Expected Core to accept the CR-containing keyword');
    assertDeepFrozen(coreValidation);

    const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
      turnPriorityBundle: coreValidation.value,
      control: base.ruleAuthority.control,
      visibility: base.ruleAuthority.visibility,
      searchSessions: base.ruleAuthority.searchSessions,
      playPermissions: base.ruleAuthority.playPermissions,
      decisionAuthorities: base.ruleAuthority.decisionAuthorities,
    });
    const root = Core.createModeNeutralCoreRootV1({ ...base, ruleAuthority });
    const transition = accepted(protocolState(root), AUDIENCES[0]);
    const visible = transition.response.projection.game.zones.stack.entries.find(
      (entry) => entry.kind === 'visible-object' && entry.definition !== null,
    );
    expect(visible?.kind === 'visible-object' ? visible.definition?.keywords : null).toEqual([
      'Alpha\rBeta',
    ]);
    const projectionValidation = Projection.validateOnlineParticipantProjectionV1(
      transition.response.projection,
    );
    expect(projectionValidation).toMatchObject({ ok: true });
    assertDeepFrozen(transition);
    assertDeepFrozen(projectionValidation);
  });
});
