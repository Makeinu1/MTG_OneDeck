import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId } from '../../ids';
import { createCoreStackTransactionBundleV1 } from '../../stack/transaction/stackTransactionBundleV1';
import { removeCoreStackObjectV1 } from '../../stack/transaction/stackRemovalV1';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import {
  createCoreTurnPriorityBundleV1,
} from '../turnPriorityBundleV1';
import { validateCoreTurnPriorityBundleV1 } from '../turnPriorityBundleValidationV1';

type Raw = Record<string, unknown>;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function stackBundle() {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  return createCoreStackTransactionBundleV1({
    objectRegistry: fixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0]);
}

function emptyStack() {
  let current = stackBundle();
  for (const operation of [
    { kind: 'cease', objectId: '@triggered-ability:fixture-trigger' },
    { kind: 'cease', objectId: '@activated-ability:fixture-activation' },
    { kind: 'cease', objectId: '@spell-copy:fixture-copy' },
    { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'owner-graveyard' } },
  ] as const) {
    current = removeCoreStackObjectV1(current, operation).bundle;
  }
  return current;
}

function pending(registry: ReturnType<typeof stackBundle>, ids: readonly string[] = []) {
  const byObject: Raw = {};
  for (const objectId of ids) {
    byObject[objectId] = {
      stackPlacementBucket: 'ordinary',
      object: {
        kind: 'triggered-ability',
        controllerPlayerId: 'P2',
        sourceObjectId: '@triggered-ability:historical-source',
        abilityKey: `fixture-${objectId.replaceAll('@triggered-ability:', '')}`,
      },
      announcement: {
        kind: 'triggered-ability',
        abilityTextSnapshot: `When ${objectId} triggers.`,
        chosenModeKeys: [],
        targetSelections: [],
        announcedVariables: [],
        distributions: [],
        costChoices: { alternativeCost: null, additionalCosts: [] },
      },
    };
  }
  return createModeNeutralCorePendingTriggerSliceV1(registry.objectRegistry, {
    pendingObjectIds: ids as CoreObjectId[],
    byObject,
  } as unknown as Parameters<typeof createModeNeutralCorePendingTriggerSliceV1>[1]);
}

function lifecycle(position: Raw, window: Raw) {
  return createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 0,
    position: position as never,
    window: window as never,
  });
}

function bundle(window: Raw, stack = emptyStack(), pendingSlice = pending(stack), position: Raw = { phase: 'precombat-main', step: null }) {
  return createCoreTurnPriorityBundleV1({
    stackBundle: stack,
    pendingTriggers: pendingSlice,
    lifecycle: lifecycle(position, window),
  });
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

describe('CoreTurnPriorityBundleV1', () => {
  it('uses canonical field order, preserves input, and deep-freezes a distinct bundle', () => {
    const stack = emptyStack();
    const input = {
      stackBundle: stack,
      pendingTriggers: pending(stack),
      lifecycle: lifecycle(
        { phase: 'beginning', step: 'untap' },
        { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P2' },
      ),
    };
    const before = JSON.stringify(input);
    const result = createCoreTurnPriorityBundleV1(input);
    expect(Object.keys(result)).toEqual(['stackBundle', 'pendingTriggers', 'lifecycle']);
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toBe(input);
    deepFrozen(result);
  });

  it('cross-validates seated players, priority chains, trigger groups, and stack boundaries', () => {
    const stack = emptyStack();
    expect(() => bundle({
      kind: 'priority',
      cycleStartPlayerId: 'P2',
      holderPlayerId: 'P1',
      passedPlayerIds: ['P3'],
    })).toThrow();

    const triggerId = '@triggered-ability:bundle-trigger';
    const triggerPending = pending(stack, [triggerId]);
    expect(() => bundle({
      kind: 'trigger-order-required',
      priorityRecipientPlayerId: 'P2',
      grantPriorityIfStable: true,
      pendingObjectIds: [],
      ambiguousGroups: [],
    }, stack, triggerPending)).toThrow();

    const withStack = stackBundle();
    expect(() => bundle({
      kind: 'resolution-ready',
      objectId: '@triggered-ability:not-the-top',
    }, withStack, pending(withStack), { phase: 'precombat-main', step: null })).toThrow();
  });

  it('round-trips canonical JSON and accepts factory input in any property insertion order', () => {
    const stack = emptyStack();
    const value = bundle({
      kind: 'sba-check-required',
      priorityRecipientPlayerId: 'P2',
      grantPriorityIfStable: true,
    }, stack, pending(stack));
    const roundTrip: unknown = JSON.parse(JSON.stringify(value));
    const validated = validateCoreTurnPriorityBundleV1(roundTrip);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.value).toEqual(value);
  });
});
