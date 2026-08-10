import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createCoreStackTransactionBundleV1 } from '../../index';
import type { CorePlayerId } from '../../ids';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import { createCoreTurnPriorityBundleV1 } from '../turnPriorityBundleV1';
import { validateCoreTurnPriorityBundleV1 } from '../turnPriorityBundleValidationV1';

type Raw = Record<string, unknown>;

function fixture(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function makeBundle() {
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
  const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(stackBundle.objectRegistry, { pendingObjectIds: [], byObject: {} });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: 0,
    position: { phase: 'precombat-main', step: null },
    window: { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2' as CorePlayerId, grantPriorityIfStable: true },
  });
  return { stackBundle, pendingTriggers, lifecycle };
}

describe('CoreTurnPriorityBundleV1 properties', () => {
  it('preserves every valid JSON round trip and canonical field order', () => {
    const input = makeBundle();
    for (const permutation of [
      { lifecycle: input.lifecycle, pendingTriggers: input.pendingTriggers, stackBundle: input.stackBundle },
      { pendingTriggers: input.pendingTriggers, stackBundle: input.stackBundle, lifecycle: input.lifecycle },
      input,
    ]) {
      const created = createCoreTurnPriorityBundleV1(permutation);
      const validated = validateCoreTurnPriorityBundleV1(JSON.parse(JSON.stringify(created)));
      expect(validated.ok).toBe(true);
      if (validated.ok) {
        expect(Object.keys(validated.value)).toEqual(['stackBundle', 'pendingTriggers', 'lifecycle']);
        expect(JSON.stringify(validated.value)).toBe(JSON.stringify(created));
      }
    }
  });

  it('never mutates a fresh candidate across repeated validation', () => {
    const input = makeBundle();
    const before = JSON.stringify(input);
    for (let index = 0; index < 8; index += 1) {
      expect(validateCoreTurnPriorityBundleV1(input).ok).toBe(true);
      expect(JSON.stringify(input)).toBe(before);
    }
  });
});
