import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  completeCoreResolutionAfterRemovalV1,
  createCoreStackTransactionBundleV1,
  passCorePriorityV1,
} from '../../index';
import type { CorePlayerId } from '../../ids';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { validateCoreTurnPriorityBundleV1 } from '../turnPriorityBundleValidationV1';

type Raw = Record<string, unknown>;

type ValidInput = Readonly<{
  readonly stackBundle: ReturnType<typeof createCoreStackTransactionBundleV1>;
  readonly pendingTriggers: ReturnType<typeof createModeNeutralCorePendingTriggerSliceV1>;
  readonly lifecycle: ReturnType<typeof createModeNeutralCoreTurnLifecycleSliceV1>;
}>;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function validInput(): ValidInput {
  const runtime = fixture('../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  (runtime.byObject as Raw)['@token:fixture-token:0'] = structuredClone((runtime.byObject as Raw)['PC4:1']);
  const announcements = fixture('../../stack/fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const stackBundle = createCoreStackTransactionBundleV1({
    objectRegistry: fixture('../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  } as unknown as Parameters<typeof createCoreStackTransactionBundleV1>[0]);
  const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(stackBundle.objectRegistry, {
    pendingObjectIds: [],
    byObject: {},
  });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 0,
    position: { phase: 'precombat-main', step: null },
    window: { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2' as never, grantPriorityIfStable: true },
  });
  return { lifecycle, pendingTriggers, stackBundle };
}

describe('validateCoreTurnPriorityBundleV1', () => {
  it('returns exact lane errors in Stack, Pending, Lifecycle order', () => {
    const input = validInput();
    const result = validateCoreTurnPriorityBundleV1({
      stackBundle: {},
      pendingTriggers: {},
      lifecycle: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((current) => current.code);
      expect(codes[0]).toBe('INVALID_STACK_BUNDLE');
      expect(codes).toContain('INVALID_PENDING_TRIGGER_SLICE');
      expect(codes).toContain('INVALID_LIFECYCLE_SLICE');
      expect(codes.indexOf('INVALID_STACK_BUNDLE')).toBeLessThan(codes.indexOf('INVALID_PENDING_TRIGGER_SLICE'));
      expect(codes.indexOf('INVALID_PENDING_TRIGGER_SLICE')).toBeLessThan(codes.indexOf('INVALID_LIFECYCLE_SLICE'));
    }
    expect(input.stackBundle).toBeDefined();
  });

  it('rejects accessors, symbols, arrays, unknown fields, and preserves hostile input', () => {
    const input = validInput() as Raw & Record<symbol, unknown>;
    const before = JSON.stringify(input);
    let reads = 0;
    Object.defineProperty(input, 'lifecycle', {
      enumerable: true,
      get: () => { reads += 1; return {}; },
    });
    input[Symbol('extra')] = true;
    const result = validateCoreTurnPriorityBundleV1(input);
    expect(result.ok).toBe(false);
    expect(reads).toBe(0);
    expect(JSON.stringify({ stackBundle: input.stackBundle, pendingTriggers: input.pendingTriggers })).toContain('objectRegistry');
    expect(before).toContain('stackBundle');
  });

  it('returns a distinct deeply frozen canonical success value', () => {
    const input = validInput();
    const result = validateCoreTurnPriorityBundleV1(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(input);
      expect(Object.keys(result.value)).toEqual(['stackBundle', 'pendingTriggers', 'lifecycle']);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.pendingTriggers)).toBe(true);
      expect(Object.isFrozen(result.value.lifecycle)).toBe(true);
    }
  });

  it('rejects progression-ready windows while pending triggers remain', () => {
    const input = validInput();
    const pendingObjectId = '@triggered-ability:validation-pending';
    const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(input.stackBundle.objectRegistry, {
      pendingObjectIds: [pendingObjectId],
      byObject: {
        [pendingObjectId]: {
          stackPlacementBucket: 'ordinary',
          object: { kind: 'triggered-ability', controllerPlayerId: 'P2', sourceObjectId: null, abilityKey: 'validation-pending' },
          announcement: {
            kind: 'triggered-ability', abilityTextSnapshot: 'When this triggers.', chosenModeKeys: [],
            targetSelections: [], announcedVariables: [], distributions: [],
            costChoices: { alternativeCost: null, additionalCosts: [] },
          },
        },
      },
    } as never);
    const cases = [
      { position: { phase: 'precombat-main', step: null }, window: { kind: 'position-advance-ready' } },
      { position: { phase: 'ending', step: 'cleanup' }, window: { kind: 'cleanup-repeat-ready' } },
      { position: { phase: 'ending', step: 'cleanup' }, window: { kind: 'turn-advance-ready' } },
    ] as const;
    for (const current of cases) {
      const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
        turnNumber: 1,
        positionSequence: 0,
        position: current.position,
        window: current.window,
      });
      const result = validateCoreTurnPriorityBundleV1({
        stackBundle: input.stackBundle,
        pendingTriggers,
        lifecycle,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '/pendingTriggers/pendingObjectIds'
          || issue.path === '/lifecycle/window')).toBe(true);
      }
    }
  });

  it('rejects pending triggers at priority and resolution-ready public boundaries', () => {
    const input = validInput();
    const pendingObjectId = '@triggered-ability:boundary-pending';
    const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(input.stackBundle.objectRegistry, {
      pendingObjectIds: [pendingObjectId],
      byObject: {
        [pendingObjectId]: {
          stackPlacementBucket: 'ordinary',
          object: { kind: 'triggered-ability', controllerPlayerId: 'P2', sourceObjectId: null, abilityKey: 'boundary-pending' },
          announcement: {
            kind: 'triggered-ability', abilityTextSnapshot: 'When this triggers.', chosenModeKeys: [],
            targetSelections: [], announcedVariables: [], distributions: [],
            costChoices: { alternativeCost: null, additionalCosts: [] },
          },
        },
      },
    } as never);
    const resolutionObjectId = input.stackBundle.objectRegistry.zones.shared.stack.at(-1);
    if (resolutionObjectId === undefined) throw new Error('Fixture must contain a stack object');
    const cases = [
      {
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
        boundary: (bundle: Raw) => passCorePriorityV1(bundle as never, 'P2' as never),
      },
      {
        lifecycle: createModeNeutralCoreTurnLifecycleSliceV1({
          turnNumber: 1,
          positionSequence: 0,
          position: { phase: 'precombat-main', step: null },
          window: { kind: 'resolution-ready', objectId: resolutionObjectId },
        }),
        boundary: (bundle: Raw) => completeCoreResolutionAfterRemovalV1(bundle as never, undefined as never),
      },
    ] as const;

    for (const current of cases) {
      const invalid = {
        stackBundle: input.stackBundle,
        pendingTriggers,
        lifecycle: current.lifecycle,
      } satisfies Raw;
      const before = JSON.stringify(invalid);
      const result = validateCoreTurnPriorityBundleV1(invalid);
      expect(result).toEqual({
        ok: false,
        issues: [{
          code: 'CROSS_SLICE_MISMATCH',
          path: '/pendingTriggers/pendingObjectIds',
          message: 'This window requires no pending triggers',
        }],
      });
      expect(() => current.boundary(invalid)).toThrowError(
        expect.objectContaining({ code: 'INVALID_TURN_PRIORITY_BUNDLE' }),
      );
      expect(JSON.stringify(invalid)).toBe(before);
    }
  });

});
