import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  appendCorePendingTriggeredAbilitiesV1,
  CorePendingTriggerOperationErrorV1,
} from '../pendingTriggerV1';
import { validateModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerValidationV1';
import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryValidationV2';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import type { CorePendingTriggeredAbilityAppendInputV1 } from '../pendingTriggerV1';

type Raw = Record<string, unknown>;
const registryDocument: unknown = JSON.parse(readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8')) as unknown;
const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(registryDocument);
if (!registryResult.ok) throw new Error(JSON.stringify(registryResult.issues));
const registry = registryResult.value;

function announcement(text = 'When this ability triggers.'): Raw {
  return {
    kind: 'triggered-ability',
    abilityTextSnapshot: text,
    chosenModeKeys: [],
    targetSelections: [],
    announcedVariables: [],
    distributions: [],
    costChoices: { alternativeCost: null, additionalCosts: [] },
  };
}

function pendingRecord(controllerPlayerId: string, bucket: string, sourceObjectId: string | null = '@triggered-ability:historical-source'): Raw {
  return {
    stackPlacementBucket: bucket,
    object: {
      kind: 'triggered-ability',
      controllerPlayerId,
      sourceObjectId,
      abilityKey: 'fixture-trigger',
    },
    announcement: announcement(),
  };
}

function input(): Raw {
  return {
    pendingObjectIds: ['@triggered-ability:pending-b', '@triggered-ability:pending-a'],
    byObject: {
      '@triggered-ability:pending-a': pendingRecord('P1', 'ordinary'),
      '@triggered-ability:pending-b': pendingRecord('P2', 'ability-triggered'),
    },
  };
}

function valid(value: Raw = input()) {
  const result = validateModeNeutralCorePendingTriggerSliceV1(registry, {
    kind: 'mode-neutral-core-pending-trigger-slice-v1',
    ...value,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
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

describe('O4P-01K-F pending trigger slice', () => {
  it('preserves pendingObjectIds order, canonicalizes byObject to that order, and freezes deeply', () => {
    const source = input();
    const before = JSON.stringify(source);
    const result = valid(source);
    expect(result.pendingObjectIds).toEqual([
      '@triggered-ability:pending-b',
      '@triggered-ability:pending-a',
    ]);
    expect(Object.keys(result.byObject)).toEqual(result.pendingObjectIds);
    const pendingA = '@triggered-ability:pending-a' as CoreObjectId;
    expect(result.byObject[pendingA].object.sourceObjectId).toBe('@triggered-ability:historical-source');
    expect(JSON.stringify(source)).toBe(before);
    deepFrozen(result);
  });

  it('rejects collisions and zone presence without mutating the input', () => {
    const collision = input();
    collision.pendingObjectIds = ['@triggered-ability:fixture-trigger'];
    collision.byObject = { '@triggered-ability:fixture-trigger': pendingRecord('P2', 'ordinary') };
    const before = JSON.stringify(collision);
    const result = validateModeNeutralCorePendingTriggerSliceV1(registry, {
      kind: 'mode-neutral-core-pending-trigger-slice-v1',
      ...collision,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('PENDING_TRIGGER_COLLISION');
    expect(JSON.stringify(collision)).toBe(before);
  });

  it('fails closed for accessors, symbols, sparse arrays, and exact key mismatches', () => {
    const hostile = input();
    let reads = 0;
    Object.defineProperty(hostile, 'pendingObjectIds', {
      enumerable: true,
      get: () => { reads += 1; return []; },
    });
    Object.defineProperty(hostile, 'kind', {
      enumerable: true,
      value: 'mode-neutral-core-pending-trigger-slice-v1',
    });
    expect(validateModeNeutralCorePendingTriggerSliceV1(registry, hostile).ok).toBe(false);
    expect(reads).toBe(0);

    const sparse: unknown[] = [];
    sparse.length = 1;
    const sparseResult = validateModeNeutralCorePendingTriggerSliceV1(registry, {
      kind: 'mode-neutral-core-pending-trigger-slice-v1',
      pendingObjectIds: sparse,
      byObject: {},
    });
    expect(sparseResult.ok).toBe(false);
    if (!sparseResult.ok) expect(sparseResult.issues.map((issue) => issue.code)).toContain('INVALID_ARRAY');

    const symbolInput = input() as Raw & Record<symbol, unknown>;
    symbolInput[Symbol('extra')] = true;
    const symbolResult = validateModeNeutralCorePendingTriggerSliceV1(registry, {
      kind: 'mode-neutral-core-pending-trigger-slice-v1',
      ...symbolInput,
    });
    expect(symbolResult.ok).toBe(false);

    const mismatch = input();
    mismatch.byObject = { '@triggered-ability:pending-a': pendingRecord('P1', 'ordinary') };
    const mismatchResult = validateModeNeutralCorePendingTriggerSliceV1(registry, {
      kind: 'mode-neutral-core-pending-trigger-slice-v1',
      ...mismatch,
    });
    expect(mismatchResult.ok).toBe(false);
    if (!mismatchResult.ok) expect(mismatchResult.issues.map((issue) => issue.code)).toContain('PENDING_TRIGGER_SET_MISMATCH');
  });

  it('appends records atomically in caller order and rejects duplicate IDs', () => {
    const initial = valid({ pendingObjectIds: [], byObject: {} });
    const addition: CorePendingTriggeredAbilityAppendInputV1 = {
      objectId: '@triggered-ability:pending-c' as CoreObjectId,
      stackPlacementBucket: 'ordinary',
      object: {
        kind: 'triggered-ability',
        controllerPlayerId: 'P3' as CorePlayerId,
        sourceObjectId: '@triggered-ability:historical-source' as CoreObjectId,
        abilityKey: 'fixture-trigger',
      },
      announcement: {
        kind: 'triggered-ability',
        abilityTextSnapshot: 'When this ability triggers.',
        chosenModeKeys: [],
        targetSelections: [],
        announcedVariables: [],
        distributions: [],
        costChoices: { alternativeCost: null, additionalCosts: [] },
      },
    };
    const next = appendCorePendingTriggeredAbilitiesV1(registry, initial, [addition]);
    expect(next.pendingObjectIds).toEqual(['@triggered-ability:pending-c']);
    const pendingC = '@triggered-ability:pending-c' as CoreObjectId;
    expect(next.byObject[pendingC].object.controllerPlayerId).toBe('P3');
    expect(() => appendCorePendingTriggeredAbilitiesV1(registry, next, [addition])).toThrow(CorePendingTriggerOperationErrorV1);
  });
});
