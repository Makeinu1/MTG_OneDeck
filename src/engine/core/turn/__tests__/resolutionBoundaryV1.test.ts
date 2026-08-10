import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../ids';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { passCorePriorityV1, type CorePriorityPassComponentInputV1 } from '../priorityPassV1';
import { completeCoreResolutionAfterRemovalV1 } from '../resolutionBoundaryV1';
import { CoreTurnPriorityOperationErrorV1 } from '../turnPriorityErrorV1';
import { createCoreStackTransactionBundleV1, removeCoreStackObjectV1 } from '../../index';
import type { CoreStackTransactionBundleV1 } from '../../index';

type Raw = Record<string, unknown>;
const TOP = '@triggered-ability:fixture-trigger' as CoreObjectId;
const MIDDLE = '@activated-ability:fixture-activation' as CoreObjectId;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function stackBundle(): CoreStackTransactionBundleV1 {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const input = {
    objectRegistry: fixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0];
  return createCoreStackTransactionBundleV1(input);
}

function priority(stack: CoreStackTransactionBundleV1): CorePriorityPassComponentInputV1 {
  return {
    stackBundle: stack,
    lifecycle: createModeNeutralCoreTurnLifecycleSliceV1({
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'precombat-main', step: null },
      window: {
        kind: 'priority',
        cycleStartPlayerId: 'P2' as CorePlayerId,
        holderPlayerId: 'P2' as CorePlayerId,
        passedPlayerIds: [],
      },
    }),
  };
}

function resolutionReady(stack: CoreStackTransactionBundleV1): CorePriorityPassComponentInputV1 {
  let current = priority(stack);
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

describe('O4P-01K-G resolution boundary', () => {
  it('replaces only a supplied top removal result and enters stabilization', () => {
    const ready = resolutionReady(stackBundle());
    const before = JSON.stringify(ready);
    const removal = removeCoreStackObjectV1(ready.stackBundle, { kind: 'cease', objectId: TOP });
    const completed = completeCoreResolutionAfterRemovalV1(ready, removal);
    expect(completed.lifecycle.window).toEqual({
      kind: 'sba-check-required',
      priorityRecipientPlayerId: 'P2',
      grantPriorityIfStable: true,
    });
    expect(completed.stackBundle.objectRegistry.zones.shared.stack).not.toContain(TOP);
    expect(completed.stackBundle.objectRegistry.zones.shared.stack).toContain(MIDDLE);
    expect(JSON.stringify(ready)).toBe(before);
    deepFrozen(completed);
  });

  it('rejects stale, wrong-top, and middle removals without positional fallback', () => {
    const ready = resolutionReady(stackBundle());
    const middleRemoval = removeCoreStackObjectV1(ready.stackBundle, { kind: 'cease', objectId: MIDDLE });
    expect(thrownCode(() => completeCoreResolutionAfterRemovalV1(ready, middleRemoval))).toBe('RESOLUTION_REMOVAL_MISMATCH');

    const topRemoval = removeCoreStackObjectV1(ready.stackBundle, { kind: 'cease', objectId: TOP });
    const stale = { ...ready, stackBundle: topRemoval.bundle };
    expect(thrownCode(() => completeCoreResolutionAfterRemovalV1(stale, topRemoval))).toBe('TOP_STACK_MISMATCH');

    const wrongIdentity = { ...topRemoval, removedObjectId: MIDDLE };
    expect(thrownCode(() => completeCoreResolutionAfterRemovalV1(ready, wrongIdentity))).toBe('RESOLUTION_REMOVAL_MISMATCH');
  });
});
