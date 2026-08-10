import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CoreObjectId } from '../../../ids';
import type { CoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionValidationV1';
import { retargetCoreStackObjectV1 } from '../stackRetargetV1';

type RawRecord = Record<string, unknown>;
const STACK_CARD = 'PC5:1' as CoreObjectId;

function bundle(): CoreStackTransactionBundleV1 {
  const runtime = JSON.parse(
    readFileSync(new URL('../../../fixtures/card-runtime-slice-v1.json', import.meta.url), 'utf8'),
  ) as RawRecord;
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as RawRecord;
  runtimeByObject['@token:fixture-token:0'] = structuredClone(runtimeByObject['PC4:1']);
  const announcements = JSON.parse(
    readFileSync(new URL('../../fixtures/stack-announcement-v1.json', import.meta.url), 'utf8'),
  ) as RawRecord;
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const registry = JSON.parse(
    readFileSync(
      new URL('../../../object/fixtures/object-registry-v2.json', import.meta.url),
      'utf8',
    ),
  ) as RawRecord;
  const result = validateCoreStackTransactionBundleV1({
    objectRegistry: registry,
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe('retargetCoreStackObjectV1 properties', () => {
  it('preserves every target slot and changes only selected references for arbitrary subsets', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }), (selected) => {
        const source = bundle();
        const before = JSON.stringify(source);
        const record = source.stackAnnouncements.byObject[STACK_CARD];
        const replacements = record.targetSelections.flatMap((selection, index) =>
          selected[index]
            ? [
                {
                  selectionId: selection.selectionId,
                  target:
                    index === 0
                      ? {
                          kind: 'object' as const,
                          objectId: '@spell-copy:historical-property-target' as CoreObjectId,
                        }
                      : { kind: 'player' as const, playerId: 'P4' },
                },
              ]
            : [],
        );
        const result = retargetCoreStackObjectV1(source, { objectId: STACK_CARD, replacements });
        const next = result.bundle.stackAnnouncements.byObject[STACK_CARD];

        expect(next.targetSelections).toHaveLength(record.targetSelections.length);
        next.targetSelections.forEach((selection, index) => {
          expect(selection.selectionId).toBe(record.targetSelections[index].selectionId);
          expect(selection.groupKey).toBe(record.targetSelections[index].groupKey);
          if (!selected[index])
            expect(selection.target).toEqual(record.targetSelections[index].target);
        });
        expect(next.chosenModeKeys).toEqual(record.chosenModeKeys);
        expect(next.announcedVariables).toEqual(record.announcedVariables);
        expect(next.distributions).toEqual(record.distributions);
        expect(next.costChoices).toEqual(record.costChoices);
        expect(result.bundle.objectRegistry.zones.shared.stack).toEqual(
          source.objectRegistry.zones.shared.stack,
        );
        expect(JSON.stringify(source)).toBe(before);
      }),
      { numRuns: 20 },
    );
  });
});
