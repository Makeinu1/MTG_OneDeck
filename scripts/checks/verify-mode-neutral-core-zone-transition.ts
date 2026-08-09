import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyCoreCardZoneTransitionV1,
  CoreCardZoneTransitionErrorV1,
} from '../../src/engine/core/transition/cardZoneTransition';
import { locateCoreObjectV1 } from '../../src/engine/core/identityZoneState';
import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../../src/engine/core/identityZoneValidation';
import { isDefaultCoreCardRuntimeAfterZoneChangeV1, nextCoreCardObjectIdV1 } from '../../src/engine/core/transition/cardReincarnation';
import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../../src/engine/core/runtime/cardRuntimeValidation';
import { validateCoreCardZoneDestinationV1 } from '../../src/engine/core/transition/zoneDestination';
import { isCanonicalCoreObjectIdV1 } from '../../src/engine/core/runtime/attachment';
import { isCoreBaseId } from '../../src/engine/core/ids';
import type { CoreObjectId, CorePlayerId } from '../../src/engine/core/ids';
import type { CoreCardZoneDestinationV1 } from '../../src/engine/core/transition/zoneDestination';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../src/engine/core/identityZoneState';
import type { ModeNeutralCoreCardRuntimeSliceV1 } from '../../src/engine/core/runtime/cardRuntimeState';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(repositoryRoot, 'src/engine/core/fixtures/card-zone-transition-slice-v1.json');
const fixtureDirectory = dirname(fixturePath);
const allowedFixtureNames = new Set(['identity-zone-slice-v1.json', 'card-runtime-slice-v1.json']);
const requiredCaseIds = [
  'owner-library-top', 'owner-library-bottom', 'owner-library-index',
  'owner-hand', 'owner-graveyard', 'battlefield-controller', 'stack-controller',
  'exile', 'command',
] as const;
const requiredDestinationKinds = ['owner-library', 'owner-hand', 'owner-graveyard', 'battlefield', 'stack', 'exile', 'command'] as const;
const requiredLibraryPlacements = ['top', 'bottom', 'index'] as const;

type RecordValue = Record<string, unknown>;
type TransitionCase = {
  readonly id: string;
  readonly objectId: string;
  readonly destination: CoreCardZoneDestinationV1;
  readonly expectedObjectId: string;
  readonly expectedZone: string;
  readonly expectedOwnerPlayerId: string;
  readonly expectedControllerPlayerId: string | null;
  readonly expectedLibrary?: readonly string[];
};
type InvalidCase = { readonly id: string; readonly objectId: string; readonly destination: unknown };
type FixtureMetadata = {
  readonly kind: string;
  readonly identityFixture: string;
  readonly identitySha256: string;
  readonly runtimeFixture: string;
  readonly runtimeSha256: string;
  readonly placementSeed: PlacementSeed;
  readonly cases: readonly TransitionCase[];
  readonly invalidCases: readonly InvalidCase[];
};
type PlacementSeed = {
  readonly kind: string;
  readonly objectId: CoreObjectId;
  readonly ownerPlayerId: CorePlayerId;
  readonly source: { readonly scope: 'shared'; readonly zone: 'battlefield'; readonly index: number };
  readonly destination: { readonly scope: 'player-scoped'; readonly zone: 'library'; readonly index: number };
  readonly runtime: RecordValue;
};
type FixtureBundle = {
  readonly metadata: FixtureMetadata;
  readonly identityRaw: unknown;
  readonly runtimeRaw: unknown;
  readonly identity: ModeNeutralCoreIdentityZoneSliceV1;
  readonly runtime: ModeNeutralCoreCardRuntimeSliceV1;
  readonly seededIdentityRaw: unknown;
  readonly seededRuntimeRaw: unknown;
  readonly seededIdentity: ModeNeutralCoreIdentityZoneSliceV1;
  readonly seededRuntime: ModeNeutralCoreCardRuntimeSliceV1;
};

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be plain`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, expected: readonly string[], label: string): void {
  assert.deepEqual(Reflect.ownKeys(value), expected, `${label} shape mismatch`);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.equal(descriptor?.enumerable, true, `${label}.${key} must be enumerable`);
    assert.equal(Object.prototype.hasOwnProperty.call(descriptor ?? {}, 'value'), true, `${label}.${key} must be data`);
  }
}

function declaredFixturePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || basename(value) !== value || value.includes('/') || value.includes('\\')) {
    throw new Error(`${label} must be a fixture basename`);
  }
  if (!allowedFixtureNames.has(value)) throw new Error(`${label} references an unknown fixture`);
  const resolved = resolve(fixtureDirectory, value);
  if (dirname(resolved) !== fixtureDirectory) throw new Error(`${label} escapes the fixture directory`);
  return resolved;
}

function readJsonWithSha256(path: string, expectedSha256: unknown, label: string): unknown {
  if (typeof expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSha256)) throw new Error(`${label} SHA-256 metadata is invalid`);
  const bytes = readFileSync(path);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error(`${label} SHA-256 mismatch`);
  return JSON.parse(bytes.toString('utf8')) as unknown;
}

function seedInputs(identityRaw: unknown, runtimeRaw: unknown, seed: PlacementSeed): { readonly identity: unknown; readonly runtime: unknown } {
  const identity = JSON.parse(JSON.stringify(identityRaw)) as RecordValue;
  const zones = record(identity.zones, 'seeded identity.zones');
  const shared = record(zones.shared, 'seeded identity.zones.shared');
  const sourceZone = shared[seed.source.zone];
  if (!Array.isArray(sourceZone) || sourceZone[seed.source.index] !== seed.objectId) throw new Error('placement seed source does not match identity fixture');
  sourceZone.splice(seed.source.index, 1);
  const byPlayer = record(zones.byPlayer, 'seeded identity.zones.byPlayer');
  const ownerZones = record(byPlayer[seed.ownerPlayerId], 'seeded owner zones');
  const library = ownerZones[seed.destination.zone];
  if (!Array.isArray(library) || seed.destination.index > library.length) throw new Error('placement seed destination is invalid');
  library.splice(seed.destination.index, 0, seed.objectId);
  const cardObjects = record(identity.cardObjects, 'seeded identity.cardObjects');
  const seededObject = record(cardObjects[seed.objectId], 'seeded card object');
  seededObject.baseControllerPlayerId = null;

  const runtime = JSON.parse(JSON.stringify(runtimeRaw)) as RecordValue;
  const runtimeByObject = record(runtime.byObject, 'seeded runtime.byObject');
  if (!Object.prototype.hasOwnProperty.call(runtimeByObject, seed.objectId)) throw new Error('placement seed runtime object is missing');
  runtimeByObject[seed.objectId] = seed.runtime;
  return { identity, runtime };
}

function requiredString(value: unknown, label: string): string {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  return value as string;
}

function validateDestinationShape(value: unknown, label: string): CoreCardZoneDestinationV1 {
  const destination = record(value, label);
  const kind = requiredString(destination.kind, `${label}.kind`);
  if (!requiredDestinationKinds.includes(kind as typeof requiredDestinationKinds[number])) throw new Error(`${label}.kind is not one of the seven destination kinds`);
  if (kind === 'owner-library') {
    exactKeys(destination, ['kind', 'placement'], label);
    const placement = record(destination.placement, `${label}.placement`);
    const placementKind = requiredString(placement.kind, `${label}.placement.kind`);
    if (placementKind === 'top' || placementKind === 'bottom') {
      exactKeys(placement, ['kind'], `${label}.placement`);
    } else if (placementKind === 'index') {
      exactKeys(placement, ['kind', 'index'], `${label}.placement`);
      const placementIndex = placement.index;
      assert.equal(typeof placementIndex, 'number', `${label}.placement.index must be a number`);
      if (typeof placementIndex !== 'number') throw new Error(`${label}.placement.index must be a number`);
      assert.equal(Number.isSafeInteger(placementIndex) && placementIndex >= 0, true, `${label}.placement.index must be non-negative safe integer`);
    } else {
      throw new Error(`${label}.placement.kind is invalid`);
    }
  } else if (kind === 'battlefield' || kind === 'stack') {
    exactKeys(destination, ['kind', 'baseControllerPlayerId'], label);
    assert.equal(isCoreBaseId(destination.baseControllerPlayerId), true, `${label}.baseControllerPlayerId is invalid`);
  } else {
    exactKeys(destination, ['kind'], label);
  }
  const validation = validateCoreCardZoneDestinationV1(destination);
  assert.equal(validation.ok, true, `${label} failed destination validator`);
  if (!validation.ok) throw new Error(`${label} destination validation failed`);
  return validation.value;
}

function validateCase(value: unknown, index: number): TransitionCase {
  const item = record(value, `cases[${index}]`);
  const hasLibrary = Object.prototype.hasOwnProperty.call(item, 'expectedLibrary');
  const keys = hasLibrary
    ? ['id', 'objectId', 'destination', 'expectedObjectId', 'expectedZone', 'expectedOwnerPlayerId', 'expectedControllerPlayerId', 'expectedLibrary']
    : ['id', 'objectId', 'destination', 'expectedObjectId', 'expectedZone', 'expectedOwnerPlayerId', 'expectedControllerPlayerId'];
  exactKeys(item, keys, `cases[${index}]`);
  const id = requiredString(item.id, `cases[${index}].id`);
  const objectId = requiredString(item.objectId, `cases[${index}].objectId`);
  const expectedObjectId = requiredString(item.expectedObjectId, `cases[${index}].expectedObjectId`);
  const expectedZone = requiredString(item.expectedZone, `cases[${index}].expectedZone`);
  const expectedOwnerPlayerId = requiredString(item.expectedOwnerPlayerId, `cases[${index}].expectedOwnerPlayerId`);
  assert.equal(isCanonicalCoreObjectIdV1(objectId), true, `cases[${index}].objectId is invalid`);
  assert.equal(isCanonicalCoreObjectIdV1(expectedObjectId), true, `cases[${index}].expectedObjectId is invalid`);
  assert.equal(isCoreBaseId(expectedOwnerPlayerId), true, `cases[${index}].expectedOwnerPlayerId is invalid`);
  const expectedControllerPlayerId = item.expectedControllerPlayerId === null
    ? null
    : requiredString(item.expectedControllerPlayerId, `cases[${index}].expectedControllerPlayerId`);
  if (expectedControllerPlayerId !== null) assert.equal(isCoreBaseId(expectedControllerPlayerId), true, `cases[${index}].expectedControllerPlayerId is invalid`);
  const destination = validateDestinationShape(item.destination, `cases[${index}].destination`);
  const libraryRequired = destination.kind === 'owner-library';
  assert.equal(hasLibrary, libraryRequired, `${id} expectedLibrary presence does not match destination`);
  let expectedLibrary: readonly string[] | undefined;
  if (hasLibrary) {
    assert.equal(Array.isArray(item.expectedLibrary), true, `${id}.expectedLibrary must be an array`);
    expectedLibrary = (item.expectedLibrary as unknown[]).map((entry, entryIndex) => {
      const entryId = requiredString(entry, `${id}.expectedLibrary[${entryIndex}]`);
      assert.equal(isCanonicalCoreObjectIdV1(entryId), true, `${id}.expectedLibrary[${entryIndex}] is invalid`);
      return entryId;
    });
  }
  return { id, objectId, destination, expectedObjectId, expectedZone, expectedOwnerPlayerId, expectedControllerPlayerId, ...(expectedLibrary === undefined ? {} : { expectedLibrary }) };
}

function validateInvalidCase(value: unknown, index: number): InvalidCase {
  const item = record(value, `invalidCases[${index}]`);
  exactKeys(item, ['id', 'objectId', 'destination'], `invalidCases[${index}]`);
  return { id: requiredString(item.id, `invalidCases[${index}].id`), objectId: requiredString(item.objectId, `invalidCases[${index}].objectId`), destination: item.destination };
}

function readFixture(): FixtureBundle {
  const root = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'transition fixture');
  exactKeys(root, ['kind', 'identityFixture', 'identitySha256', 'runtimeFixture', 'runtimeSha256', 'placementSeed', 'cases', 'invalidCases'], 'transition fixture');
  assert.equal(root.kind, 'mode-neutral-core-card-zone-transition-slice-v1');
  if (!Array.isArray(root.cases) || !Array.isArray(root.invalidCases)) throw new Error('transition fixture cases must be arrays');
  const cases = root.cases.map(validateCase);
  const invalidCases = root.invalidCases.map(validateInvalidCase);
  const seed = record(root.placementSeed, 'placementSeed');
  exactKeys(seed, ['kind', 'objectId', 'ownerPlayerId', 'source', 'destination', 'runtime'], 'placementSeed');
  const source = record(seed.source, 'placementSeed.source');
  exactKeys(source, ['scope', 'zone', 'index'], 'placementSeed.source');
  const destination = record(seed.destination, 'placementSeed.destination');
  exactKeys(destination, ['scope', 'zone', 'index'], 'placementSeed.destination');
  const seedRuntime = record(seed.runtime, 'placementSeed.runtime');
  exactKeys(seedRuntime, ['orientation', 'counterDamage', 'attachment'], 'placementSeed.runtime');
  assert.equal(seed.kind, 'mode-neutral-core-card-zone-transition-placement-seed-v1');
  assert.equal(isCanonicalCoreObjectIdV1(seed.objectId), true, 'placementSeed.objectId is invalid');
  assert.equal(isCoreBaseId(seed.ownerPlayerId), true, 'placementSeed.ownerPlayerId is invalid');
  assert.deepEqual(source, { scope: 'shared', zone: 'battlefield', index: 0 });
  assert.deepEqual(destination, { scope: 'player-scoped', zone: 'library', index: 0 });
  assert.equal(cases.length, requiredCaseIds.length, 'case count mismatch');
  const ids = cases.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, 'case IDs must be unique');
  assert.deepEqual([...ids].sort(), [...requiredCaseIds].sort(), 'case ID set is incomplete or substituted');
  assert.deepEqual([...new Set(cases.map(({ destination }) => destination.kind))].sort(), [...requiredDestinationKinds].sort(), 'destination-kind set is incomplete or substituted');
  const placements = cases.filter(({ destination }) => destination.kind === 'owner-library').map(({ destination }) => {
    if (destination.kind !== 'owner-library') throw new Error('owner-library coverage narrowing failed');
    return destination.placement.kind;
  });
  assert.deepEqual([...new Set(placements)].sort(), [...requiredLibraryPlacements].sort(), 'library placement set is incomplete or substituted');
  assert.equal(placements.length, requiredLibraryPlacements.length, 'library placement case count mismatch');
  for (const kind of ['battlefield', 'stack'] as const) {
    const divergence = cases.find(({ destination, expectedOwnerPlayerId, expectedControllerPlayerId }) =>
      destination.kind === kind && expectedControllerPlayerId !== null && expectedOwnerPlayerId !== expectedControllerPlayerId);
    assert.notEqual(divergence, undefined, `${kind} owner/controller divergence coverage is missing`);
  }
  const identityFixture = requiredString(root.identityFixture, 'identityFixture');
  const runtimeFixture = requiredString(root.runtimeFixture, 'runtimeFixture');
  const identityPath = declaredFixturePath(identityFixture, 'identityFixture');
  const runtimePath = declaredFixturePath(runtimeFixture, 'runtimeFixture');
  assert.notEqual(identityPath, runtimePath, 'identity and runtime fixture paths must differ');
  const identityRaw = readJsonWithSha256(identityPath, root.identitySha256, 'identity fixture');
  const identityValidation = validateModeNeutralCoreIdentityZoneSliceV1(identityRaw);
  assert.equal(identityValidation.ok, true, 'identity fixture validator rejected declared content');
  if (!identityValidation.ok) throw new Error('identity fixture validation failed');
  const runtimeRaw = readJsonWithSha256(runtimePath, root.runtimeSha256, 'runtime fixture');
  const runtimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityValidation.value, runtimeRaw);
  assert.equal(runtimeValidation.ok, true, 'runtime fixture validator rejected declared content');
  if (!runtimeValidation.ok) throw new Error('runtime fixture validation failed');
  const placementSeed: PlacementSeed = {
    kind: seed.kind,
    objectId: seed.objectId as CoreObjectId,
    ownerPlayerId: seed.ownerPlayerId as CorePlayerId,
    source: { scope: 'shared', zone: 'battlefield', index: source.index },
    destination: { scope: 'player-scoped', zone: 'library', index: destination.index },
    runtime: seedRuntime,
  };
  const seededRaw = seedInputs(identityRaw, runtimeRaw, placementSeed);
  const seededIdentityValidation = validateModeNeutralCoreIdentityZoneSliceV1(seededRaw.identity);
  assert.equal(seededIdentityValidation.ok, true, 'seeded identity validator rejected generated content');
  if (!seededIdentityValidation.ok) throw new Error('seeded identity validation failed');
  const seededRuntimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(seededIdentityValidation.value, seededRaw.runtime);
  assert.equal(seededRuntimeValidation.ok, true, 'seeded runtime validator rejected generated content');
  if (!seededRuntimeValidation.ok) throw new Error('seeded runtime validation failed');
  return {
    metadata: {
      kind: root.kind,
      identityFixture,
      identitySha256: root.identitySha256 as string,
      runtimeFixture,
      runtimeSha256: root.runtimeSha256 as string,
      placementSeed,
      cases,
      invalidCases,
    },
    identityRaw,
    runtimeRaw,
    identity: identityValidation.value,
    runtime: runtimeValidation.value,
    seededIdentityRaw: seededRaw.identity,
    seededRuntimeRaw: seededRaw.runtime,
    seededIdentity: seededIdentityValidation.value,
    seededRuntime: seededRuntimeValidation.value,
  };
}

function inputs(bundle: FixtureBundle): { readonly identity: unknown; readonly runtime: unknown } {
  return {
    identity: JSON.parse(JSON.stringify(bundle.seededIdentityRaw)) as unknown,
    runtime: JSON.parse(JSON.stringify(bundle.seededRuntimeRaw)) as unknown,
  };
}

function verifyCase(bundle: FixtureBundle, testCase: TransitionCase): ReturnType<typeof applyCoreCardZoneTransitionV1> {
  const { identity, runtime } = inputs(bundle);
  const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
  const sourceObjectId = testCase.objectId as CoreObjectId;
  const nextObjectId = testCase.expectedObjectId as CoreObjectId;
  const ownerPlayerId = testCase.expectedOwnerPlayerId as CorePlayerId;
  const sourceCard = bundle.seededIdentity.cardObjects[sourceObjectId];
  assert.notEqual(sourceCard, undefined, `${testCase.id}: source card missing`);
  if (sourceCard === undefined) throw new Error('source card missing');
  assert.equal(testCase.expectedObjectId, nextCoreCardObjectIdV1(sourceCard.physicalCardId, sourceCard.incarnation), `${testCase.id}: expected object id mismatch`);
  const result = applyCoreCardZoneTransitionV1(identity, runtime, { objectId: testCase.objectId, destination: testCase.destination });
  assert.equal(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`, before, `${testCase.id}: input mutated`);
  assert.equal(result.identityZoneState.cardObjects[sourceObjectId], undefined, `${testCase.id}: source remains`);
  const next = result.identityZoneState.cardObjects[nextObjectId];
  assert.notEqual(next, undefined, `${testCase.id}: next object missing`);
  assert.equal(next?.incarnation, sourceCard.incarnation + 1, `${testCase.id}: incarnation did not advance`);
  assert.equal(next?.baseControllerPlayerId, testCase.expectedControllerPlayerId, `${testCase.id}: controller mismatch`);
  assert.equal(result.cardRuntimeState.byObject[sourceObjectId], undefined, `${testCase.id}: old runtime remains`);
  assert.equal(isDefaultCoreCardRuntimeAfterZoneChangeV1(result.cardRuntimeState.byObject[nextObjectId]), true, `${testCase.id}: runtime not reset`);
  assert.equal(locateCoreObjectV1(result.identityZoneState, nextObjectId)?.zone, testCase.expectedZone, `${testCase.id}: zone mismatch`);
  assert.equal(next === undefined ? undefined : result.identityZoneState.physicalCards[next.physicalCardId]?.ownerPlayerId, testCase.expectedOwnerPlayerId, `${testCase.id}: owner mismatch`);
  if (testCase.expectedLibrary !== undefined) assert.deepEqual(result.identityZoneState.zones.byPlayer[ownerPlayerId]?.library, testCase.expectedLibrary, `${testCase.id}: library placement mismatch`);
  assert.equal(validateModeNeutralCoreIdentityZoneSliceV1(result.identityZoneState).ok, true, `${testCase.id}: identity validator rejected output`);
  assert.equal(validateModeNeutralCoreCardRuntimeSliceV1(result.identityZoneState, result.cardRuntimeState).ok, true, `${testCase.id}: runtime validator rejected output`);
  return result;
}

function expectRejected(action: () => unknown, label: string): void {
  assert.throws(action, CoreCardZoneTransitionErrorV1, label);
}

const bundle = readFixture();
const firstCase = bundle.metadata.cases[0];
if (firstCase === undefined) throw new Error('required transition case is missing');
const firstResult = verifyCase(bundle, firstCase);
for (const testCase of bundle.metadata.cases.slice(1)) verifyCase(bundle, testCase);

for (const testCase of bundle.metadata.invalidCases) {
  const { identity, runtime } = inputs(bundle);
  const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
  expectRejected(() => applyCoreCardZoneTransitionV1(identity, runtime, testCase), testCase.id);
  assert.equal(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`, before, `${testCase.id}: partial update`);
}

const firstSourceId = firstCase.objectId;
const firstNextId = firstCase.expectedObjectId;
const tamperedIdentity = JSON.parse(JSON.stringify(firstResult.identityZoneState)) as RecordValue;
const tamperedZones = record(tamperedIdentity.zones, 'tampered zones');
const tamperedShared = record(tamperedZones.shared, 'tampered shared zones');
(tamperedShared.exile as string[]).push(firstSourceId);
assert.equal(validateModeNeutralCoreIdentityZoneSliceV1(tamperedIdentity).ok, false, 'source residual was accepted');

const tamperedRuntime = JSON.parse(JSON.stringify(firstResult.cardRuntimeState)) as RecordValue;
const tamperedByObject = record(tamperedRuntime.byObject, 'tampered runtime');
tamperedByObject[firstSourceId] = JSON.parse(JSON.stringify(tamperedByObject[firstNextId])) as unknown;
assert.equal(validateModeNeutralCoreCardRuntimeSliceV1(firstResult.identityZoneState, tamperedRuntime).ok, false, 'old runtime key was accepted');

const malformed = { objectId: firstSourceId, destination: { kind: 'exile' }, unknown: true };
expectRejected(() => applyCoreCardZoneTransitionV1(firstResult.identityZoneState, firstResult.cardRuntimeState, malformed), 'unknown transition field');
const accessor = { objectId: firstSourceId, destination: { kind: 'exile' } } as { objectId: string; destination: unknown };
Object.defineProperty(accessor, 'objectId', { enumerable: true, get: () => firstSourceId });
expectRejected(() => applyCoreCardZoneTransitionV1(firstResult.identityZoneState, firstResult.cardRuntimeState, accessor), 'accessor transition field');

console.log(
  `slice=mode-neutral-core-card-zone-transition-slice-v1 cases=${bundle.metadata.cases.length}`
  + ` invalidCases=${bundle.metadata.invalidCases.length} destinations=7 placements=3`
  + ' validation=ok atomic=ok ownerController=ok incarnation=ok runtimeReset=ok',
);
