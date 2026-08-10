import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createCoreTurnPriorityBundleV1 } from '../../turn/turnPriorityBundleV1';
import { applyCoreControlEffectV1, createModeNeutralCoreControlSliceV1 } from '../controlEffectV1';
import {
  addCoreDecisionAuthorityV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
} from '../decisionAuthorityV1';
import {
  createCoreRuleAuthorityBundleV1,
  validateCoreRuleAuthorityBundleV1,
} from '../ruleAuthorityBundleV1';
import {
  activateCoreRuleAuthorityAtTurnStartV1,
  expireCoreRuleAuthorityAtTurnBoundaryV1,
  pruneCoreRuleAuthorityForMissingSourcesV1,
} from '../ruleAuthorityLifecycleV1';
import { createModeNeutralCorePlayPermissionSliceV1 } from '../playPermissionV1';
import { createModeNeutralCoreSearchSessionSliceV1 } from '../searchSessionV1';
import { createModeNeutralCoreVisibilitySliceV1 } from '../visibilityGrantV1';

type Raw = Record<string, unknown>;

function fixture(): Raw {
  return JSON.parse(
    readFileSync(
      new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url),
      'utf8',
    ),
  ) as Raw;
}

function turnBundle() {
  const value = fixture().bundle;
  return createCoreTurnPriorityBundleV1(value as never);
}

function emptyControl() {
  return createModeNeutralCoreControlSliceV1({
    effectOrder: [],
    byEffect: {},
    continuityByObject: {
      ['PC6:0' as never]: {
        controllerPlayerId: 'P3' as never,
        continuousSinceMostRecentTurnBegan: false,
      },
    },
  });
}

function emptyBundle() {
  return createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: turnBundle(),
    control: emptyControl(),
    visibility: createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: createModeNeutralCorePlayPermissionSliceV1({
      permissionOrder: [],
      byPermission: {},
    }),
    decisionAuthorities: createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: [],
      byAuthority: {},
    }),
  });
}

describe('Core rule authority bundle V1', () => {
  it('validates the six-field root in order and returns a frozen JSON value', () => {
    const bundle = emptyBundle();
    expect(Object.keys(bundle)).toEqual([
      'turnPriorityBundle',
      'control',
      'visibility',
      'searchSessions',
      'playPermissions',
      'decisionAuthorities',
    ]);
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle);

    const invalid = validateCoreRuleAuthorityBundleV1({
      turnPriorityBundle: {},
      control: {},
      visibility: {},
      searchSessions: {},
      playPermissions: {},
      decisionAuthorities: {},
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'INVALID_TURN_PRIORITY_BUNDLE',
          'INVALID_CONTROL_SLICE',
          'INVALID_DECISION_AUTHORITY_SLICE',
          'INVALID_SEARCH_SESSION_SLICE',
          'INVALID_VISIBILITY_SLICE',
          'INVALID_PLAY_PERMISSION_SLICE',
        ]),
      );
    }
  });

  it('expires only turn-boundary records and preserves the turn bundle and search sessions', () => {
    const control = applyCoreControlEffectV1(emptyControl(), 'eot-control', {
      targetObjectId: 'PC6:0' as never,
      gainingControllerPlayerId: 'P2' as never,
      sourceObjectId: 'PC2:0' as never,
      duration: { kind: 'until-end-of-turn', turnNumber: 4 },
    }).value;
    const bundle = createCoreRuleAuthorityBundleV1({
      ...emptyBundle(),
      control,
      searchSessions: createModeNeutralCoreSearchSessionSliceV1({
        sessionOrder: ['s'],
        bySession: {
          s: {
            rulesActorPlayerId: 'P1' as never,
            selectorPlayerId: 'P1' as never,
            zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' },
            portion: { kind: 'all' },
            candidateObjectIds: ['PC1:0' as never],
            criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
            revealFound: false,
            shuffleAfter: false,
          },
        },
      }),
    });
    const expired = expireCoreRuleAuthorityAtTurnBoundaryV1(bundle, 4);
    expect(expired.value.turnPriorityBundle).toBe(bundle.turnPriorityBundle);
    expect(expired.value.control.effectOrder).toEqual([]);
    expect(expired.value.searchSessions.sessionOrder).toEqual(['s']);
    expect(expired.controllerChangedObjectIds).toEqual(['PC6:0']);
  });

  it('prunes missing sources and activates pending authorities at the canonical turn start', () => {
    const withAuthority = addCoreDecisionAuthorityV1(emptyBundle().decisionAuthorities, 'pending', {
      controlledPlayerId: 'P2' as never,
      decisionMakerPlayerId: 'P3' as never,
      sourceObjectId: 'PC2:0' as never,
      scope: { kind: 'pending-next-turn' },
    }).value;
    const bundle = createCoreRuleAuthorityBundleV1({
      ...emptyBundle(),
      control: applyCoreControlEffectV1(emptyControl(), 'source-control', {
        targetObjectId: 'PC6:0' as never,
        gainingControllerPlayerId: 'P2' as never,
        sourceObjectId: 'PC2:0' as never,
        duration: { kind: 'while-source-exists', sourceObjectId: 'PC2:0' },
      }).value,
      decisionAuthorities: withAuthority,
    });
    const registry = JSON.parse(
      JSON.stringify(bundle.turnPriorityBundle.stackBundle.objectRegistry),
    ) as Raw;
    delete (registry.objects as Raw)['PC2:0'];
    const pruned = pruneCoreRuleAuthorityForMissingSourcesV1(bundle, registry as never);
    expect(pruned.value.control.effectOrder).toEqual([]);

    const activated = activateCoreRuleAuthorityAtTurnStartV1(bundle, 'P2' as never, 4);
    expect(activated.value.decisionAuthorities.byAuthority.pending.scope).toEqual({
      kind: 'active-turn',
      turnNumber: 4,
    });
  });
});
