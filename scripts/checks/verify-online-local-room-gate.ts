#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core/index';
import turnPriorityFixture from '../../src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';
import * as Headless from '../../src/online/headless/index';
import * as Projection from '../../src/online/projection/index';
import * as Protocol from '../../src/online/protocol/index';
import * as Room from '../../src/online/room/index';

type RecordValue = Record<string, unknown>;
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
      };
      objects: Record<string, Record<string, unknown>>;
      physicalCards: Record<string, Record<string, unknown>>;
      cardDefinitions: Record<string, Record<string, unknown>>;
    };
    objectRuntime: { byObject: Record<string, Record<string, unknown>> };
  };
};

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/online/headless/fixtures/o4p-02e-local-room-gate-v1.json',
);

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as RecordValue;
}

function jsonClone<T>(value: T): DeepMutable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepMutable<T>;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen)
    );
  });
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

function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const source = Core.createCoreTurnPriorityBundleV1(turnPriorityFixture.bundle as never);
  const raw = jsonClone(source) as unknown as MutableTurnBundle;
  const registry = raw.stackBundle.objectRegistry;
  const runtime = raw.stackBundle.objectRuntime;
  const cards = [
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
  for (const [playerId, zone, physicalCardId] of cards) {
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

function command(playerId: 'P1' | 'P2' | 'P3', sequence: number): Core.CoreCommandV1 {
  const card = { P1: 'PC1', P2: 'PC3', P3: 'PC6' }[playerId];
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: playerId as Core.CorePlayerId,
    decisionMakerPlayerId: playerId as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: `verify-o4p-02e-${playerId}` },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: card as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

const fixtureText = readFileSync(fixturePath, 'utf8');
const fixture = record(JSON.parse(fixtureText) as unknown, 'Headless fixture');
assert.equal(fixture.version, 'o4p-02e-local-room-gate-v1');
assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.protocolVersion, 1);
assert.equal(Headless.ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1, 1);
assert.equal(/(?:seat|observer|participant)[_-]?capabilit/i.test(fixtureText), false);

const clientRecords = fixture.clients as readonly RecordValue[];
const playerRecords = clientRecords.slice(0, 4);
const tableRecord = record(clientRecords[4], 'Table fixture client');
const playerIds = playerRecords.map(({ corePlayerId }) => String(corePlayerId));
const participantIds = playerRecords.map(({ participantId }) => String(participantId));
const tableId = String(tableRecord.participantId);
const capabilities = playerIds.map(
  (playerId, index) => `seat_capability_verify_${playerId}_${String(index).padStart(16, 'x')}`,
);
const tableCapability = 'observer_capability_verify_TABLE_xxxxxxxxxxxxxxxx';
const allCapabilities = [...capabilities, tableCapability];

const root = makeCoreRoot();
let room = Room.createOnlineRoomV1({
  roomId: fixture.roomId,
  seatAssignments: playerIds.map((corePlayerId, seatIndex) => ({
    seatIndex,
    corePlayerId,
    seatCapability: capabilities[seatIndex],
  })),
  host: { participantId: participantIds[0], seatCapability: capabilities[0] },
});
for (let index = 1; index < participantIds.length; index += 1) {
  room = Room.joinOnlineRoomV1(room, {
    participantId: participantIds[index],
    role: 'player',
    seatCapability: capabilities[index],
  });
}
room = Room.joinOnlineRoomV1(room, { participantId: tableId, role: 'table' });
for (let index = 0; index < participantIds.length; index += 1) {
  room = Room.setOnlineRoomPlayerReadyV1(room, {
    participantId: participantIds[index],
    seatCapability: capabilities[index],
    ready: true,
  });
}
room = Room.startOnlineRoomV1(room, participantIds[0]);
room = Room.activateOnlineRoomV1(room, { hostParticipantId: participantIds[0], coreRoot: root });
const state = Protocol.createOnlineProtocolStateV1({
  serverBuildId: fixture.serverBuildId,
  room,
  coreRoot: root,
  observerAuthorizations: [{ participantId: tableId, observerCapability: tableCapability }],
});

const clients = [
  ...participantIds.map((participantId, index) => ({
    participantId,
    participantCapability: capabilities[index],
    clientBuildId: fixture.clientBuildId,
  })),
  {
    participantId: tableId,
    participantCapability: tableCapability,
    clientBuildId: fixture.clientBuildId,
  },
];
const commands = {
  'actor-mismatch-p2-sequence-1': command('P2', 1),
  'p1-commander-cast-sequence-1': command('P1', 1),
  'p2-commander-cast-sequence-1': command('P2', 1),
  'p2-commander-cast-sequence-2': command('P2', 2),
} as const;
const actions = (fixture.actions as readonly RecordValue[]).map((entry) => {
  const kind = entry.kind;
  if (kind === 'client-hello' || kind === 'disconnect') {
    return { kind, participantId: entry.participantId };
  }
  if (kind === 'projection') {
    return {
      kind,
      participantId: entry.participantId,
      knownRevision: entry.knownRevision,
      decisionContext: null,
    };
  }
  if (kind !== 'command') throw new Error('Unknown fixture action');
  const template = String(entry.commandTemplate) as keyof typeof commands;
  return {
    kind,
    participantId: entry.participantId,
    commandId: entry.commandId,
    baseRevision: entry.baseRevision,
    command: commands[template],
  };
});
const input = {
  kind: 'online-local-headless-room-gate-input-v1',
  schemaVersion: 1,
  state,
  clients,
  actions,
};

const before = JSON.stringify(input);
const checked = Headless.validateOnlineHeadlessRoomGateInputV1(input);
assert.equal(checked.ok, true);
if (!checked.ok) throw new Error('Expected valid headless input');
assert.equal(deepFrozen(checked.value), true);
const transition = Headless.runLocalOnlineHeadlessRoomGateV1(input);
assert.equal(JSON.stringify(input), before);
assert.equal(deepFrozen(transition), true);
assert.equal(transition.state.revision, 2);
assert.equal(transition.state.coreRoot.acceptedCommandCount, 2);
assert.equal(transition.state.receipts.length, 3);
assert.deepEqual(transition.report.counts, fixture.expectedCounts);
assert.deepEqual(transition.report.coverage, fixture.expectedCoverage);
assert.deepEqual(transition.report.deferred, fixture.expectedDeferred);
assert.equal(Headless.validateOnlineHeadlessRoomGateReportV1(transition.report).ok, true);
assert.equal(
  transition.state.room.participants.every(({ presence }) => presence === 'connected'),
  true,
);

const acceptedCommands = [
  commands['p1-commander-cast-sequence-1'],
  commands['p2-commander-cast-sequence-2'],
];
const closure = Core.runOrdinaryFourPlayerCoreClosureV1(root, acceptedCommands);
const replay = Core.replayCoreCommandsV1(jsonClone(closure.replayPackage));
assert.equal(replay.ok, true);
if (!replay.ok) throw new Error('Expected successful replay');
const protocolDigest = Core.coreCanonicalDigestFromValueV1(transition.state.coreRoot);
assert.equal(closure.finalStateDigest, protocolDigest);
assert.equal(replay.finalStateDigest, protocolDigest);
assert.equal(closure.journal.length, 2);

for (const [index, client] of clients.entries()) {
  const projected = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
    kind: 'online-projection-request-v1',
    protocolVersion: 1,
    roomId: fixture.roomId,
    participantId: client.participantId,
    participantCapability: client.participantCapability,
    knownRevision: 0,
    clientBuildId: fixture.clientBuildId,
    decisionContext: null,
  });
  assert.equal(projected.response.status, 'accepted');
  if (projected.response.status !== 'accepted') throw new Error('Expected accepted projection');
  assert.equal(projected.response.projection.corePlayerId, index < 4 ? playerIds[index] : null);
  assert.equal(
    Projection.validateOnlineParticipantProjectionV1(projected.response.projection).ok,
    true,
  );
  const serialized = JSON.stringify([projected.response, projected.log]);
  for (const capability of allCapabilities) assert.equal(serialized.includes(capability), false);
}

const reportText = JSON.stringify(transition.report);
for (const capability of allCapabilities) assert.equal(reportText.includes(capability), false);
assert.equal(
  /NAME-P[1-4]-(?:hand|library)|"projection"\s*:|commandId|requestDigest|receipt|coreRoot|Digest/i.test(
    reportText,
  ),
  false,
);

const missingOrderingInput = {
  ...input,
  actions: actions.filter(
    (_, index) =>
      (fixture.actions as readonly RecordValue[])[index]?.witness !== 'accepted-command-ordering',
  ),
};
assert.throws(
  () => Headless.runLocalOnlineHeadlessRoomGateV1(missingOrderingInput),
  (error: unknown) =>
    error instanceof Headless.OnlineHeadlessRoomGateOperationErrorV1 &&
    error.code === 'COVERAGE_MISSING' &&
    !allCapabilities.some((capability) => JSON.stringify(error).includes(capability)),
);

console.log(
  'fixture=o4p-02e-local-room-gate-v1 clients=4-player+table schema=1 ' +
    'accepted-unique=2 duplicate=1 stale-resync=true reconnect=player+table ' +
    'privacy=audience-separated replay=ordered capability-leak=false deferred=o4p-03 frozen=true',
);
