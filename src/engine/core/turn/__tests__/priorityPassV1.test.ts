import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import {
  passCorePriorityV1,
  resumeCoreAfterPriorityActionV1,
  startCorePriorityCycleV1,
  validateCorePriorityPassComponentV1,
  type CorePriorityPassComponentInputV1,
} from '../priorityPassV1';
import { CoreTurnPriorityOperationErrorV1 } from '../turnPriorityErrorV1';
import { createCoreStackTransactionBundleV1, removeCoreStackObjectV1 } from '../../index';
import type { CoreStackTransactionBundleV1 } from '../../index';

type Raw = Record<string, unknown>;

const STACK_TOP = '@triggered-ability:fixture-trigger' as CoreObjectId;
const STACK_MIDDLE = '@activated-ability:fixture-activation' as CoreObjectId;

function jsonFixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stackBundle(): CoreStackTransactionBundleV1 {
  const runtime = jsonFixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = clone(runtimeByObject['PC4:1']);
  const announcements = jsonFixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const input = {
    objectRegistry: jsonFixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0];
  return createCoreStackTransactionBundleV1(input);
}

function emptyStackBundle(): CoreStackTransactionBundleV1 {
  let current = stackBundle();
  const removals: readonly [CoreObjectId, Raw][] = [
    [STACK_TOP, { kind: 'cease', objectId: STACK_TOP }],
    [STACK_MIDDLE, { kind: 'cease', objectId: STACK_MIDDLE }],
    ['@spell-copy:fixture-copy' as CoreObjectId, { kind: 'cease', objectId: '@spell-copy:fixture-copy' }],
    ['PC5:1' as CoreObjectId, { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'owner-graveyard' } }],
  ];
  for (const [objectId, operation] of removals) {
    current = removeCoreStackObjectV1(current, operation).bundle;
    expect(objectId).toBe(operation.objectId);
  }
  return current;
}

function component(
  stack: CoreStackTransactionBundleV1,
  window: Raw,
  position: Raw = { phase: 'precombat-main', step: null },
): CorePriorityPassComponentInputV1 {
  return {
    stackBundle: stack,
    lifecycle: createModeNeutralCoreTurnLifecycleSliceV1({
      turnNumber: 1,
      positionSequence: 0,
      position: position as never,
      window: window as never,
    }),
  };
}

function priority(
  stack: CoreStackTransactionBundleV1,
  holder: CorePlayerId = 'P2' as CorePlayerId,
  passedPlayerIds: readonly CorePlayerId[] = [],
  cycleStartPlayerId: CorePlayerId = 'P2' as CorePlayerId,
  position: Raw = { phase: 'precombat-main', step: null },
): CorePriorityPassComponentInputV1 {
  return component(stack, {
    kind: 'priority',
    cycleStartPlayerId,
    holderPlayerId: holder,
    passedPlayerIds,
  }, position);
}

function passAll(input: CorePriorityPassComponentInputV1) {
  let current = input;
  for (const playerId of ['P2', 'P3', 'P4', 'P1'] as const) {
    current = passCorePriorityV1(current, playerId as CorePlayerId);
  }
  return current;
}

function deepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) deepFrozen(descriptor.value, seen);
  }
}

function thrownCode(operation: () => unknown): string {
  try {
    operation();
  } catch (error: unknown) {
    if (error instanceof CoreTurnPriorityOperationErrorV1) return error.code;
    throw error;
  }
  throw new Error('Expected operation to throw');
}

describe('O4P-01K-G priority/pass component', () => {
  it('starts active-player-first and rotates exactly one seated holder', () => {
    const initial = component(stackBundle(), {
      kind: 'position-advance-ready',
    });
    const started = startCorePriorityCycleV1(initial);
    expect(started.lifecycle.window).toEqual({
      kind: 'priority',
      cycleStartPlayerId: 'P2',
      holderPlayerId: 'P2',
      passedPlayerIds: [],
    });
    const next = passCorePriorityV1(started, 'P2' as CorePlayerId);
    expect(next.lifecycle.window).toEqual({
      kind: 'priority',
      cycleStartPlayerId: 'P2',
      holderPlayerId: 'P3',
      passedPlayerIds: ['P2'],
    });
    expect(thrownCode(() => passCorePriorityV1(next, 'P2' as CorePlayerId))).toBe('NOT_PRIORITY_HOLDER');
  });

  it('rejects unseated, duplicate, and non-contiguous pass chains before a transition', () => {
    const invalid: CorePriorityPassComponentInputV1 = {
      stackBundle: stackBundle(),
      lifecycle: {
        kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
        turnNumber: 1,
        positionSequence: 0,
        position: { phase: 'precombat-main', step: null },
        window: {
          kind: 'priority',
          cycleStartPlayerId: 'P2',
          holderPlayerId: 'P3',
          passedPlayerIds: ['P2', 'P2'],
        },
      },
    } as unknown as CorePriorityPassComponentInputV1;
    const result = validateCorePriorityPassComponentV1(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe('INVALID_PASS_SEQUENCE');

    const nonContiguous: CorePriorityPassComponentInputV1 = {
      stackBundle: stackBundle(),
      lifecycle: {
        kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
        turnNumber: 1,
        positionSequence: 0,
        position: { phase: 'precombat-main', step: null },
        window: {
          kind: 'priority',
          cycleStartPlayerId: 'P2',
          holderPlayerId: 'P1',
          passedPlayerIds: ['P2', 'P4'],
        },
      },
    } as unknown as CorePriorityPassComponentInputV1;
    expect(thrownCode(() => passCorePriorityV1(nonContiguous, 'P1' as CorePlayerId))).toBe('INVALID_PASS_SEQUENCE');
    expect(thrownCode(() => passCorePriorityV1(priority(stackBundle()), 'P9' as CorePlayerId))).toBe('PLAYER_NOT_SEATED');
  });

  it('returns exact all-pass boundaries and resets after the current holder acts', () => {
    const ready = passAll(priority(stackBundle()));
    expect(ready.lifecycle.window).toEqual({ kind: 'resolution-ready', objectId: STACK_TOP });

    const positionAdvance = passAll(priority(emptyStackBundle()));
    expect(positionAdvance.lifecycle.window).toEqual({ kind: 'position-advance-ready' });

    const cleanup = passAll(priority(
      emptyStackBundle(),
      'P2' as CorePlayerId,
      [],
      'P2' as CorePlayerId,
      { phase: 'ending', step: 'cleanup' },
    ));
    expect(cleanup.lifecycle.window).toEqual({ kind: 'cleanup-repeat-ready' });

    const actionInput = priority(stackBundle(), 'P3' as CorePlayerId, ['P2'] as CorePlayerId[]);
    const beforeStack = JSON.stringify(actionInput.stackBundle);
    const acted = resumeCoreAfterPriorityActionV1(
      actionInput,
      'P3' as CorePlayerId,
    );
    expect(acted.lifecycle.window).toEqual({
      kind: 'sba-check-required',
      priorityRecipientPlayerId: 'P3',
      grantPriorityIfStable: true,
    });
    expect(JSON.stringify(acted.stackBundle)).toBe(beforeStack);
    deepFrozen(acted);
  }, 15000);
});
