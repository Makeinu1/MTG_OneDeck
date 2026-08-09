import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createModeNeutralCoreCardRuntimeSliceV1,
  validateModeNeutralCoreCardRuntimeSliceV1,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../../src/engine/core';
import type {
  CreateModeNeutralCoreCardRuntimeSliceV1Input,
  ModeNeutralCoreCardRuntimeSliceV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from '../../src/engine/core';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const identityFixturePath = resolve(repositoryRoot, 'src/engine/core/fixtures/identity-zone-slice-v1.json');
const runtimeFixturePath = resolve(repositoryRoot, 'src/engine/core/fixtures/card-runtime-slice-v1.json');

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a record`);
  }
  return value as Record<string, unknown>;
}

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every((child) => isDeepFrozen(child));
}

function cloneJson(value: unknown): Record<string, unknown> {
  return recordOf(JSON.parse(JSON.stringify(value)) as unknown, 'cloned JSON');
}

function runtimeInputOf(value: ModeNeutralCoreCardRuntimeSliceV1): CreateModeNeutralCoreCardRuntimeSliceV1Input {
  return { byObject: value.byObject };
}

function permutedRuntimeFixture(parsed: unknown): unknown {
  const raw = cloneJson(parsed);
  const source = recordOf(raw.byObject, 'runtime.byObject');
  const byObject: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [objectId, value] of Object.entries(source).reverse()) byObject[objectId] = value;
  raw.byObject = byObject;
  return raw;
}

const identityParsed = JSON.parse(readFileSync(identityFixturePath, 'utf8')) as unknown;
const runtimeParsed = JSON.parse(readFileSync(runtimeFixturePath, 'utf8')) as unknown;
const identityValidation = validateModeNeutralCoreIdentityZoneSliceV1(identityParsed);
assert.equal(identityValidation.ok, true, JSON.stringify(identityValidation));
if (!identityValidation.ok) throw new Error('identity fixture validation failed');
const identityState: ModeNeutralCoreIdentityZoneSliceV1 = identityValidation.value;

const runtimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, runtimeParsed);
assert.equal(runtimeValidation.ok, true, JSON.stringify(runtimeValidation));
if (!runtimeValidation.ok) throw new Error('runtime fixture validation failed');
const runtimeState: ModeNeutralCoreCardRuntimeSliceV1 = runtimeValidation.value;

assert.equal(runtimeState.kind, 'mode-neutral-core-card-runtime-slice-v1');
assert.deepEqual(Object.keys(runtimeState.byObject), Object.keys(identityState.cardObjects).sort());
assert.equal(isDeepFrozen(runtimeState), true);
assert.equal(JSON.stringify(runtimeState), JSON.stringify(runtimeParsed));

const generated = createModeNeutralCoreCardRuntimeSliceV1(identityState, runtimeInputOf(runtimeState));
assert.equal(JSON.stringify(generated), JSON.stringify(runtimeState));
assert.equal(isDeepFrozen(generated), true);

const roundTrip = validateModeNeutralCoreCardRuntimeSliceV1(
  identityState,
  JSON.parse(JSON.stringify(generated)) as unknown,
);
assert.equal(roundTrip.ok, true, JSON.stringify(roundTrip));
if (!roundTrip.ok) throw new Error('runtime round-trip validation failed');
assert.equal(JSON.stringify(roundTrip.value), JSON.stringify(runtimeState));

const permuted = validateModeNeutralCoreCardRuntimeSliceV1(
  identityState,
  permutedRuntimeFixture(runtimeParsed),
);
assert.equal(permuted.ok, true, JSON.stringify(permuted));
if (!permuted.ok) throw new Error('permuted runtime validation failed');
assert.equal(JSON.stringify(permuted.value), JSON.stringify(runtimeState));

const invalidSource = cloneJson(runtimeParsed);
const invalidSourceEntry = recordOf(recordOf(invalidSource.byObject, 'byObject')['PC5:1'], 'PC5:1');
recordOf(invalidSourceEntry.attachment, 'PC5:1.attachment').attachedTo = {
  kind: 'object',
  objectId: 'PC4:1',
};
const sourceValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, invalidSource);
assert.equal(sourceValidation.ok, false, JSON.stringify(sourceValidation));
if (sourceValidation.ok) throw new Error('non-battlefield attachment was accepted');
assert.equal(sourceValidation.issues.some((issue) =>
  issue.code === 'ATTACHMENT_SOURCE_NOT_ON_BATTLEFIELD'
  && issue.path === '/byObject/PC5:1/attachment/attachedTo'), true);

const invalidFace = cloneJson(runtimeParsed);
recordOf(recordOf(invalidFace.byObject, 'byObject')['PC2:0'], 'PC2:0');
recordOf(recordOf(invalidFace.byObject, 'byObject')['PC2:0'], 'PC2:0').orientation = {
  faceIndex: 1,
  faceDown: false,
  tapped: false,
  flipped: false,
  phasedOut: false,
};
const faceValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, invalidFace);
assert.equal(faceValidation.ok, false, JSON.stringify(faceValidation));
if (faceValidation.ok) throw new Error('non-zero faceIndex outside battlefield/stack was accepted');
assert.equal(faceValidation.issues.some((issue) =>
  issue.code === 'FACE_INDEX_NOT_ZERO_OUTSIDE_BATTLEFIELD_OR_STACK'
  && issue.path === '/byObject/PC2:0/orientation/faceIndex'), true);

console.log(
  `slice=mode-neutral-core-card-runtime-slice-v1`
  + ` objects=${Object.keys(runtimeState.byObject).length}`
  + ' validation=ok roundTrip=ok canonicalValidation=ok frozen=true',
);
