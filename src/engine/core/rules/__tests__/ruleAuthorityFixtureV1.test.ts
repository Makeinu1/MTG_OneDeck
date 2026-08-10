import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createCoreTurnPriorityBundleV1 } from '../../turn/turnPriorityBundleV1';
import { applyCoreControlEffectV1, createModeNeutralCoreControlSliceV1 } from '../controlEffectV1';
import {
  addCoreDecisionAuthorityV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
} from '../decisionAuthorityV1';
import {
  activateCoreRuleAuthorityAtTurnStartV1,
  expireCoreRuleAuthorityAtTurnBoundaryV1,
  pruneCoreRuleAuthorityForMissingSourcesV1,
} from '../ruleAuthorityLifecycleV1';
import { createCoreRuleAuthorityBundleV1 } from '../ruleAuthorityBundleV1';
import { completeCoreSearchSessionV1, openCoreSearchSessionV1 } from '../searchSessionOperationsV1';
import { createModeNeutralCoreSearchSessionSliceV1 } from '../searchSessionV1';
import {
  addCorePlayPermissionV1,
  createModeNeutralCorePlayPermissionSliceV1,
} from '../playPermissionV1';
import { createModeNeutralCoreVisibilitySliceV1 } from '../visibilityGrantV1';

type Raw = Record<string, unknown>;
const p1 = 'P1' as CorePlayerId;
const p2 = 'P2' as CorePlayerId;
const pc2 = 'PC2:0' as CoreObjectId;
const pc4 = 'PC4:0' as CoreObjectId;
const pc6 = 'PC6:0' as CoreObjectId;

function fixture(): Raw {
  return JSON.parse(
    readFileSync(new URL('../fixtures/rule-authority-v1.json', import.meta.url), 'utf8'),
  ) as Raw;
}

function turnBundle() {
  const source = JSON.parse(
    readFileSync(
      new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url),
      'utf8',
    ),
  ) as Raw;
  return createCoreTurnPriorityBundleV1(source.bundle as never);
}

function bundle(): ReturnType<typeof createCoreRuleAuthorityBundleV1> {
  const control0 = createModeNeutralCoreControlSliceV1({
    effectOrder: [],
    byEffect: {},
    continuityByObject: {
      [pc6]: { controllerPlayerId: p1, continuousSinceMostRecentTurnBegan: false },
    },
  });
  const control = applyCoreControlEffectV1(control0, 'p2-control', {
    targetObjectId: pc6,
    gainingControllerPlayerId: p2,
    sourceObjectId: pc2,
    duration: { kind: 'indefinite' },
  }).value;
  const orderedControl = applyCoreControlEffectV1(control, 'p1-control-eot', {
    targetObjectId: pc6,
    gainingControllerPlayerId: p1,
    sourceObjectId: pc2,
    duration: { kind: 'until-end-of-turn', turnNumber: 4 },
  }).value;
  const visibility = createModeNeutralCoreVisibilitySliceV1({
    grantOrder: ['exile-look', 'top-look'],
    byGrant: {
      'exile-look': {
        subject: { kind: 'object', objectId: pc4 },
        audience: { kind: 'players', playerIds: [p1] },
        mode: 'look',
        sourceObjectId: pc2,
        duration: { kind: 'while-source-exists', sourceObjectId: pc2 },
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
  const searchSessions = createModeNeutralCoreSearchSessionSliceV1({
    sessionOrder: [],
    bySession: {},
  });
  let playPermissions = createModeNeutralCorePlayPermissionSliceV1({
    permissionOrder: [],
    byPermission: {},
  });
  playPermissions = addCorePlayPermissionV1(playPermissions, 'exile-play', {
    allowedPlayerId: p1,
    action: 'play-card',
    subject: {
      kind: 'object',
      objectId: pc4,
      expectedZone: { kind: 'shared-zone', zone: 'exile' },
    },
    sourceObjectId: pc2,
    duration: { kind: 'while-source-exists', sourceObjectId: pc2 },
  }).value;
  playPermissions = addCorePlayPermissionV1(playPermissions, 'top-play', {
    allowedPlayerId: p1,
    action: 'cast-spell',
    subject: { kind: 'top-of-library', playerId: p2 },
    sourceObjectId: pc2,
    duration: { kind: 'single-use' },
  }).value;
  let decisionAuthorities = createModeNeutralCoreDecisionAuthoritySliceV1({
    authorityOrder: [],
    byAuthority: {},
  });
  decisionAuthorities = addCoreDecisionAuthorityV1(decisionAuthorities, 'pending', {
    controlledPlayerId: p2,
    decisionMakerPlayerId: p1,
    sourceObjectId: pc2,
    scope: { kind: 'pending-next-turn' },
  }).value;
  decisionAuthorities = addCoreDecisionAuthorityV1(decisionAuthorities, 'active', {
    controlledPlayerId: p2,
    decisionMakerPlayerId: p1,
    sourceObjectId: pc2,
    scope: { kind: 'active-turn', turnNumber: 4 },
  }).value;
  return createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: turnBundle(),
    control: orderedControl,
    visibility,
    searchSessions,
    playPermissions,
    decisionAuthorities,
  });
}

describe('O4P-01L rule-authority fixture', () => {
  it('contains the four-player scenario and validates as a frozen bundle', () => {
    const input = fixture();
    expect(input.players).toEqual(['P1', 'P2', 'P3', 'P4']);
    const value = bundle();
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.control.effectOrder).toEqual(['p2-control', 'p1-control-eot']);
    expect(value.control.continuityByObject[pc6].continuousSinceMostRecentTurnBegan).toBe(false);
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  });

  it('keeps search actor/selector distinct and performs no card movement or shuffle', () => {
    const input = fixture();
    const openedResult = openCoreSearchSessionV1(bundle(), 'p2-search', {
      zone: { kind: 'player-zone', playerId: p2, zone: 'library' },
      portion: { kind: 'all' },
      criteria: { kind: 'quantity', minimum: 0, maximum: 0 },
      revealFound: false,
      shuffleAfter: true,
      rulesActorPlayerId: p1,
    });
    const openedBundle = openedResult.value as ReturnType<typeof bundle>;
    const session = openedBundle.searchSessions.bySession['p2-search'];
    expect(session.rulesActorPlayerId).toBe(p1);
    expect(session.selectorPlayerId).toBe(p2);
    const completed = completeCoreSearchSessionV1(openedBundle, 'p2-search', []);
    expect(completed.selectedObjectIds).toEqual([]);
    expect(completed.shuffleAfter).toBe(true);
    expect(JSON.stringify(input)).toContain('P2');
  });

  it('preserves the deferred boundaries across expiry, activation, and source pruning', () => {
    const original = bundle();
    const expired = expireCoreRuleAuthorityAtTurnBoundaryV1(original, 4);
    expect(expired.value.control.effectOrder).toEqual(['p2-control']);
    expect(expired.value.decisionAuthorities.authorityOrder).toEqual(['pending']);
    expect(expired.value.searchSessions).toEqual(original.searchSessions);
    expect(expired.controllerChangedObjectIds).toEqual([pc6]);
    const activated = activateCoreRuleAuthorityAtTurnStartV1(original, p2, 4);
    expect(activated.value.decisionAuthorities.byAuthority.active.scope).toEqual({
      kind: 'active-turn',
      turnNumber: 4,
    });
    const registry = JSON.parse(
      JSON.stringify(original.turnPriorityBundle.stackBundle.objectRegistry),
    ) as Raw;
    delete (registry.objects as Raw)[pc2];
    const pruned = pruneCoreRuleAuthorityForMissingSourcesV1(original, registry as never);
    expect(pruned.value.control.effectOrder).toEqual(['p2-control', 'p1-control-eot']);
    expect(pruned.value.visibility.grantOrder).toEqual(['top-look']);
    expect(pruned.value.playPermissions.permissionOrder).toEqual(['top-play']);
  });
});
