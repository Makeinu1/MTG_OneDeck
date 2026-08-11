#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Core from '../../src/engine/core';

type RecordValue = Record<string, unknown>;
type Player = 'P1' | 'P2' | 'P3' | 'P4';

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const vectorPath = resolve(repositoryRoot, 'src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json');
const turnFixturePath = resolve(repositoryRoot, 'src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json');
const P1 = 'P1' as Core.CorePlayerId;
const PC1 = 'PC1' as Core.CorePhysicalCardId;
const PC7 = 'PC7' as Core.CorePhysicalCardId;
const O1 = 'PC1:0' as Core.CoreObjectId;
const O7 = 'PC7:0' as Core.CoreObjectId;

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a record`);
  return value as RecordValue;
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen);
  });
}

function firstMutablePath(value: unknown, path = '', seen = new Set<object>()): string | null {
  if (value === null || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (!Object.isFrozen(value)) return path || '/';
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) {
      const found = firstMutablePath(descriptor.value, `${path}/${String(key)}`, seen);
      if (found !== null) return found;
    }
  }
  return null;
}

function makeRoot(): Core.ModeNeutralCoreRootV1 {
  const turnFixture = record(JSON.parse(readFileSync(turnFixturePath, 'utf8')) as unknown, 'turn fixture');
  const source = Core.createCoreTurnPriorityBundleV1(record(turnFixture.bundle, 'turn fixture bundle'));
  const baseRegistry = source.stackBundle.objectRegistry;
  const objectRegistry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players: baseRegistry.players,
    turnOrder: baseRegistry.turnOrder,
    activePlayerId: baseRegistry.activePlayerId,
    cardDefinitions: baseRegistry.cardDefinitions,
    physicalCards: { ...baseRegistry.physicalCards, [PC7]: { ...baseRegistry.physicalCards[PC1] } },
    objects: { ...baseRegistry.objects, [O7]: Core.createCoreCardObjectIdentityV2({ kind: 'card', physicalCardId: PC7, incarnation: 0, baseControllerPlayerId: null }) },
    zones: { byPlayer: { ...baseRegistry.zones.byPlayer, [P1]: { ...baseRegistry.zones.byPlayer[P1], library: [...baseRegistry.zones.byPlayer[P1].library, O7] } }, shared: baseRegistry.zones.shared },
  });
  const objectRuntime = Core.createModeNeutralCoreObjectRuntimeStateV2(objectRegistry, { byObject: { ...source.stackBundle.objectRuntime.byObject, [O7]: source.stackBundle.objectRuntime.byObject[O1] } });
  const stackAnnouncements = Core.createModeNeutralCoreStackAnnouncementSliceV1(objectRegistry, { byObject: source.stackBundle.stackAnnouncements.byObject });
  const stackBundle = Core.createCoreStackTransactionBundleV1({ objectRegistry, objectRuntime, stackAnnouncements });
  const lifecycle = Core.createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: source.lifecycle.turnNumber,
    positionSequence: source.lifecycle.positionSequence,
    position: source.lifecycle.position,
    window: { kind: 'priority', cycleStartPlayerId: 'P2' as never, holderPlayerId: 'P3' as never, passedPlayerIds: ['P2'] as never },
  });
  const pendingTriggers = Core.createModeNeutralCorePendingTriggerSliceV1(objectRegistry, { pendingObjectIds: [], byObject: {} });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle });
  const decisionAuthorities = Core.addCoreDecisionAuthorityV1(
    Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
    'separated-search',
    { controlledPlayerId: 'P1' as never, decisionMakerPlayerId: 'P2' as never, sourceObjectId: null, scope: { kind: 'all-game-decisions' } },
  ).value;
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities,
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
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: ['P1', 'P2', 'P3', 'P4'].map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders,
    commanderCastLedgers: commanders.map((commander) => Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })),
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'], entries: [{ commanderPhysicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 2 }] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'], records: [{ combatObjectId: 'PC6:0', commanderPhysicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 2 }] }),
    combatContext: Core.createCoreCombatContextV1({ combatId: 'combat-01n', turnNumber: 4, step: 'declare-attackers', attackingPlayerId: 'P1', defendingPlayerIds: ['P2', 'P3', 'P4'], attacks: [], blocks: [] }),
  });
}

function command(root: Core.ModeNeutralCoreRootV1, actor: Player, payload: Core.CoreCommandPayloadV1, decisionContext: Core.CoreCommandV1['decisionContext'] = { kind: 'decision', decisionKey: 'verify' }, decisionMaker: Player = actor): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({ schemaVersion: 1, sequence: root.acceptedCommandCount + 1, actorPlayerId: actor as Core.CorePlayerId, decisionMakerPlayerId: decisionMaker as Core.CorePlayerId, decisionContext, payload });
}

const vector = record(JSON.parse(readFileSync(vectorPath, 'utf8')) as unknown, 'closure vector');
assert.equal(vector.version, 'mode-neutral-core-closure-v1');
assert.deepEqual(vector.players, ['P1', 'P2', 'P3', 'P4']);
assert.equal(Array.isArray(vector.commanders) ? vector.commanders.length : 0, 4);
assert.equal(Array.isArray(vector.payloadKinds) ? vector.payloadKinds.length : 0, 15);
assert.deepEqual(Core.CORE_CLOSURE_VERSION_VECTOR_V1, { coreStateSchemaVersion: 1, coreCommandSchemaVersion: 1, coreEventSchemaVersion: 1, coreReplaySchemaVersion: 1 });
assert.equal(Core.coreSha256HexV1(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
assert.equal(Core.coreSha256HexV1('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

const initialRoot = makeRoot();
let root = initialRoot;
const commands: Core.CoreCommandV1[] = [];
const apply = (actor: Player, payload: Core.CoreCommandPayloadV1, decisionContext?: Core.CoreCommandV1['decisionContext'], decisionMaker: Player = actor): void => {
  const nextCommand = command(root, actor, payload, decisionContext, decisionMaker);
  const result = Core.applyCoreCommandV1(root, nextCommand);
  assert.notEqual(result.status, 'rejected', JSON.stringify(result));
  commands.push(nextCommand);
  root = result.root;
};

apply('P3', { kind: 'priority-pass', playerId: 'P3' as never });
apply('P4', { kind: 'priority-pass', playerId: 'P4' as never });
const announcement = initialRoot.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject['PC5:1' as Core.CoreObjectId];
assert.ok(announcement);
apply('P1', { kind: 'stack-commit-card-spell', input: { sourceObjectId: 'PC2:0' as never, controllerPlayerId: 'P1' as never, announcement } }, undefined, 'P2');
const committedObjectId = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.shared.stack.find((id) => id.startsWith('PC2:'));
assert.ok(committedObjectId);
apply('P1', { kind: 'stack-remove-object', input: { kind: 'card-to-zone', objectId: committedObjectId, destination: { kind: 'owner-graveyard' } } }, undefined, 'P2');
apply('P1', { kind: 'search-open', sessionKey: 'search-01n', input: { zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' }, portion: { kind: 'all' }, criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false, rulesActorPlayerId: 'P1' as never } }, { kind: 'search-session', searchSessionId: 'search-01n' }, 'P2');
apply('P1', { kind: 'search-complete', sessionKey: 'search-01n', selectedObjectIds: ['PC1:0' as never] }, { kind: 'search-session', searchSessionId: 'search-01n' }, 'P2');
apply('P4', { kind: 'control-effect-apply', effectKey: 'effect-01n', effect: { targetObjectId: 'PC6:0' as never, gainingControllerPlayerId: 'P4' as never, sourceObjectId: null, duration: { kind: 'indefinite' } } });
apply('P1', { kind: 'commander-cast-record', physicalCardId: 'PC1' as never, origin: 'command-zone', accepted: true }, undefined, 'P2');
apply('P1', { kind: 'combat-attack-add', attack: { attackerObjectId: 'PC6:0' as never, attackerControllerPlayerId: 'P1' as never, defendingPlayerId: 'P2' as never } }, undefined, 'P2');
apply('P1', { kind: 'combat-step-set', step: 'declare-blockers' }, undefined, 'P2');
apply('P2', { kind: 'combat-block-add', block: { blockerObjectId: 'PC3:0' as never, blockerControllerPlayerId: 'P2' as never, attackedObjectId: 'PC6:0' as never, defendingPlayerId: 'P2' as never } });
apply('P1', { kind: 'commander-damage-record', physicalCardId: 'PC6' as never, defendingPlayerId: 'P2' as never, damage: 3, combatObjectId: 'PC6:0' as never }, undefined, 'P2');
const libraryBefore = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[P1].library;
apply('P1', { kind: 'random-zone-order', randomDecisionId: 'random-01n', zone: { kind: 'player-zone', playerId: P1, zone: 'library' }, beforeOrder: libraryBefore, afterOrder: libraryBefore.slice().reverse() }, undefined, 'P2');
apply('P2', { kind: 'correct-player-life', playerId: 'P2' as never, replacementLifeTotal: 39, expectedBeforeStateDigest: Core.coreCanonicalDigestFromValueV1(root), reason: 'private verifier reason' });
apply('P2', { kind: 'correct-commander-damage', physicalCardId: 'PC6' as never, defendingPlayerId: 'P2' as never, replacementDamageTotal: 4, expectedBeforeStateDigest: Core.coreCanonicalDigestFromValueV1(root), reason: 'second private verifier reason' });
apply('P4', { kind: 'player-exit', playerId: 'P4' as never, cause: 'concession' });

const defeatRoot = makeRoot();
const defeatResult = Core.applyCoreCommandV1(defeatRoot, command(defeatRoot, 'P4', { kind: 'player-exit', playerId: 'P4' as never, cause: 'defeat' }));
assert.equal(defeatResult.status, 'accepted');
if (defeatResult.status === 'accepted') {
  assert.equal(defeatResult.root.playerLifecycle.players.find((entry) => entry.playerId === 'P4')?.exitCause, 'defeat');
  assert.equal(Object.prototype.hasOwnProperty.call(defeatResult.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players, 'P4'), false);
  assert.equal(defeatResult.events.some((event) => event.payload.kind === 'player-exited' && event.payload.cause === 'defeat'), true);
}

const report = Core.runOrdinaryFourPlayerCoreClosureV1(initialRoot, commands);
assert.deepEqual(report.playerIds, ['P1', 'P2', 'P3', 'P4']);
assert.equal(report.finalRoot.commanders.length, 4);
assert.equal(report.finalRoot.playerLifecycle.players.find((entry) => entry.playerId === 'P4')?.status, 'exited');
assert.equal(Object.prototype.hasOwnProperty.call(report.finalRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players, 'P4'), false);
assert.deepEqual(report.finalRoot.commanderDamage.defendingPlayerIds, ['P1', 'P2', 'P3', 'P4']);
assert.equal(report.finalRoot.commanderDamage.entries.some((entry) => entry.defendingPlayerId === 'P4'), true);
assert.equal(JSON.stringify(report.events).includes('private verifier reason'), false);
assert.equal(JSON.stringify(report.journal).includes('private verifier reason'), true);
assert.equal(deepFrozen(report), true, `mutable report path: ${firstMutablePath(report) ?? 'none'}`);
const replay = Core.replayCoreCommandsV1(JSON.parse(JSON.stringify(report.replayPackage)) as Core.CoreReplayPackageV1);
assert.equal(replay.ok, true);
if (replay.ok) {
  assert.equal(replay.finalStateDigest, report.finalStateDigest);
  assert.equal(replay.eventTranscriptDigest, Core.coreCanonicalDigestFromValueV1(report.events));
}
const tamperedReason = JSON.parse(JSON.stringify(report.replayPackage)) as { journal: Array<{ command: { payload: { kind: string; reason?: string } } }> };
const correctionIndex = tamperedReason.journal.findIndex((entry) => entry.command.payload.kind === 'correct-player-life');
assert.ok(correctionIndex >= 0);
tamperedReason.journal[correctionIndex].command.payload.reason = 'tampered verifier reason';
const tamperedReasonReplay = Core.replayCoreCommandsV1(tamperedReason as Core.CoreReplayPackageV1);
assert.equal(tamperedReasonReplay.ok, false);
if (!tamperedReasonReplay.ok) {
  assert.equal(tamperedReasonReplay.divergence.code, 'COMMAND_DIGEST_MISMATCH');
  assert.equal(tamperedReasonReplay.divergence.journalIndex, correctionIndex);
}
assert.deepEqual(report.deferred, vector.deferred);

const rejectedCommand = Core.createCoreCommandV1({ schemaVersion: 1, sequence: 1, actorPlayerId: 'P3' as never, decisionMakerPlayerId: 'P3' as never, decisionContext: { kind: 'decision', decisionKey: 'reject' }, payload: { kind: 'priority-pass', playerId: 'P2' as never } });
const rejected = Core.applyCoreCommandV1(initialRoot, rejectedCommand);
assert.equal(rejected.status, 'rejected');
const acceptedCommand = Core.createCoreCommandV1({ schemaVersion: 1, sequence: 1, actorPlayerId: 'P3' as never, decisionMakerPlayerId: 'P3' as never, decisionContext: { kind: 'decision', decisionKey: 'accept' }, payload: { kind: 'priority-pass', playerId: 'P3' as never } });
const accepted = Core.applyCoreCommandV1(initialRoot, acceptedCommand);
assert.equal(accepted.status, 'accepted');
const retryJournal = Core.appendCoreCommandJournalEntryV1(Core.appendCoreCommandJournalEntryV1([], rejectedCommand, rejected), acceptedCommand, accepted);
assert.equal(Core.replayCoreCommandsV1(Core.createCoreReplayPackageV1(initialRoot, retryJournal)).ok, true);

const publicExports = Object.keys(Core);
for (const name of ['applyCoreCommandV1', 'replayCoreCommandsV1', 'runOrdinaryFourPlayerCoreClosureV1']) assert.equal(publicExports.includes(name), true, name);
for (const name of ['applyDomainEventV1', 'applyJsonPatchV1', 'replaceWholeCoreStateV1']) assert.equal(publicExports.includes(name), false, name);

console.log(`fixture=${String(vector.version)} players=4 commanders=4 payloadKinds=15 accepted=${report.finalRoot.acceptedCommandCount} actorDecisionSeparated=true random=recorded-library-permutation correction=typed-safe exits=concession+defeat replay=state+events-equal stableRoster=true immutable=true deterministic=true defers=6`);
