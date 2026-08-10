import { readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import { removeCoreStackObjectV1 } from '../stackRemovalV1';

type Raw = Record<string, unknown>;

function readJson(path: string): Raw {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Raw;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bundle() {
  const runtime = readJson('../../../fixtures/card-runtime-slice-v1.json');
  runtime.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const runtimeByObject = runtime.byObject as Raw;
  runtimeByObject['@token:fixture-token:0'] = clone(runtimeByObject['PC4:1']);
  const announcements = readJson('../../fixtures/stack-announcement-v1.json');
  announcements.kind = 'mode-neutral-core-stack-announcement-slice-v1';
  const result = validateCoreStackTransactionBundleV1({
    objectRegistry: readJson('../../../object/fixtures/object-registry-v2.json'),
    objectRuntime: runtime,
    stackAnnouncements: announcements,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe('removeCoreStackObjectV1 deterministic properties', () => {
  it('produces identical canonical bytes for every non-stack destination', () => {
    const destinations = [
      { kind: 'owner-library', placement: { kind: 'top' } },
      { kind: 'owner-library', placement: { kind: 'bottom' } },
      { kind: 'owner-hand' },
      { kind: 'owner-graveyard' },
      { kind: 'battlefield', baseControllerPlayerId: 'P4' },
      { kind: 'exile' },
      { kind: 'command' },
    ] as const;
    fc.assert(fc.property(fc.constantFrom(...destinations), (destination) => {
      const first = bundle();
      const second = bundle();
      const operation = { kind: 'card-to-zone', objectId: 'PC5:1', destination };
      const firstResult = removeCoreStackObjectV1(first, operation);
      const secondResult = removeCoreStackObjectV1(second, operation);
      expect(JSON.stringify(firstResult)).toBe(JSON.stringify(secondResult));
      expect(firstResult.nextObjectId).toBe('PC5:2');
    }));
  }, 60_000);

  it('does not mutate a valid input bundle or operation', () => {
    const input = { kind: 'card-to-zone', objectId: 'PC5:1', destination: { kind: 'exile' } };
    const beforeInput = JSON.stringify(input);
    const source = bundle();
    const beforeSource = JSON.stringify(source);
    removeCoreStackObjectV1(source, input);
    expect(JSON.stringify(input)).toBe(beforeInput);
    expect(JSON.stringify(source)).toBe(beforeSource);
  });
});
