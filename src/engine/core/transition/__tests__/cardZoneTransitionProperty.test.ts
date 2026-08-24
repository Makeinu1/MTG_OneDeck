import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  applyCoreCardZoneTransitionV1,
  CoreCardZoneTransitionErrorV1,
} from '../cardZoneTransition';
import { locateCoreObjectV1 } from '../../identityZoneState';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../identityZoneState';
import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../../identityZoneValidation';
import { isDefaultCoreCardRuntimeAfterZoneChangeV1, nextCoreCardObjectIdV1 } from '../cardReincarnation';
import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../../runtime/cardRuntimeValidation';
import type { ModeNeutralCoreCardRuntimeSliceV1 } from '../../runtime/cardRuntimeState';
import type { CoreCardZoneDestinationV1 } from '../zoneDestination';
import type { CoreObjectId, CorePlayerId } from '../../ids';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/card-zone-transition-slice-v1.json',
);
const fixtureDirectory = dirname(fixturePath);
const allowedFixtureNames = new Set(['identity-zone-slice-v1.json', 'card-runtime-slice-v1.json']);
const playerIds = ['P1', 'P2', 'P3', 'P4'] as const;

type RecordValue = Record<string, unknown>;
type TransitionCase = {
  readonly id: string;
  readonly objectId: string;
  readonly destination: unknown;
  readonly expectedObjectId: string;
  readonly expectedZone: string;
  readonly expectedOwnerPlayerId: string;
  readonly expectedControllerPlayerId: string | null;
  readonly expectedLibrary?: readonly string[];
};
type InvalidCase = {
  readonly id: string;
  readonly objectId: string;
  readonly destination: unknown;
};
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
type LoadedFixture = {
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
type SourceSlot = {
  readonly objectId: CoreObjectId;
  readonly zone: 'library' | 'hand' | 'graveyard' | 'battlefield' | 'stack' | 'exile' | 'command';
  readonly zoneIndex: number;
  readonly ownerPlayerId: CorePlayerId;
  readonly ownerLibraryLengthAfterSourceRemoval: number;
};
type GeneratedTransition = {
  readonly source: SourceSlot;
  readonly destination: CoreCardZoneDestinationV1;
};

function record(value: unknown, label: string): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be plain`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, expected: readonly string[], label: string): void {
  expect(Reflect.ownKeys(value), `${label} shape`).toEqual(expected);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(descriptor?.enumerable, `${label}.${key} enumerable`).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(descriptor ?? {}, 'value'), `${label}.${key} data`).toBe(true);
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
  if (typeof expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
    throw new Error(`${label} SHA-256 metadata is invalid`);
  }
  const bytes = readFileSync(path);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error(`${label} SHA-256 mismatch`);
  return JSON.parse(bytes.toString('utf8')) as unknown;
}

function seededInputs(identityRaw: unknown, runtimeRaw: unknown, seed: PlacementSeed): { readonly identity: unknown; readonly runtime: unknown } {
  const identity = record(JSON.parse(JSON.stringify(identityRaw)) as unknown, 'seeded identity');
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

  const runtime = record(JSON.parse(JSON.stringify(runtimeRaw)) as unknown, 'seeded runtime');
  const runtimeByObject = record(runtime.byObject, 'seeded runtime.byObject');
  if (!Object.prototype.hasOwnProperty.call(runtimeByObject, seed.objectId)) throw new Error('placement seed runtime object is missing');
  runtimeByObject[seed.objectId] = seed.runtime;
  return { identity, runtime };
}

function readMetadata(): FixtureMetadata {
  const root = record(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown, 'transition fixture');
  exactKeys(root, ['kind', 'identityFixture', 'identitySha256', 'runtimeFixture', 'runtimeSha256', 'placementSeed', 'cases', 'invalidCases'], 'transition fixture');
  expect(root.kind).toBe('mode-neutral-core-card-zone-transition-slice-v1');
  if (!Array.isArray(root.cases) || !Array.isArray(root.invalidCases)) throw new Error('transition fixture cases must be arrays');
  const cases = root.cases.map((value, index) => {
    const item = record(value, `cases[${index}]`);
    const keys = Object.prototype.hasOwnProperty.call(item, 'expectedLibrary')
      ? ['id', 'objectId', 'destination', 'expectedObjectId', 'expectedZone', 'expectedOwnerPlayerId', 'expectedControllerPlayerId', 'expectedLibrary']
      : ['id', 'objectId', 'destination', 'expectedObjectId', 'expectedZone', 'expectedOwnerPlayerId', 'expectedControllerPlayerId'];
    exactKeys(item, keys, `cases[${index}]`);
    return item as unknown as TransitionCase;
  });
  const invalidCases = root.invalidCases.map((value, index) => {
    const item = record(value, `invalidCases[${index}]`);
    exactKeys(item, ['id', 'objectId', 'destination'], `invalidCases[${index}]`);
    return item as unknown as InvalidCase;
  });
  const seed = record(root.placementSeed, 'placementSeed');
  exactKeys(seed, ['kind', 'objectId', 'ownerPlayerId', 'source', 'destination', 'runtime'], 'placementSeed');
  const source = record(seed.source, 'placementSeed.source');
  exactKeys(source, ['scope', 'zone', 'index'], 'placementSeed.source');
  const destination = record(seed.destination, 'placementSeed.destination');
  exactKeys(destination, ['scope', 'zone', 'index'], 'placementSeed.destination');
  const seedRuntime = record(seed.runtime, 'placementSeed.runtime');
  exactKeys(seedRuntime, ['orientation', 'counterDamage', 'attachment'], 'placementSeed.runtime');
  expect(seed.kind).toBe('mode-neutral-core-card-zone-transition-placement-seed-v1');
  expect(seed.objectId).toBe('PC4:1');
  expect(seed.ownerPlayerId).toBe('P2');
  expect(source.scope).toBe('shared');
  expect(source.zone).toBe('battlefield');
  expect(source.index).toBe(0);
  expect(destination.scope).toBe('player-scoped');
  expect(destination.zone).toBe('library');
  expect(destination.index).toBe(0);
  return {
    kind: root.kind as string,
    identityFixture: root.identityFixture as string,
    identitySha256: root.identitySha256 as string,
    runtimeFixture: root.runtimeFixture as string,
    runtimeSha256: root.runtimeSha256 as string,
    placementSeed: {
      kind: seed.kind as string,
      objectId: seed.objectId as CoreObjectId,
      ownerPlayerId: seed.ownerPlayerId as CorePlayerId,
      source: { scope: 'shared', zone: 'battlefield', index: source.index as number },
      destination: { scope: 'player-scoped', zone: 'library', index: destination.index as number },
      runtime: seedRuntime,
    },
    cases,
    invalidCases,
  };
}

function loadFixture(): LoadedFixture {
  const metadata = readMetadata();
  const identityPath = declaredFixturePath(metadata.identityFixture, 'identityFixture');
  const runtimePath = declaredFixturePath(metadata.runtimeFixture, 'runtimeFixture');
  if (identityPath === runtimePath) throw new Error('identity and runtime fixture paths must differ');
  const identityRaw = readJsonWithSha256(identityPath, metadata.identitySha256, 'identity fixture');
  const identityValidation = validateModeNeutralCoreIdentityZoneSliceV1(identityRaw);
  if (!identityValidation.ok) throw new Error(`identity fixture validation failed: ${JSON.stringify(identityValidation.issues)}`);
  const runtimeRaw = readJsonWithSha256(runtimePath, metadata.runtimeSha256, 'runtime fixture');
  const runtimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(identityValidation.value, runtimeRaw);
  if (!runtimeValidation.ok) throw new Error(`runtime fixture validation failed: ${JSON.stringify(runtimeValidation.issues)}`);
  const seededRaw = seededInputs(identityRaw, runtimeRaw, metadata.placementSeed);
  const seededIdentityValidation = validateModeNeutralCoreIdentityZoneSliceV1(seededRaw.identity);
  if (!seededIdentityValidation.ok) throw new Error(`seeded identity validation failed: ${JSON.stringify(seededIdentityValidation.issues)}`);
  const seededRuntimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(seededIdentityValidation.value, seededRaw.runtime);
  if (!seededRuntimeValidation.ok) throw new Error(`seeded runtime validation failed: ${JSON.stringify(seededRuntimeValidation.issues)}`);
  return {
    metadata,
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

function freshInputs(loaded: LoadedFixture): { readonly identity: unknown; readonly runtime: unknown } {
  return {
    identity: JSON.parse(JSON.stringify(loaded.seededIdentityRaw)) as unknown,
    runtime: JSON.parse(JSON.stringify(loaded.seededRuntimeRaw)) as unknown,
  };
}

function assertTransitionCase(loaded: LoadedFixture, testCase: TransitionCase): void {
  const { identity, runtime } = freshInputs(loaded);
  const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
  const sourceObjectId = testCase.objectId as CoreObjectId;
  const nextObjectId = testCase.expectedObjectId as CoreObjectId;
  const ownerPlayerId = testCase.expectedOwnerPlayerId as CorePlayerId;
  const result = applyCoreCardZoneTransitionV1(identity, runtime, {
    objectId: testCase.objectId,
    destination: testCase.destination,
  });
  expect(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`).toBe(before);
  expect(result.identityZoneState.cardObjects[sourceObjectId]).toBeUndefined();
  expect(result.identityZoneState.cardObjects[nextObjectId]?.physicalCardId).toBe(testCase.expectedObjectId.split(':')[0]);
  expect(result.identityZoneState.cardObjects[nextObjectId]?.incarnation).toBe(1);
  expect(locateCoreObjectV1(result.identityZoneState, nextObjectId)?.zone).toBe(testCase.expectedZone);
  if (testCase.expectedLibrary !== undefined) {
    expect(result.identityZoneState.zones.byPlayer[ownerPlayerId]?.library).toEqual(testCase.expectedLibrary);
  }
  const nextCard = result.identityZoneState.cardObjects[nextObjectId];
  expect(nextCard?.baseControllerPlayerId).toBe(testCase.expectedControllerPlayerId);
  if (nextCard === undefined) throw new Error('transition fixture omitted next card');
  expect(result.identityZoneState.physicalCards[nextCard.physicalCardId]?.ownerPlayerId).toBe(testCase.expectedOwnerPlayerId);
  expect(result.cardRuntimeState.byObject[sourceObjectId]).toBeUndefined();
  expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(result.cardRuntimeState.byObject[nextObjectId])).toBe(true);
  expect(validateModeNeutralCoreIdentityZoneSliceV1(result.identityZoneState).ok).toBe(true);
  expect(validateModeNeutralCoreCardRuntimeSliceV1(result.identityZoneState, result.cardRuntimeState).ok).toBe(true);
}

const sourceObjectIds = ['PC2:0', 'PC3:0', 'PC4:1', 'PC5:1', 'PC6:0', 'PC7:0'] as const;
const PROPERTY_TEST_TIMEOUT_MS = 15_000;
function sourceSlots(identity: ModeNeutralCoreIdentityZoneSliceV1): readonly SourceSlot[] {
  return sourceObjectIds.map((objectId) => {
    const typedObjectId = objectId as CoreObjectId;
    const location = locateCoreObjectV1(identity, typedObjectId);
    const card = identity.cardObjects[typedObjectId];
    if (location === null || card === undefined) throw new Error(`generated source ${objectId} is missing`);
    const ownerPlayerId = identity.physicalCards[card.physicalCardId].ownerPlayerId;
    return {
      objectId: typedObjectId,
      zone: location.zone,
      zoneIndex: location.index,
      ownerPlayerId,
      ownerLibraryLengthAfterSourceRemoval: identity.zones.byPlayer[ownerPlayerId].library.length
        - (location.zone === 'library' ? 1 : 0),
    };
  });
}
const branchNames = ['owner-library', 'owner-hand', 'owner-graveyard', 'battlefield', 'stack', 'exile', 'command'] as const;

const placementArbitrary = fc.oneof(
  fc.record({ kind: fc.constant('top' as const) }),
  fc.record({ kind: fc.constant('bottom' as const) }),
  fc.record({ kind: fc.constant('index' as const), index: fc.integer({ min: 0, max: 1 }) }),
);
function generatedTransitionArbitrary(loaded: LoadedFixture): fc.Arbitrary<GeneratedTransition> {
  const slots = sourceSlots(loaded.seededIdentity);
  return fc.record({
    sourceIndex: fc.integer({ min: 0, max: slots.length - 1 }),
    branchIndex: fc.integer({ min: 0, max: branchNames.length - 1 }),
    controllerIndex: fc.integer({ min: 0, max: playerIds.length - 1 }),
    placement: placementArbitrary,
  }).map(({ sourceIndex, branchIndex, controllerIndex, placement }) => {
    const source = slots[sourceIndex];
    if (source === undefined) throw new Error('generated source slot missing');
    const branch = branchNames[branchIndex];
    if (branch === undefined) throw new Error('generated destination branch missing');
    const controllerPlayerId = playerIds[controllerIndex] as CorePlayerId | undefined;
    if (controllerPlayerId === undefined) throw new Error('generated controller missing');
    const destination: CoreCardZoneDestinationV1 = branch === 'owner-library'
      ? { kind: branch, placement }
      : branch === 'battlefield' || branch === 'stack'
        ? { kind: branch, baseControllerPlayerId: controllerPlayerId }
        : { kind: branch };
    return { source, destination };
  }).filter(({ source, destination }) => {
    const destinationZone = destination.kind === 'owner-library' || destination.kind === 'owner-hand' || destination.kind === 'owner-graveyard'
      ? destination.kind.slice('owner-'.length)
      : destination.kind;
    const libraryIndexIsValid = destination.kind !== 'owner-library'
      || destination.placement.kind !== 'index'
      || destination.placement.index <= source.ownerLibraryLengthAfterSourceRemoval;
    return destinationZone !== source.zone && libraryIndexIsValid;
  });
}

function zoneArrays(state: ModeNeutralCoreIdentityZoneSliceV1): readonly CoreObjectId[] {
  const playerZoneIds = state.turnOrder.flatMap((playerId) => {
    const zones = state.zones.byPlayer[playerId];
    return [...zones.library, ...zones.hand, ...zones.graveyard];
  });
  return [...playerZoneIds, ...state.zones.shared.battlefield, ...state.zones.shared.stack, ...state.zones.shared.exile, ...state.zones.shared.command];
}

function assertGeneratedTransition(loaded: LoadedFixture, generated: GeneratedTransition): void {
  const { identity, runtime } = freshInputs(loaded);
  const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
  const source = generated.source;
  const current = loaded.seededIdentity.cardObjects[source.objectId];
  if (current === undefined) throw new Error('generated source object missing from validated fixture');
  const expectedObjectId = nextCoreCardObjectIdV1(current.physicalCardId, current.incarnation);
  const ownerPlayerId = loaded.seededIdentity.physicalCards[current.physicalCardId].ownerPlayerId;
  const result = applyCoreCardZoneTransitionV1(identity, runtime, {
    objectId: source.objectId,
    destination: generated.destination,
  });
  expect(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`).toBe(before);
  expect(zoneArrays(result.identityZoneState).filter((objectId) => objectId === source.objectId)).toHaveLength(0);
  expect(zoneArrays(result.identityZoneState).filter((objectId) => objectId === expectedObjectId)).toHaveLength(1);
  expect(result.identityZoneState.cardObjects[source.objectId]).toBeUndefined();
  expect(result.identityZoneState.cardObjects[expectedObjectId]?.incarnation).toBe(current.incarnation + 1);
  expect(result.identityZoneState.cardObjects[expectedObjectId]?.physicalCardId).toBe(current.physicalCardId);
  const expectedZone = generated.destination.kind.startsWith('owner-')
    ? generated.destination.kind.slice('owner-'.length)
    : generated.destination.kind;
  expect(locateCoreObjectV1(result.identityZoneState, expectedObjectId)?.zone).toBe(expectedZone);
  if (generated.destination.kind === 'owner-library') {
    const expectedLibrary = [...loaded.seededIdentity.zones.byPlayer[ownerPlayerId].library];
    const insertionIndex = generated.destination.placement.kind === 'top'
      ? 0
      : generated.destination.placement.kind === 'bottom'
        ? expectedLibrary.length
        : generated.destination.placement.index;
    expectedLibrary.splice(insertionIndex, 0, expectedObjectId);
    expect(result.identityZoneState.zones.byPlayer[ownerPlayerId].library).toEqual(expectedLibrary);
  }
  const expectedController = generated.destination.kind === 'battlefield' || generated.destination.kind === 'stack'
    ? generated.destination.baseControllerPlayerId
    : null;
  expect(result.identityZoneState.cardObjects[expectedObjectId]?.baseControllerPlayerId).toBe(expectedController);
  expect(result.identityZoneState.physicalCards[current.physicalCardId].ownerPlayerId).toBe(ownerPlayerId);
  expect(result.cardRuntimeState.byObject[source.objectId]).toBeUndefined();
  expect(isDefaultCoreCardRuntimeAfterZoneChangeV1(result.cardRuntimeState.byObject[expectedObjectId])).toBe(true);
  expect(validateModeNeutralCoreIdentityZoneSliceV1(result.identityZoneState).ok).toBe(true);
  expect(validateModeNeutralCoreCardRuntimeSliceV1(result.identityZoneState, result.cardRuntimeState).ok).toBe(true);
}

const generatedInvalidArbitrary = fc.record({
  kindIndex: fc.integer({ min: 0, max: 3 }),
  invalidIndex: fc.integer({ min: 2, max: 100 }),
  unknownFieldCount: fc.integer({ min: 0, max: 2 }),
}).map(({ kindIndex, invalidIndex, unknownFieldCount }) => {
  if (kindIndex === 0) return { objectId: 'PC1:99', destination: { kind: 'exile' } };
  if (kindIndex === 1) return { objectId: 'PC2:0', destination: { kind: 'future-zone', extra: unknownFieldCount } };
  if (kindIndex === 2) return { objectId: 'PC1:0', destination: { kind: 'owner-library', placement: { kind: 'top' } } };
  return { objectId: 'PC2:0', destination: { kind: 'owner-library', placement: { kind: 'index', index: invalidIndex } } };
});

describe('Core card zone transition fixture properties', () => {
  it('keeps golden fixture coverage separate and resolves its declared inputs', () => {
    const loaded = loadFixture();
    expect(loaded.metadata.cases.map(({ id }) => id)).toEqual([
      'owner-library-top', 'owner-library-bottom', 'owner-library-index',
      'owner-hand', 'owner-graveyard', 'battlefield-controller', 'stack-controller',
      'exile', 'command',
    ]);
    for (const testCase of loaded.metadata.cases) assertTransitionCase(loaded, testCase);
  });

  it('generates valid source, destination, placement, and controller records', { timeout: PROPERTY_TEST_TIMEOUT_MS }, () => {
    const loaded = loadFixture();
    fc.assert(
      fc.property(generatedTransitionArbitrary(loaded), (generated) => {
        assertGeneratedTransition(loaded, generated);
      }),
      { numRuns: 128, seed: 2026080908 },
    );
  });

  it('generates invalid records and rejects each atomically', { timeout: PROPERTY_TEST_TIMEOUT_MS }, () => {
    const loaded = loadFixture();
    fc.assert(
      fc.property(generatedInvalidArbitrary, (transitionInput) => {
        const { identity, runtime } = freshInputs(loaded);
        const before = `${JSON.stringify(identity)}|${JSON.stringify(runtime)}`;
        expect(() => applyCoreCardZoneTransitionV1(identity, runtime, transitionInput)).toThrow(CoreCardZoneTransitionErrorV1);
        expect(`${JSON.stringify(identity)}|${JSON.stringify(runtime)}`).toBe(before);
      }),
      { numRuns: 64, seed: 2026080909 },
    );
  });
});
