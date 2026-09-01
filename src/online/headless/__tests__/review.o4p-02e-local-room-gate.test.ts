import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import turnPriorityFixture from '../../../engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';
import * as Projection from '../../projection/index';
import * as Protocol from '../../protocol/index';
import * as Room from '../../room/index';
import * as Headless from '../index';
import fixture from '../fixtures/o4p-02e-local-room-gate-v1.json';

const PLAYER_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4'] as const);
const PARTICIPANT_IDS = Object.freeze([
  'host-p1' as Room.OnlineRoomParticipantIdV1,
  'player-p2' as Room.OnlineRoomParticipantIdV1,
  'player-p3' as Room.OnlineRoomParticipantIdV1,
  'player-p4' as Room.OnlineRoomParticipantIdV1,
] as const);
const TABLE_ID = 'table-display' as Room.OnlineRoomParticipantIdV1;
const CAPABILITIES = Object.freeze([
  'O4P02E_P1_AAAAAAAAAAAAAAAAAAAAAA' as Room.OnlineRoomSeatCapabilityV1,
  'O4P02E_P2_BBBBBBBBBBBBBBBBBBBBBB' as Room.OnlineRoomSeatCapabilityV1,
  'O4P02E_P3_CCCCCCCCCCCCCCCCCCCCCC' as Room.OnlineRoomSeatCapabilityV1,
  'O4P02E_P4_DDDDDDDDDDDDDDDDDDDDDD' as Room.OnlineRoomSeatCapabilityV1,
] as const);
const TABLE_CAPABILITY =
  'O4P02E_TABLE_TTTTTTTTTTTTTTTTTTT' as Protocol.OnlineProtocolObserverCapabilityV1;
const COMMAND_IDS = Object.freeze({
  normalRejection: 'command-normal-rejection' as Protocol.OnlineProtocolCommandIdV1,
  tableRoleRejection: 'command-table-role-rejection' as Protocol.OnlineProtocolCommandIdV1,
  acceptedFirst: 'command-accepted-1' as Protocol.OnlineProtocolCommandIdV1,
  acceptedSecond: 'command-accepted-2' as Protocol.OnlineProtocolCommandIdV1,
  stale: 'command-stale-1' as Protocol.OnlineProtocolCommandIdV1,
});
const ALL_CAPABILITIES = Object.freeze([...CAPABILITIES, TABLE_CAPABILITY]);
const ALL_CAPABILITY_FRAGMENTS = Object.freeze([
  ...new Set(
    ALL_CAPABILITIES.flatMap((capability) =>
      Array.from(
        { length: capability.length - 7 },
        (_, start) => capability.slice(start, start + 8),
      ),
    ),
  ),
]);
const SERVER_BUILD_ID = 'server-o4p-02e';
const CLIENT_BUILD_ID = 'client-o4p-02e';

const ISSUE_CODES: Readonly<Record<Headless.OnlineHeadlessRoomGateIssueV1['code'], true>> = {
  INVALID_ROOT: true,
  MISSING_FIELD: true,
  UNKNOWN_FIELD: true,
  INVALID_DESCRIPTOR: true,
  INVALID_TYPE: true,
  INVALID_LITERAL: true,
  INVALID_VERSION: true,
  INVALID_ID: true,
  INVALID_CAPABILITY: true,
  INVALID_INTEGER: true,
  INVALID_ARRAY: true,
  NON_DENSE_ARRAY: true,
  INVALID_BUILD_ID: true,
  INVALID_PROTOCOL_STATE: true,
  INVALID_CLIENT_SET: true,
  INVALID_ACTION: true,
  INVALID_RELATION: true,
  COMPOSITION_REJECTED: true,
  COVERAGE_MISSING: true,
  PRIVACY_REJECTED: true,
  REPLAY_MISMATCH: true,
};

const OPERATION_CODES: Readonly<
  Record<Headless.OnlineHeadlessRoomGateOperationErrorV1['code'], true>
> = {
  INVALID_INPUT: true,
  COMPOSITION_REJECTED: true,
  COVERAGE_MISSING: true,
  PRIVACY_REJECTED: true,
  REPLAY_MISMATCH: true,
};

type DeepMutable<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
      : T;

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

type ScriptEntry = Readonly<{
  readonly witness: string;
  readonly action: Headless.OnlineHeadlessRoomGateActionV1;
}>;

type AcceptedProjection = Projection.OnlineProjectedSnapshotTransitionV1 & {
  readonly response: Projection.OnlineProjectedSnapshotAcceptedV1;
};

const REQUIRED_WITNESSES = [
  'hello-p1',
  'projection-p1',
  'accepted-command',
  'accepted-command-ordering',
  'normal-player-rejection',
  'table-role-rejection',
  'stale-rejection',
  'stale-current-projection',
  'accepted-duplicate',
  'rejoin-player',
  'rejoin-table',
] as const;

function jsonClone<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>;
}

function mutableRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw new Error('Expected mutable record');
  return value as Record<string, unknown>;
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

function assertExactKeys(value: object, keys: readonly string[]): void {
  expect(Reflect.ownKeys(value)).toEqual(keys);
}

function assertNoCapabilities(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const fragment of ALL_CAPABILITY_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
}

function assertSafeReport(value: unknown): void {
  const serialized = JSON.stringify(value);
  assertNoCapabilities(value);
  expect(serialized).not.toMatch(
    /NAME-P[1-4]-(?:hand|library)|ORACLE-P[1-4]-(?:hand|library)|seatCapability|observerCapability|observerAuthorizations|physicalCardId|definitionId|decisionContext|commandId|commandDigest|requestDigest|receipt|coreRoot|finalStateDigest|initialStateDigest|event|result|issue|message|error|stack/i,
  );
  expect(serialized).not.toMatch(/"projection"\s*:/i);
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
    faces: [
      {
        name: `FACE-${label}`,
        manaCost: '{1}',
        typeLine: `FACE-TYPE-${label}`,
        oracleText: `ORACLE-${label}`,
        power: null,
        toughness: null,
        loyalty: null,
        defense: null,
      },
    ],
  };
}

function makeSentinelRoot(): Core.ModeNeutralCoreRootV1 {
  const source = Core.createCoreTurnPriorityBundleV1(turnPriorityFixture.bundle as never);
  const raw = jsonClone(source) as unknown as MutableTurnBundle;
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
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1(raw as never);
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({
      effectOrder: [],
      byEffect: {},
      continuityByObject: {
        'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false },
      } as never,
    }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: [],
      bySession: {},
    }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({
      permissionOrder: [],
      byPermission: {},
    }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: [],
      byAuthority: {},
    }),
  });
  const commanders = [
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC3', ownerPlayerId: 'P2' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC6', ownerPlayerId: 'P3' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC5', ownerPlayerId: 'P4' }),
  ];
  return Core.createModeNeutralCoreRootV1({
    versions: Core.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({
      players: registry.turnOrder.map((playerId) => ({
        playerId,
        status: 'active',
        exitCause: null,
      })),
    }),
    commanders,
    commanderCastLedgers: commanders.map((commander) =>
      Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 }),
    ),
    commanderDamage: Core.createCoreCommanderDamageStateV1({
      commanders,
      defendingPlayerIds: registry.turnOrder,
      entries: [],
    }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({
      commanders,
      defendingPlayerIds: registry.turnOrder,
      records: [],
    }),
    combatContext: null,
  });
}

function makeActiveState(root = makeSentinelRoot()): Protocol.OnlineProtocolStateV1 {
  const seatAssignments = PLAYER_IDS.map((corePlayerId, seatIndex) => ({
    seatIndex,
    corePlayerId,
    seatCapability: CAPABILITIES[seatIndex],
  }));
  let room = Room.createOnlineRoomV1({
    roomId: fixture.roomId,
    seatAssignments,
    host: { participantId: PARTICIPANT_IDS[0], seatCapability: CAPABILITIES[0] },
  });
  for (let index = 1; index < PARTICIPANT_IDS.length; index += 1) {
    room = Room.joinOnlineRoomV1(room, {
      participantId: PARTICIPANT_IDS[index],
      role: 'player',
      seatCapability: CAPABILITIES[index],
    });
  }
  room = Room.joinOnlineRoomV1(room, { participantId: TABLE_ID, role: 'table' });
  for (let index = 0; index < PARTICIPANT_IDS.length; index += 1) {
    room = Room.setOnlineRoomPlayerReadyV1(room, {
      participantId: PARTICIPANT_IDS[index],
      seatCapability: CAPABILITIES[index],
      ready: true,
    });
  }
  room = Room.startOnlineRoomV1(room, PARTICIPANT_IDS[0]);
  room = Room.activateOnlineRoomV1(room, { hostParticipantId: PARTICIPANT_IDS[0], coreRoot: root });
  return Protocol.createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD_ID,
    room,
    coreRoot: root,
    observerAuthorizations: [{ participantId: TABLE_ID, observerCapability: TABLE_CAPABILITY }],
  });
}

function coreCommand(
  actorPlayerId: (typeof PLAYER_IDS)[number],
  sequence: number,
): Core.CoreCommandV1 {
  const physicalCardId = ({ P1: 'PC1', P2: 'PC3', P3: 'PC6', P4: 'PC5' } as const)[actorPlayerId];
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionMakerPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: `o4p-02e-${actorPlayerId}` },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: physicalCardId as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function makeExitedStartingState(): Protocol.OnlineProtocolStateV1 {
  const initialRoot = makeSentinelRoot();
  const initialTurn = initialRoot.ruleAuthority.turnPriorityBundle;
  const registry = initialTurn.stackBundle.objectRegistry;
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    ...initialTurn,
    pendingTriggers: Core.createModeNeutralCorePendingTriggerSliceV1(registry, {
      pendingObjectIds: [],
      byObject: {},
    }),
  });
  const activeRoot = Core.createModeNeutralCoreRootV1({
    ...initialRoot,
    ruleAuthority: Core.createCoreRuleAuthorityBundleV1({
      ...initialRoot.ruleAuthority,
      turnPriorityBundle,
    }),
  });
  const active = makeActiveState(activeRoot);
  const exitCommand = Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: 1,
    actorPlayerId: 'P4' as Core.CorePlayerId,
    decisionMakerPlayerId: 'P4' as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'o4p-02e-exited-start' },
    payload: {
      kind: 'player-exit',
      playerId: 'P4' as Core.CorePlayerId,
      cause: 'concession',
    },
  });
  const exited = Core.applyCoreCommandV1(active.coreRoot, exitCommand);
  if (exited.status !== 'accepted') throw new Error('Expected canonical P4 exit state');
  const freshExitedRoot = Core.createModeNeutralCoreRootV1({
    ...exited.root,
    acceptedCommandCount: 0,
  });
  const exitedRoom = Room.reconcileOnlineRoomCoreLifecycleV1(active.room, freshExitedRoot);
  return Protocol.createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD_ID,
    room: exitedRoom,
    coreRoot: freshExitedRoot,
    observerAuthorizations: [{ participantId: TABLE_ID, observerCapability: TABLE_CAPABILITY }],
  });
}

function makeScript(): readonly ScriptEntry[] {
  const acceptedCommand = coreCommand('P1', 1);
  return Object.freeze([
    ...PARTICIPANT_IDS.map((participantId, index) =>
      Object.freeze({
        witness: `hello-p${index + 1}`,
        action: Object.freeze({ kind: 'client-hello' as const, participantId }),
      }),
    ),
    Object.freeze({
      witness: 'hello-table',
      action: Object.freeze({ kind: 'client-hello' as const, participantId: TABLE_ID }),
    }),
    ...PARTICIPANT_IDS.map((participantId, index) =>
      Object.freeze({
        witness: `projection-p${index + 1}`,
        action: Object.freeze({
          kind: 'projection' as const,
          participantId,
          knownRevision: 0,
          decisionContext: null,
        }),
      }),
    ),
    Object.freeze({
      witness: 'projection-table',
      action: Object.freeze({
        kind: 'projection' as const,
        participantId: TABLE_ID,
        knownRevision: 0,
        decisionContext: null,
      }),
    }),
    Object.freeze({
      witness: 'normal-player-rejection',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: PARTICIPANT_IDS[0],
        commandId: COMMAND_IDS.normalRejection,
        baseRevision: 0,
        command: coreCommand('P2', 1),
      }),
    }),
    Object.freeze({
      witness: 'table-role-rejection',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: TABLE_ID,
        commandId: COMMAND_IDS.tableRoleRejection,
        baseRevision: 0,
        command: acceptedCommand,
      }),
    }),
    Object.freeze({
      witness: 'accepted-command',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: PARTICIPANT_IDS[0],
        commandId: COMMAND_IDS.acceptedFirst,
        baseRevision: 0,
        command: acceptedCommand,
      }),
    }),
    Object.freeze({
      witness: 'accepted-command-ordering',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: PARTICIPANT_IDS[1],
        commandId: COMMAND_IDS.acceptedSecond,
        baseRevision: 1,
        command: coreCommand('P2', 2),
      }),
    }),
    Object.freeze({
      witness: 'accepted-duplicate',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: PARTICIPANT_IDS[0],
        commandId: COMMAND_IDS.acceptedFirst,
        baseRevision: 0,
        command: acceptedCommand,
      }),
    }),
    Object.freeze({
      witness: 'stale-rejection',
      action: Object.freeze({
        kind: 'command' as const,
        participantId: PARTICIPANT_IDS[1],
        commandId: COMMAND_IDS.stale,
        baseRevision: 0,
        command: coreCommand('P2', 1),
      }),
    }),
    Object.freeze({
      witness: 'stale-current-projection',
      action: Object.freeze({
        kind: 'projection' as const,
        participantId: PARTICIPANT_IDS[1],
        knownRevision: 2,
        decisionContext: null,
      }),
    }),
    Object.freeze({
      witness: 'disconnect-player',
      action: Object.freeze({ kind: 'disconnect' as const, participantId: PARTICIPANT_IDS[2] }),
    }),
    Object.freeze({
      witness: 'rejoin-player',
      action: Object.freeze({
        kind: 'projection' as const,
        participantId: PARTICIPANT_IDS[2],
        knownRevision: 2,
        decisionContext: null,
      }),
    }),
    Object.freeze({
      witness: 'disconnect-table',
      action: Object.freeze({ kind: 'disconnect' as const, participantId: TABLE_ID }),
    }),
    Object.freeze({
      witness: 'rejoin-table',
      action: Object.freeze({
        kind: 'projection' as const,
        participantId: TABLE_ID,
        knownRevision: 2,
        decisionContext: null,
      }),
    }),
  ] satisfies readonly ScriptEntry[]);
}

function makeInput(
  state: Protocol.OnlineProtocolStateV1 = makeActiveState(),
  script: readonly ScriptEntry[] = makeScript(),
): Headless.OnlineHeadlessRoomGateInputV1 {
  return {
    kind: 'online-local-headless-room-gate-input-v1',
    schemaVersion: 1,
    state,
    clients: Object.freeze([
      ...PARTICIPANT_IDS.map((participantId, index) =>
        Object.freeze({
          participantId,
          participantCapability: CAPABILITIES[index],
          clientBuildId: CLIENT_BUILD_ID,
        }),
      ),
      Object.freeze({
        participantId: TABLE_ID,
        participantCapability: TABLE_CAPABILITY,
        clientBuildId: CLIENT_BUILD_ID,
      }),
    ]),
    actions: Object.freeze(script.map(({ action }) => action)),
  };
}

function acceptedProjection(
  state: Protocol.OnlineProtocolStateV1,
  participantId: Room.OnlineRoomParticipantIdV1,
  participantCapability: Protocol.OnlineProtocolParticipantCapabilityV1,
): AcceptedProjection {
  const transition = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
    kind: 'online-projection-request-v1',
    protocolVersion: 1,
    roomId: fixture.roomId,
    participantId,
    participantCapability,
    knownRevision: state.revision,
    clientBuildId: CLIENT_BUILD_ID,
    decisionContext: null,
  });
  expect(transition.response.status).toBe('accepted');
  if (transition.response.status !== 'accepted') throw new Error('Expected accepted projection');
  return transition as AcceptedProjection;
}

function playerZones(
  projection: Projection.OnlineParticipantProjectionV1,
  playerId: string,
): Projection.OnlineProjectedPlayerZonesV1 {
  const group = projection.game.zones.byPlayer.find((entry) => entry.playerId === playerId);
  if (group === undefined) throw new Error(`Missing ${playerId} zones`);
  return group.zones;
}

function operationError(
  callback: () => unknown,
  expectedCode?: Headless.OnlineHeadlessRoomGateOperationErrorV1['code'],
): Headless.OnlineHeadlessRoomGateOperationErrorV1 {
  let caught: unknown;
  try {
    callback();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Headless.OnlineHeadlessRoomGateOperationErrorV1);
  const error = caught as Headless.OnlineHeadlessRoomGateOperationErrorV1;
  if (expectedCode !== undefined) expect(error.code).toBe(expectedCode);
  expect(OPERATION_CODES[error.code]).toBe(true);
  assertDeepFrozen(error);
  assertNoCapabilities({
    name: error.name,
    code: error.code,
    message: error.message,
    issues: error.issues,
  });
  expect(Reflect.ownKeys(error).sort()).toEqual(['code', 'issues', 'message', 'name', 'stack']);
  expect(Object.keys(error).sort()).toEqual(['code', 'issues', 'name']);
  for (const key of ['cause', 'request', 'response', 'capability', 'state', 'projection']) {
    expect(Object.hasOwn(error, key)).toBe(false);
  }
  return error;
}

function validationIssues(
  input: unknown,
  compareMutation = true,
): readonly Headless.OnlineHeadlessRoomGateIssueV1[] {
  const before = (() => {
    if (!compareMutation) return null;
    try {
      return JSON.stringify(input);
    } catch {
      return null;
    }
  })();
  const first = Headless.validateOnlineHeadlessRoomGateInputV1(input);
  const second = Headless.validateOnlineHeadlessRoomGateInputV1(input);
  expect(first.ok).toBe(false);
  expect(second).toEqual(first);
  if (first.ok || second.ok) throw new Error('Expected invalid input');
  expect(first.issues.length).toBeGreaterThan(0);
  expect(first.issues).toEqual(second.issues);
  assertDeepFrozen(first.issues);
  for (const issue of first.issues) expect(ISSUE_CODES[issue.code]).toBe(true);
  assertNoCapabilities(first.issues);
  if (before !== null) expect(JSON.stringify(input)).toBe(before);
  return first.issues;
}

function reportIssues(
  input: unknown,
  compareMutation = true,
): readonly Headless.OnlineHeadlessRoomGateIssueV1[] {
  const before = (() => {
    if (!compareMutation) return null;
    try {
      return JSON.stringify(input);
    } catch {
      return null;
    }
  })();
  const first = Headless.validateOnlineHeadlessRoomGateReportV1(input);
  const second = Headless.validateOnlineHeadlessRoomGateReportV1(input);
  expect(first.ok).toBe(false);
  expect(second).toEqual(first);
  if (first.ok || second.ok) throw new Error('Expected invalid report');
  expect(first.issues.length).toBeGreaterThan(0);
  assertDeepFrozen(first.issues);
  for (const issue of first.issues) expect(ISSUE_CODES[issue.code]).toBe(true);
  assertNoCapabilities(first.issues);
  if (before !== null) expect(JSON.stringify(input)).toBe(before);
  return first.issues;
}

describe('O4P-02E judge-owned local headless room gate evidence', () => {
  it('runs the exact serial composition and returns one canonical frozen transition and report', () => {
    const mutableInput = jsonClone(makeInput());
    const before = JSON.stringify(mutableInput);
    const validated = Headless.validateOnlineHeadlessRoomGateInputV1(mutableInput);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected valid gate input');
    expect(validated.value).not.toBe(mutableInput);
    assertDeepFrozen(validated.value);

    const transition = Headless.runLocalOnlineHeadlessRoomGateV1(mutableInput);
    expect(JSON.stringify(mutableInput)).toBe(before);
    assertExactKeys(transition, ['state', 'report']);
    assertDeepFrozen(transition);
    expect(Protocol.validateOnlineProtocolStateV1(transition.state)).toMatchObject({ ok: true });
    expect(Headless.validateOnlineHeadlessRoomGateReportV1(transition.report)).toMatchObject({
      ok: true,
    });
    expect(transition.state).not.toBe(mutableInput.state);
    expect(transition.state.revision).toBe(2);
    expect(transition.state.coreRoot.acceptedCommandCount).toBe(2);
    expect(transition.state.receipts).toHaveLength(3);
    expect(
      transition.state.receipts.filter(({ commandId }) => commandId === 'command-accepted-1'),
    ).toHaveLength(1);
    expect(transition.state.room.participants.map(({ presence }) => presence)).toEqual([
      'connected',
      'connected',
      'connected',
      'connected',
      'connected',
    ]);

    expect(transition.report).toEqual({
      kind: 'online-local-headless-room-gate-report-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      roomId: fixture.roomId,
      initialRevision: 0,
      finalRevision: 2,
      finalRoomLifecycle: 'active',
      clients: [
        { participantId: 'host-p1', role: 'player', corePlayerId: 'P1', presence: 'connected' },
        { participantId: 'player-p2', role: 'player', corePlayerId: 'P2', presence: 'connected' },
        { participantId: 'player-p3', role: 'player', corePlayerId: 'P3', presence: 'connected' },
        { participantId: 'player-p4', role: 'player', corePlayerId: 'P4', presence: 'connected' },
        { participantId: TABLE_ID, role: 'table', corePlayerId: null, presence: 'connected' },
      ],
      counts: fixture.expectedCounts,
      coverage: fixture.expectedCoverage,
      deferred: fixture.expectedDeferred,
    });
    assertSafeReport(transition.report);
  });

  it('directly proves five distinct audience projections without merging private views into report', () => {
    const input = makeInput();
    const audiences = [
      ...PARTICIPANT_IDS.map((participantId, index) => ({
        participantId,
        capability: CAPABILITIES[index],
        role: 'player' as const,
        corePlayerId: PLAYER_IDS[index],
      })),
      {
        participantId: TABLE_ID,
        capability: TABLE_CAPABILITY,
        role: 'table' as const,
        corePlayerId: null,
      },
    ];
    const projections = audiences.map((audience) =>
      acceptedProjection(input.state, audience.participantId, audience.capability),
    );
    for (const [audienceIndex, transition] of projections.entries()) {
      const audience = audiences[audienceIndex];
      expect(transition.response).toMatchObject({
        status: 'accepted',
        participantId: audience.participantId,
        role: audience.role,
        revision: 0,
        reason: 'synchronized',
      });
      expect(transition.response.projection.corePlayerId).toBe(audience.corePlayerId);
      expect(
        Projection.validateOnlineParticipantProjectionV1(transition.response.projection),
      ).toMatchObject({ ok: true });
      assertNoCapabilities(transition.response);
      assertNoCapabilities(transition.log);
      assertDeepFrozen(transition);
      for (let playerIndex = 0; playerIndex < PLAYER_IDS.length; playerIndex += 1) {
        const zones = playerZones(transition.response.projection, PLAYER_IDS[playerIndex]);
        expect(zones.library.entries).toEqual([{ kind: 'hidden-card' }]);
        const hand = zones.hand.entries[0];
        if (audience.corePlayerId === PLAYER_IDS[playerIndex]) {
          expect(hand).toMatchObject({
            kind: 'visible-object',
            definition: { name: `NAME-P${playerIndex + 1}-hand` },
          });
        } else {
          expect(hand).toEqual({ kind: 'hidden-card' });
        }
      }
    }
    const table = projections[4].response.projection;
    expect(table.role).toBe('table');
    expect(table.corePlayerId).toBeNull();
    expect(JSON.stringify(table)).not.toMatch(/NAME-P[1-4]-(?:hand|library)/);

    const report = Headless.runLocalOnlineHeadlessRoomGateV1(input).report;
    expect(JSON.stringify(report)).not.toMatch(/"projection"\s*:|NAME-P[1-4]|ORACLE-P[1-4]/i);
    expect(report.clients[4]).toEqual({
      participantId: TABLE_ID,
      role: 'table',
      corePlayerId: null,
      presence: 'connected',
    });
  });

  it('pins the exact shipped ACK, rejection, duplicate, stale, and current-projection witnesses', () => {
    const initial = makeActiveState();
    const envelope = (
      participantId: string,
      participantCapability: string,
      commandId: string,
      baseRevision: number,
      command: Core.CoreCommandV1,
    ): Record<string, unknown> => ({
      kind: 'online-command-envelope-v1',
      protocolVersion: 1,
      roomId: fixture.roomId,
      participantId,
      participantCapability,
      commandId,
      baseRevision,
      command,
    });

    const normal = Protocol.handleOnlineCommandEnvelopeV1(
      initial,
      envelope(
        PARTICIPANT_IDS[0],
        CAPABILITIES[0],
        'command-normal-rejection',
        0,
        coreCommand('P2', 1),
      ),
    );
    expect(normal.response.kind).toBe('online-command-reject-v1');
    if (normal.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected normal Player rejection');
    }
    expect(normal.response.issues.map(({ code }) => code)).toEqual(['ACTOR_MISMATCH']);
    expect(normal.state).toBe(initial);
    expect(normal.state.revision).toBe(0);
    expect(normal.state.receipts).toEqual([]);

    const table = Protocol.handleOnlineCommandEnvelopeV1(
      normal.state,
      envelope(TABLE_ID, TABLE_CAPABILITY, 'command-table-role-rejection', 0, coreCommand('P1', 1)),
    );
    expect(table.response.kind).toBe('online-command-reject-v1');
    if (table.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected Table role rejection');
    }
    expect(table.response.issues.map(({ code }) => code)).toEqual(['ROLE_NOT_ALLOWED']);
    expect(table.state).toBe(initial);
    expect(table.state.revision).toBe(0);
    expect(table.state.receipts).toEqual([]);

    const firstEnvelope = envelope(
      PARTICIPANT_IDS[0],
      CAPABILITIES[0],
      'command-accepted-1',
      0,
      coreCommand('P1', 1),
    );
    const first = Protocol.handleOnlineCommandEnvelopeV1(table.state, firstEnvelope);
    expect(first.response).toMatchObject({
      kind: 'online-command-ack-v1',
      duplicate: false,
      acceptedRevision: 1,
      currentRevision: 1,
    });
    const second = Protocol.handleOnlineCommandEnvelopeV1(
      first.state,
      envelope(PARTICIPANT_IDS[1], CAPABILITIES[1], 'command-accepted-2', 1, coreCommand('P2', 2)),
    );
    expect(second.response).toMatchObject({
      kind: 'online-command-ack-v1',
      duplicate: false,
      acceptedRevision: 2,
      currentRevision: 2,
    });
    expect(second.state.revision).toBe(2);
    expect(second.state.receipts).toHaveLength(2);

    const beforeDuplicateDigest = Core.coreCanonicalDigestFromValueV1(second.state.coreRoot);
    const duplicate = Protocol.handleOnlineCommandEnvelopeV1(second.state, firstEnvelope);
    expect(duplicate.response).toMatchObject({
      kind: 'online-command-ack-v1',
      duplicate: true,
      acceptedRevision: 1,
      currentRevision: 2,
    });
    expect(duplicate.state).toBe(second.state);
    expect(duplicate.state.revision).toBe(2);
    expect(duplicate.state.receipts).toHaveLength(2);
    expect(Core.coreCanonicalDigestFromValueV1(duplicate.state.coreRoot)).toBe(
      beforeDuplicateDigest,
    );

    const stale = Protocol.handleOnlineCommandEnvelopeV1(
      duplicate.state,
      envelope(PARTICIPANT_IDS[1], CAPABILITIES[1], 'command-stale-1', 0, coreCommand('P2', 1)),
    );
    expect(stale.response.kind).toBe('online-command-reject-v1');
    if (stale.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected stale rejection');
    }
    expect(stale.response).toMatchObject({
      duplicate: false,
      currentRevision: 2,
      resyncRequired: true,
    });
    expect(stale.response.issues.map(({ code }) => code)).toContain('STALE_REVISION');
    expect(stale.state.revision).toBe(2);
    expect(stale.state.receipts).toHaveLength(3);
    expect(Core.coreCanonicalDigestFromValueV1(stale.state.coreRoot)).toBe(beforeDuplicateDigest);
    const current = acceptedProjection(stale.state, PARTICIPANT_IDS[1], CAPABILITIES[1]);
    expect(current.response).toMatchObject({
      revision: 2,
      knownRevision: 2,
      reason: 'synchronized',
    });

    for (const publicValue of [
      normal.response,
      table.response,
      first.response,
      second.response,
      duplicate.response,
      stale.response,
      current.response,
      current.log,
    ]) {
      assertNoCapabilities(publicValue);
    }
  });

  it('proves duplicate, rejection, stale resync, exact receipts, revision, and replay relations', () => {
    const input = makeInput();
    const transition = Headless.runLocalOnlineHeadlessRoomGateV1(input);
    expect(transition.report.counts).toEqual(fixture.expectedCounts);
    expect(transition.report.finalRevision).toBe(transition.report.counts.commandsAccepted);
    expect(transition.report.counts.commandDuplicates).toBe(1);
    expect(transition.report.counts.staleRevisionRejections).toBeLessThanOrEqual(
      transition.report.counts.commandsRejected,
    );
    expect(transition.report.counts.roleRejections).toBeLessThanOrEqual(
      transition.report.counts.commandsRejected,
    );
    const acceptedReceipt = transition.state.receipts.find(
      ({ commandId }) => commandId === 'command-accepted-1',
    );
    expect(acceptedReceipt?.outcome).toMatchObject({
      kind: 'accepted',
      baseRevision: 0,
      acceptedRevision: 1,
    });
    const secondAcceptedReceipt = transition.state.receipts.find(
      ({ commandId }) => commandId === 'command-accepted-2',
    );
    expect(secondAcceptedReceipt?.outcome).toMatchObject({
      kind: 'accepted',
      baseRevision: 1,
      acceptedRevision: 2,
    });
    const staleReceipt = transition.state.receipts.find(
      ({ commandId }) => commandId === 'command-stale-1',
    );
    expect(staleReceipt?.outcome).toMatchObject({
      kind: 'rejected',
      baseRevision: 0,
      resyncRequired: true,
      issues: [expect.objectContaining({ code: 'STALE_REVISION' })],
    });

    const acceptedActions = makeScript()
      .filter(
        ({ witness }) => witness === 'accepted-command' || witness === 'accepted-command-ordering',
      )
      .map(({ action }) => action);
    if (!acceptedActions.every((action) => action.kind === 'command')) {
      throw new Error('Missing accepted command witness');
    }
    const closure = Core.runOrdinaryFourPlayerCoreClosureV1(input.state.coreRoot, [
      acceptedActions[0].command,
      acceptedActions[1].command,
    ]);
    const replay = Core.replayCoreCommandsV1(jsonClone(closure.replayPackage));
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error('Expected successful replay');
    const protocolDigest = Core.coreCanonicalDigestFromValueV1(transition.state.coreRoot);
    expect(closure.finalStateDigest).toBe(protocolDigest);
    expect(replay.finalStateDigest).toBe(protocolDigest);
    expect(closure.journal).toHaveLength(2);

    const tampered = jsonClone(closure.replayPackage);
    tampered.journal[0].commandDigest = '0'.repeat(64);
    expect(Core.replayCoreCommandsV1(tampered)).toMatchObject({ ok: false });
    const omitted = jsonClone(closure.replayPackage);
    omitted.journal = omitted.journal.slice(0, 1);
    expect(Core.replayCoreCommandsV1(omitted)).toMatchObject({ ok: false });
    const reorderedReplay = jsonClone(closure.replayPackage);
    [reorderedReplay.journal[0], reorderedReplay.journal[1]] = [
      reorderedReplay.journal[1],
      reorderedReplay.journal[0],
    ];
    expect(Core.replayCoreCommandsV1(reorderedReplay)).toMatchObject({ ok: false });
  });

  it('rejoins Player and Table through accepted projected snapshots with presence-only drift', () => {
    let state = makeActiveState();
    const assertPresenceOnly = (
      before: Protocol.OnlineProtocolStateV1,
      after: Protocol.OnlineProtocolStateV1,
      targetParticipantId: string,
    ): void => {
      expect(after.coreRoot).toEqual(before.coreRoot);
      expect(after.revision).toBe(before.revision);
      expect(after.receipts).toEqual(before.receipts);
      expect(after.room.lifecycle).toBe(before.room.lifecycle);
      expect(after.room.hostParticipantId).toBe(before.room.hostParticipantId);
      expect(after.room.seats).toEqual(before.room.seats);
      for (const participant of after.room.participants) {
        const previous = before.room.participants.find(
          ({ participantId: currentId }) => currentId === participant.participantId,
        );
        if (previous === undefined) throw new Error('Missing previous participant');
        if (participant.participantId === targetParticipantId) {
          expect({ ...participant, presence: previous.presence }).toEqual(previous);
        } else {
          expect(participant).toEqual(previous);
        }
      }
    };

    const playerDisconnectedRoom = Room.disconnectOnlineRoomParticipantV1(
      state.room,
      PARTICIPANT_IDS[2],
    );
    const playerDisconnected = Protocol.validateOnlineProtocolStateV1({
      ...state,
      room: playerDisconnectedRoom,
    });
    expect(playerDisconnected.ok).toBe(true);
    if (!playerDisconnected.ok) throw new Error('Expected valid Player disconnect');
    const playerRejoin = acceptedProjection(
      playerDisconnected.value,
      PARTICIPANT_IDS[2],
      CAPABILITIES[2],
    );
    expect(playerRejoin.response.reason).toBe('rejoined');
    assertPresenceOnly(playerDisconnected.value, playerRejoin.state, PARTICIPANT_IDS[2]);
    state = playerRejoin.state;

    const tableDisconnectedRoom = Room.disconnectOnlineRoomParticipantV1(state.room, TABLE_ID);
    const tableDisconnected = Protocol.validateOnlineProtocolStateV1({
      ...state,
      room: tableDisconnectedRoom,
    });
    expect(tableDisconnected.ok).toBe(true);
    if (!tableDisconnected.ok) throw new Error('Expected valid Table disconnect');
    const tableRejoin = acceptedProjection(tableDisconnected.value, TABLE_ID, TABLE_CAPABILITY);
    expect(tableRejoin.response.reason).toBe('rejoined');
    assertPresenceOnly(tableDisconnected.value, tableRejoin.state, TABLE_ID);
    expect(
      tableRejoin.state.room.participants.every(({ presence }) => presence === 'connected'),
    ).toBe(true);
  });

  it('keeps validation, operation errors, responses, logs, and final report serializable and safe', () => {
    const state = makeActiveState();
    const hello = Protocol.handleOnlineClientHelloV1(state, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      roomId: fixture.roomId,
      participantId: PARTICIPANT_IDS[0],
      participantCapability: CAPABILITIES[0],
      clientBuildId: CLIENT_BUILD_ID,
    });
    const projection = acceptedProjection(state, PARTICIPANT_IDS[0], CAPABILITIES[0]);
    const rejectedProjection = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
      kind: 'online-projection-request-v1',
      protocolVersion: 1,
      roomId: fixture.roomId,
      participantId: PARTICIPANT_IDS[0],
      participantCapability: CAPABILITIES[1],
      knownRevision: 0,
      clientBuildId: CLIENT_BUILD_ID,
      decisionContext: null,
    });
    for (const publicValue of [
      hello.response,
      projection.response,
      projection.log,
      rejectedProjection.response,
      rejectedProjection.log,
    ]) {
      expect(() => JSON.stringify(publicValue)).not.toThrow();
      assertNoCapabilities(publicValue);
    }
    const transition = Headless.runLocalOnlineHeadlessRoomGateV1(makeInput(state));
    expect(() => JSON.stringify(transition.report)).not.toThrow();
    assertSafeReport(transition.report);

    const capabilityEcho = jsonClone(makeInput(state));
    const secretCommandId = `echo-${CAPABILITIES[0]}`;
    for (const action of capabilityEcho.actions) {
      if (action.kind === 'command' && action.commandId === COMMAND_IDS.acceptedFirst) {
        mutableRecord(action).commandId = secretCommandId;
      }
    }
    operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(capabilityEcho),
      'INVALID_INPUT',
    );
  });

  it('rejects an exact eight-code-unit configured capability fragment in an action', () => {
    const capabilityFragment = CAPABILITIES[0].slice(0, 8);
    expect(capabilityFragment.length).toBe(8);
    const input = jsonClone(makeInput());
    for (const action of input.actions) {
      if (action.kind === 'command' && action.commandId === COMMAND_IDS.acceptedFirst) {
        mutableRecord(action).commandId = `public-${capabilityFragment}-tail`;
      }
    }
    const issues = validationIssues(input);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'INVALID_CAPABILITY' }),
    );
    expect(JSON.stringify(issues)).not.toContain(capabilityFragment);
    const error = operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(input),
      'INVALID_INPUT',
    );
    expect(JSON.stringify({ message: error.message, issues: error.issues })).not.toContain(
      capabilityFragment,
    );
  });

  it('redacts a configured capability fragment even when nested authority cannot canonicalize', () => {
    const capabilityFragment = CAPABILITIES[0].slice(0, 8);
    const input = jsonClone(makeInput()) as unknown as Record<string, unknown>;
    mutableRecord(input.state).serverBuildId = 'invalid build id';
    input.clients = [];
    input[capabilityFragment] = true;

    const issues = validationIssues(input);
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_FIELD',
      path: '/<unknown-field>',
    }));
    expect(JSON.stringify(issues)).not.toContain(capabilityFragment);
    expect(JSON.stringify(issues)).not.toContain(CAPABILITIES[0]);
  });

  it('rejects canonical already-exited starting authority during input validation', () => {
    const state = makeExitedStartingState();
    expect(Protocol.validateOnlineProtocolStateV1(state)).toMatchObject({ ok: true });
    expect(state.revision).toBe(0);
    expect(state.receipts).toEqual([]);
    expect(state.room.seats[3]?.outcome).toBe('conceded');
    expect(state.coreRoot.playerLifecycle.players[3]).toMatchObject({
      playerId: 'P4',
      status: 'exited',
    });
    const input = makeInput(state);
    const issues = validationIssues(input);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'INVALID_RELATION' }),
    );
    operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(input),
      'INVALID_INPUT',
    );
  });

  it('rejects an oversized action array before inspecting any entry', () => {
    const input = jsonClone(makeInput());
    mutableRecord(input).actions = new Array(257);
    const issues = validationIssues(input);
    expect(issues.map(({ code }) => code)).toEqual(['INVALID_ARRAY']);
    expect(issues[0]?.path).toBe('/actions/length');
  });

  it('rejects descriptor traps, getters, ownKeys hazards, and closed-shape violations without coercion', () => {
    let getTrapCalls = 0;
    const proxy = new Proxy(makeInput(), {
      ownKeys(): never {
        throw new Error('ownKeys trap');
      },
      get(): never {
        getTrapCalls += 1;
        throw new Error('get trap');
      },
    });
    validationIssues(proxy, false);
    expect(getTrapCalls).toBe(0);

    let descriptorGetTrapCalls = 0;
    const descriptorProxy = new Proxy(makeInput(), {
      ownKeys: Reflect.ownKeys,
      getOwnPropertyDescriptor(): never {
        throw new Error('descriptor trap');
      },
      get(): never {
        descriptorGetTrapCalls += 1;
        throw new Error('get trap');
      },
    });
    validationIssues(descriptorProxy, false);
    expect(descriptorGetTrapCalls).toBe(0);

    const getterInput = jsonClone(makeInput());
    let getterCalls = 0;
    Object.defineProperty(getterInput.actions[0], 'participantId', {
      enumerable: true,
      get(): string {
        getterCalls += 1;
        return PARTICIPANT_IDS[0];
      },
    });
    validationIssues(getterInput, false);
    expect(getterCalls).toBe(0);

    const nonEnumerable = jsonClone(makeInput());
    Object.defineProperty(nonEnumerable, 'hidden', { value: true, enumerable: false });
    validationIssues(nonEnumerable);
    const symbolField = jsonClone(makeInput());
    Object.defineProperty(symbolField, Symbol('hostile'), { value: true, enumerable: true });
    validationIssues(symbolField);
    const unknown = jsonClone(makeInput()) as Record<string, unknown>;
    unknown.extra = true;
    validationIssues(unknown);
    validationIssues(Object.assign(Object.create({ inherited: true }) as object, makeInput()));

    const sparse = jsonClone(makeInput());
    sparse.actions.length += 1;
    expect(validationIssues(sparse).map(({ code }) => code)).toContain('NON_DENSE_ARRAY');
    const extraArrayProperty = jsonClone(makeInput());
    Object.defineProperty(extraArrayProperty.actions, 'extra', { value: true, enumerable: true });
    validationIssues(extraArrayProperty);
  });

  it('rejects invalid state, action, scalar, client set, capability mapping, and start relations', () => {
    const cases: unknown[] = [];
    const invalidState = jsonClone(makeInput());
    invalidState.state.revision = 1;
    cases.push(invalidState);
    const nonemptyReceipts = jsonClone(makeInput());
    nonemptyReceipts.state.receipts = [{ hostile: true }] as never;
    cases.push(nonemptyReceipts);
    const invalidCommand = jsonClone(makeInput());
    const commandAction = invalidCommand.actions.find((action) => action.kind === 'command');
    if (commandAction?.kind !== 'command') throw new Error('Missing command');
    commandAction.command = { kind: 'not-a-core-command' } as never;
    cases.push(invalidCommand);
    const invalidContext = jsonClone(makeInput());
    const projectionAction = invalidContext.actions.find((action) => action.kind === 'projection');
    if (projectionAction?.kind !== 'projection') throw new Error('Missing projection');
    projectionAction.decisionContext = { kind: 'hostile-context' } as never;
    cases.push(invalidContext);
    const invalidScalar = jsonClone(makeInput());
    invalidScalar.actions[0].participantId = 17 as never;
    cases.push(invalidScalar);
    const duplicateClients = jsonClone(makeInput());
    duplicateClients.clients[1] = jsonClone(duplicateClients.clients[0]);
    cases.push(duplicateClients);
    const reorderedClients = jsonClone(makeInput());
    [reorderedClients.clients[0], reorderedClients.clients[1]] = [
      reorderedClients.clients[1],
      reorderedClients.clients[0],
    ];
    cases.push(reorderedClients);
    const wrongCapability = jsonClone(makeInput());
    [
      wrongCapability.clients[0].participantCapability,
      wrongCapability.clients[1].participantCapability,
    ] = [
      wrongCapability.clients[1].participantCapability,
      wrongCapability.clients[0].participantCapability,
    ];
    cases.push(wrongCapability);
    const missingClient = jsonClone(makeInput());
    missingClient.clients.pop();
    cases.push(missingClient);
    const extraClient = jsonClone(makeInput());
    extraClient.clients.push(jsonClone(extraClient.clients[4]));
    cases.push(extraClient);
    const missingParticipant = jsonClone(makeInput());
    missingParticipant.state.room.participants.pop();
    cases.push(missingParticipant);
    const spectator = jsonClone(makeInput());
    spectator.state.room.participants[4].role = 'spectator';
    cases.push(spectator);
    for (const candidate of cases) validationIssues(candidate);

    const complete = jsonClone(makeInput());
    complete.kind = 'wrong-kind' as never;
    complete.schemaVersion = 2 as never;
    complete.clients = [];
    complete.actions = [];
    const completeIssues = validationIssues(complete);
    expect(completeIssues.length).toBeGreaterThanOrEqual(3);
    expect(completeIssues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['INVALID_LITERAL', 'INVALID_VERSION', 'INVALID_CLIENT_SET']),
    );
  });

  it('redacts capability-shaped unknown keys and never executes nested scalar get traps', () => {
    const capabilityKey = `unknown-${CAPABILITIES[0]}-tail`;
    const input = jsonClone(makeInput()) as Record<string, unknown>;
    input[capabilityKey] = true;
    const issues = validationIssues(input);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_FIELD',
        path: '/<unknown-field>',
      }),
    );
    expect(JSON.stringify(issues)).not.toContain(capabilityKey);

    let getCalls = 0;
    const scalarProxy = new Proxy(
      { value: PARTICIPANT_IDS[0] },
      {
        get(): never {
          getCalls += 1;
          throw new Error('scalar get trap');
        },
      },
    );
    const scalar = jsonClone(makeInput()) as unknown as {
      actions: Array<Record<string, unknown>>;
    };
    scalar.actions[0].participantId = scalarProxy;
    validationIssues(scalar, false);
    expect(getCalls).toBe(0);
  });

  it('falsifies every publicly representable report relation without reconstructing private witnesses', () => {
    const valid = Headless.runLocalOnlineHeadlessRoomGateV1(makeInput()).report;
    const cases: unknown[] = [];
    const role = jsonClone(valid);
    role.clients[0].role = 'table';
    cases.push(role);
    const corePlayer = jsonClone(valid);
    mutableRecord(corePlayer.clients[1]).corePlayerId = 'P4';
    cases.push(corePlayer);
    const order = jsonClone(valid);
    [order.clients[0], order.clients[1]] = [order.clients[1], order.clients[0]];
    cases.push(order);
    const presence = jsonClone(valid);
    presence.clients[2].presence = 'disconnected';
    cases.push(presence);
    const revision = jsonClone(valid);
    revision.finalRevision = 3;
    cases.push(revision);
    const lifecycle = jsonClone(valid);
    mutableRecord(lifecycle).finalRoomLifecycle = 'forming';
    cases.push(lifecycle);
    const acceptedCount = jsonClone(valid);
    acceptedCount.counts.commandsAccepted = 3;
    cases.push(acceptedCount);
    const staleSubset = jsonClone(valid);
    staleSubset.counts.staleRevisionRejections = 4;
    cases.push(staleSubset);
    const roleSubset = jsonClone(valid);
    roleSubset.counts.roleRejections = 4;
    cases.push(roleSubset);
    const rejoinSubset = jsonClone(valid);
    rejoinSubset.counts.playerRejoins = 9;
    cases.push(rejoinSubset);
    const reconnectWithoutDisconnect = jsonClone(valid);
    reconnectWithoutDisconnect.counts.playerRejoins = 2;
    reconnectWithoutDisconnect.counts.tableRejoins = 1;
    reconnectWithoutDisconnect.counts.disconnects = 2;
    cases.push(reconnectWithoutDisconnect);
    const tooManyActions = jsonClone(valid);
    tooManyActions.counts.clientHellosAccepted = 257;
    cases.push(tooManyActions);
    const falseCoverage = jsonClone(valid);
    mutableRecord(falseCoverage.coverage).replay = false;
    cases.push(falseCoverage);
    const missingCoverage = jsonClone(valid);
    delete mutableRecord(missingCoverage.coverage).privacyGate;
    cases.push(missingCoverage);
    const malformedInteger = jsonClone(valid);
    malformedInteger.counts.commandsRejected = 1.5;
    cases.push(malformedInteger);
    const reorderedDeferred = jsonClone(valid);
    [reorderedDeferred.deferred[0], reorderedDeferred.deferred[1]] = [
      reorderedDeferred.deferred[1],
      reorderedDeferred.deferred[0],
    ];
    cases.push(reorderedDeferred);
    const projectionField = jsonClone(valid) as Record<string, unknown>;
    projectionField.projection = {};
    cases.push(projectionField);
    const privateField = jsonClone(valid) as Record<string, unknown>;
    privateField[CAPABILITIES[0]] = true;
    cases.push(privateField);
    for (const candidate of cases) reportIssues(candidate);
  });

  it('rejects hostile report descriptors and proxies without caller mutation or get coercion', () => {
    const valid = jsonClone(Headless.runLocalOnlineHeadlessRoomGateV1(makeInput()).report);
    let getterCalls = 0;
    Object.defineProperty(valid.counts, 'commandsAccepted', {
      enumerable: true,
      get(): number {
        getterCalls += 1;
        return 1;
      },
    });
    reportIssues(valid, false);
    expect(getterCalls).toBe(0);

    let getTrapCalls = 0;
    const proxySource = jsonClone(Headless.runLocalOnlineHeadlessRoomGateV1(makeInput()).report);
    const proxy = new Proxy(proxySource, {
      ownKeys(): never {
        throw new Error('ownKeys trap');
      },
      get(): never {
        getTrapCalls += 1;
        throw new Error('get trap');
      },
    });
    reportIssues(proxy, false);
    expect(getTrapCalls).toBe(0);
  }, 15_000);

  it.each(REQUIRED_WITNESSES)(
    'fails closed without required %s witness and never returns a report',
    (witness) => {
      const input = makeInput(
        makeActiveState(),
        makeScript().filter((entry) => entry.witness !== witness),
      );
      const error = operationError(
        () => Headless.runLocalOnlineHeadlessRoomGateV1(input),
        'COVERAGE_MISSING',
      );
      expect(JSON.stringify(error)).not.toContain('report');
    },
    10_000,
  );

  it('fails the gate for tampered, reordered, and omitted accepted-command evidence', () => {
    const script = makeScript();
    const tampered = jsonClone(script);
    for (const entry of tampered) {
      if (
        (entry.witness === 'accepted-command' || entry.witness === 'accepted-duplicate') &&
        entry.action.kind === 'command'
      ) {
        mutableRecord(entry.action).command = coreCommand('P2', 1);
      }
    }
    operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(makeInput(makeActiveState(), tampered)),
      'COVERAGE_MISSING',
    );

    const reordered = [...script];
    const acceptedIndex = reordered.findIndex(({ witness }) => witness === 'accepted-command');
    const staleIndex = reordered.findIndex(({ witness }) => witness === 'stale-rejection');
    [reordered[acceptedIndex], reordered[staleIndex]] = [
      reordered[staleIndex],
      reordered[acceptedIndex],
    ];
    operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(makeInput(makeActiveState(), reordered)),
      'COVERAGE_MISSING',
    );

    const omitted = script.filter(({ witness }) => witness !== 'accepted-command');
    operationError(
      () => Headless.runLocalOnlineHeadlessRoomGateV1(makeInput(makeActiveState(), omitted)),
      'COVERAGE_MISSING',
    );
  }, 15_000);
});
