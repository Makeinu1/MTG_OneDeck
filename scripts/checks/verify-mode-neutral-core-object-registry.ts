import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  coreActivatedAbilityObjectIdOfV2,
  coreCardObjectIdOf,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
  validateModeNeutralCoreObjectRegistrySliceV2,
  validateModeNeutralCoreObjectRuntimeSliceV2,
} from "../../src/engine/core";
import type {
  CorePhysicalCardId,
  ModeNeutralCoreObjectRegistrySliceV2,
} from "../../src/engine/core";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = resolve(
  repositoryRoot,
  "src/engine/core/object/fixtures/object-registry-v2.json",
);
const identityFixturePath = resolve(
  repositoryRoot,
  "src/engine/core/fixtures/identity-zone-slice-v1.json",
);
const runtimeFixturePath = resolve(
  repositoryRoot,
  "src/engine/core/fixtures/card-runtime-slice-v1.json",
);

function recordOf(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be a record");
  }
  return value as Record<string, unknown>;
}

function readJsonRecord(path: string): Record<string, unknown> {
  return recordOf(JSON.parse(readFileSync(path, "utf8")) as unknown, path);
}

function reverseRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).reverse());
}

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined
      || !Object.prototype.hasOwnProperty.call(descriptor, "value")
      || deepFrozen(descriptor.value, seen);
  });
}

function assertAcceptedRegistry(input: unknown): ModeNeutralCoreObjectRegistrySliceV2 {
  const result = validateModeNeutralCoreObjectRegistrySliceV2(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error("registry fixture rejected");
  return result.value;
}

const fixture = readJsonRecord(fixturePath);
const fixtureBefore = JSON.stringify(fixture);
const registry = assertAcceptedRegistry(fixture);
assert.equal(JSON.stringify(fixture), fixtureBefore);
assert.equal(registry.kind, "mode-neutral-core-object-registry-slice-v2");
assert.equal(Object.keys(recordOf(registry.players, "players")).length, 4);
assert.equal(deepFrozen(registry), true);

const objects = recordOf(registry.objects, "objects");
const zones = recordOf(registry.zones, "zones");
const shared = recordOf(zones.shared, "zones.shared");
const stack = shared.stack;
assert.deepEqual(stack, [
  "PC5:1",
  "@spell-copy:fixture-copy",
  "@activated-ability:fixture-activation",
  "@triggered-ability:fixture-trigger",
]);
assert.equal((stack as readonly string[]).at(-1), "@triggered-ability:fixture-trigger");
assert.equal(recordOf(objects["@token:fixture-token:0"], "token").kind, "token");
assert.equal(
  recordOf(objects["@spell-copy:fixture-copy"], "spell-copy").copiedFromObjectId,
  "PC8:0",
);

const reordered = structuredClone(fixture);
for (const key of ["players", "cardDefinitions", "physicalCards", "objects"]) {
  reordered[key] = reverseRecord(recordOf(reordered[key], key));
}
const reorderedZones = recordOf(reordered.zones, "reordered zones");
reorderedZones.byPlayer = reverseRecord(recordOf(reorderedZones.byPlayer, "byPlayer"));
const reorderedRegistry = assertAcceptedRegistry(reordered);
assert.deepEqual(registry, reorderedRegistry);
assert.equal(JSON.stringify(registry), JSON.stringify(reorderedRegistry));

const identityFixture = readJsonRecord(identityFixturePath);
const runtimeFixture = readJsonRecord(runtimeFixturePath);
const identityBefore = JSON.stringify(identityFixture);
const runtimeBefore = JSON.stringify(runtimeFixture);
const identityV2 = upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2(identityFixture);
const runtimeV2 = upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
  identityFixture,
  runtimeFixture,
);
assert.deepEqual(
  Object.keys(identityV2.objects).sort(),
  Object.keys(recordOf(identityFixture.cardObjects, "V1 cardObjects")).sort(),
);
assert.equal(JSON.stringify(identityFixture), identityBefore);
assert.equal(JSON.stringify(runtimeFixture), runtimeBefore);
assert.equal(deepFrozen(identityV2), true);
assert.equal(deepFrozen(runtimeV2), true);
assert.equal(runtimeV2.kind, "mode-neutral-core-object-runtime-slice-v2");

const runtimeInput = readJsonRecord(runtimeFixturePath);
runtimeInput.kind = "mode-neutral-core-object-runtime-slice-v2";
const runtimeRows = recordOf(runtimeInput.byObject, "runtime rows");
runtimeRows["@token:fixture-token:0"] = structuredClone(runtimeRows["PC4:1"]);
const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(registry, runtimeInput);
assert.equal(runtimeResult.ok, true, JSON.stringify(runtimeResult));
if (!runtimeResult.ok) throw new Error("runtime fixture rejected");
const runtimeObjectIds = Object.keys(runtimeResult.value.byObject).sort();
assert.equal(runtimeObjectIds.includes("@token:fixture-token:0"), true);
assert.equal(runtimeObjectIds.includes("@spell-copy:fixture-copy"), false);
assert.equal(runtimeObjectIds.includes("@activated-ability:fixture-activation"), false);
assert.equal(runtimeObjectIds.includes("@triggered-ability:fixture-trigger"), false);
assert.equal(deepFrozen(runtimeResult.value), true);

const illegal = structuredClone(fixture);
const illegalShared = recordOf(recordOf(illegal.zones, "illegal zones").shared, "shared");
illegalShared.battlefield = [
  ...((illegalShared.battlefield as readonly string[]) ?? []),
  "@spell-copy:fixture-copy",
];
const illegalResult = validateModeNeutralCoreObjectRegistrySliceV2(illegal);
assert.equal(illegalResult.ok, false);

const syntheticIds = [
  coreTokenObjectIdOfV2("seed", 0),
  coreSpellCopyObjectIdOfV2("seed"),
  coreActivatedAbilityObjectIdOfV2("seed"),
  coreTriggeredAbilityObjectIdOfV2("seed"),
  coreCardObjectIdOf("PC1" as CorePhysicalCardId, 0),
];
assert.equal(new Set(syntheticIds).size, syntheticIds.length);
for (const objectId of syntheticIds) {
  assert.equal(isCanonicalCoreObjectIdV2(objectId), true);
  assert.notEqual(parseCoreObjectIdV2(objectId), null);
}

for (const sourceName of [
  "objectIdV2.ts",
  "tokenObjectV2.ts",
  "stackObjectV2.ts",
  "objectRegistryStateV2.ts",
  "objectRegistryValidationV2.ts",
  "objectRegistryCanonicalizationV2.ts",
  "objectRuntimeV2.ts",
  "index.ts",
]) {
  const source = readFileSync(
    resolve(repositoryRoot, "src/engine/core/object", sourceName),
    "utf8",
  );
  assert.doesNotMatch(source, /\b(?:fetch|WebSocket|XMLHttpRequest|axios)\b/);
}

console.log(
  "verify:mode-neutral-core-object-registry PASS "
  + "objects=" + String(Object.keys(objects).length)
  + " runtime=" + String(runtimeObjectIds.length)
  + " stackTop=" + String((stack as readonly string[]).at(-1)),
);
