#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core';
import * as Room from '../../src/online/room';
import turnPriorityFixture from '../../src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json';

type RecordValue = Record<string, unknown>;
type Player = 'P1' | 'P2' | 'P3' | 'P4';

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/online/room/fixtures/o4p-02b-four-seat-room-v1.json',
);

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  return value as RecordValue;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen);
  });
}

function makeCoreRoot(): Core.ModeNeutralCoreRootV1 {
  const source = Core.createCoreTurnPriorityBundleV1(turnPriorityFixture.bundle as never);
  const registry = source.stackBundle.objectRegistry;
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
    stackBundle: source.stackBundle,
    pendingTriggers: Core.createModeNeutralCorePendingTriggerSliceV1(registry, {
      pendingObjectIds: [],
      byObject: {},
    }),
    lifecycle: source.lifecycle,
  });
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

function command(
  root: Core.ModeNeutralCoreRootV1,
  actorPlayerId: Player,
  cause: 'concession' | 'defeat',
): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: root.acceptedCommandCount + 1,
    actorPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionMakerPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'online-room-verify' },
    payload: { kind: 'player-exit', playerId: actorPlayerId as Core.CorePlayerId, cause },
  });
}

const fixture = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'Room fixture');
assert.equal(fixture.version, 'online-four-seat-room-v1');
assert.equal(fixture.schemaVersion, 1);
assert.equal(Room.ONLINE_ROOM_SCHEMA_VERSION_V1, 1);

const assignments: unknown = fixture.seatAssignments;
const host = fixture.host;
let room = Room.createOnlineRoomV1({ roomId: fixture.roomId, seatAssignments: assignments, host });
const players = fixture.players as readonly string[];
const capabilities = (fixture.seatAssignments as Array<RecordValue>).map(
  (assignment) => assignment.seatCapability,
);
room = Room.joinOnlineRoomV1(room, { participantId: fixture.tableParticipantId, role: 'table' });
room = Room.joinOnlineRoomV1(room, {
  participantId: fixture.spectatorParticipantId,
  role: 'spectator',
});
for (let index = 1; index < 4; index += 1) {
  room = Room.joinOnlineRoomV1(room, {
    participantId: players[index],
    role: 'player',
    seatCapability: capabilities[index],
  });
}
for (let index = 0; index < 4; index += 1) {
  room = Room.setOnlineRoomPlayerReadyV1(room, {
    participantId: players[index],
    seatCapability: capabilities[index],
    ready: true,
  });
}
assert.equal(room.lifecycle, 'ready');

let root = makeCoreRoot();
const coreDigestBeforeDisconnect = Core.coreCanonicalDigestFromValueV1(root);
room = Room.disconnectOnlineRoomParticipantV1(room, players[1]);
assert.equal(room.lifecycle, 'forming');
assert.equal(Core.coreCanonicalDigestFromValueV1(root), coreDigestBeforeDisconnect);
room = Room.rejoinOnlineRoomPlayerV1(room, {
  participantId: players[1],
  seatCapability: capabilities[1],
});
room = Room.setOnlineRoomPlayerReadyV1(room, {
  participantId: players[1],
  seatCapability: capabilities[1],
  ready: true,
});
room = Room.startOnlineRoomV1(room, players[0]);
room = Room.activateOnlineRoomV1(room, { hostParticipantId: players[0], coreRoot: root });
assert.equal(room.lifecycle, 'active');
assert.equal(JSON.stringify(room).includes('acceptedCommandCount'), false);

for (const [playerId, cause] of [
  ['P4', 'concession'],
  ['P3', 'defeat'],
  ['P1', 'defeat'],
] as const) {
  const result = Core.applyCoreCommandV1(root, command(root, playerId, cause));
  assert.notEqual(result.status, 'rejected', JSON.stringify(result));
  root = result.root;
  room = Room.reconcileOnlineRoomCoreLifecycleV1(room, root);
}
assert.equal(room.lifecycle, 'finished');
assert.deepEqual(room.seats.map((seat) => seat.outcome), [
  'defeated',
  'pending',
  'defeated',
  'conceded',
]);
assert.equal(JSON.stringify(root).includes('seat_capability_'), false);
assert.equal(deepFrozen(room), true);

console.log(
  'fixture=online-four-seat-room-v1 seats=4 roles=player+table+spectator '
  + 'lifecycle=forming-ready-started-active-finished rejoin=capability '
  + 'disconnect=room-only exits=core-concession+defeat core-contamination=false frozen=true',
);
