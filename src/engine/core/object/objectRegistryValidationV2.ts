import {
  isCoreBaseId,
  isCoreUnsafeRecordKey,
} from "../ids";
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePlayerId,
} from "../ids";
import type {
  CoreCardObjectRuntimeStateV1,
  ModeNeutralCoreCardRuntimeSliceV1,
} from "../runtime/cardRuntimeState";
import {
  validateCoreAttachmentStateV1,
} from "../runtime/attachment";
import type {
  CoreAttachmentTargetV1,
  CoreAttachmentValidationIssue,
} from "../runtime/attachment";
import {
  validateCoreCardOrientationStateV1,
} from "../runtime/cardOrientation";
import type {
  CoreCardOrientationValidationIssue,
} from "../runtime/cardOrientation";
import {
  validateCoreCounterDamageStateV1,
} from "../runtime/counterDamage";
import type {
  CoreCounterDamageValidationIssue,
} from "../runtime/counterDamage";
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
import {
  canonicalizeModeNeutralCoreObjectRegistryStateV2AfterValidation,
  canonicalizeModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryCanonicalizationV2";
import type {
  ModeNeutralCoreObjectRegistryStateV2,
  ModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryStateV2";
import {
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
  validateCoreGameObjectIdentityV2,
} from "./tokenObjectV2";
import type {
  CoreGameObjectIdentityV2,
} from "./tokenObjectV2";

export type CoreObjectRegistryValidationCode = string;

export interface CoreObjectRegistryValidationIssue {
  readonly code: CoreObjectRegistryValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreObjectRegistryValidationResult =
  | Readonly<{
      readonly ok: true;
      readonly value: ModeNeutralCoreObjectRegistryStateV2;
    }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreObjectRegistryValidationIssue[];
    }>;

export type CoreObjectRegistryValidationIssueV2 = CoreObjectRegistryValidationIssue;
export type CoreObjectRegistryValidationResultV2 = CoreObjectRegistryValidationResult;

export class CoreObjectRegistryCreationErrorV2 extends Error {
  readonly issues: readonly CoreObjectRegistryValidationIssue[];

  constructor(issues: readonly CoreObjectRegistryValidationIssue[]) {
    super(`Invalid mode-neutral Core object registry slice (${issues.length} issue(s))`);
    this.name = "CoreObjectRegistryCreationErrorV2";
    this.issues = issues;
  }
}

export type CoreObjectRuntimeValidationCode = string;

export interface CoreObjectRuntimeValidationIssue {
  readonly code: CoreObjectRuntimeValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreObjectRuntimeValidationResult =
  | Readonly<{
      readonly ok: true;
      readonly value: ModeNeutralCoreObjectRuntimeStateV2;
    }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreObjectRuntimeValidationIssue[];
    }>;

export type CoreObjectRuntimeValidationIssueV2 = CoreObjectRuntimeValidationIssue;
export type CoreObjectRuntimeValidationResultV2 = CoreObjectRuntimeValidationResult;

export class CoreObjectRuntimeCreationErrorV2 extends Error {
  readonly issues: readonly CoreObjectRuntimeValidationIssue[];

  constructor(issues: readonly CoreObjectRuntimeValidationIssue[]) {
    super(`Invalid mode-neutral Core object runtime slice (${issues.length} issue(s))`);
    this.name = "CoreObjectRuntimeCreationErrorV2";
    this.issues = issues;
  }
}

type RawRecord = Record<string, unknown>;
type ZoneName = "library" | "hand" | "graveyard" | "battlefield" | "stack" | "exile" | "command";
type ZoneReference = Readonly<{
  readonly objectId: string;
  readonly zone: ZoneName;
  readonly path: string;
}>;

const ROOT_KIND = "mode-neutral-core-object-registry-slice-v2";
const RUNTIME_ROOT_KIND = "mode-neutral-core-object-runtime-slice-v2";
const ROOT_FIELDS = [
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
const ZONES_FIELDS = ["byPlayer", "shared"] as const;
const PLAYER_ZONE_FIELDS = ["library", "hand", "graveyard"] as const;
const SHARED_ZONE_FIELDS = ["battlefield", "stack", "exile", "command"] as const;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  let arrayValue: boolean;
  try {
    arrayValue = Array.isArray(value);
  } catch {
    return false;
  }
  if (value === null || typeof value !== "object" || arrayValue) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function dataDescriptorValue(
  descriptor: PropertyDescriptor | undefined,
): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
    return null;
  }
  return { value: descriptor.value };
}

function safeDataValue(value: object, key: string): { readonly value: unknown } | null {
  try {
    return dataDescriptorValue(Object.getOwnPropertyDescriptor(value, key));
  } catch {
    return null;
  }
}

function safeOwnKeys(value: object): readonly (string | symbol)[] | null {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return null;
  }
}

class IssueCollector {
  private readonly values: CoreObjectRegistryValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: string, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push(Object.freeze({ code, path, message }));
  }

  sorted(): readonly CoreObjectRegistryValidationIssue[] {
    return Object.freeze(this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path)
      || codeUnitCompare(left.code, right.code)
      || codeUnitCompare(left.message, right.message)));
  }
}

class RuntimeIssueCollector {
  private readonly values: CoreObjectRuntimeValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: string, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push(Object.freeze({ code, path, message }));
  }

  sorted(): readonly CoreObjectRuntimeValidationIssue[] {
    return Object.freeze(this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path)
      || codeUnitCompare(left.code, right.code)
      || codeUnitCompare(left.message, right.message)));
  }
}

function readObject(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: IssueCollector | RuntimeIssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add("INVALID_TYPE", path, "Expected a plain record");
    return null;
  }
  const keys = safeOwnKeys(value);
  if (keys === null) {
    issues.add("INVALID_TYPE", path, "Record descriptors are not readable");
    return null;
  }
  const expected = new Set(fields);
  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== "string") {
      issues.add("UNKNOWN_FIELD", `${path}/[symbol]`, "Symbol fields are not allowed");
      continue;
    }
    const fieldPath = pointer(path, key);
    if (!expected.has(key)) {
      issues.add("UNKNOWN_FIELD", fieldPath, `Unknown field: ${key}`);
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add("INVALID_TYPE", fieldPath, "Field descriptor is not readable");
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.add("INVALID_TYPE", fieldPath, "Fields must be enumerable");
      continue;
    }
    const data = dataDescriptorValue(descriptor);
    if (data === null) {
      issues.add("INVALID_TYPE", fieldPath, "Accessor properties are not allowed");
      continue;
    }
    result[key] = data.value;
  }
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add("MISSING_FIELD", pointer(path, field), "Required field is missing");
    }
  }
  return result;
}

function readRecord(
  value: unknown,
  path: string,
  issues: IssueCollector | RuntimeIssueCollector,
): readonly (readonly [string, unknown])[] {
  if (!isPlainRecord(value)) {
    issues.add("INVALID_TYPE", path, "Expected a plain record");
    return [];
  }
  const keys = safeOwnKeys(value);
  if (keys === null) {
    issues.add("INVALID_TYPE", path, "Record descriptors are not readable");
    return [];
  }
  const entries: Array<readonly [string, unknown]> = [];
  for (const key of keys) {
    if (typeof key !== "string") {
      issues.add("UNKNOWN_FIELD", `${path}/[symbol]`, "Symbol record keys are not allowed");
      continue;
    }
    const entryPath = pointer(path, key);
    if (isCoreUnsafeRecordKey(key)) {
      issues.add("UNSAFE_RECORD_KEY", entryPath, `Unsafe record key: ${key}`);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add("INVALID_TYPE", entryPath, "Record descriptor is not readable");
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.add("INVALID_TYPE", entryPath, "Record entries must be enumerable");
      continue;
    }
    const data = dataDescriptorValue(descriptor);
    if (data === null) {
      issues.add("INVALID_TYPE", entryPath, "Accessor record values are not allowed");
      continue;
    }
    entries.push([key, data.value]);
  }
  return entries;
}

function readArray(
  value: unknown,
  path: string,
  issues: IssueCollector | RuntimeIssueCollector,
): readonly unknown[] {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    issues.add("INVALID_TYPE", path, "Array shape is not readable");
  }
  if (!isArray) {
    issues.add("INVALID_TYPE", path, "Expected an array");
    return [];
  }
  try {
    if (Reflect.getPrototypeOf(value as object) !== Array.prototype) {
      issues.add("INVALID_TYPE", path, "Expected an ordinary array");
    }
  } catch {
    issues.add("INVALID_TYPE", path, "Array prototype is not readable");
  }
  const keys = safeOwnKeys(value as object);
  if (keys === null) {
    issues.add("INVALID_TYPE", path, "Array descriptors are not readable");
    return [];
  }
  let lengthDescriptor: { readonly value: unknown } | null = null;
  try {
    lengthDescriptor = dataDescriptorValue(
      Object.getOwnPropertyDescriptor(value, "length"),
    );
  } catch {
    issues.add("INVALID_TYPE", path, "Array length descriptor is not readable");
  }
  const length = lengthDescriptor?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    issues.add("INVALID_TYPE", path, "Expected an ordinary array length");
    return [];
  }
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string") {
      issues.add("UNKNOWN_FIELD", `${path}/[symbol]`, "Symbol array properties are not allowed");
      continue;
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      issues.add("UNKNOWN_FIELD", pointer(path, key), `Unknown array property: ${key}`);
    }
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const itemPath = pointer(path, String(index));
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      issues.add("INVALID_TYPE", itemPath, "Array element descriptor is not readable");
      result.push(undefined);
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || dataDescriptorValue(descriptor) === null) {
      issues.add("INVALID_TYPE", itemPath, "Array elements must be enumerable data properties");
      result.push(undefined);
      continue;
    }
    result.push(descriptor.value);
  }
  return result;
}

function ownDataValue(value: unknown, key: string): unknown {
  if (!isPlainRecord(value)) return undefined;
  return safeDataValue(value, key)?.value;
}

function appendNestedIssues(
  issues: IssueCollector | RuntimeIssueCollector,
  path: string,
  nestedIssues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): void {
  for (const issue of nestedIssues) issues.add(issue.code, `${path}${issue.path}`, issue.message);
}

function appendV1Issues(
  issues: IssueCollector,
  nestedIssues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): void {
  for (const issue of nestedIssues) {
    const path = issue.path.startsWith("/cardObjects")
      ? `/objects${issue.path.slice("/cardObjects".length)}`
      : issue.path;
    issues.add(issue.code, path, issue.message);
  }
}

function cardKindObject(value: unknown): boolean {
  return ownDataValue(value, "kind") === "card";
}

function copyDataRecord(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const result = Object.create(null) as Record<string, unknown>;
  const keys = safeOwnKeys(value);
  if (keys === null) return result;
  for (const key of keys) {
    if (typeof key !== "string") continue;
    const descriptor = safeDataValue(value, key);
    if (descriptor !== null) result[key] = descriptor.value;
  }
  return result;
}

function filterCardArray(value: unknown, cardObjectIds: ReadonlySet<string>): unknown {
  try {
    if (!Array.isArray(value)) return value;
  } catch {
    return [];
  }
  const result: unknown[] = [];
  const length = safeDataValue(value as object, "length")?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) return [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = safeDataValue(value as object, String(index));
    if (descriptor !== null && typeof descriptor.value === "string" && cardObjectIds.has(descriptor.value)) {
      result.push(descriptor.value);
    }
  }
  return result;
}

function projectZonesToV1(
  zones: unknown,
  cardObjectIds: ReadonlySet<string>,
): unknown {
  const zoneRecord = copyDataRecord(zones);
  if (zoneRecord === null) return zones;
  const byPlayer = copyDataRecord(zoneRecord.byPlayer);
  if (byPlayer !== null) {
    for (const playerId of Object.keys(byPlayer)) {
      const playerZones = copyDataRecord(byPlayer[playerId]);
      if (playerZones === null) continue;
      for (const zone of PLAYER_ZONE_FIELDS) {
        playerZones[zone] = filterCardArray(playerZones[zone], cardObjectIds);
      }
      byPlayer[playerId] = playerZones;
    }
    zoneRecord.byPlayer = byPlayer;
  }
  const shared = copyDataRecord(zoneRecord.shared);
  if (shared !== null) {
    for (const zone of SHARED_ZONE_FIELDS) {
      shared[zone] = filterCardArray(shared[zone], cardObjectIds);
    }
    zoneRecord.shared = shared;
  }
  return zoneRecord;
}

function projectRegistryToV1(
  root: RawRecord,
  objectEntries: readonly (readonly [string, unknown])[],
): ModeNeutralCoreIdentityZoneSliceV1 {
  const cardObjects = Object.create(null) as Record<string, unknown>;
  const cardObjectIds = new Set<string>();
  for (const [objectId, object] of objectEntries) {
    if (!cardKindObject(object)) continue;
    cardObjects[objectId] = object;
    cardObjectIds.add(objectId);
  }
  return {
    kind: "mode-neutral-core-identity-zone-slice-v1",
    players: root.players as ModeNeutralCoreIdentityZoneSliceV1["players"],
    turnOrder: root.turnOrder as ModeNeutralCoreIdentityZoneSliceV1["turnOrder"],
    activePlayerId: root.activePlayerId as CorePlayerId,
    cardDefinitions: root.cardDefinitions as ModeNeutralCoreIdentityZoneSliceV1["cardDefinitions"],
    physicalCards: root.physicalCards as ModeNeutralCoreIdentityZoneSliceV1["physicalCards"],
    cardObjects: cardObjects as ModeNeutralCoreIdentityZoneSliceV1["cardObjects"],
    zones: projectZonesToV1(root.zones, cardObjectIds) as CoreZonesV1,
  };
}

function addIdentityIssues(
  issues: IssueCollector,
  objectId: string,
  nestedIssues: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): void {
  for (const issue of nestedIssues) {
    const suffix = issue.path === "$" ? "" : issue.path.slice(1).replaceAll(".", "/");
    issues.add(issue.code, `/objects/${escapePointerSegment(objectId)}${suffix}`, issue.message);
  }
}

function validateObjectIdKey(
  objectId: string,
  path: string,
  issues: IssueCollector,
): void {
  if (!isCanonicalCoreObjectIdV2(objectId)) {
    issues.add("INVALID_ID", path, "Object key must be a canonical Core object ID V2");
  }
}

function validateObjectIdMatchesIdentityKind(
  objectId: string,
  object: CoreGameObjectIdentityV2,
  path: string,
  issues: IssueCollector,
): void {
  const parsed = parseCoreObjectIdV2(objectId);
  if (parsed === null || parsed.kind !== object.kind) {
    issues.add(
      "OBJECT_ID_KIND_MISMATCH",
      path,
      `Object ID family must match identity kind ${object.kind}`,
    );
    return;
  }
  if (object.kind === "card" && parsed.kind === "card") {
    if (parsed.physicalCardId !== object.physicalCardId) {
      issues.add(
        "OBJECT_ID_PHYSICAL_CARD_MISMATCH",
        `${path}/physicalCardId`,
        "Card object ID physical card does not match identity",
      );
    }
    if (parsed.incarnation !== object.incarnation) {
      issues.add(
        "OBJECT_ID_INCARNATION_MISMATCH",
        `${path}/incarnation`,
        "Card object ID incarnation does not match identity",
      );
    }
  }
  if (object.kind === "token" && parsed.kind === "token" && parsed.incarnation !== object.incarnation) {
    issues.add(
      "OBJECT_ID_INCARNATION_MISMATCH",
      `${path}/incarnation`,
      "Token object ID incarnation does not match identity",
    );
  }
}

function validateBaseIdKey(
  key: string,
  path: string,
  issues: IssueCollector,
): void {
  if (!isCoreBaseId(key)) issues.add("INVALID_ID", path, "Record key must be a Core base ID");
}

function validateZones(
  value: unknown,
  objectIds: ReadonlySet<string>,
  issues: IssueCollector,
): readonly ZoneReference[] {
  const references: ZoneReference[] = [];
  const zones = readObject(value, "/zones", ZONES_FIELDS, issues);
  if (zones === null) return references;

  const byPlayerEntries = readRecord(zones.byPlayer, "/zones/byPlayer", issues);
  for (const [playerId, playerZonesValue] of byPlayerEntries) {
    const playerZones = readObject(
      playerZonesValue,
      `/zones/byPlayer/${escapePointerSegment(playerId)}`,
      PLAYER_ZONE_FIELDS,
      issues,
    );
    if (playerZones === null) continue;
    for (const zone of PLAYER_ZONE_FIELDS) {
      const zonePath = `/zones/byPlayer/${escapePointerSegment(playerId)}/${zone}`;
      const values = readArray(playerZones[zone], zonePath, issues);
      for (let index = 0; index < values.length; index += 1) {
        const item = values[index];
        const itemPath = pointer(zonePath, String(index));
        if (typeof item !== "string") {
          issues.add("INVALID_ID", itemPath, "Zone entries must be Core object IDs");
          continue;
        }
        if (!objectIds.has(item)) {
          issues.add("ZONE_OBJECT_NOT_FOUND", itemPath, "Zone object does not exist");
        }
        references.push(Object.freeze({ objectId: item, zone, path: itemPath }));
      }
    }
  }

  const shared = readObject(zones.shared, "/zones/shared", SHARED_ZONE_FIELDS, issues);
  if (shared !== null) {
    for (const zone of SHARED_ZONE_FIELDS) {
      const zonePath = `/zones/shared/${zone}`;
      const values = readArray(shared[zone], zonePath, issues);
      for (let index = 0; index < values.length; index += 1) {
        const item = values[index];
        const itemPath = pointer(zonePath, String(index));
        if (typeof item !== "string") {
          issues.add("INVALID_ID", itemPath, "Zone entries must be Core object IDs");
          continue;
        }
        if (!objectIds.has(item)) {
          issues.add("ZONE_OBJECT_NOT_FOUND", itemPath, "Zone object does not exist");
        }
        references.push(Object.freeze({ objectId: item, zone, path: itemPath }));
      }
    }
  }
  return references;
}

function locationOf(
  references: readonly ZoneReference[],
  objectId: string,
): ZoneReference | null {
  return references.find((reference) => reference.objectId === objectId) ?? null;
}

function validateObjectSemantics(
  objectId: string,
  object: CoreGameObjectIdentityV2,
  references: readonly ZoneReference[],
  playerIds: ReadonlySet<string>,
  definitionIds: ReadonlySet<string>,
  issues: IssueCollector,
): void {
  const path = `/objects/${escapePointerSegment(objectId)}`;
  const location = locationOf(references, objectId);
  if (object.kind === "token") {
    if (!definitionIds.has(object.definitionId)) {
      issues.add("CARD_DEFINITION_NOT_FOUND", `${path}/definitionId`, "Token definition does not exist");
    }
    if (!playerIds.has(object.ownerPlayerId)) {
      issues.add("OWNER_NOT_SEATED", `${path}/ownerPlayerId`, "Token owner is not seated");
    }
    if (!playerIds.has(object.baseControllerPlayerId)) {
      issues.add("BASE_CONTROLLER_NOT_SEATED", `${path}/baseControllerPlayerId`, "Token controller is not seated");
    }
    if (location?.zone !== "battlefield") {
      issues.add("INVALID_ZONE_FOR_OBJECT", path, "Token objects must be in battlefield");
    }
    return;
  }
  if (object.kind === "spell-copy") {
    if (!definitionIds.has(object.definitionId)) {
      issues.add("CARD_DEFINITION_NOT_FOUND", `${path}/definitionId`, "Spell-copy definition does not exist");
    }
    if (!playerIds.has(object.controllerPlayerId)) {
      issues.add("BASE_CONTROLLER_NOT_SEATED", `${path}/controllerPlayerId`, "Spell-copy controller is not seated");
    }
    if (location?.zone !== "stack") {
      issues.add("INVALID_ZONE_FOR_OBJECT", path, "Spell-copy objects must be in stack");
    }
    return;
  }
  if (object.kind === "activated-ability" || object.kind === "triggered-ability") {
    if (!playerIds.has(object.controllerPlayerId)) {
      issues.add("BASE_CONTROLLER_NOT_SEATED", `${path}/controllerPlayerId`, "Ability controller is not seated");
    }
    if (location?.zone !== "stack") {
      issues.add("INVALID_ZONE_FOR_OBJECT", path, "Ability objects must be in stack");
    }
  }
}

function identityObjectIds(
  identity: ModeNeutralCoreObjectRegistryStateV2,
): readonly CoreObjectId[] {
  return Object.keys(identity.objects).sort(codeUnitCompare) as CoreObjectId[];
}

function objectZone(
  identity: ModeNeutralCoreObjectRegistryStateV2,
  objectId: string,
): ZoneName | null {
  const playerIds = identity.turnOrder;
  for (const playerId of playerIds) {
    const zones = identity.zones.byPlayer[playerId];
    for (const zone of PLAYER_ZONE_FIELDS) {
      if (zones[zone].includes(objectId as CoreObjectId)) return zone;
    }
  }
  for (const zone of SHARED_ZONE_FIELDS) {
    if (identity.zones.shared[zone].includes(objectId as CoreObjectId)) return zone;
  }
  return null;
}

function definitionFaceCount(
  identity: ModeNeutralCoreObjectRegistryStateV2,
  object: CoreGameObjectIdentityV2,
): number | null {
  let definitionId: CoreCardDefinitionId | undefined;
  if (object.kind === "card") {
    const physical = identity.physicalCards[object.physicalCardId];
    definitionId = physical?.definitionId;
  } else if (object.kind === "token") {
    definitionId = object.definitionId;
  }
  if (definitionId === undefined) return null;
  return identity.cardDefinitions[definitionId]?.faces.length ?? null;
}

function validateRuntimeCrossState(
  identity: ModeNeutralCoreObjectRegistryStateV2,
  objectId: CoreObjectId,
  object: CoreGameObjectIdentityV2,
  value: CoreCardObjectRuntimeStateV1,
  objectIds: ReadonlySet<string>,
  playerIds: ReadonlySet<string>,
  issues: RuntimeIssueCollector,
): void {
  const basePath = pointer("/byObject", objectId);
  const zone = objectZone(identity, objectId);
  if (zone === null) return;
  const faceCount = definitionFaceCount(identity, object);
  if (faceCount !== null && value.orientation.faceIndex >= faceCount) {
    issues.add(
      "FACE_INDEX_OUT_OF_RANGE",
      `${basePath}/orientation/faceIndex`,
      "faceIndex must be less than the definition face count",
    );
  }
  if (zone !== "battlefield" && zone !== "stack" && value.orientation.faceIndex !== 0) {
    issues.add(
      "FACE_INDEX_NOT_ZERO_OUTSIDE_BATTLEFIELD_OR_STACK",
      `${basePath}/orientation/faceIndex`,
      "faceIndex must be zero outside battlefield and stack",
    );
  }
  if (value.orientation.faceDown && zone !== "battlefield" && zone !== "stack" && zone !== "exile") {
    issues.add(
      "FACE_DOWN_NOT_ALLOWED_IN_ZONE",
      `${basePath}/orientation/faceDown`,
      "faceDown is only allowed in battlefield, stack, and exile",
    );
  }
  if (zone !== "battlefield") {
    if (value.orientation.tapped) {
      issues.add("TAPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD", `${basePath}/orientation/tapped`, "tapped must be false outside battlefield");
    }
    if (value.orientation.flipped) {
      issues.add("FLIPPED_NOT_ALLOWED_OUTSIDE_BATTLEFIELD", `${basePath}/orientation/flipped`, "flipped must be false outside battlefield");
    }
    if (value.orientation.phasedOut) {
      issues.add("PHASED_OUT_NOT_ALLOWED_OUTSIDE_BATTLEFIELD", `${basePath}/orientation/phasedOut`, "phasedOut must be false outside battlefield");
    }
    if (value.counterDamage.markedDamage !== 0) {
      issues.add("MARKED_DAMAGE_NOT_ALLOWED_OUTSIDE_BATTLEFIELD", `${basePath}/counterDamage/markedDamage`, "markedDamage must be zero outside battlefield");
    }
  }
  const attachedTo = value.attachment.attachedTo;
  if (attachedTo === null) return;
  if (zone !== "battlefield") {
    issues.add("ATTACHMENT_SOURCE_NOT_ON_BATTLEFIELD", `${basePath}/attachment/attachedTo`, "A card outside battlefield cannot have an attachment target");
  }
  validateAttachmentTargetV2(attachedTo, objectId, objectIds, playerIds, basePath, issues);
}

function validateAttachmentTargetV2(
  target: CoreAttachmentTargetV1,
  sourceObjectId: CoreObjectId,
  objectIds: ReadonlySet<string>,
  playerIds: ReadonlySet<string>,
  basePath: string,
  issues: RuntimeIssueCollector,
): void {
  if (target.kind === "object") {
    if (!objectIds.has(target.objectId)) {
      issues.add("ATTACHMENT_TARGET_OBJECT_NOT_FOUND", `${basePath}/attachment/attachedTo/objectId`, "Attachment target object does not exist");
    }
    if (target.objectId === sourceObjectId) {
      issues.add("SELF_ATTACHMENT", `${basePath}/attachment/attachedTo/objectId`, "An object cannot attach to itself");
    }
    return;
  }
  if (!playerIds.has(target.playerId)) {
    issues.add("ATTACHMENT_TARGET_PLAYER_NOT_FOUND", `${basePath}/attachment/attachedTo/playerId`, "Attachment target player does not exist");
  }
}

function readRuntimeState(
  value: unknown,
  path: string,
  issues: RuntimeIssueCollector,
): CoreCardObjectRuntimeStateV1 | null {
  const root = readObject(value, path, ["orientation", "counterDamage", "attachment"], issues);
  if (root === null) return null;
  let orientation: ReturnType<typeof validateCoreCardOrientationStateV1> | null;
  let counterDamage: ReturnType<typeof validateCoreCounterDamageStateV1> | null;
  let attachment: ReturnType<typeof validateCoreAttachmentStateV1> | null;
  try {
    orientation = validateCoreCardOrientationStateV1(root.orientation);
  } catch {
    orientation = null;
    issues.add(
      "INVALID_TYPE",
      `${path}/orientation`,
      "Runtime orientation could not be validated safely",
    );
  }
  try {
    counterDamage = validateCoreCounterDamageStateV1(root.counterDamage);
  } catch {
    counterDamage = null;
    issues.add(
      "INVALID_TYPE",
      `${path}/counterDamage`,
      "Runtime counter damage could not be validated safely",
    );
  }
  try {
    attachment = validateCoreAttachmentStateV1(root.attachment);
  } catch {
    attachment = null;
    issues.add(
      "INVALID_TYPE",
      `${path}/attachment`,
      "Runtime attachment could not be validated safely",
    );
  }
  if (orientation === null || counterDamage === null || attachment === null) return null;
  if (!orientation.ok) appendNestedIssues(issues, `${path}/orientation`, orientation.issues);
  if (!counterDamage.ok) appendNestedIssues(issues, `${path}/counterDamage`, counterDamage.issues);
  if (!attachment.ok) appendNestedIssues(issues, `${path}/attachment`, attachment.issues);
  if (!orientation.ok || !counterDamage.ok || !attachment.ok) return null;
  return Object.freeze({
    orientation: orientation.value,
    counterDamage: counterDamage.value,
    attachment: attachment.value,
  });
}

function failedRegistry(
  issues: IssueCollector,
): CoreObjectRegistryValidationResult {
  return Object.freeze({ ok: false, issues: issues.sorted() });
}

function failedRuntime(
  issues: RuntimeIssueCollector,
): CoreObjectRuntimeValidationResult {
  return Object.freeze({ ok: false, issues: issues.sorted() });
}

function validateModeNeutralCoreObjectRegistryStateV2Internal(
  input: unknown,
  canonicalizeOutput: boolean,
): CoreObjectRegistryValidationResult {
  const issues = new IssueCollector();
  const root = readObject(input, "", ROOT_FIELDS, issues);
  if (root === null) return failedRegistry(issues);
  if (root.kind !== ROOT_KIND) issues.add("INVALID_LITERAL", "/kind", `Expected ${ROOT_KIND}`);

  const objectEntries = readRecord(root.objects, "/objects", issues);
  const objectIds = new Set<string>();
  const canonicalObjects = new Map<string, CoreGameObjectIdentityV2>();
  for (const [objectId, objectValue] of objectEntries) {
    objectIds.add(objectId);
    validateObjectIdKey(objectId, `/objects/${escapePointerSegment(objectId)}`, issues);
    const identity = validateCoreGameObjectIdentityV2(objectValue);
    if (!identity.ok) {
      addIdentityIssues(issues, objectId, identity.issues);
    } else {
      canonicalObjects.set(objectId, identity.value);
    }
  }

  const playerEntries = readRecord(root.players, "/players", issues);
  const playerIds = new Set<string>();
  for (const [playerId] of playerEntries) {
    playerIds.add(playerId);
    validateBaseIdKey(playerId, `/players/${escapePointerSegment(playerId)}`, issues);
  }
  const definitionEntries = readRecord(root.cardDefinitions, "/cardDefinitions", issues);
  const definitionIds = new Set<string>();
  for (const [definitionId] of definitionEntries) {
    definitionIds.add(definitionId);
    validateBaseIdKey(definitionId, `/cardDefinitions/${escapePointerSegment(definitionId)}`, issues);
  }

  const v1Projection = projectRegistryToV1(root, objectEntries);
  let v1Validation: ReturnType<typeof validateModeNeutralCoreIdentityZoneSliceV1> | null;
  try {
    v1Validation = validateModeNeutralCoreIdentityZoneSliceV1(v1Projection);
  } catch {
    v1Validation = null;
    issues.add(
      "INVALID_TYPE",
      "/",
      "V1 projection could not be validated safely",
    );
  }
  if (v1Validation !== null && !v1Validation.ok) {
    appendV1Issues(issues, v1Validation.issues);
  }

  const references = validateZones(root.zones, objectIds, issues);
  const locationCounts = new Map<string, number>();
  for (const reference of references) {
    if (!objectIds.has(reference.objectId)) continue;
    locationCounts.set(reference.objectId, (locationCounts.get(reference.objectId) ?? 0) + 1);
  }
  for (const objectId of objectIds) {
    if (locationCounts.get(objectId) !== 1) {
      issues.add("OBJECT_NOT_IN_EXACTLY_ONE_ZONE", `/objects/${escapePointerSegment(objectId)}`, "Object must occur in exactly one zone");
    }
  }
  for (const [objectId, object] of canonicalObjects) {
    validateObjectIdMatchesIdentityKind(
      objectId,
      object,
      `/objects/${escapePointerSegment(objectId)}`,
      issues,
    );
    validateObjectSemantics(objectId, object, references, playerIds, definitionIds, issues);
  }

  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0 || v1Validation === null || !v1Validation.ok) {
    return Object.freeze({ ok: false, issues: sortedIssues });
  }

  const v1 = v1Validation.value;
  const canonicalInput: ModeNeutralCoreObjectRegistryStateV2 = {
    kind: ROOT_KIND,
    players: v1.players,
    turnOrder: v1.turnOrder,
    activePlayerId: v1.activePlayerId,
    cardDefinitions: v1.cardDefinitions,
    physicalCards: v1.physicalCards,
    objects: Object.fromEntries(canonicalObjects),
    zones: root.zones as CoreZonesV1,
  };
  return Object.freeze({
    ok: true,
    value: canonicalizeOutput
      ? canonicalizeModeNeutralCoreObjectRegistryStateV2AfterValidation(canonicalInput)
      : canonicalInput,
  });
}

export function validateModeNeutralCoreObjectRegistryStateV2(
  input: unknown,
): CoreObjectRegistryValidationResult {
  return validateModeNeutralCoreObjectRegistryStateV2Internal(input, true);
}

export function validateModeNeutralCoreObjectRegistryForCanonicalization(
  input: unknown,
): CoreObjectRegistryValidationResult {
  return validateModeNeutralCoreObjectRegistryStateV2Internal(input, false);
}

export const validateModeNeutralCoreObjectRegistrySliceV2 =
  validateModeNeutralCoreObjectRegistryStateV2;
export const validateCoreObjectRegistryStateV2 =
  validateModeNeutralCoreObjectRegistryStateV2;
export const validateCoreObjectRegistryV2 =
  validateModeNeutralCoreObjectRegistryStateV2;

function identityValidationForRuntime(
  identityInput: unknown,
  issues: RuntimeIssueCollector,
): ModeNeutralCoreObjectRegistryStateV2 | null {
  const identity = validateModeNeutralCoreObjectRegistryStateV2(identityInput);
  if (!identity.ok) {
    for (const issue of identity.issues) issues.add(issue.code, `/identity${issue.path}`, issue.message);
    return null;
  }
  return identity.value;
}

export function validateModeNeutralCoreObjectRuntimeStateV2(
  identityInput: unknown,
  input: unknown,
): CoreObjectRuntimeValidationResult {
  const issues = new RuntimeIssueCollector();
  const identity = identityValidationForRuntime(identityInput, issues);
  const root = readObject(input, "", RUNTIME_ROOT_FIELDS, issues);
  if (root === null) return failedRuntime(issues);
  if (root.kind !== RUNTIME_ROOT_KIND) issues.add("INVALID_LITERAL", "/kind", `Expected ${RUNTIME_ROOT_KIND}`);

  const entries = readRecord(root.byObject, "/byObject", issues);
  if (identity === null) return failedRuntime(issues);

  const expectedIds = identityObjectIds(identity).filter((objectId) => {
    const kind = identity.objects[objectId].kind;
    return kind === "card" || kind === "token";
  });
  const expectedSet = new Set<string>(expectedIds);
  const values = new Map<string, unknown>(entries);
  for (const objectId of expectedIds) {
    if (!values.has(objectId)) {
      issues.add("OBJECT_SET_MISMATCH", `/byObject/${escapePointerSegment(objectId)}`, "Runtime state is missing an identity card or token object");
    }
  }
  for (const [objectId] of entries) {
    if (!expectedSet.has(objectId)) {
      issues.add("OBJECT_SET_MISMATCH", `/byObject/${escapePointerSegment(objectId)}`, "Runtime state contains a non-card or unknown object");
    }
  }

  const objectIds = new Set<string>(Object.keys(identity.objects));
  const playerIds = new Set<string>(Object.keys(identity.players));
  const states = new Map<CoreObjectId, CoreCardObjectRuntimeStateV1>();
  for (const objectId of expectedIds) {
    if (!values.has(objectId)) continue;
    const state = readRuntimeState(values.get(objectId), `/byObject/${escapePointerSegment(objectId)}`, issues);
    if (state === null) continue;
    states.set(objectId, state);
    validateRuntimeCrossState(
      identity,
      objectId,
      identity.objects[objectId],
      state,
      objectIds,
      playerIds,
      issues,
    );
  }

  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return Object.freeze({ ok: false, issues: sortedIssues });
  const byObject = Object.fromEntries(states) as Readonly<Record<CoreObjectId, CoreCardObjectRuntimeStateV1>>;
  return Object.freeze({
    ok: true,
    value: canonicalizeModeNeutralCoreObjectRuntimeStateV2({
      kind: RUNTIME_ROOT_KIND,
      byObject,
    }),
  });
}

export const validateModeNeutralCoreObjectRuntimeSliceV2 =
  validateModeNeutralCoreObjectRuntimeStateV2;
export const validateCoreObjectRuntimeStateV2 =
  validateModeNeutralCoreObjectRuntimeStateV2;
export const validateCoreObjectRuntimeV2 =
  validateModeNeutralCoreObjectRuntimeStateV2;

export { CoreObjectRegistryCreationErrorV2 as CoreObjectRegistryCreationError };
export { CoreObjectRuntimeCreationErrorV2 as CoreObjectRuntimeCreationError };
export {
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryStateV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeStateV2,
} from "./objectRegistryCanonicalizationV2";

export type {
  CoreCardObjectIdentityV1,
  CorePlayerZonesV1,
  CoreSharedZonesV1,
  ModeNeutralCoreCardRuntimeSliceV1,
  ModeNeutralCoreIdentityZoneSliceV1,
  CoreCardOrientationValidationIssue,
  CoreCounterDamageValidationIssue,
  CoreAttachmentValidationIssue,
};
