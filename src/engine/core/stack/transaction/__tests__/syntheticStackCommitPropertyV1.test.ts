import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../../ids';
import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../stackAnnouncementValidationV1';
import {
  commitCoreSyntheticStackObjectV1,
  type CoreSyntheticStackCommitInputV1,
} from '../syntheticStackCommitV1';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import type { CoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';

type RawRecord = Record<string, unknown>;

function readJson(path: string): RawRecord {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as RawRecord;
}

function bundle(): CoreStackTransactionBundleV1 {
  const registry = validateModeNeutralCoreObjectRegistrySliceV2(
    readJson('../../../object/fixtures/object-registry-v2.json'),
  );
  if (!registry.ok) throw new Error(JSON.stringify(registry.issues));
  const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as RawRecord;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);
  const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(registry.value, runtime);
  if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.issues));
  const announcements = readJson('../../fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const announcementResult = validateModeNeutralCoreStackAnnouncementSliceV1(registry.value, announcements);
  if (!announcementResult.ok) throw new Error(JSON.stringify(announcementResult.issues));
  const result = validateCoreStackTransactionBundleV1({
    objectRegistry: registry.value,
    objectRuntime: runtimeResult.value,
    stackAnnouncements: announcementResult.value,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function inputFor(seed: string, source: CoreObjectId): CoreSyntheticStackCommitInputV1 {
  return {
    objectId: `@triggered-ability:${seed}` as CoreObjectId,
    object: {
      kind: 'triggered-ability',
      controllerPlayerId: 'P1' as CorePlayerId,
      sourceObjectId: source,
      abilityKey: 'ability.property',
    },
    announcement: {
      kind: 'triggered-ability',
      abilityTextSnapshot: 'A synthetic trigger.',
      chosenModeKeys: [],
      targetSelections: [],
      announcedVariables: [],
      distributions: [],
      costChoices: { alternativeCost: null, additionalCosts: [] },
    },
  };
}

describe('O4P-01J-G synthetic stack commit deterministic properties', () => {
  it('is deterministic across valid seed and historical-reference permutations', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,12}$/),
      fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,12}$/),
      (seed, sourceSeed) => {
        const firstBundle = bundle();
        const secondBundle = bundle();
        const first = commitCoreSyntheticStackObjectV1(
          firstBundle,
          inputFor(seed, `@triggered-ability:${sourceSeed}` as CoreObjectId),
        );
        const second = commitCoreSyntheticStackObjectV1(
          secondBundle,
          inputFor(seed, `@triggered-ability:${sourceSeed}` as CoreObjectId),
        );
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      },
    ), { numRuns: 2 });
  });

  it('preserves canonical JSON after a successful round trip', () => {
    const original = bundle();
    const committed = commitCoreSyntheticStackObjectV1(
      original,
      inputFor('round-trip', '@triggered-ability:historical' as CoreObjectId),
    );
    const decoded = JSON.parse(JSON.stringify(committed.bundle)) as unknown;
    const revalidated = validateCoreStackTransactionBundleV1(decoded);
    expect(revalidated.ok).toBe(true);
    if (revalidated.ok) expect(JSON.stringify(revalidated.value)).toBe(JSON.stringify(committed.bundle));
  });
});
