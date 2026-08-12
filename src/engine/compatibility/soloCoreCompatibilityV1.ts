import {
  isCoreBaseId,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
  validateModeNeutralCoreRootV1,
} from '../core';
import type {
  CoreObjectId,
  CorePhysicalCardId,
  CorePlayerId,
  CoreTurnPositionV1,
  ModeNeutralCoreRootV1,
} from '../core';
import { objectIdOf } from '../types';
import type { ObjectId, PhysicalCardId, PlayerId } from '../types';

export const SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1 = 1 as const;

export type SoloCoreCompatibilityClassV1 =
  | 'transformable'
  | 'lossy'
  | 'solo-only'
  | 'core-only'
  | 'unsupported';

export type SoloCoreCompatibilityConcernV1 =
  | 'player-roster'
  | 'active-player'
  | 'turn-position'
  | 'ordered-zones'
  | 'commander-identity'
  | 'commander-cast-count'
  | 'commander-damage'
  | 'combat-assignments'
  | 'general-life'
  | 'stack-subset'
  | 'search-control-subset'
  | 'random-zone-order'
  | 'full-combat-damage'
  | 'pending-trigger-sba-turn-advance'
  | 'poison-energy-experience'
  | 'mana-payment'
  | 'undo-redo'
  | 'indexeddb-snapshot'
  | 'typed-manual-correction'
  | 'core-replay-package';

export type SoloCoreCompatibilityCatalogEntryV1 = Readonly<{
  readonly concern: SoloCoreCompatibilityConcernV1;
  readonly classification: SoloCoreCompatibilityClassV1;
  readonly reasonCode: string;
}>;

const CATALOG_INPUT: readonly (readonly [SoloCoreCompatibilityConcernV1, SoloCoreCompatibilityClassV1, string])[] = [
  ['player-roster', 'lossy', 'PLAYER_ROSTER_LOSSY'],
  ['active-player', 'transformable', 'ACTIVE_PLAYER_TRANSFORMABLE'],
  ['turn-position', 'transformable', 'TURN_POSITION_TRANSFORMABLE'],
  ['ordered-zones', 'transformable', 'ORDERED_ZONES_TRANSFORMABLE'],
  ['commander-identity', 'transformable', 'COMMANDER_IDENTITY_TRANSFORMABLE'],
  ['commander-cast-count', 'transformable', 'COMMANDER_CAST_COUNT_TRANSFORMABLE'],
  ['commander-damage', 'lossy', 'COMMANDER_DAMAGE_LOSSY'],
  ['combat-assignments', 'transformable', 'COMBAT_ASSIGNMENTS_TRANSFORMABLE'],
  ['general-life', 'lossy', 'GENERAL_LIFE_LOSSY'],
  ['stack-subset', 'lossy', 'STACK_SUBSET_LOSSY'],
  ['search-control-subset', 'lossy', 'SEARCH_CONTROL_SUBSET_LOSSY'],
  ['random-zone-order', 'transformable', 'RANDOM_ZONE_ORDER_TRANSFORMABLE'],
  ['full-combat-damage', 'unsupported', 'FULL_COMBAT_DAMAGE_UNSUPPORTED'],
  ['pending-trigger-sba-turn-advance', 'unsupported', 'PENDING_TRIGGER_SBA_TURN_ADVANCE_UNSUPPORTED'],
  ['poison-energy-experience', 'solo-only', 'POISON_ENERGY_EXPERIENCE_SOLO_ONLY'],
  ['mana-payment', 'solo-only', 'MANA_PAYMENT_SOLO_ONLY'],
  ['undo-redo', 'solo-only', 'UNDO_REDO_SOLO_ONLY'],
  ['indexeddb-snapshot', 'solo-only', 'INDEXEDDB_SNAPSHOT_SOLO_ONLY'],
  ['typed-manual-correction', 'core-only', 'TYPED_MANUAL_CORRECTION_CORE_ONLY'],
  ['core-replay-package', 'core-only', 'CORE_REPLAY_PACKAGE_CORE_ONLY'],
];

export const SOLO_CORE_COMPATIBILITY_CATALOG_V1: readonly SoloCoreCompatibilityCatalogEntryV1[] = Object.freeze(
  CATALOG_INPUT.map(([concern, classification, reasonCode]) => Object.freeze({ concern, classification, reasonCode })),
);

export function soloCoreCompatibilityEntryForV1(
  concern: SoloCoreCompatibilityConcernV1,
): SoloCoreCompatibilityCatalogEntryV1 | null {
  const entry = SOLO_CORE_COMPATIBILITY_CATALOG_V1.find((current) => current.concern === concern);
  return entry === undefined ? null : Object.freeze({ ...entry });
}

type CompatibilityIssueCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_VERSION'
  | 'INVALID_ID'
  | 'INVALID_ARRAY'
  | 'NON_DENSE_ARRAY'
  | 'DUPLICATE_SOLO_KEY'
  | 'DUPLICATE_CORE_VALUE'
  | 'EMPTY_REQUIRED_MAP'
  | 'STALE_SOLO_REFERENCE'
  | 'STALE_CORE_REFERENCE'
  | 'UNMAPPED_PLAYER'
  | 'UNMAPPED_PHYSICAL_CARD'
  | 'UNMAPPED_OBJECT'
  | 'UNSUPPORTED_COMBAT_TARGET'
  | 'UNSUPPORTED_COMBAT_STEP'
  | 'INVALID_SOURCE'
  | 'VIEW_FIELD_MISMATCH';

type CompatibilityIssue = Readonly<{
  readonly code: CompatibilityIssueCode;
  readonly path: string;
  readonly message: string;
}>;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function sortedIssues(issues: readonly CompatibilityIssue[]): readonly CompatibilityIssue[] {
  return Object.freeze([...issues].sort((left, right) => (
    codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)
  )));
}

function issue(code: CompatibilityIssueCode, path: string, message: string): CompatibilityIssue {
  return Object.freeze({ code, path, message });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object') {
    const objectValue = value as object;
    if (!seen.has(objectValue)) {
      seen.add(objectValue);
      for (const key of Reflect.ownKeys(objectValue)) {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
      }
      Object.freeze(objectValue);
    }
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readExactRecord(
  input: unknown,
  fields: readonly string[],
  path: string,
  issues: CompatibilityIssue[],
): Record<string, unknown> | null {
  if (!isPlainRecord(input)) {
    issues.push(issue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'));
    return null;
  }
  const readable = Object.create(null) as Record<string, unknown>;
  const present = new Set<string>();
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Object keys are not readable'));
    return null;
  }
  for (const key of keys) {
    const keyPath = `${path}/${typeof key === 'string' ? key : '<symbol>'}`;
    if (typeof key !== 'string' || !fields.includes(key)) {
      issues.push(issue('UNKNOWN_FIELD', keyPath, 'Unknown field'));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', keyPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', keyPath, 'Field must be an enumerable data property'));
      continue;
    }
    readable[key] = descriptor.value;
  }
  for (const field of fields) {
    if (!present.has(field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, `Missing field: ${field}`));
  }
  return readable;
}

function readDenseArray(
  input: unknown,
  path: string,
  issues: CompatibilityIssue[],
): readonly unknown[] | null {
  let array: boolean;
  try { array = Array.isArray(input); } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!array) {
    issues.push(issue('INVALID_ARRAY', path, 'Expected an ordinary array'));
    return null;
  }
  const value = input as object;
  let keys: readonly PropertyKey[];
  let prototype: object | null;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    keys = Reflect.ownKeys(value);
    prototype = Reflect.getPrototypeOf(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (prototype !== Array.prototype) issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array'));
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    issues.push(issue('INVALID_DESCRIPTOR', `${path}/length`, 'Array length is not a data property'));
    return null;
  }
  const rawLength: unknown = lengthDescriptor.value;
  if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
    issues.push(issue('INVALID_ARRAY', `${path}/length`, 'Array length must be a non-negative safe integer'));
    return null;
  }
  const length = rawLength;
  const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '<symbol>'}`, 'Unknown array property'));
  }
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined) {
      issues.push(issue('NON_DENSE_ARRAY', `${path}/${index}`, 'Array must be dense'));
    } else if (descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${index}`, 'Array entry must be an enumerable data property'));
    } else {
      values.push(descriptor.value);
    }
  }
  return values;
}

export type SoloCorePlayerMapEntryV1 = Readonly<{
  readonly soloPlayerId: PlayerId;
  readonly corePlayerId: CorePlayerId;
}>;

export type SoloCorePhysicalCardMapEntryV1 = Readonly<{
  readonly soloPhysicalCardId: PhysicalCardId;
  readonly corePhysicalCardId: CorePhysicalCardId;
}>;

export type SoloCoreObjectMapEntryV1 = Readonly<{
  readonly soloObjectId: ObjectId;
  readonly coreObjectId: CoreObjectId;
}>;

export type SoloCoreIdentityMapV1 = Readonly<{
  readonly kind: 'solo-core-identity-map-v1';
  readonly schemaVersion: 1;
  readonly players: readonly SoloCorePlayerMapEntryV1[];
  readonly physicalCards: readonly SoloCorePhysicalCardMapEntryV1[];
  readonly objects: readonly SoloCoreObjectMapEntryV1[];
}>;

function readString(value: unknown, path: string, issues: CompatibilityIssue[], allowEmpty = false): string | null {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    issues.push(issue('INVALID_ID', path, 'Expected a non-empty string ID'));
    return null;
  }
  return value;
}

function soloPhysicalCardIdFromObjectId(value: string): string | null {
  const separator = value.lastIndexOf(':');
  if (separator <= 0 || separator === value.length - 1) return null;
  const incarnationText = value.slice(separator + 1);
  if (!/^(0|[1-9][0-9]*)$/u.test(incarnationText)) return null;
  const incarnation = Number(incarnationText);
  if (!Number.isSafeInteger(incarnation) || incarnation < 0) return null;
  return value.slice(0, separator);
}

function normalizeIdentityMap(input: unknown): { readonly value: SoloCoreIdentityMapV1 | null; readonly issues: readonly CompatibilityIssue[] } {
  const issues: CompatibilityIssue[] = [];
  const root = readExactRecord(input, ['kind', 'schemaVersion', 'players', 'physicalCards', 'objects'], '', issues);
  if (root === null) return { value: null, issues: sortedIssues(issues) };
  if (root.kind !== 'solo-core-identity-map-v1') issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid identity map kind'));
  if (root.schemaVersion !== SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1) issues.push(issue('INVALID_VERSION', '/schemaVersion', 'Invalid identity map schema version'));
  const playersRaw = readDenseArray(root.players, '/players', issues);
  const physicalRaw = readDenseArray(root.physicalCards, '/physicalCards', issues);
  const objectsRaw = readDenseArray(root.objects, '/objects', issues);
  if (playersRaw !== null && playersRaw.length === 0) issues.push(issue('EMPTY_REQUIRED_MAP', '/players', 'Player map must be non-empty'));
  if (physicalRaw !== null && physicalRaw.length === 0) issues.push(issue('EMPTY_REQUIRED_MAP', '/physicalCards', 'Physical-card map must be non-empty'));
  const players: SoloCorePlayerMapEntryV1[] = [];
  const physicalCards: SoloCorePhysicalCardMapEntryV1[] = [];
  const objects: SoloCoreObjectMapEntryV1[] = [];
  const playerSolo = new Set<string>();
  const playerCore = new Set<string>();
  const physicalSolo = new Set<string>();
  const physicalCore = new Set<string>();
  const objectSolo = new Set<string>();
  const objectCore = new Set<string>();
  const entry = (inputValue: unknown, fields: readonly string[], path: string): Record<string, unknown> | null => readExactRecord(inputValue, fields, path, issues);
  for (const [index, raw] of (playersRaw ?? []).entries()) {
    const value = entry(raw, ['soloPlayerId', 'corePlayerId'], `/players/${index}`);
    if (value === null) continue;
    const solo = readString(value.soloPlayerId, `/players/${index}/soloPlayerId`, issues);
    const core = readString(value.corePlayerId, `/players/${index}/corePlayerId`, issues);
    if (core !== null && !isCoreBaseId(core)) issues.push(issue('INVALID_ID', `/players/${index}/corePlayerId`, 'Invalid Core player ID'));
    if (solo === null || core === null || !isCoreBaseId(core)) continue;
    if (playerSolo.has(solo)) issues.push(issue('DUPLICATE_SOLO_KEY', `/players/${index}/soloPlayerId`, 'Duplicate Solo player ID'));
    if (playerCore.has(core)) issues.push(issue('DUPLICATE_CORE_VALUE', `/players/${index}/corePlayerId`, 'Duplicate Core player ID'));
    playerSolo.add(solo); playerCore.add(core);
    players.push(Object.freeze({ soloPlayerId: solo, corePlayerId: core as CorePlayerId }));
  }
  for (const [index, raw] of (physicalRaw ?? []).entries()) {
    const value = entry(raw, ['soloPhysicalCardId', 'corePhysicalCardId'], `/physicalCards/${index}`);
    if (value === null) continue;
    const solo = readString(value.soloPhysicalCardId, `/physicalCards/${index}/soloPhysicalCardId`, issues);
    const core = readString(value.corePhysicalCardId, `/physicalCards/${index}/corePhysicalCardId`, issues);
    if (core !== null && !isCoreBaseId(core)) issues.push(issue('INVALID_ID', `/physicalCards/${index}/corePhysicalCardId`, 'Invalid Core physical card ID'));
    if (solo === null || core === null || !isCoreBaseId(core)) continue;
    if (physicalSolo.has(solo)) issues.push(issue('DUPLICATE_SOLO_KEY', `/physicalCards/${index}/soloPhysicalCardId`, 'Duplicate Solo physical-card ID'));
    if (physicalCore.has(core)) issues.push(issue('DUPLICATE_CORE_VALUE', `/physicalCards/${index}/corePhysicalCardId`, 'Duplicate Core physical-card ID'));
    physicalSolo.add(solo); physicalCore.add(core);
    physicalCards.push(Object.freeze({ soloPhysicalCardId: solo, corePhysicalCardId: core as CorePhysicalCardId }));
  }
  for (const [index, raw] of (objectsRaw ?? []).entries()) {
    const value = entry(raw, ['soloObjectId', 'coreObjectId'], `/objects/${index}`);
    if (value === null) continue;
    const solo = readString(value.soloObjectId, `/objects/${index}/soloObjectId`, issues);
    const core = readString(value.coreObjectId, `/objects/${index}/coreObjectId`, issues);
    if (core !== null && !isCanonicalCoreObjectIdV2(core)) issues.push(issue('INVALID_ID', `/objects/${index}/coreObjectId`, 'Invalid Core object ID'));
    if (solo === null || core === null || !isCanonicalCoreObjectIdV2(core)) continue;
    const soloPhysical = soloPhysicalCardIdFromObjectId(solo);
    const parsedCore = parseCoreObjectIdV2(core);
    const corePhysical = parsedCore?.kind === 'card' ? parsedCore.physicalCardId : null;
    const expectedCorePhysical = soloPhysical === null
      ? undefined
      : physicalCards.find((entry) => entry.soloPhysicalCardId === soloPhysical)?.corePhysicalCardId;
    const expectedSoloPhysical = corePhysical === null
      ? undefined
      : physicalCards.find((entry) => entry.corePhysicalCardId === corePhysical)?.soloPhysicalCardId;
    if (soloPhysical === null || expectedCorePhysical === undefined || expectedCorePhysical !== corePhysical) {
      issues.push(issue('INVALID_ID', `/objects/${index}/soloObjectId`, 'Solo object physical identity does not match the physical-card map'));
    }
    if (corePhysical === null || expectedSoloPhysical === undefined || expectedSoloPhysical !== soloPhysical) {
      issues.push(issue('INVALID_ID', `/objects/${index}/coreObjectId`, 'Core object physical identity does not match the physical-card map'));
    }
    if (objectSolo.has(solo)) issues.push(issue('DUPLICATE_SOLO_KEY', `/objects/${index}/soloObjectId`, 'Duplicate Solo object ID'));
    if (objectCore.has(core)) issues.push(issue('DUPLICATE_CORE_VALUE', `/objects/${index}/coreObjectId`, 'Duplicate Core object ID'));
    objectSolo.add(solo); objectCore.add(core);
    objects.push(Object.freeze({ soloObjectId: solo, coreObjectId: core }));
  }
  if (issues.length > 0) return { value: null, issues: sortedIssues(issues) };
  const value: SoloCoreIdentityMapV1 = Object.freeze({
    kind: 'solo-core-identity-map-v1',
    schemaVersion: 1,
    players: Object.freeze(players),
    physicalCards: Object.freeze(physicalCards),
    objects: Object.freeze(objects),
  });
  return { value: deepFreeze(value), issues: Object.freeze([]) };
}

export function validateSoloCoreIdentityMapV1(input: unknown):
  | { readonly ok: true; readonly value: SoloCoreIdentityMapV1 }
  | { readonly ok: false; readonly issues: readonly CompatibilityIssue[] } {
  const result = normalizeIdentityMap(input);
  return result.value === null ? { ok: false, issues: result.issues } : { ok: true, value: result.value };
}

export function createSoloCoreIdentityMapV1(
  input: unknown,
): SoloCoreIdentityMapV1 {
  const candidate: Record<string, unknown> = {
    kind: 'solo-core-identity-map-v1',
    schemaVersion: 1,
    players: dataField(input, 'players'),
    physicalCards: dataField(input, 'physicalCards'),
    objects: dataField(input, 'objects'),
  };
  const result = validateSoloCoreIdentityMapV1(candidate);
  if (!result.ok) throw new Error(`Invalid Solo/Core identity map (${result.issues.length} issue(s))`);
  return result.value;
}

export type SoloCoreComparableTurnPositionV1 = CoreTurnPositionV1;

export type SoloCoreComparableZoneV1 = Readonly<{
  readonly playerId: CorePlayerId | null;
  readonly zone: 'library' | 'hand' | 'graveyard' | 'battlefield' | 'stack' | 'exile' | 'command';
  readonly objectIds: readonly CoreObjectId[];
}>;

export type SoloCoreComparableCommanderV1 = Readonly<{
  readonly physicalCardId: CorePhysicalCardId;
  readonly ownerPlayerId: CorePlayerId;
  readonly castCount: number;
}>;

export type SoloCoreComparableCombatV1 = Readonly<{
  readonly turnNumber: number;
  readonly step: 'declare-attackers' | 'declare-blockers';
  readonly attackingPlayerId: CorePlayerId;
  readonly defendingPlayerIds: readonly CorePlayerId[];
  readonly attacks: readonly Readonly<{
    readonly attackerObjectId: CoreObjectId;
    readonly attackerControllerPlayerId: CorePlayerId;
    readonly defendingPlayerId: CorePlayerId;
  }>[];
  readonly blocks: readonly Readonly<{
    readonly blockerObjectId: CoreObjectId;
    readonly blockerControllerPlayerId: CorePlayerId;
    readonly attackedObjectId: CoreObjectId;
    readonly defendingPlayerId: CorePlayerId;
  }>[];
}>;

export type SoloCoreComparableViewV1 = Readonly<{
  readonly kind: 'solo-core-comparable-view-v1';
  readonly schemaVersion: 1;
  readonly activePlayerId: CorePlayerId;
  readonly turnNumber: number;
  readonly turnPosition: SoloCoreComparableTurnPositionV1;
  readonly orderedZones: readonly SoloCoreComparableZoneV1[];
  readonly commanders: readonly SoloCoreComparableCommanderV1[];
  readonly combat: SoloCoreComparableCombatV1 | null;
}>;

type ProjectionResult =
  | Readonly<{ readonly kind: 'projected'; readonly view: SoloCoreComparableViewV1 }>
  | Readonly<{ readonly kind: 'rejected'; readonly issues: readonly CompatibilityIssue[] }>;

function rejected(issues: readonly CompatibilityIssue[]): ProjectionResult {
  return Object.freeze({ kind: 'rejected' as const, issues: sortedIssues(issues) });
}

function dataField(input: unknown, field: string): unknown {
  try {
    if (input === null || typeof input !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !('value' in descriptor)) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function recordKeys(input: unknown): readonly string[] | null {
  try {
    if (!isPlainRecord(input)) return null;
    return Object.keys(input);
  } catch {
    return null;
  }
}

function hasDataRecordEntry(input: unknown, key: string): boolean {
  try {
    if (!isPlainRecord(input)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor !== undefined && 'value' in descriptor;
  } catch {
    return false;
  }
}

function mapIndexes(map: SoloCoreIdentityMapV1): Readonly<{
  readonly playerBySolo: ReadonlyMap<string, CorePlayerId>;
  readonly playerByCore: ReadonlyMap<string, PlayerId>;
  readonly physicalBySolo: ReadonlyMap<string, CorePhysicalCardId>;
  readonly physicalByCore: ReadonlyMap<string, PhysicalCardId>;
  readonly objectBySolo: ReadonlyMap<string, CoreObjectId>;
  readonly objectByCore: ReadonlyMap<string, ObjectId>;
}> {
  return {
    playerBySolo: new Map(map.players.map((entry) => [entry.soloPlayerId, entry.corePlayerId])),
    playerByCore: new Map(map.players.map((entry) => [entry.corePlayerId, entry.soloPlayerId])),
    physicalBySolo: new Map(map.physicalCards.map((entry) => [entry.soloPhysicalCardId, entry.corePhysicalCardId])),
    physicalByCore: new Map(map.physicalCards.map((entry) => [entry.corePhysicalCardId, entry.soloPhysicalCardId])),
    objectBySolo: new Map(map.objects.map((entry) => [entry.soloObjectId, entry.coreObjectId])),
    objectByCore: new Map(map.objects.map((entry) => [entry.coreObjectId, entry.soloObjectId])),
  };
}

function arrayValue(input: unknown): readonly unknown[] | null {
  try {
    return Array.isArray(input) ? input : null;
  } catch {
    return null;
  }
}

function soloObjectIdForCard(card: unknown): string | null {
  if (!isPlainRecord(card)) return null;
  const id = dataField(card, 'id');
  const counter = dataField(card, 'zoneChangeCounter');
  if (typeof id !== 'string' || typeof counter !== 'number' || !Number.isSafeInteger(counter) || counter < 0) return null;
  return objectIdOf({ id, zoneChangeCounter: counter });
}

function coreRegistryOf(root: ModeNeutralCoreRootV1): Record<string, unknown> {
  return root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry as unknown as Record<string, unknown>;
}

function validateMapAgainstSolo(map: SoloCoreIdentityMapV1, state: unknown, issues: CompatibilityIssue[]): {
  readonly indexes: ReturnType<typeof mapIndexes>;
  readonly cards: Record<string, unknown>;
  readonly zones: Record<string, unknown>;
  readonly zonesByPlayer: Record<string, unknown>;
  readonly turnOrder: readonly string[];
} | null {
  const indexes = mapIndexes(map);
  const cards = dataField(state, 'cards');
  const zones = dataField(state, 'zones');
  const zonesByPlayer = dataField(state, 'zonesByPlayer');
  const turnOrder = arrayValue(dataField(state, 'turnOrder'));
  if (!isPlainRecord(cards) || !isPlainRecord(zones) || !isPlainRecord(zonesByPlayer) || turnOrder === null || !turnOrder.every((id): id is string => typeof id === 'string')) {
    issues.push(issue('INVALID_SOURCE', '', 'Solo source state is not readable'));
    return null;
  }
  const turnSet = new Set(turnOrder);
  for (const entry of map.players) {
    if (!turnSet.has(entry.soloPlayerId) || !hasDataRecordEntry(zonesByPlayer, entry.soloPlayerId)) issues.push(issue('STALE_SOLO_REFERENCE', `/players/${entry.soloPlayerId}`, 'Solo player is not present in the state'));
  }
  for (const playerId of turnOrder) if (!indexes.playerBySolo.has(playerId)) issues.push(issue('UNMAPPED_PLAYER', `/turnOrder/${playerId}`, 'Solo player is not mapped'));
  for (const entry of map.physicalCards) if (!hasDataRecordEntry(cards, entry.soloPhysicalCardId)) issues.push(issue('STALE_SOLO_REFERENCE', `/physicalCards/${entry.soloPhysicalCardId}`, 'Solo physical card is not present in the state'));
  const objectIds = new Set<string>();
  for (const key of recordKeys(cards) ?? []) {
    const objectId = soloObjectIdForCard(dataField(cards, key));
    if (objectId !== null) objectIds.add(objectId);
  }
  for (const entry of map.objects) if (!objectIds.has(entry.soloObjectId)) issues.push(issue('STALE_SOLO_REFERENCE', `/objects/${entry.soloObjectId}`, 'Solo object incarnation is not present in the state'));
  return { indexes, cards, zones, zonesByPlayer, turnOrder: map.players.map((entry) => entry.soloPlayerId) };
}

function validateMapAgainstCore(map: SoloCoreIdentityMapV1, root: ModeNeutralCoreRootV1, issues: CompatibilityIssue[]): {
  readonly indexes: ReturnType<typeof mapIndexes>;
  readonly registry: Record<string, unknown>;
  readonly turnOrder: readonly CorePlayerId[];
} | null {
  const indexes = mapIndexes(map);
  const registry = coreRegistryOf(root);
  const coreTurnOrder = arrayValue(dataField(registry, 'turnOrder'));
  const physicalCards = dataField(registry, 'physicalCards');
  const objects = dataField(registry, 'objects');
  if (coreTurnOrder === null || !coreTurnOrder.every((id): id is CorePlayerId => typeof id === 'string') || !isPlainRecord(physicalCards) || !isPlainRecord(objects)) {
    issues.push(issue('INVALID_SOURCE', '/ruleAuthority/turnPriorityBundle/stackBundle/objectRegistry', 'Core object registry is not readable'));
    return null;
  }
  const corePlayers = new Set(coreTurnOrder);
  for (const entry of map.players) {
    if (!corePlayers.has(entry.corePlayerId)) issues.push(issue('STALE_CORE_REFERENCE', `/players/${entry.corePlayerId}`, 'Core player is not present in the root'));
  }
  for (const playerId of coreTurnOrder) if (!indexes.playerByCore.has(playerId)) issues.push(issue('UNMAPPED_PLAYER', `/turnOrder/${playerId}`, 'Core player is not mapped'));
  const activePlayer = dataField(registry, 'activePlayerId');
  if (typeof activePlayer !== 'string' || !indexes.playerByCore.has(activePlayer)) issues.push(issue('UNMAPPED_PLAYER', '/activePlayerId', 'Active Core player is not mapped'));
  for (const entry of map.physicalCards) if (!hasDataRecordEntry(physicalCards, entry.corePhysicalCardId)) issues.push(issue('STALE_CORE_REFERENCE', `/physicalCards/${entry.corePhysicalCardId}`, 'Core physical card is not present in the root'));
  for (const entry of map.objects) if (!hasDataRecordEntry(objects, entry.coreObjectId)) issues.push(issue('STALE_CORE_REFERENCE', `/objects/${entry.coreObjectId}`, 'Core object is not present in the root'));
  return { indexes, registry, turnOrder: map.players.map((entry) => entry.corePlayerId) };
}

function mapSoloZoneObject(
  soloCardId: unknown,
  state: Record<string, unknown>,
  indexes: ReturnType<typeof mapIndexes>,
  path: string,
  issues: CompatibilityIssue[],
): CoreObjectId | null {
  if (typeof soloCardId !== 'string' || !hasDataRecordEntry(state, soloCardId)) {
    issues.push(issue('STALE_SOLO_REFERENCE', path, 'Solo zone references an unknown card'));
    return null;
  }
  const objectId = soloObjectIdForCard(dataField(state, soloCardId));
  if (objectId === null) {
    issues.push(issue('STALE_SOLO_REFERENCE', path, 'Solo card has no valid object incarnation'));
    return null;
  }
  const mapped = indexes.objectBySolo.get(objectId);
  if (mapped === undefined) {
    issues.push(issue('UNMAPPED_OBJECT', path, 'Solo object is not mapped'));
    return null;
  }
  const physical = dataField(dataField(state, soloCardId), 'id');
  const physicalMapped = typeof physical === 'string' ? indexes.physicalBySolo.get(physical) : undefined;
  if (physicalMapped === undefined) issues.push(issue('UNMAPPED_PHYSICAL_CARD', path, 'Solo physical card is not mapped'));
  return mapped;
}

function soloTurnPosition(state: unknown, issues: CompatibilityIssue[]): SoloCoreComparableTurnPositionV1 | null {
  const phase = dataField(state, 'phase');
  if (phase === 'untap' || phase === 'upkeep' || phase === 'draw') return Object.freeze({ phase: 'beginning', step: phase });
  if (phase === 'main1') return Object.freeze({ phase: 'precombat-main', step: null });
  if (phase === 'main2') return Object.freeze({ phase: 'postcombat-main', step: null });
  if (phase === 'end') return Object.freeze({ phase: 'ending', step: 'end' });
  if (phase === 'cleanup') return Object.freeze({ phase: 'ending', step: 'cleanup' });
  if (phase === 'combat') {
    const combat = dataField(state, 'combat');
    const step = isPlainRecord(combat) ? dataField(combat, 'step') : undefined;
    const translated = step === 'beginningOfCombat' ? 'beginning-of-combat'
      : step === 'declareAttackers' ? 'declare-attackers'
        : step === 'declareBlockers' ? 'declare-blockers'
          : step === 'combatDamage' ? 'combat-damage'
            : step === 'endOfCombat' ? 'end-of-combat' : 'beginning-of-combat';
    return Object.freeze({ phase: 'combat', step: translated });
  }
  issues.push(issue('INVALID_SOURCE', '/phase', 'Solo phase is not supported'));
  return null;
}

function soloCombat(
  state: unknown,
  indexes: ReturnType<typeof mapIndexes>,
  cards: Record<string, unknown>,
  issues: CompatibilityIssue[],
): SoloCoreComparableCombatV1 | null {
  const raw = dataField(state, 'combat');
  if (raw === null || raw === undefined) return null;
  if (!isPlainRecord(raw)) { issues.push(issue('INVALID_SOURCE', '/combat', 'Solo combat is not readable')); return null; }
  const step = dataField(raw, 'step');
  if (step !== 'declareAttackers' && step !== 'declareBlockers') {
    issues.push(issue('UNSUPPORTED_COMBAT_STEP', '/combat/step', 'Only combat assignments are comparable'));
    return null;
  }
  const attackingSolo = dataField(raw, 'attackingPlayerId');
  const defendingSolo = dataField(raw, 'defendingPlayerId');
  const attacking = typeof attackingSolo === 'string' ? indexes.playerBySolo.get(attackingSolo) : undefined;
  const defending = typeof defendingSolo === 'string' ? indexes.playerBySolo.get(defendingSolo) : undefined;
  if (attacking === undefined) issues.push(issue('UNMAPPED_PLAYER', '/combat/attackingPlayerId', 'Attacking player is not mapped'));
  if (defending === undefined) issues.push(issue('UNMAPPED_PLAYER', '/combat/defendingPlayerId', 'Defending player is not mapped'));
  const attackers: SoloCoreComparableCombatV1['attacks'][number][] = [];
  const blockers: SoloCoreComparableCombatV1['blocks'][number][] = [];
  const attackerValues = arrayValue(dataField(raw, 'attackers'));
  const blockerValues = arrayValue(dataField(raw, 'blockers'));
  if (attackerValues === null || blockerValues === null) {
    issues.push(issue('INVALID_SOURCE', '/combat', 'Combat assignments must be arrays'));
    return null;
  }
  for (const [index, value] of attackerValues.entries()) {
    if (!isPlainRecord(value)) { issues.push(issue('INVALID_SOURCE', `/combat/attackers/${index}`, 'Attacker is not readable')); continue; }
    const target = dataField(value, 'target');
    if (!isPlainRecord(target) || dataField(target, 'type') !== 'player') {
      issues.push(issue('UNSUPPORTED_COMBAT_TARGET', `/combat/attackers/${index}/target`, 'Battle targets are not transformable in V1'));
      continue;
    }
    const attackerObjectId = mapSoloZoneObject(dataField(value, 'cardId'), cards, indexes, `/combat/attackers/${index}/cardId`, issues);
    const controllerSolo = dataField(value, 'controllerId');
    const controller = typeof controllerSolo === 'string' ? indexes.playerBySolo.get(controllerSolo) : undefined;
    const targetPlayer = dataField(target, 'playerId');
    const targetCore = typeof targetPlayer === 'string' ? indexes.playerBySolo.get(targetPlayer) : undefined;
    if (controller === undefined) issues.push(issue('UNMAPPED_PLAYER', `/combat/attackers/${index}/controllerId`, 'Attacker controller is not mapped'));
    if (targetCore === undefined) issues.push(issue('UNMAPPED_PLAYER', `/combat/attackers/${index}/target/playerId`, 'Attack target is not mapped'));
    if (attackerObjectId !== null && controller !== undefined && targetCore !== undefined) attackers.push(Object.freeze({ attackerObjectId, attackerControllerPlayerId: controller, defendingPlayerId: targetCore }));
  }
  for (const [index, value] of blockerValues.entries()) {
    if (!isPlainRecord(value)) { issues.push(issue('INVALID_SOURCE', `/combat/blockers/${index}`, 'Blocker is not readable')); continue; }
    const blockerObjectId = mapSoloZoneObject(dataField(value, 'cardId'), cards, indexes, `/combat/blockers/${index}/cardId`, issues);
    const controllerSolo = dataField(value, 'controllerId');
    const controller = typeof controllerSolo === 'string' ? indexes.playerBySolo.get(controllerSolo) : undefined;
    const blocking = arrayValue(dataField(value, 'blocking'));
    if (blocking === null) { issues.push(issue('INVALID_SOURCE', `/combat/blockers/${index}/blocking`, 'Blocking assignments must be an array')); continue; }
    if (controller === undefined) issues.push(issue('UNMAPPED_PLAYER', `/combat/blockers/${index}/controllerId`, 'Blocker controller is not mapped'));
    for (const [blockedIndex, blockedCardId] of blocking.entries()) {
      const attackedObjectId = mapSoloZoneObject(blockedCardId, cards, indexes, `/combat/blockers/${index}/blocking/${blockedIndex}`, issues);
      if (blockerObjectId !== null && attackedObjectId !== null && controller !== undefined && defending !== undefined) blockers.push(Object.freeze({ blockerObjectId, blockerControllerPlayerId: controller, attackedObjectId, defendingPlayerId: defending }));
    }
  }
  if (issues.length > 0 || attacking === undefined || defending === undefined) return null;
  return Object.freeze({
    turnNumber: typeof dataField(raw, 'turn') === 'number' ? dataField(raw, 'turn') as number : 0,
    step: step === 'declareAttackers' ? 'declare-attackers' : 'declare-blockers',
    attackingPlayerId: attacking,
    defendingPlayerIds: Object.freeze([defending]),
    attacks: Object.freeze(attackers),
    blocks: Object.freeze(blockers),
  });
}

function soloProjectZones(
  stateInfo: NonNullable<ReturnType<typeof validateMapAgainstSolo>>,
  issues: CompatibilityIssue[],
): readonly SoloCoreComparableZoneV1[] {
  const zones: SoloCoreComparableZoneV1[] = [];
  const privateZones = ['library', 'hand', 'graveyard'] as const;
  for (const playerId of stateInfo.turnOrder) {
    const corePlayerId = stateInfo.indexes.playerBySolo.get(playerId);
    const playerZones = dataField(stateInfo.zonesByPlayer, playerId);
    if (corePlayerId === undefined || !isPlainRecord(playerZones)) { issues.push(issue('INVALID_SOURCE', `/zonesByPlayer/${playerId}`, 'Player private zones are not readable')); continue; }
    for (const zone of privateZones) {
      const entries = arrayValue(dataField(playerZones, zone));
      if (entries === null) { issues.push(issue('INVALID_SOURCE', `/zonesByPlayer/${playerId}/${zone}`, 'Zone must be an array')); zones.push(Object.freeze({ playerId: corePlayerId, zone, objectIds: Object.freeze([]) })); continue; }
      const objectIds = entries.map((cardId, index) => mapSoloZoneObject(cardId, stateInfo.cards, stateInfo.indexes, `/zonesByPlayer/${playerId}/${zone}/${index}`, issues)).filter((id): id is CoreObjectId => id !== null);
      zones.push(Object.freeze({ playerId: corePlayerId, zone, objectIds: Object.freeze(objectIds) }));
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    const entries = arrayValue(dataField(stateInfo.zones, zone));
    if (entries === null) { issues.push(issue('INVALID_SOURCE', `/zones/${zone}`, 'Shared zone must be an array')); zones.push(Object.freeze({ playerId: null, zone, objectIds: Object.freeze([]) })); continue; }
    const objectIds = entries.map((cardId, index) => mapSoloZoneObject(cardId, stateInfo.cards, stateInfo.indexes, `/zones/${zone}/${index}`, issues)).filter((id): id is CoreObjectId => id !== null);
    zones.push(Object.freeze({ playerId: null, zone, objectIds: Object.freeze(objectIds) }));
  }
  return Object.freeze(zones);
}

function soloProjectCommanders(state: unknown, indexes: ReturnType<typeof mapIndexes>, cards: Record<string, unknown>, issues: CompatibilityIssue[]): readonly SoloCoreComparableCommanderV1[] {
  const values = arrayValue(dataField(state, 'commanders'));
  if (values === null) { issues.push(issue('INVALID_SOURCE', '/commanders', 'Commanders must be an array')); return Object.freeze([]); }
  const result: SoloCoreComparableCommanderV1[] = [];
  for (const [index, value] of values.entries()) {
    if (!isPlainRecord(value)) { issues.push(issue('INVALID_SOURCE', `/commanders/${index}`, 'Commander is not readable')); continue; }
    const cardId = dataField(value, 'cardId');
    const card = typeof cardId === 'string' ? dataField(cards, cardId) : undefined;
    const physical = typeof cardId === 'string' && isPlainRecord(card) ? dataField(card, 'id') : undefined;
    const corePhysical = typeof physical === 'string' ? indexes.physicalBySolo.get(physical) : undefined;
    const owner = isPlainRecord(card) ? dataField(card, 'ownerId') : undefined;
    const coreOwner = typeof owner === 'string' ? indexes.playerBySolo.get(owner) : undefined;
    const castCount = dataField(value, 'castCount');
    if (corePhysical === undefined) issues.push(issue('UNMAPPED_PHYSICAL_CARD', `/commanders/${index}/cardId`, 'Commander physical card is not mapped'));
    if (coreOwner === undefined) issues.push(issue('UNMAPPED_PLAYER', `/commanders/${index}/ownerId`, 'Commander owner is not mapped'));
    if (typeof castCount !== 'number' || !Number.isSafeInteger(castCount) || castCount < 0) issues.push(issue('INVALID_SOURCE', `/commanders/${index}/castCount`, 'Commander cast count is invalid'));
    if (corePhysical !== undefined && coreOwner !== undefined && typeof castCount === 'number' && Number.isSafeInteger(castCount) && castCount >= 0) result.push(Object.freeze({ physicalCardId: corePhysical, ownerPlayerId: coreOwner, castCount }));
  }
  return Object.freeze(result);
}

function coreProjectZones(
  stateInfo: NonNullable<ReturnType<typeof validateMapAgainstCore>>,
  issues: CompatibilityIssue[],
): readonly SoloCoreComparableZoneV1[] {
  const registryZones = dataField(stateInfo.registry, 'zones');
  const byPlayer = isPlainRecord(registryZones) ? dataField(registryZones, 'byPlayer') : undefined;
  const shared = isPlainRecord(registryZones) ? dataField(registryZones, 'shared') : undefined;
  const zones: SoloCoreComparableZoneV1[] = [];
  for (const corePlayerId of stateInfo.turnOrder) {
    const playerZones = isPlainRecord(byPlayer) ? dataField(byPlayer, corePlayerId) : undefined;
    if (!isPlainRecord(playerZones)) { issues.push(issue('INVALID_SOURCE', `/zones/byPlayer/${corePlayerId}`, 'Core player zones are not readable')); continue; }
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      const values = arrayValue(dataField(playerZones, zone));
      if (values === null) { issues.push(issue('INVALID_SOURCE', `/zones/byPlayer/${corePlayerId}/${zone}`, 'Core zone must be an array')); zones.push(Object.freeze({ playerId: corePlayerId, zone, objectIds: Object.freeze([]) })); continue; }
      const objectIds = values.filter((value): value is CoreObjectId => {
        if (typeof value !== 'string' || !stateInfo.indexes.objectByCore.has(value)) { issues.push(issue('UNMAPPED_OBJECT', `/zones/byPlayer/${corePlayerId}/${zone}`, 'Core object is not mapped')); return false; }
        return true;
      });
      zones.push(Object.freeze({ playerId: corePlayerId, zone, objectIds: Object.freeze(objectIds) }));
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    const values = arrayValue(dataField(shared, zone));
    if (values === null) { issues.push(issue('INVALID_SOURCE', `/zones/shared/${zone}`, 'Core shared zone must be an array')); zones.push(Object.freeze({ playerId: null, zone, objectIds: Object.freeze([]) })); continue; }
    const objectIds = values.filter((value): value is CoreObjectId => {
      if (typeof value !== 'string' || !stateInfo.indexes.objectByCore.has(value)) { issues.push(issue('UNMAPPED_OBJECT', `/zones/shared/${zone}`, 'Core object is not mapped')); return false; }
      return true;
    });
    zones.push(Object.freeze({ playerId: null, zone, objectIds: Object.freeze(objectIds) }));
  }
  return Object.freeze(zones);
}

function coreProjectCombat(
  root: ModeNeutralCoreRootV1,
  indexes: ReturnType<typeof mapIndexes>,
  issues: CompatibilityIssue[],
): SoloCoreComparableCombatV1 | null {
  const combat = root.combatContext;
  if (combat === null) return null;
  if (!indexes.playerByCore.has(combat.attackingPlayerId)) {
    issues.push(issue('UNMAPPED_PLAYER', '/combat/attackingPlayerId', 'Core attacking player is not mapped'));
  }
  for (const [index, playerId] of combat.defendingPlayerIds.entries()) {
    if (!indexes.playerByCore.has(playerId)) {
      issues.push(issue('UNMAPPED_PLAYER', `/combat/defendingPlayerIds/${index}`, 'Core defending player is not mapped'));
    }
  }
  for (const [index, attack] of combat.attacks.entries()) {
    if (!indexes.objectByCore.has(attack.attackerObjectId)) {
      issues.push(issue('UNMAPPED_OBJECT', `/combat/attacks/${index}/attackerObjectId`, 'Core attacker object is not mapped'));
    }
    if (!indexes.playerByCore.has(attack.attackerControllerPlayerId)) {
      issues.push(issue('UNMAPPED_PLAYER', `/combat/attacks/${index}/attackerControllerPlayerId`, 'Core attacker controller is not mapped'));
    }
    if (!indexes.playerByCore.has(attack.defendingPlayerId)) {
      issues.push(issue('UNMAPPED_PLAYER', `/combat/attacks/${index}/defendingPlayerId`, 'Core attack defender is not mapped'));
    }
  }
  for (const [index, block] of combat.blocks.entries()) {
    if (!indexes.objectByCore.has(block.blockerObjectId)) {
      issues.push(issue('UNMAPPED_OBJECT', `/combat/blocks/${index}/blockerObjectId`, 'Core blocker object is not mapped'));
    }
    if (!indexes.objectByCore.has(block.attackedObjectId)) {
      issues.push(issue('UNMAPPED_OBJECT', `/combat/blocks/${index}/attackedObjectId`, 'Core attacked object is not mapped'));
    }
    if (!indexes.playerByCore.has(block.blockerControllerPlayerId)) {
      issues.push(issue('UNMAPPED_PLAYER', `/combat/blocks/${index}/blockerControllerPlayerId`, 'Core blocker controller is not mapped'));
    }
    if (!indexes.playerByCore.has(block.defendingPlayerId)) {
      issues.push(issue('UNMAPPED_PLAYER', `/combat/blocks/${index}/defendingPlayerId`, 'Core block defender is not mapped'));
    }
  }
  return Object.freeze({
    turnNumber: combat.turnNumber,
    step: combat.step,
    attackingPlayerId: combat.attackingPlayerId,
    defendingPlayerIds: Object.freeze([...combat.defendingPlayerIds]),
    attacks: Object.freeze(combat.attacks.map((attack) => Object.freeze({ ...attack }))),
    blocks: Object.freeze(combat.blocks.map((block) => Object.freeze({ ...block }))),
  });
}

function projectSoloUnchecked(state: unknown, map: SoloCoreIdentityMapV1): ProjectionResult {
  const issues: CompatibilityIssue[] = [];
  const indexes = mapIndexes(map);
  const active = dataField(state, 'activePlayerId');
  const activePlayerId = typeof active === 'string' ? indexes.playerBySolo.get(active) : undefined;
  const turn = dataField(state, 'turn');
  if (activePlayerId === undefined) issues.push(issue('UNMAPPED_PLAYER', '/activePlayerId', 'Active Solo player is not mapped'));
  if (typeof turn !== 'number' || !Number.isSafeInteger(turn) || turn < 1) issues.push(issue('INVALID_SOURCE', '/turn', 'Turn number is invalid'));
  const stateInfo = validateMapAgainstSolo(map, state, issues);
  if (stateInfo === null) return rejected(issues);
  const turnPosition = soloTurnPosition(state, issues);
  const combat = soloCombat(state, stateInfo.indexes, stateInfo.cards, issues);
  const orderedZones = soloProjectZones(stateInfo, issues);
  const commanders = soloProjectCommanders(state, stateInfo.indexes, stateInfo.cards, issues);
  if (issues.length > 0 || activePlayerId === undefined || turnPosition === null) return rejected(issues);
  const view: SoloCoreComparableViewV1 = Object.freeze({
    kind: 'solo-core-comparable-view-v1',
    schemaVersion: 1,
    activePlayerId,
    turnNumber: turn as number,
    turnPosition,
    orderedZones,
    commanders,
    combat,
  });
  if (issues.length > 0) return rejected(issues);
  return Object.freeze({ kind: 'projected' as const, view: deepFreeze(view) });
}

function projectCoreUnchecked(root: ModeNeutralCoreRootV1, map: SoloCoreIdentityMapV1): ProjectionResult {
  const issues: CompatibilityIssue[] = [];
  const stateInfo = validateMapAgainstCore(map, root, issues);
  if (stateInfo === null) return rejected(issues);
  const lifecycle = root.ruleAuthority.turnPriorityBundle.lifecycle;
  const active = dataField(stateInfo.registry, 'activePlayerId');
  const activePlayerId = typeof active === 'string' && stateInfo.indexes.playerByCore.has(active)
    ? active as CorePlayerId
    : undefined;
  const turnPosition = lifecycle.position;
  if (activePlayerId === undefined) issues.push(issue('UNMAPPED_PLAYER', '/activePlayerId', 'Active player is not mapped'));
  const commanders = root.commanders.map((commander, index) => {
    const ledger = root.commanderCastLedgers[index];
    const physical = stateInfo.indexes.physicalByCore.get(commander.physicalCardId);
    if (physical === undefined) issues.push(issue('UNMAPPED_PHYSICAL_CARD', `/commanders/${index}/physicalCardId`, 'Commander physical card is not mapped'));
    if (!stateInfo.indexes.playerByCore.has(commander.ownerPlayerId)) issues.push(issue('UNMAPPED_PLAYER', `/commanders/${index}/ownerPlayerId`, 'Commander owner is not mapped'));
    if (ledger === undefined || ledger.commander.physicalCardId !== commander.physicalCardId) issues.push(issue('STALE_CORE_REFERENCE', `/commanderCastLedgers/${index}`, 'Commander cast ledger is missing'));
    if (physical === undefined || ledger === undefined) return null;
    return Object.freeze({ physicalCardId: commander.physicalCardId, ownerPlayerId: commander.ownerPlayerId, castCount: ledger.castCount });
  }).filter((value): value is SoloCoreComparableCommanderV1 => value !== null);
  const view: SoloCoreComparableViewV1 = Object.freeze({
    kind: 'solo-core-comparable-view-v1',
    schemaVersion: 1,
    activePlayerId: activePlayerId as CorePlayerId,
    turnNumber: lifecycle.turnNumber,
    turnPosition,
    orderedZones: coreProjectZones(stateInfo, issues),
    commanders: Object.freeze(commanders),
    combat: coreProjectCombat(root, stateInfo.indexes, issues),
  });
  if (issues.length > 0 || activePlayerId === undefined) return rejected(issues);
  return Object.freeze({ kind: 'projected' as const, view: deepFreeze(view) });
}

export function projectSoloCompatibilityViewV1(state: unknown, identityMap: unknown): ProjectionResult {
  try {
    const mapResult = validateSoloCoreIdentityMapV1(identityMap);
    if (!mapResult.ok) return rejected(mapResult.issues);
    return projectSoloUnchecked(state, mapResult.value);
  } catch {
    return rejected([issue('INVALID_SOURCE', '', 'Solo projection input could not be inspected safely')]);
  }
}

export function projectCoreCompatibilityViewV1(root: unknown, identityMap: unknown): ProjectionResult {
  try {
    const mapResult = validateSoloCoreIdentityMapV1(identityMap);
    if (!mapResult.ok) return rejected(mapResult.issues);
    const rootResult = validateModeNeutralCoreRootV1(root);
    if (!rootResult.ok) return rejected(rootResult.issues.map((current) => issue('INVALID_SOURCE', current.path, current.message)));
    return projectCoreUnchecked(rootResult.value, mapResult.value);
  } catch {
    return rejected([issue('INVALID_SOURCE', '', 'Core projection input could not be inspected safely')]);
  }
}

export type { CompatibilityIssue as SoloCoreCompatibilityIssueV1 };
