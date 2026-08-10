#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as core from '../../src/engine/core';

const repositoryRoot = resolve(new URL('../..', import.meta.url).pathname);
const fixturePath = resolve(
  repositoryRoot,
  'src/engine/core/turn/fixtures/turn-priority-lifecycle-v1.json',
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
const turnPriorityBundle = core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
const registry = turnPriorityBundle.stackBundle.objectRegistry;
const runtime = turnPriorityBundle.stackBundle.objectRuntime;
const p1 = 'P1' as never;
const p2 = 'P2' as never;
const pc2 = 'PC2:0' as never;
const pc4 = 'PC4:0' as never;
const pc6 = 'PC6:0' as never;

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen)
      );
    })
  );
}

function emptyControl() {
  return core.createModeNeutralCoreControlSliceV1({
    effectOrder: [],
    byEffect: {},
    continuityByObject: {
      [pc6]: { controllerPlayerId: p3(), continuousSinceMostRecentTurnBegan: false },
    },
  });
}
function p3() {
  return 'P3' as never;
}

let control = core.applyCoreControlEffectV1(emptyControl(), 'p2-control', {
  targetObjectId: pc6,
  gainingControllerPlayerId: p2,
  sourceObjectId: pc2,
  duration: { kind: 'while-source-exists', sourceObjectId: pc2 },
}).value;
control = core.applyCoreControlEffectV1(control, 'p1-control-eot', {
  targetObjectId: pc6,
  gainingControllerPlayerId: p1,
  sourceObjectId: pc2,
  duration: { kind: 'until-end-of-turn', turnNumber: 4 },
}).value;
assert.equal(core.currentCoreObjectControllerV1(registry, control, pc6), p1);
assert.deepEqual(control.effectOrder, ['p2-control', 'p1-control-eot']);
assert.equal(control.continuityByObject[pc6].continuousSinceMostRecentTurnBegan, false);

const visibility = core.createModeNeutralCoreVisibilitySliceV1({
  grantOrder: ['exile-look', 'top-look'],
  byGrant: {
    'exile-look': {
      subject: { kind: 'object', objectId: pc4 },
      audience: { kind: 'players', playerIds: [p1] },
      mode: 'look',
      sourceObjectId: pc2,
      duration: { kind: 'until-end-of-turn', turnNumber: 4 },
    },
    'top-look': {
      subject: { kind: 'top-of-library', playerId: p2, count: 1 },
      audience: { kind: 'players', playerIds: [p1] },
      mode: 'look',
      sourceObjectId: pc2,
      duration: { kind: 'indefinite' },
    },
  },
});
assert.equal(
  core.coreCanPlayerViewObjectIdentityV1(
    { objectRegistry: registry, objectRuntime: runtime, visibility, control },
    p1,
    pc4,
  ),
  true,
);
assert.equal(
  core.coreCanPlayerViewObjectIdentityV1(
    { objectRegistry: registry, objectRuntime: runtime, visibility, control },
    p2,
    pc4,
  ),
  false,
);

let playPermissions = core.createModeNeutralCorePlayPermissionSliceV1({
  permissionOrder: [],
  byPermission: {},
});
playPermissions = core.addCorePlayPermissionV1(playPermissions, 'exile-play', {
  allowedPlayerId: p1,
  action: 'play-card',
  subject: { kind: 'object', objectId: pc4, expectedZone: { kind: 'shared-zone', zone: 'exile' } },
  sourceObjectId: pc2,
  duration: { kind: 'while-source-exists', sourceObjectId: pc2 },
}).value;
playPermissions = core.addCorePlayPermissionV1(playPermissions, 'top-play', {
  allowedPlayerId: p1,
  action: 'cast-spell',
  subject: { kind: 'top-of-library', playerId: p2 },
  sourceObjectId: pc2,
  duration: { kind: 'single-use' },
}).value;
assert.equal(
  core.coreCanPlayerAttemptPlayObjectV1(registry, visibility, playPermissions, p1, pc4),
  true,
);
assert.equal(
  core.coreCanPlayerAttemptPlayObjectV1(
    registry,
    { kind: 'mode-neutral-core-visibility-slice-v1', grantOrder: [], byGrant: {} },
    playPermissions,
    p1,
    pc4,
  ),
  false,
);

let decisionAuthorities = core.createModeNeutralCoreDecisionAuthoritySliceV1({
  authorityOrder: [],
  byAuthority: {},
});
decisionAuthorities = core.addCoreDecisionAuthorityV1(decisionAuthorities, 'pending', {
  controlledPlayerId: p2,
  decisionMakerPlayerId: p1,
  sourceObjectId: pc2,
  scope: { kind: 'pending-next-turn' },
}).value;
decisionAuthorities = core.addCoreDecisionAuthorityV1(decisionAuthorities, 'active', {
  controlledPlayerId: p2,
  decisionMakerPlayerId: p1,
  sourceObjectId: pc2,
  scope: { kind: 'active-turn', turnNumber: 4 },
}).value;
assert.equal(
  core.coreDecisionMakerForV1(decisionAuthorities, p2, { kind: 'decision', decisionKey: 'choice' }),
  p2,
);

const root = core.createCoreRuleAuthorityBundleV1({
  turnPriorityBundle,
  control,
  visibility,
  searchSessions: core.createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: [],
    bySession: {},
  }),
  playPermissions,
  decisionAuthorities,
});
const rootValidation = core.validateCoreRuleAuthorityBundleV1(root);
assert.equal(rootValidation.ok, true);
assert.deepEqual(Object.keys(root), [
  'turnPriorityBundle',
  'control',
  'visibility',
  'searchSessions',
  'playPermissions',
  'decisionAuthorities',
]);
assert.equal(deepFrozen(root), true);
assert.equal(JSON.stringify(JSON.parse(JSON.stringify(root))), JSON.stringify(root));

const zonesBeforeSearch = JSON.stringify(registry.zones);
const opened = core.openCoreSearchSessionV1(root, 'search-1', {
  zone: { kind: 'player-zone', playerId: p2, zone: 'library' },
  portion: { kind: 'all' },
  criteria: { kind: 'quantity', minimum: 0, maximum: 0 },
  revealFound: false,
  shuffleAfter: true,
  rulesActorPlayerId: p1,
});
const completed = core.completeCoreSearchSessionV1(opened.value, 'search-1', []);
assert.deepEqual(completed.selectedObjectIds, []);
assert.equal(completed.shuffleAfter, true);
assert.equal(JSON.stringify(registry.zones), zonesBeforeSearch);

const expired = core.expireCoreRuleAuthorityAtTurnBoundaryV1(root, 4);
assert.deepEqual(expired.value.control.effectOrder, ['p2-control']);
assert.deepEqual(expired.value.visibility.grantOrder, ['top-look']);
assert.deepEqual(expired.value.decisionAuthorities.authorityOrder, ['pending']);
assert.deepEqual(expired.controllerChangedObjectIds, [pc6]);

const missingSourceRegistry = JSON.parse(JSON.stringify(registry)) as Record<string, unknown>;
delete (missingSourceRegistry.objects as Record<string, unknown>)[pc2 as string];
const pruned = core.pruneCoreRuleAuthorityForMissingSourcesV1(root, missingSourceRegistry as never);
assert.deepEqual(pruned.value.control.effectOrder, ['p1-control-eot']);
assert.deepEqual(pruned.value.visibility.grantOrder, ['exile-look', 'top-look']);
assert.deepEqual(pruned.value.playPermissions.permissionOrder, ['top-play']);

const activated = core.activateCoreRuleAuthorityAtTurnStartV1(root, p2, 4);
assert.deepEqual(activated.value.decisionAuthorities.byAuthority.pending.scope, {
  kind: 'active-turn',
  turnNumber: 4,
});
assert.equal(core.coreHasContinuousControlSinceTurnStartV1(activated.value.control, pc6), false);

console.log('OK: mode-neutral core rule authority verification');
