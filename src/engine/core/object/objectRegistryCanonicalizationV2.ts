import {
  canonicalizeModeNeutralCoreIdentityZoneSliceV1,
} from "../identityZoneCanonicalization";
import {
  validateModeNeutralCoreCardRuntimeSliceV1,
} from "../runtime/cardRuntimeValidation";
import {
  validateModeNeutralCoreIdentityZoneSliceV1,
} from "../identityZoneValidation";
import type {
  CoreCardObjectIdentityV1,
  CorePlayerZonesV1,
  CoreSharedZonesV1,
  CoreZonesV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from "../identityZoneState";
import type {
  CoreObjectId,
  CorePlayerId,
} from "../ids";
import type {
  CoreCardObjectRuntimeStateV1,
} from "../runtime/cardRuntimeState";
import type {
  CoreGameObjectIdentityV2,
} from "./tokenObjectV2";
import type {
  ModeNeutralCoreObjectRegistryStateV2,
  ModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryStateV2";

const REGISTRY_ROOT_FIELDS = [
  "kind",
  "players",
  "turnOrder",
  "activePlayerId",
  "cardDefinitions",
  "physicalCards",
  "objects",
  "zones",
] as const;
const RUNTIME_ROOT_FIELDS = ["kind", "byObject"] as const;

type CanonicalRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedKeys(value: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(value).sort(codeUnitCompare);
}

function dataValue(record: Readonly<Record<string, unknown>>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
    throw new TypeError(`Canonicalization requires a data property: ${key}`);
  }
  return descriptor.value;
}

function canonicalRecord<T>(
  keys: readonly string[],
  valueForKey: (key: string) => unknown,
): T {
  const target = Object.create(null) as CanonicalRecord;
  for (const key of keys) {
    Object.defineProperty(target, key, {
      value: valueForKey(key),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return new Proxy(target, {
    ownKeys: () => keys.slice(),
  }) as T;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const object = value;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      deepFreeze(descriptor.value, seen);
    }
  }
  if (!Object.isFrozen(object)) Object.freeze(object);
  return value;
}

function cloneArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze(value.slice());
}

function cloneDataValue(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (value === null || typeof value !== "object") return value;
  const object = value;
  const existing = seen.get(object);
  if (existing !== undefined) return existing;

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(object, clone);
    for (const item of value) clone.push(cloneDataValue(item, seen));
    return Object.freeze(clone);
  }

  const keys = Object.keys(value).sort(codeUnitCompare);
  const clone = canonicalRecord<CanonicalRecord>(keys, (key) =>
    cloneDataValue(dataValue(value as Readonly<Record<string, unknown>>, key), seen));
  seen.set(object, clone);
  return Object.freeze(clone);
}

function projectZonesForV1(
  zones: CoreZonesV1,
  cardObjectIds: ReadonlySet<string>,
): CoreZonesV1 {
  const byPlayer: Record<string, CorePlayerZonesV1> = Object.create(null) as Record<
    string,
    CorePlayerZonesV1
  >;
  for (const playerIdText of Object.keys(zones.byPlayer)) {
    const playerId = playerIdText as CorePlayerId;
    const source = zones.byPlayer[playerId];
    byPlayer[playerId] = {
      library: source.library.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
      hand: source.hand.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
      graveyard: source.graveyard.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
    };
  }
  const shared: CoreSharedZonesV1 = {
    battlefield: zones.shared.battlefield.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
    stack: zones.shared.stack.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
    exile: zones.shared.exile.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
    command: zones.shared.command.filter((objectId: CoreObjectId) => cardObjectIds.has(objectId)),
  };
  return { byPlayer, shared };
}

function projectRegistryToV1(
  value: ModeNeutralCoreObjectRegistryStateV2,
): ModeNeutralCoreIdentityZoneSliceV1 {
  const cardObjects: Record<string, CoreCardObjectIdentityV1> = Object.create(null) as Record<
    string,
    CoreCardObjectIdentityV1
  >;
  const cardObjectIds = new Set<string>();
  const objects = value.objects as Readonly<Record<string, CoreGameObjectIdentityV2>>;
  for (const objectId of Object.keys(objects)) {
    const object = objects[objectId];
    if (object.kind !== "card") continue;
    cardObjects[objectId] = object;
    cardObjectIds.add(objectId);
  }
  return {
    kind: "mode-neutral-core-identity-zone-slice-v1",
    players: value.players,
    turnOrder: value.turnOrder,
    activePlayerId: value.activePlayerId,
    cardDefinitions: value.cardDefinitions,
    physicalCards: value.physicalCards,
    cardObjects,
    zones: projectZonesForV1(value.zones, cardObjectIds),
  };
}

function canonicalizeZones(
  value: CoreZonesV1,
  turnOrder: readonly CorePlayerId[],
): CoreZonesV1 {
  const byPlayer = value.byPlayer as Readonly<Record<string, CorePlayerZonesV1>>;
  const shared = value.shared;
  return canonicalRecord<CoreZonesV1>(["byPlayer", "shared"], (key) => {
    if (key === "byPlayer") {
      return canonicalRecord<Readonly<Record<string, CorePlayerZonesV1>>>(
        turnOrder,
        (playerId) => {
          const source = byPlayer[playerId];
          return canonicalRecord<CorePlayerZonesV1>(
            ["library", "hand", "graveyard"],
            (zone) => cloneArray(source[zone as keyof CorePlayerZonesV1]),
          );
        },
      );
    }
    return canonicalRecord<CoreSharedZonesV1>(
      ["battlefield", "stack", "exile", "command"],
      (zone) => cloneArray(shared[zone as keyof CoreSharedZonesV1]),
    );
  });
}

function canonicalizeObjectIdentity(
  value: CoreGameObjectIdentityV2,
): CoreGameObjectIdentityV2 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  switch (value.kind) {
    case "card":
      return canonicalRecord<CoreGameObjectIdentityV2>(
        ["kind", "physicalCardId", "incarnation", "baseControllerPlayerId"],
        (key) => dataValue(record, key),
      );
    case "token": {
      const origin = dataValue(record, "origin") as Readonly<Record<string, unknown>>;
      const canonicalOrigin = canonicalRecord<import("./tokenObjectV2").CoreTokenOriginV2>(
        ["kind", "sourceObjectId"],
        (key) => dataValue(origin, key),
      );
      return canonicalRecord<CoreGameObjectIdentityV2>(
        [
          "kind",
          "definitionId",
          "ownerPlayerId",
          "incarnation",
          "baseControllerPlayerId",
          "origin",
        ],
        (key) => (key === "origin" ? canonicalOrigin : dataValue(record, key)),
      );
    }
    case "spell-copy":
      return canonicalRecord<CoreGameObjectIdentityV2>(
        ["kind", "definitionId", "controllerPlayerId", "copiedFromObjectId"],
        (key) => dataValue(record, key),
      );
    case "activated-ability":
    case "triggered-ability":
      return canonicalRecord<CoreGameObjectIdentityV2>(
        ["kind", "controllerPlayerId", "sourceObjectId", "abilityKey"],
        (key) => dataValue(record, key),
      );
  }
}

export function canonicalizeModeNeutralCoreObjectRegistryStateV2(
  value: ModeNeutralCoreObjectRegistryStateV2,
): ModeNeutralCoreObjectRegistryStateV2 {
  const v1 = canonicalizeModeNeutralCoreIdentityZoneSliceV1(projectRegistryToV1(value));
  const objects = value.objects as Readonly<Record<string, CoreGameObjectIdentityV2>>;
  const objectIds = sortedKeys(objects);
  const canonical = canonicalRecord<ModeNeutralCoreObjectRegistryStateV2>(
    REGISTRY_ROOT_FIELDS,
    (key) => {
      switch (key) {
        case "kind":
          return "mode-neutral-core-object-registry-slice-v2";
        case "players":
          return v1.players;
        case "turnOrder":
          return cloneArray(v1.turnOrder);
        case "activePlayerId":
          return v1.activePlayerId;
        case "cardDefinitions":
          return v1.cardDefinitions;
        case "physicalCards":
          return v1.physicalCards;
        case "objects":
          return canonicalRecord<Readonly<Record<CoreObjectId, CoreGameObjectIdentityV2>>>(
            objectIds,
            (objectId) => canonicalizeObjectIdentity(objects[objectId]),
          );
        case "zones":
          return canonicalizeZones(value.zones, v1.turnOrder);
      }
    },
  );
  return deepFreeze(canonical);
}

export const canonicalizeModeNeutralCoreObjectRegistrySliceV2 =
  canonicalizeModeNeutralCoreObjectRegistryStateV2;
export const canonicalizeCoreObjectRegistryStateV2 =
  canonicalizeModeNeutralCoreObjectRegistryStateV2;

export function canonicalizeModeNeutralCoreObjectRuntimeStateV2(
  value: ModeNeutralCoreObjectRuntimeStateV2,
): ModeNeutralCoreObjectRuntimeStateV2 {
  const byObject = value.byObject as Readonly<Record<string, unknown>>;
  const objectIds = sortedKeys(byObject);
  const canonical = canonicalRecord<ModeNeutralCoreObjectRuntimeStateV2>(
    RUNTIME_ROOT_FIELDS,
    (key) => key === "kind"
      ? "mode-neutral-core-object-runtime-slice-v2"
      : canonicalRecord<Readonly<Record<CoreObjectId, CoreCardObjectRuntimeStateV1>>>(
        objectIds,
        (objectId) => cloneDataValue(dataValue(byObject, objectId)),
      ),
  );
  return deepFreeze(canonical);
}

export const canonicalizeModeNeutralCoreObjectRuntimeSliceV2 =
  canonicalizeModeNeutralCoreObjectRuntimeStateV2;
export const canonicalizeCoreObjectRuntimeStateV2 =
  canonicalizeModeNeutralCoreObjectRuntimeStateV2;

export class CoreObjectRegistryAdapterErrorV2 extends TypeError {
  readonly issues: readonly { readonly code: string; readonly path: string; readonly message: string }[];

  constructor(
    message: string,
    issues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
  ) {
    super(message);
    this.name = "CoreObjectRegistryAdapterErrorV2";
    this.issues = issues;
  }
}

function throwAdapterError(
  message: string,
  issues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): never {
  throw new CoreObjectRegistryAdapterErrorV2(message, issues);
}

export function upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2(
  input: unknown,
): ModeNeutralCoreObjectRegistryStateV2 {
  const validation = validateModeNeutralCoreIdentityZoneSliceV1(input);
  if (!validation.ok) {
    return throwAdapterError(
      "Invalid V1 identity/zone slice",
      validation.issues,
    );
  }
  const v1 = validation.value;
  const objects: Record<string, CoreGameObjectIdentityV2> = Object.create(null) as Record<
    string,
    CoreGameObjectIdentityV2
  >;
  const cardObjects = v1.cardObjects as Readonly<Record<string, CoreCardObjectIdentityV1>>;
  for (const objectId of Object.keys(cardObjects)) {
    objects[objectId] = cardObjects[objectId];
  }
  return canonicalizeModeNeutralCoreObjectRegistryStateV2({
    kind: "mode-neutral-core-object-registry-slice-v2",
    players: v1.players,
    turnOrder: v1.turnOrder,
    activePlayerId: v1.activePlayerId,
    cardDefinitions: v1.cardDefinitions,
    physicalCards: v1.physicalCards,
    objects,
    zones: v1.zones,
  });
}

export const upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryStateV2 =
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2;

export function upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
  identityInput: unknown,
  runtimeInput: unknown,
): ModeNeutralCoreObjectRuntimeStateV2 {
  const identity = validateModeNeutralCoreIdentityZoneSliceV1(identityInput);
  if (!identity.ok) {
    return throwAdapterError("Invalid V1 identity/zone slice", identity.issues);
  }
  const runtime = validateModeNeutralCoreCardRuntimeSliceV1(identity.value, runtimeInput);
  if (!runtime.ok) {
    return throwAdapterError("Invalid V1 card runtime slice", runtime.issues);
  }
  const runtimeValue = runtime.value;
  return canonicalizeModeNeutralCoreObjectRuntimeStateV2({
    kind: "mode-neutral-core-object-runtime-slice-v2",
    byObject: runtimeValue.byObject,
  });
}

export const upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeStateV2 =
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2;

