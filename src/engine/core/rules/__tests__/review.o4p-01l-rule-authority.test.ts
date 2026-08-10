import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as coreApi from '../../index';

type Raw = Record<string, unknown>;
type CoreFunction = (...args: unknown[]) => unknown;

const P1 = 'P1';
const P2 = 'P2';
const P3 = 'P3';
const CARD = 'PC6:0';
const STACK_CARD = 'PC5:1';
const SPELL_COPY = '@spell-copy:fixture-copy';
const ABILITY = '@activated-ability:fixture-activation';
const SOURCE = 'PC2:0';

function record(value: unknown, label: string): Raw {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a record`);
  return value as Raw;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function call(name: string, ...args: unknown[]): unknown {
  const candidate: unknown = Reflect.get(coreApi, name);
  if (typeof candidate !== 'function') throw new Error(`missing required Core export: ${name}`);
  return (candidate as CoreFunction)(...args);
}

function fixtureBundle(): Raw {
  const fixture = JSON.parse(
    readFileSync(
      new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url),
      'utf8',
    ),
  ) as Raw;
  return clone(record(fixture.bundle, 'turn fixture bundle'));
}

function fixtureRegistry(): Raw {
  const stack = record(fixtureBundle().stackBundle, 'stack bundle');
  return record(stack.objectRegistry, 'object registry');
}

function fixtureZones(): Raw {
  return record(fixtureRegistry().zones, 'zones');
}

function emptyControl(): Raw {
  return {
    kind: 'mode-neutral-core-control-slice-v1',
    effectOrder: [],
    byEffect: {},
    continuityByObject: {
      [CARD]: { controllerPlayerId: P3, continuousSinceMostRecentTurnBegan: false },
    },
  };
}

function emptyVisibility(): Raw {
  return { kind: 'mode-neutral-core-visibility-slice-v1', grantOrder: [], byGrant: {} };
}
function emptySearch(): Raw {
  return { kind: 'mode-neutral-core-search-session-slice-v1', sessionOrder: [], bySession: {} };
}
function emptyPlay(): Raw {
  return {
    kind: 'mode-neutral-core-play-permission-slice-v1',
    permissionOrder: [],
    byPermission: {},
  };
}
function emptyDecision(): Raw {
  return {
    kind: 'mode-neutral-core-decision-authority-slice-v1',
    authorityOrder: [],
    byAuthority: {},
  };
}

function root(overrides: Partial<Raw> = {}): Raw {
  return {
    turnPriorityBundle: fixtureBundle(),
    control: emptyControl(),
    visibility: emptyVisibility(),
    searchSessions: emptySearch(),
    playPermissions: emptyPlay(),
    decisionAuthorities: emptyDecision(),
    ...overrides,
  };
}

function resultValue(value: unknown, label: string): Raw {
  const result = record(value, label);
  if (Object.prototype.hasOwnProperty.call(result, 'value')) {
    return record(result.value, `${label}.value`);
  }
  if (Object.prototype.hasOwnProperty.call(result, 'bundle')) {
    return record(result.bundle, `${label}.bundle`);
  }
  return result;
}

function deepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) deepFrozen(descriptor.value, seen);
  }
}

const indefinite = { kind: 'indefinite' };
const eot = { kind: 'until-end-of-turn', turnNumber: 4 };
const zone = (zoneName: string): Raw =>
  zoneName === 'battlefield' || zoneName === 'stack' || zoneName === 'exile'
    ? { kind: 'shared-zone', zone: zoneName }
    : { kind: 'player-zone', playerId: P1, zone: zoneName };

describe('O4P-01L rule authority acceptance pins', () => {
  it('pins the six-field root, valid bundle, no duplicate turn state, and atomic strict validation', () => {
    const input = root();
    const before = JSON.stringify(input);
    const validation = record(
      call('validateCoreRuleAuthorityBundleV1', input),
      'bundle validation',
    );
    expect(validation.ok).toBe(true);
    const value = resultValue(validation, 'bundle validation');
    expect(Object.keys(value)).toEqual([
      'turnPriorityBundle',
      'control',
      'visibility',
      'searchSessions',
      'playPermissions',
      'decisionAuthorities',
    ]);
    expect(JSON.stringify(value)).toBe(
      JSON.stringify(
        resultValue(call('createCoreRuleAuthorityBundleV1', input), 'bundle creation'),
      ),
    );
    expect(JSON.stringify(input)).toBe(before);
    deepFrozen(value);
    for (const [field, code] of [
      ['control', 'INVALID_CONTROL_SLICE'],
      ['visibility', 'INVALID_VISIBILITY_SLICE'],
      ['searchSessions', 'INVALID_SEARCH_SESSION_SLICE'],
      ['playPermissions', 'INVALID_PLAY_PERMISSION_SLICE'],
      ['decisionAuthorities', 'INVALID_DECISION_AUTHORITY_SLICE'],
    ] as const) {
      const rejected = record(
        call('validateCoreRuleAuthorityBundleV1', { ...input, [field]: {} }),
        `${field} rejection`,
      );
      expect(rejected.ok).toBe(false);
      expect(JSON.stringify(input)).toBe(before);
      expect(JSON.stringify(rejected.issues)).toContain(code);
    }
  });

  it('pins control of battlefield cards, stack spells and copies, ordered last-wins, removal restoration, and ability rejection', () => {
    let control = emptyControl();
    const effect = (
      targetObjectId: string,
      controllerPlayerId = P2,
      duration: Raw = indefinite,
    ): Raw => ({
      targetObjectId,
      gainingControllerPlayerId: controllerPlayerId,
      sourceObjectId: SOURCE,
      duration,
    });
    control = resultValue(
      call('applyCoreControlEffectV1', control, 'first', effect(CARD, P2)),
      'first control',
    );
    control = resultValue(
      call('applyCoreControlEffectV1', control, 'second', effect(CARD, P1, eot)),
      'second control',
    );
    control = resultValue(
      call('applyCoreControlEffectV1', control, 'stack', effect(STACK_CARD)),
      'stack control',
    );
    control = resultValue(
      call('applyCoreControlEffectV1', control, 'copy', effect(SPELL_COPY)),
      'copy control',
    );
    expect(call('currentCoreObjectControllerV1', fixtureRegistry(), control, CARD)).toBe(P1);
    expect(call('currentCoreObjectControllerV1', fixtureRegistry(), control, STACK_CARD)).toBe(P2);
    expect(call('currentCoreObjectControllerV1', fixtureRegistry(), control, SPELL_COPY)).toBe(P2);
    const rejected = (() => {
      try {
        call('applyCoreControlEffectV1', control, 'ability', effect(ABILITY));
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(rejected).toBeTruthy();
    expect(String(rejected)).toMatch(/OBJECT_NOT_CONTROLLABLE/);
    control = resultValue(call('removeCoreControlEffectV1', control, 'second'), 'remove latest');
    expect(call('currentCoreObjectControllerV1', fixtureRegistry(), control, CARD)).toBe(P2);
    const reordered = resultValue(
      call('replaceCoreControlEffectOrderV1', control, ['copy', 'first', 'stack']),
      'replace order',
    );
    expect(reordered.effectOrder).toEqual(['copy', 'first', 'stack']);
  });

  it('pins continuity transitions, explicit turn-start marking, EOT expiry, and source pruning', () => {
    const control = resultValue(
      call('applyCoreControlEffectV1', emptyControl(), 'owned', {
        targetObjectId: CARD,
        gainingControllerPlayerId: P2,
        sourceObjectId: SOURCE,
        duration: indefinite,
      }),
      'owned control',
    );
    expect(record(control.continuityByObject, 'continuity')[CARD]).toEqual({
      controllerPlayerId: P2,
      continuousSinceMostRecentTurnBegan: false,
    });
    const marked = resultValue(
      call('markCoreControlledPermanentsAtTurnStartV1', control, P2),
      'turn start',
    );
    expect(
      record(record(marked.continuityByObject, 'marked continuity')[CARD], 'marked row')
        .continuousSinceMostRecentTurnBegan,
    ).toBe(true);
    expect(call('coreHasContinuousControlSinceTurnStartV1', marked, CARD)).toBe(true);
    const expired = resultValue(
      call(
        'expireCoreControlEffectsAtTurnBoundaryV1',
        resultValue(
          call('applyCoreControlEffectV1', marked, 'eot', {
            targetObjectId: CARD,
            gainingControllerPlayerId: P1,
            sourceObjectId: SOURCE,
            duration: eot,
          }),
          'eot control',
        ),
        4,
      ),
      'expiry',
    );
    expect(expired.effectOrder).not.toContain('eot');
    const pruned = resultValue(
      call(
        'pruneCoreRuleAuthorityForMissingSourcesV1',
        root({ control: control }),
        fixtureRegistry(),
      ),
      'source prune',
    );
    expect(pruned).toBeTruthy();
  });

  it('pins default and granted identity visibility across hand, library, public, face-down battlefield/stack/exile, top library, controlled player, and outside-game exclusion', () => {
    const registry = fixtureRegistry();
    const visibility = resultValue(
      call('createModeNeutralCoreVisibilitySliceV1', {
        grantOrder: ['exile', 'top'],
        byGrant: {
          exile: {
            subject: { kind: 'object', objectId: 'PC4:0' },
            audience: { kind: 'players', playerIds: [P1] },
            mode: 'look',
            sourceObjectId: null,
            duration: indefinite,
          },
          top: {
            subject: { kind: 'top-of-library', playerId: P1, count: 1 },
            audience: { kind: 'all-players' },
            mode: 'reveal',
            sourceObjectId: null,
            duration: indefinite,
          },
        },
      }),
      'visibility',
    );
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P1, 'PC2:0')).toBe(true);
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P2, 'PC1:0')).toBe(true);
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P1, 'PC6:0')).toBe(true);
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P1, 'PC4:0')).toBe(true);
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P2, 'PC4:0')).toBe(
      false,
    );
    expect(call('coreCanPlayerViewObjectIdentityV1', registry, visibility, P2, 'outside:1')).toBe(
      false,
    );
    const invalidReveal = (() => {
      try {
        call('createModeNeutralCoreVisibilitySliceV1', {
          grantOrder: ['bad'],
          byGrant: {
            bad: {
              subject: { kind: 'object', objectId: CARD },
              audience: { kind: 'players', playerIds: [P1] },
              mode: 'reveal',
              sourceObjectId: null,
              duration: indefinite,
            },
          },
        });
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(invalidReveal).toBeTruthy();
    expect(String(invalidReveal)).toMatch(/INVALID_LITERAL|VISIBILITY_RULE_MISMATCH/);
  });

  it('pins search actor/selector separation, owner/opponent zones, quantity and qualified bounds, fail-to-find, stale snapshots, no reveal/movement/shuffle', () => {
    const registry = fixtureRegistry();
    const input = root({
      decisionAuthorities: {
        ...emptyDecision(),
        authorityOrder: ['search'],
        byAuthority: {
          search: {
            controlledPlayerId: P1,
            decisionMakerPlayerId: P2,
            sourceObjectId: null,
            scope: { kind: 'search-session', searchSessionId: 's1' },
          },
        },
      },
    });
    const opened = resultValue(
      call('openCoreSearchSessionV1', input, 's1', {
        zone: zone('library'),
        portion: { kind: 'all' },
        criteria: { kind: 'quantity', minimum: 1, maximum: 1 },
        revealFound: false,
        shuffleAfter: true,
        rulesActorPlayerId: P1,
      }),
      'search open',
    );
    const session = record(opened.searchSessions ?? opened, 'search sessions');
    expect(session).toBeTruthy();
    const completed = resultValue(
      call('completeCoreSearchSessionV1', opened, 's1', ['PC1:0']),
      'search complete',
    );
    expect(completed).toBeTruthy();
    expect(JSON.stringify(completed)).not.toContain('moved');
    const stale = (() => {
      try {
        call('completeCoreSearchSessionV1', opened, 's1', ['PC2:0']);
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(stale).toBeTruthy();
    expect(String(stale)).toMatch(/SEARCH_SNAPSHOT_STALE|SEARCH_SELECTION_INVALID/);
    const qualified = {
      kind: 'qualified',
      criteriaKey: 'card.criteria',
      minimum: 1,
      maximum: 2,
      mayFailToFind: true,
    };
    expect(
      call('openCoreSearchSessionV1', registry, P1, {
        zone: zone('graveyard'),
        portion: { kind: 'all' },
        criteria: qualified,
        revealFound: true,
        shuffleAfter: false,
      }),
    ).toBeTruthy();
    expect(call('cancelCoreSearchSessionV1', opened, 's1')).toBeTruthy();
  });

  it('pins play permission as attempt-only for object/top-library/face-down exile, expected-zone checks, and last single-use consumption', () => {
    const permission = (subject: Raw, duration: Raw = indefinite): Raw => ({
      allowedPlayerId: P2,
      action: 'play-card',
      subject,
      sourceObjectId: null,
      duration,
    });
    let slice = resultValue(
      call(
        'addCorePlayPermissionV1',
        emptyPlay(),
        'object',
        permission({ kind: 'object', objectId: STACK_CARD, expectedZone: zone('stack') }),
      ),
      'object permission',
    );
    slice = resultValue(
      call(
        'addCorePlayPermissionV1',
        slice,
        'top',
        permission({ kind: 'top-of-library', playerId: P1 }, { kind: 'single-use' }),
      ),
      'top permission',
    );
    expect(call('findCorePlayPermissionsV1', slice, P2, 'play-card')).toBeTruthy();
    expect(
      call(
        'coreCanPlayerAttemptPlayObjectV1',
        fixtureRegistry(),
        emptyVisibility(),
        slice,
        P2,
        STACK_CARD,
      ),
    ).toBe(true);
    expect(
      call(
        'coreCanPlayerAttemptPlayObjectV1',
        fixtureRegistry(),
        emptyVisibility(),
        slice,
        P1,
        STACK_CARD,
      ),
    ).toBe(false);
    const consumed = resultValue(
      call('consumeCorePlayPermissionV1', slice, 'top'),
      'consume permission',
    );
    expect(consumed.permissionOrder).not.toContain('top');
    expect(JSON.stringify(fixtureZones())).toContain(STACK_CARD);
  });

  it('pins pending/active/decision-specific/search authority, last-wins, skipped-turn activation, and non-authority boundaries', () => {
    let slice = resultValue(
      call('addCoreDecisionAuthorityV1', emptyDecision(), 'broad', {
        controlledPlayerId: P1,
        decisionMakerPlayerId: P2,
        sourceObjectId: null,
        scope: { kind: 'all-game-decisions' },
      }),
      'broad authority',
    );
    slice = resultValue(
      call('addCoreDecisionAuthorityV1', slice, 'specific', {
        controlledPlayerId: P1,
        decisionMakerPlayerId: P3,
        sourceObjectId: SOURCE,
        scope: { kind: 'decision', decisionKey: 'choose.mode' },
      }),
      'specific authority',
    );
    expect(
      call('coreDecisionMakerForV1', slice, P1, { kind: 'decision', decisionKey: 'choose.mode' }),
    ).toBe(P3);
    expect(
      call('coreDecisionMakerForV1', slice, P1, { kind: 'decision', decisionKey: 'other' }),
    ).toBe(P2);
    expect(
      resultValue(
        call('activateCorePendingDecisionAuthoritiesAtTurnStartV1', slice, P1, 5),
        'activate pending',
      ),
    ).toBeTruthy();
    expect(
      resultValue(call('expireCoreDecisionAuthoritiesAfterTurnV1', slice, 4), 'expire active'),
    ).toBeTruthy();
    expect(JSON.stringify(slice)).not.toContain('activePlayerId');
    expect(JSON.stringify(slice)).not.toContain('manaPool');
    expect(JSON.stringify(slice)).not.toContain('concession');
  });

  it('pins expiry as a single explicit turn-boundary operation and preserves search sessions', () => {
    const input = root({
      searchSessions: {
        kind: 'mode-neutral-core-search-session-slice-v1',
        sessionOrder: ['s'],
        bySession: {
          s: {
            rulesActorPlayerId: P1,
            selectorPlayerId: P1,
            zone: zone('library'),
            portion: { kind: 'all' },
            candidateObjectIds: ['PC1:0'],
            criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
            revealFound: false,
            shuffleAfter: false,
          },
        },
      },
    });
    const expired = resultValue(
      call('expireCoreRuleAuthorityAtTurnBoundaryV1', input, 4),
      'root expiry',
    );
    expect(record(expired.searchSessions, 'expired sessions')['sessionOrder']).toEqual(['s']);
    expect(expired['turnPriorityBundle']).toEqual(input['turnPriorityBundle']);
  });

  it('pins hostile input non-mutation, deterministic complete issues, canonical JSON, and deep freeze', () => {
    const input = root();
    const hostile = clone(input);
    Object.defineProperty(hostile, 'unknown', { enumerable: true, value: 1 });
    const before = JSON.stringify(hostile);
    const validation = record(
      call('validateCoreRuleAuthorityBundleV1', hostile),
      'hostile validation',
    );
    expect(validation.ok).toBe(false);
    expect(JSON.stringify(hostile)).toBe(before);
    expect(JSON.stringify(validation.issues)).toContain('UNKNOWN_FIELD');
    const valid = resultValue(call('createCoreRuleAuthorityBundleV1', input), 'created root');
    expect(JSON.parse(JSON.stringify(valid))).toEqual(valid);
    deepFrozen(valid);
  });
});
