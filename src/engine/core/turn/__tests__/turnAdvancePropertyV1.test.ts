import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRuntimeV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../index';
import {
  advanceCoreTurnPositionV1,
  type CoreTurnAdvanceBundleV1,
} from '../turnAdvanceV1';
import type { CoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import type { CoreTurnPositionV1 } from '../turnPositionV1';

type Raw = Record<string, unknown>;

function raw(url: URL): Raw { return JSON.parse(readFileSync(url, 'utf8')) as Raw; }

function baseBundle(position: CoreTurnLifecycleSliceV1['position']): CoreTurnAdvanceBundleV1 {
  const registryRaw = raw(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url));
  const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(registryRaw);
  if (!registryResult.ok) throw new Error(JSON.stringify(registryResult.issues));
  const registry = registryResult.value;
  const runtimeRaw = raw(new URL('../../fixtures/card-runtime-slice-v1.json', import.meta.url));
  runtimeRaw.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const byObject = runtimeRaw.byObject as Raw;
  byObject['@token:fixture-token:0'] = structuredClone(byObject['PC4:1']);
  const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(registry, runtimeRaw);
  if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.issues));
  const announcementsResult = validateModeNeutralCoreStackAnnouncementSliceV1(registry, {
    ...raw(new URL('../../stack/fixtures/stack-announcement-v1.json', import.meta.url)),
    kind: 'mode-neutral-core-stack-announcement-slice-v1',
  });
  if (!announcementsResult.ok) throw new Error(JSON.stringify(announcementsResult.issues));
  const emptyRegistry = {
    ...registry,
    zones: { ...registry.zones, shared: { ...registry.zones.shared, stack: [] } },
  };
  return {
    stackBundle: { objectRegistry: emptyRegistry, objectRuntime: runtimeResult.value, stackAnnouncements: announcementsResult.value },
    pendingTriggers: { pendingObjectIds: [] },
    lifecycle: {
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1', turnNumber: 1, positionSequence: 0,
      position, window: { kind: 'position-advance-ready' },
    },
  };
}

type Transition = readonly [CoreTurnPositionV1, CoreTurnPositionV1];

const transitionArb = fc.constantFrom<Transition>(
  [{ phase: 'beginning', step: 'upkeep' }, { phase: 'beginning', step: 'draw' }],
  [{ phase: 'beginning', step: 'draw' }, { phase: 'precombat-main', step: null }],
  [{ phase: 'precombat-main', step: null }, { phase: 'combat', step: 'beginning-of-combat' }],
  [{ phase: 'combat', step: 'beginning-of-combat' }, { phase: 'combat', step: 'declare-attackers' }],
  [{ phase: 'combat', step: 'declare-attackers' }, { phase: 'combat', step: 'end-of-combat' }],
  [{ phase: 'combat', step: 'declare-blockers' }, { phase: 'combat', step: 'combat-damage' }],
  [{ phase: 'combat', step: 'combat-damage' }, { phase: 'combat', step: 'combat-damage' }],
  [{ phase: 'combat', step: 'combat-damage' }, { phase: 'combat', step: 'end-of-combat' }],
  [{ phase: 'combat', step: 'end-of-combat' }, { phase: 'postcombat-main', step: null }],
  [{ phase: 'postcombat-main', step: null }, { phase: 'ending', step: 'end' }],
  [{ phase: 'ending', step: 'end' }, { phase: 'ending', step: 'cleanup' }],
);

describe('turn advance property V1', () => {
  it('increments exactly once for every allowed transition and leaves input unchanged', () => {
    fc.assert(fc.property(transitionArb, ([from, to]) => {
      const input = baseBundle(from);
      const before = JSON.stringify(input);
      const output = advanceCoreTurnPositionV1(input, { nextPosition: to });
      expect(output.lifecycle.positionSequence).toBe(1);
      expect(JSON.stringify(input)).toBe(before);
      expect(Object.isFrozen(output)).toBe(true);
      expect(Object.isFrozen(output.lifecycle)).toBe(true);
    }), { numRuns: 20 });
  });
});
