import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  validateModeNeutralCoreCardRuntimeSliceV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../../index';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../index';

import { fixtureRecord, isRecord } from '../../__tests__/testHelpers';

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a record`);
  return value;
}

function identityState(): ModeNeutralCoreIdentityZoneSliceV1 {
  const result = validateModeNeutralCoreIdentityZoneSliceV1(fixtureRecord());
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function runtimeFixture(): unknown {
  const path = resolve(process.cwd(), 'src/engine/core/fixtures/card-runtime-slice-v1.json');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function permutedRuntime(input: unknown, order: readonly string[]): unknown {
  const raw = structuredClone(input);
  const root = record(raw, 'runtime root');
  const source = record(root.byObject, 'runtime.byObject');
  const byObject: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const objectId of order) byObject[objectId] = source[objectId];
  root.byObject = byObject;
  return root;
}

describe('Core composite runtime canonicalization properties', () => {
  it('accepts every generated ObjectId permutation and emits one canonical JSON form', () => {
    const identity = identityState();
    const fixture = runtimeFixture();
    const objectIds = Object.keys(identity.cardObjects);
    const canonicalJson = JSON.stringify(fixture);

    fc.assert(
      fc.property(
        fc.shuffledSubarray(objectIds, {
          minLength: objectIds.length,
          maxLength: objectIds.length,
        }),
        (order) => {
          const result = validateModeNeutralCoreCardRuntimeSliceV1(
            identity,
            permutedRuntime(fixture, order),
          );
          expect(result.ok).toBe(true);
          if (!result.ok) throw new Error(JSON.stringify(result.issues));
          expect(Object.keys(result.value.byObject)).toEqual(objectIds.slice().sort());
          expect(JSON.stringify(result.value)).toBe(canonicalJson);
          expect(Object.isFrozen(result.value)).toBe(true);
          expect(Object.isFrozen(result.value.byObject)).toBe(true);
        },
      ),
      { numRuns: 32, seed: 4101 },
    );
  });
});
