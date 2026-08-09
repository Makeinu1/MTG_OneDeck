import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as coreApi from '../../index';

type UnknownRecord = Record<string, unknown>;
type ExportFunction = (...args: unknown[]) => unknown;

function isExportFunction(value: unknown): value is ExportFunction {
  return typeof value === 'function';
}

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures');
const identityFixturePath = resolve(fixtureRoot, 'identity-zone-slice-v1.json');
const runtimeFixturePath = resolve(fixtureRoot, 'card-runtime-slice-v1.json');
const V2_REGISTRY_KIND = 'mode-neutral-core-object-registry-slice-v2';
const V2_RUNTIME_KIND = 'mode-neutral-core-object-runtime-slice-v2';
const TOKEN_ID = '@token:historical-token:0';
const SPELL_COPY_ID = '@spell-copy:historical-copy';
const ACTIVATED_ABILITY_ID = '@activated-ability:historical-activation';
const TRIGGERED_ABILITY_ID = '@triggered-ability:historical-trigger';

function isRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${label} must be a plain record`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function cloneRecord(value: UnknownRecord): UnknownRecord {
  return record(structuredClone(value), 'clone');
}

function readFixture(path: string): UnknownRecord {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return record(parsed, path);
}

function callExport(name: string, ...args: unknown[]): unknown {
  const candidate: unknown = Reflect.get(coreApi, name);
  if (!isExportFunction(candidate)) throw new Error(`missing required Core export: ${name}`);
  return candidate(...args);
}

function unwrapValue(value: unknown, label: string): UnknownRecord {
  const outer = record(value, label);
  if (outer.ok === true && Object.prototype.hasOwnProperty.call(outer, 'value')) {
    return record(outer.value, `${label}.value`);
  }
  return outer;
}

function acceptedRegistry(value: unknown): UnknownRecord {
  const result = record(
    callExport('validateModeNeutralCoreObjectRegistrySliceV2', value),
    'registry validation result',
  );
  expect(result.ok).toBe(true);
  if (result.ok !== true) throw new Error(JSON.stringify(result.issues));
  return record(result.value, 'registry validation value');
}

function acceptedRuntime(registry: UnknownRecord, value: unknown): UnknownRecord {
  const result = record(
    callExport('validateModeNeutralCoreObjectRuntimeSliceV2', registry, value),
    'runtime validation result',
  );
  expect(result.ok).toBe(true);
  if (result.ok !== true) throw new Error(JSON.stringify(result.issues));
  return record(result.value, 'runtime validation value');
}

function rejected(callName: string, ...args: unknown[]): readonly unknown[] {
  const result = record(callExport(callName, ...args), `${callName} result`);
  expect(result.ok).toBe(false);
  if (result.ok !== false) throw new Error(`${callName} unexpectedly accepted input`);
  expect(Array.isArray(result.issues)).toBe(true);
  return array(result.issues, `${callName}.issues`);
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
}

function reverseRecord(value: UnknownRecord): UnknownRecord {
  const reversed: UnknownRecord = {};
  for (const [key, child] of Object.entries(value).reverse()) reversed[key] = child;
  return reversed;
}

function identityFixture(): UnknownRecord {
  return readFixture(identityFixturePath);
}

function runtimeFixture(): UnknownRecord {
  return readFixture(runtimeFixturePath);
}

function registryFixture(): UnknownRecord {
  const raw = identityFixture();
  const cardObjects = record(raw.cardObjects, 'V1 cardObjects');
  delete raw.cardObjects;
  raw.kind = V2_REGISTRY_KIND;
  raw.objects = cardObjects;

  const objects = record(raw.objects, 'V2 objects');
  objects[TOKEN_ID] = {
    kind: 'token',
    definitionId: 'def.unused',
    ownerPlayerId: 'P1',
    incarnation: 0,
    baseControllerPlayerId: 'P1',
    origin: { kind: 'created', sourceObjectId: '@token:source-no-longer-live:0' },
  };
  objects[SPELL_COPY_ID] = {
    kind: 'spell-copy',
    definitionId: 'def.fixture-card',
    controllerPlayerId: 'P2',
    copiedFromObjectId: 'PC8:0',
  };
  objects[ACTIVATED_ABILITY_ID] = {
    kind: 'activated-ability',
    controllerPlayerId: 'P1',
    sourceObjectId: 'PC9:0',
    abilityKey: 'activated-1',
  };
  objects[TRIGGERED_ABILITY_ID] = {
    kind: 'triggered-ability',
    controllerPlayerId: 'P2',
    sourceObjectId: '@triggered-ability:source-no-longer-live',
    abilityKey: 'triggered-1',
  };

  const zones = record(raw.zones, 'V2 zones');
  const shared = record(zones.shared, 'shared zones');
  shared.battlefield = [...array(shared.battlefield, 'battlefield'), TOKEN_ID];
  shared.stack = [
    ...array(shared.stack, 'stack'),
    SPELL_COPY_ID,
    ACTIVATED_ABILITY_ID,
    TRIGGERED_ABILITY_ID,
  ];
  return raw;
}

function runtimeV2Fixture(): UnknownRecord {
  const raw = runtimeFixture();
  const byObject = record(raw.byObject, 'V1 runtime byObject');
  const tokenState = record(byObject['PC4:1'], 'token runtime seed');
  byObject[TOKEN_ID] = structuredClone(tokenState);
  raw.kind = V2_RUNTIME_KIND;
  return raw;
}

function reversedRegistryFixture(): UnknownRecord {
  const result = registryFixture();
  for (const key of ['players', 'cardDefinitions', 'physicalCards', 'objects']) {
    result[key] = reverseRecord(record(result[key], key));
  }
  const zones = cloneRecord(record(result.zones, 'zones'));
  zones.byPlayer = reverseRecord(record(zones.byPlayer, 'zones.byPlayer'));
  result.zones = zones;
  return result;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function v1WithoutKind(): UnknownRecord {
  const value = identityFixture();
  delete value.kind;
  return value;
}

describe('O4P-01H universal object registry acceptance pins', () => {
  it('pin-01 preserves V1 card-ID meaning and fixture bytes', () => {
    expect(callExport('coreCardObjectIdOf', 'PC1', 0)).toBe('PC1:0');
    const parsed = record(callExport('parseCoreObjectIdV2', 'PC1:0'), 'parsed V1 card ID');
    expect(parsed.kind).toBe('card');
    expect(parsed.physicalCardId).toBe('PC1');
    expect(parsed.incarnation).toBe(0);
    expect(callExport('isCanonicalCoreObjectIdV2', 'PC1:0')).toBe(true);
    expect(sha256(identityFixturePath)).toBe('92c4f649fbb67685fb25c7ab135546c429634d14c9e0aadb57a1e00d11752501');
    expect(sha256(runtimeFixturePath)).toBe('c3f0589d97f78c33a08730583dba5655a151485ce9e267915af9bd82b572b116');
  });

  it('pin-02 gives every synthetic kind a deterministic non-colliding canonical ID', () => {
    const ids = [
      callExport('coreTokenObjectIdOfV2', 'seed', 0),
      callExport('coreSpellCopyObjectIdOfV2', 'seed'),
      callExport('coreActivatedAbilityObjectIdOfV2', 'seed'),
      callExport('coreTriggeredAbilityObjectIdOfV2', 'seed'),
      'PC1:0',
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 4)).toEqual([
      TOKEN_ID.replace('historical-token', 'seed'),
      '@spell-copy:seed',
      '@activated-ability:seed',
      '@triggered-ability:seed',
    ]);
    for (const id of ids) {
      expect(callExport('isCanonicalCoreObjectIdV2', id)).toBe(true);
      const parsed = record(callExport('parseCoreObjectIdV2', id), `parsed ${String(id)}`);
      expect(typeof parsed.kind).toBe('string');
    }
    expect(callExport('coreTokenObjectIdOfV2', 'seed', 0)).toBe(
      callExport('coreTokenObjectIdOfV2', 'seed', 0),
    );
  });

  it('pin-03 rejects malformed, trimmed, non-canonical, and delimiter-rich IDs', () => {
    const malformed = [
      '',
      ' PC1:0',
      'PC1:0 ',
      'PC1:01',
      'PC1:+1',
      'PC1:1e3',
      'PC1:1.0',
      'PC1:-1',
      'PC1:0:extra',
      '@token:seed',
      '@token:seed:01',
      '@token:seed:+1',
      '@token:seed:1e3',
      '@token:bad seed:0',
      '@token:bad/seed:0',
      '@token:bad@seed:0',
      '@token:seed:0:extra',
      '@spell-copy:seed:extra',
      '@activated-ability:seed:0',
      '@triggered-ability:seed:',
    ];
    for (const id of malformed) {
      expect(callExport('isCanonicalCoreObjectIdV2', id), id).toBe(false);
      const parsed = callExport('parseCoreObjectIdV2', id);
      expect(parsed === null || parsed === undefined, id).toBe(true);
    }
    expect(() => callExport('coreTokenObjectIdOfV2', 'bad seed', 0)).toThrow();
    expect(() => callExport('coreSpellCopyObjectIdOfV2', 'bad:seed')).toThrow();
  });

  it('pin-04 upgrades V1 identity without changing card bytes, zones, or input', () => {
    const input = identityFixture();
    const before = JSON.stringify(input);
    const output = unwrapValue(
      callExport('upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2', input),
      'identity upgrade',
    );
    expect(output.kind).toBe(V2_REGISTRY_KIND);
    expect(Object.prototype.hasOwnProperty.call(output, 'cardObjects')).toBe(false);
    const objects = record(output.objects, 'upgraded objects');
    const oldObjects = record(input.cardObjects, 'V1 objects');
    expect(Object.keys(objects).sort()).toEqual(Object.keys(oldObjects).sort());
    for (const objectId of Object.keys(oldObjects)) {
      expect(JSON.stringify(objects[objectId])).toBe(JSON.stringify(oldObjects[objectId]));
    }
    expect(JSON.stringify(output.zones)).toBe(JSON.stringify(input.zones));
    expect(JSON.stringify(input)).toBe(before);
    assertDeepFrozen(output);

    const malformed = identityFixture();
    delete malformed.turnOrder;
    expect(() => callExport('upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2', malformed)).toThrow();
  });

  it('pin-05 preserves V1 factory and validators while upgrading runtime aliases', () => {
    const identity = identityFixture();
    const runtime = runtimeFixture();
    const identityBefore = JSON.stringify(identity);
    const runtimeBefore = JSON.stringify(runtime);
    const identityValidation = record(
      callExport('validateModeNeutralCoreIdentityZoneSliceV1', identity),
      'V1 identity validation',
    );
    expect(identityValidation.ok).toBe(true);
    const runtimeValidation = record(
      callExport('validateModeNeutralCoreCardRuntimeSliceV1', identity, runtime),
      'V1 runtime validation',
    );
    expect(runtimeValidation.ok).toBe(true);
    const factoryResult = unwrapValue(
      callExport('createModeNeutralCoreIdentityZoneSliceV1', v1WithoutKind()),
      'V1 factory result',
    );
    expect(factoryResult.kind).toBe('mode-neutral-core-identity-zone-slice-v1');
    const upgradedRuntime = unwrapValue(
      callExport('upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2', identity, runtime),
      'runtime upgrade',
    );
    expect(upgradedRuntime.kind).toBe(V2_RUNTIME_KIND);
    expect(Object.keys(record(upgradedRuntime.byObject, 'upgraded runtime')).sort()).toEqual(
      Object.keys(record(runtime.byObject, 'V1 runtime')).sort(),
    );
    expect(JSON.stringify(identity)).toBe(identityBefore);
    expect(JSON.stringify(runtime)).toBe(runtimeBefore);
    assertDeepFrozen(upgradedRuntime);
  });

  it('pin-06 accepts legal token, spell-copy, ability, and mixed bottom-to-top stack zones', () => {
    const input = registryFixture();
    const output = acceptedRegistry(input);
    const objects = record(output.objects, 'accepted objects');
    const zones = record(output.zones, 'accepted zones');
    const shared = record(zones.shared, 'accepted shared zones');
    expect(array(shared.battlefield, 'battlefield')).toContain(TOKEN_ID);
    expect(array(shared.stack, 'stack')).toEqual([
      'PC5:1',
      SPELL_COPY_ID,
      ACTIVATED_ABILITY_ID,
      TRIGGERED_ABILITY_ID,
    ]);
    expect(array(shared.stack, 'stack').at(-1)).toBe(TRIGGERED_ABILITY_ID);
    expect(record(objects[TOKEN_ID], 'token').kind).toBe('token');
    expect(record(objects[SPELL_COPY_ID], 'spell copy').kind).toBe('spell-copy');
    expect(record(objects[ACTIVATED_ABILITY_ID], 'activated ability').kind).toBe('activated-ability');
    expect(record(objects[TRIGGERED_ABILITY_ID], 'triggered ability').kind).toBe('triggered-ability');
    expect(Object.prototype.hasOwnProperty.call(record(objects[TOKEN_ID], 'token'), 'physicalCardId')).toBe(false);
  });

  it('pin-07 rejects each non-card kind in an illegal zone and stale references', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      [TOKEN_ID, 'stack'],
      [SPELL_COPY_ID, 'battlefield'],
      [ACTIVATED_ABILITY_ID, 'battlefield'],
      [TRIGGERED_ABILITY_ID, 'exile'],
    ];
    for (const [objectId, illegalZone] of cases) {
      const input = registryFixture();
      const zones = record(input.zones, 'zones');
      const shared = record(zones.shared, 'shared');
      const original = array(shared[illegalZone], illegalZone);
      shared[illegalZone] = [...original, objectId];
      rejected('validateModeNeutralCoreObjectRegistrySliceV2', input);
    }
    const unresolved = registryFixture();
    const unresolvedObjects = record(unresolved.objects, 'objects');
    unresolvedObjects['PC1:0'] = {
      ...record(unresolvedObjects['PC1:0'], 'PC1:0'),
      baseControllerPlayerId: 'P99',
    };
    const unresolvedShared = record(record(unresolved.zones, 'zones').shared, 'shared');
    unresolvedShared.stack = [...array(unresolvedShared.stack, 'stack'), 'PC99:0'];
    rejected('validateModeNeutralCoreObjectRegistrySliceV2', unresolved);
  });

  it('pin-08 permits historical source references while keeping non-card objects cardless', () => {
    const output = acceptedRegistry(registryFixture());
    const objects = record(output.objects, 'objects');
    for (const objectId of [TOKEN_ID, SPELL_COPY_ID, ACTIVATED_ABILITY_ID, TRIGGERED_ABILITY_ID]) {
      const object = record(objects[objectId], objectId);
      expect(Object.prototype.hasOwnProperty.call(object, 'physicalCardId')).toBe(false);
    }
    expect(record(objects[TOKEN_ID], TOKEN_ID).origin).toEqual({
      kind: 'created',
      sourceObjectId: '@token:source-no-longer-live:0',
    });
    expect(record(objects[SPELL_COPY_ID], SPELL_COPY_ID).copiedFromObjectId).toBe('PC8:0');
    expect(record(objects[ACTIVATED_ABILITY_ID], ACTIVATED_ABILITY_ID).sourceObjectId).toBe('PC9:0');
    expect(record(objects[TRIGGERED_ABILITY_ID], TRIGGERED_ABILITY_ID).sourceObjectId).toBe(
      '@triggered-ability:source-no-longer-live',
    );
  });

  it('pin-09 enforces exactly one live card object per physical card and one zone membership', () => {
    const duplicatePhysical = registryFixture();
    const objects = record(duplicatePhysical.objects, 'objects');
    objects['PC7:1'] = {
      kind: 'card',
      physicalCardId: 'PC7',
      incarnation: 1,
      baseControllerPlayerId: null,
    };
    const shared = record(record(duplicatePhysical.zones, 'zones').shared, 'shared');
    shared.command = [...array(shared.command, 'command'), 'PC7:1'];
    rejected('validateModeNeutralCoreObjectRegistrySliceV2', duplicatePhysical);

    const duplicateZone = registryFixture();
    const duplicateShared = record(record(duplicateZone.zones, 'zones').shared, 'shared');
    duplicateShared.exile = [...array(duplicateShared.exile, 'exile'), 'PC4:1'];
    rejected('validateModeNeutralCoreObjectRegistrySliceV2', duplicateZone);

    const missingZone = registryFixture();
    const missingShared = record(record(missingZone.zones, 'zones').shared, 'shared');
    missingShared.battlefield = array(missingShared.battlefield, 'battlefield').filter((id) => id !== 'PC4:1');
    rejected('validateModeNeutralCoreObjectRegistrySliceV2', missingZone);
  });

  it('pin-10 requires the runtime key set to be exactly card and token objects', () => {
    const registry = acceptedRegistry(registryFixture());
    const runtime = runtimeV2Fixture();
    const accepted = acceptedRuntime(registry, runtime);
    const objects = record(registry.objects, 'registry objects');
    const expected = Object.entries(objects)
      .filter(([, value]) => {
        const kind = record(value, 'object').kind;
        return kind === 'card' || kind === 'token';
      })
      .map(([objectId]) => objectId)
      .sort();
    expect(Object.keys(record(accepted.byObject, 'runtime byObject')).sort()).toEqual(expected);
    const missingToken = cloneRecord(runtime);
    delete record(missingToken.byObject, 'missing token runtime')[TOKEN_ID];
    rejected('validateModeNeutralCoreObjectRuntimeSliceV2', registry, missingToken);
    const staleStackRow = cloneRecord(runtime);
    record(staleStackRow.byObject, 'stale runtime')[SPELL_COPY_ID] = structuredClone(
      record(record(staleStackRow.byObject, 'stale runtime')['PC4:1'], 'runtime seed'),
    );
    rejected('validateModeNeutralCoreObjectRuntimeSliceV2', registry, staleStackRow);
  });

  it('pin-11 canonicalizes records without sorting semantic zone or stack arrays', () => {
    const first = acceptedRegistry(registryFixture());
    const second = acceptedRegistry(reversedRegistryFixture());
    const firstCanonical = unwrapValue(
      callExport('canonicalizeModeNeutralCoreObjectRegistrySliceV2', first),
      'first canonical registry',
    );
    const secondCanonical = unwrapValue(
      callExport('canonicalizeModeNeutralCoreObjectRegistrySliceV2', second),
      'second canonical registry',
    );
    expect(JSON.stringify(firstCanonical)).toBe(JSON.stringify(secondCanonical));
    const firstStack = array(record(record(firstCanonical.zones, 'zones').shared, 'shared').stack, 'stack');
    expect(firstStack).toEqual(['PC5:1', SPELL_COPY_ID, ACTIVATED_ABILITY_ID, TRIGGERED_ABILITY_ID]);

    const firstRuntime = acceptedRuntime(first, runtimeV2Fixture());
    const secondRuntime = acceptedRuntime(second, runtimeV2Fixture());
    const firstRuntimeCanonical = unwrapValue(
      callExport('canonicalizeModeNeutralCoreObjectRuntimeSliceV2', firstRuntime),
      'first canonical runtime',
    );
    const secondRuntimeCanonical = unwrapValue(
      callExport('canonicalizeModeNeutralCoreObjectRuntimeSliceV2', secondRuntime),
      'second canonical runtime',
    );
    expect(JSON.stringify(firstRuntimeCanonical)).toBe(JSON.stringify(secondRuntimeCanonical));
  });

  it('pin-12 returns fresh deeply frozen values and never mutates hostile input', () => {
    const input = registryFixture();
    const before = JSON.stringify(input);
    const output = acceptedRegistry(input);
    expect(output).not.toBe(input);
    expect(record(output.objects, 'output objects')).not.toBe(record(input.objects, 'input objects'));
    expect(JSON.stringify(input)).toBe(before);
    assertDeepFrozen(output);

    const hostile = registryFixture();
    let getterExecuted = false;
    Object.defineProperty(hostile, 'objects', {
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return {};
      },
    });
    rejected('validateModeNeutralCoreObjectRegistrySliceV2', hostile);
    expect(getterExecuted).toBe(false);
  });

  it('pin-13 rejects unknown fields and returns deterministic complete issues', () => {
    const first = registryFixture();
    first.unexpected = true;
    const second = reversedRegistryFixture();
    second.unexpected = true;
    const firstIssues = rejected('validateModeNeutralCoreObjectRegistrySliceV2', first);
    const secondIssues = rejected('validateModeNeutralCoreObjectRegistrySliceV2', second);
    expect(JSON.stringify(firstIssues)).toBe(JSON.stringify(secondIssues));
    expect(firstIssues.some((issue) => record(issue, 'issue').code === 'UNKNOWN_FIELD')).toBe(true);
  });
});
