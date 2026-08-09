import { describe, expect, it } from 'vitest';

import {
  applyCoreCardZoneTransitionV1,
  CoreCardZoneTransitionErrorV1,
} from '../cardZoneTransition';
import type { CoreCardZoneTransitionResultV1 } from '../cardZoneTransition';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../../identityZoneValidation';
import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../../runtime/cardRuntimeValidation';
import { createModeNeutralCoreIdentityZoneSliceV1 } from '../../identityZoneState';
import { createModeNeutralCoreCardRuntimeSliceV1 } from '../../runtime/cardRuntimeState';
import { isDefaultCoreCardRuntimeAfterZoneChangeV1, nextCoreCardObjectIdV1 } from '../cardReincarnation';
import { fixtureRecord } from '../../__tests__/testHelpers';

const P1 = 'P1' as CorePlayerId;
const P2 = 'P2' as CorePlayerId;
const PC1_0 = 'PC1:0' as CoreObjectId;
const PC1_1 = 'PC1:1' as CoreObjectId;
const PC2_0 = 'PC2:0' as CoreObjectId;
const PC2_1 = 'PC2:1' as CoreObjectId;
const PC4_2 = 'PC4:2' as CoreObjectId;

function runtimeFixture(): unknown {
  return JSON.parse(JSON.stringify({
    kind: 'mode-neutral-core-card-runtime-slice-v1',
    byObject: {
      'PC1:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [{ kind: 'charge', count: 2 }], markedDamage: 0 }, attachment: { attachedTo: null } },
      'PC2:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [{ kind: '+1/+1', count: 1 }], markedDamage: 0 }, attachment: { attachedTo: null } },
      'PC3:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } },
      'PC4:1': { orientation: { faceIndex: 0, faceDown: false, tapped: true, flipped: false, phasedOut: false }, counterDamage: { counters: [{ kind: 'shield', count: 1 }], markedDamage: 3 }, attachment: { attachedTo: null } },
      'PC5:1': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } },
      'PC6:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } },
      'PC7:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } },
    },
  }));
}

function states(): { identity: ReturnType<typeof createModeNeutralCoreIdentityZoneSliceV1>; runtime: ReturnType<typeof createModeNeutralCoreCardRuntimeSliceV1> } {
  const identityInput = fixtureRecord();
  delete identityInput.kind;
  const identity = createModeNeutralCoreIdentityZoneSliceV1(identityInput as never);
  const rawRuntime = runtimeFixture() as { kind: string; byObject: Record<string, unknown> };
  const runtimeInput = { byObject: rawRuntime.byObject };
  const runtime = createModeNeutralCoreCardRuntimeSliceV1(identity, runtimeInput as never);
  return { identity, runtime };
}

function transition(objectId: string, destination: unknown): CoreCardZoneTransitionResultV1 {
  const { identity, runtime } = states();
  return applyCoreCardZoneTransitionV1(identity, runtime, { objectId, destination });
}

function expectError(action: () => unknown, code: string): void {
  expect(action).toThrow(CoreCardZoneTransitionErrorV1);
  try { action(); } catch (error: unknown) {
    if (error instanceof CoreCardZoneTransitionErrorV1) expect(error.code).toBe(code);
  }
}

describe('atomic Core card zone transition V1', () => {
  it.each([
    ['owner-library', { kind: 'owner-library', placement: { kind: 'top' } }, 'PC2:1'],
    ['owner-hand', { kind: 'owner-hand' }, 'PC1:1'],
    ['owner-graveyard', { kind: 'owner-graveyard' }, 'PC2:1'],
    ['battlefield', { kind: 'battlefield', baseControllerPlayerId: 'P3' }, 'PC2:1'],
    ['stack', { kind: 'stack', baseControllerPlayerId: 'P3' }, 'PC2:1'],
    ['exile', { kind: 'exile' }, 'PC2:1'],
    ['command', { kind: 'command' }, 'PC2:1'],
  ])('moves to every destination branch: %s', (_label, destination, newObjectId) => {
    const sourceObjectId = newObjectId === 'PC1:1' ? PC1_0 : PC2_0;
    const result = transition(sourceObjectId, destination);
    expect(result.identityZoneState.cardObjects[sourceObjectId]).toBeUndefined();
    expect(result.identityZoneState.cardObjects[newObjectId as CoreObjectId]).toBeDefined();
  });

  it.each([
    ['top', { kind: 'top' }, ['PC2:1', 'PC1:0']],
    ['bottom', { kind: 'bottom' }, ['PC1:0', 'PC2:1']],
    ['index', { kind: 'index', index: 1 }, ['PC1:0', 'PC2:1']],
  ])('places owner-library card at %s', (_label, placement, expected) => {
    const result = transition('PC2:0', { kind: 'owner-library', placement });
    expect(result.identityZoneState.zones.byPlayer[P1].library).toEqual(expected);
  });

  it('routes owner destinations by physical owner, independent of controller', () => {
    const result = transition('PC4:1', { kind: 'owner-graveyard' });
    expect(result.identityZoneState.zones.byPlayer[P2].graveyard).toEqual(['PC3:0', 'PC4:2']);
    expect(result.identityZoneState.cardObjects[PC4_2]?.baseControllerPlayerId).toBeNull();
    expect(result.identityZoneState.cardObjects[PC4_2]?.physicalCardId).toBe('PC4');
  });

  it('uses explicit battlefield/stack controllers and null for other destinations', () => {
    expect(transition('PC2:0', { kind: 'battlefield', baseControllerPlayerId: 'P3' }).identityZoneState.cardObjects[PC2_1]?.baseControllerPlayerId).toBe('P3');
    expect(transition('PC2:0', { kind: 'stack', baseControllerPlayerId: 'P3' }).identityZoneState.cardObjects[PC2_1]?.baseControllerPlayerId).toBe('P3');
    for (const destination of [{ kind: 'exile' }, { kind: 'command' }, { kind: 'owner-hand' }] as const) {
      const source = destination.kind === 'owner-hand' ? PC1_0 : PC2_0;
      const next = destination.kind === 'owner-hand' ? PC1_1 : PC2_1;
      expect(transition(source, destination).identityZoneState.cardObjects[next]?.baseControllerPlayerId).toBeNull();
    }
  });

  it('removes the old identity/runtime key, increments once, and resets the new runtime', () => {
    const result = transition('PC2:0', { kind: 'battlefield', baseControllerPlayerId: 'P2' });
    expect(result.cardRuntimeState.byObject[PC2_0]).toBeUndefined();
    expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(result.cardRuntimeState.byObject[PC2_1])).toBe(true);
    expect(result.cardRuntimeState.byObject[PC1_0]).toBeDefined();
    expect(result.identityZoneState.cardObjects[PC2_1]?.incarnation).toBe(1);
    expect(result.identityZoneState.cardObjects[PC2_1]?.physicalCardId).toBe('PC2');
    const expectedObjectId = nextCoreCardObjectIdV1('PC2', 0);
    expect(expectedObjectId).toBe(PC2_1);
    expect(result.identityZoneState.cardObjects[expectedObjectId]).toEqual(result.identityZoneState.cardObjects[PC2_1]);
  });

  it('preserves inputs, deeply freezes the result, and passes both validators', () => {
    const { identity, runtime } = states();
    const beforeIdentity = JSON.stringify(identity);
    const beforeRuntime = JSON.stringify(runtime);
    const result = applyCoreCardZoneTransitionV1(identity, runtime, { objectId: 'PC2:0', destination: { kind: 'owner-graveyard' } });
    expect(JSON.stringify(identity)).toBe(beforeIdentity);
    expect(JSON.stringify(runtime)).toBe(beforeRuntime);
    expect(Object.isFrozen(result)).toBe(true);
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) walk(child);
    };
    walk(result);
    expect(validateModeNeutralCoreIdentityZoneSliceV1(result.identityZoneState).ok).toBe(true);
    expect(validateModeNeutralCoreCardRuntimeSliceV1(result.identityZoneState, result.cardRuntimeState).ok).toBe(true);
  });

  it.each([
    [{ kind: 'owner-hand' }, 'SAME_ZONE_TRANSITION'],
    [{ kind: 'owner-library', placement: { kind: 'index', index: 2 } }, 'INVALID_LIBRARY_INDEX'],
    [{ kind: 'owner-library', placement: { kind: 'index', index: -1 } }, 'INVALID_DESTINATION'],
    [{ kind: 'battlefield', baseControllerPlayerId: 'bad id' }, 'INVALID_DESTINATION'],
    [{ kind: 'future-zone' }, 'INVALID_DESTINATION'],
  ])('rejects invalid transition without output: %j', (destination, code) => {
    const { identity, runtime } = states();
    const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
    expectError(() => applyCoreCardZoneTransitionV1(identity, runtime, { objectId: 'PC2:0', destination }), code);
    expect(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`).toBe(before);
  });

  it('rejects missing, duplicate, malformed, and invalid identity/runtime sources', () => {
    const { identity, runtime } = states();
    expectError(() => applyCoreCardZoneTransitionV1(identity, runtime, { objectId: 'PC9:0', destination: { kind: 'exile' } }), 'SOURCE_NOT_FOUND');
    const duplicate = JSON.parse(JSON.stringify(identity)) as { zones: { byPlayer: { P1: { library: string[] } } } };
    duplicate.zones.byPlayer.P1.library.push('PC2:0');
    expectError(() => applyCoreCardZoneTransitionV1(duplicate, runtime, { objectId: 'PC2:0', destination: { kind: 'exile' } }), 'INVALID_IDENTITY_STATE');
    expectError(() => applyCoreCardZoneTransitionV1(identity, runtime, { objectId: 'bad id', destination: { kind: 'exile' } }), 'INVALID_TRANSITION_INPUT');
    const invalidRuntime = { byObject: {} };
    expectError(() => applyCoreCardZoneTransitionV1(identity, invalidRuntime, { objectId: 'PC2:0', destination: { kind: 'exile' } }), 'INVALID_RUNTIME_STATE');
  });

  it('rejects dangling attachment references rather than returning partial state', () => {
    const { identity, runtime } = states();
    const byObject = JSON.parse(JSON.stringify(runtime.byObject)) as Record<string, { attachment: { attachedTo: unknown } }>;
    byObject['PC4:1'].attachment.attachedTo = { kind: 'object', objectId: 'PC2:0' };
    const invalidRuntime = { kind: 'mode-neutral-core-card-runtime-slice-v1', byObject };
    expectError(() => applyCoreCardZoneTransitionV1(identity, invalidRuntime, { objectId: 'PC2:0', destination: { kind: 'exile' } }), 'TRANSITION_CANDIDATE_INVALID');
  });

  it('is deterministic and has no forbidden nondeterministic dependencies', () => {
    const first = transition('PC2:0', { kind: 'owner-graveyard' });
    const second = transition('PC2:0', { kind: 'owner-graveyard' });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
