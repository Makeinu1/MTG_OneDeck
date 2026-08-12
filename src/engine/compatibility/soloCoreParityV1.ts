import type {
  SoloCoreComparableCombatV1,
  SoloCoreComparableViewV1,
} from './soloCoreCompatibilityV1';

export type SoloCoreParityIssueV1 = Readonly<{
  readonly code: 'VIEW_FIELD_MISMATCH';
  readonly path: string;
  readonly message: string;
}>;

type CompatibilityResult = Readonly<{
  readonly kind: 'compatible';
  readonly soloView: SoloCoreComparableViewV1;
  readonly coreView: SoloCoreComparableViewV1;
  readonly issues: readonly SoloCoreParityIssueV1[];
}> | Readonly<{
  readonly kind: 'incompatible';
  readonly soloView: SoloCoreComparableViewV1;
  readonly coreView: SoloCoreComparableViewV1;
  readonly issues: readonly SoloCoreParityIssueV1[];
}>;

export type SoloCoreParityResultV1 = CompatibilityResult;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object') {
    const objectValue = value as object;
    if (!seen.has(objectValue)) {
      seen.add(objectValue);
      for (const key of Reflect.ownKeys(objectValue)) {
        const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        if (descriptor !== undefined && 'value' in descriptor) freezeDeep(descriptor.value, seen);
      }
      Object.freeze(objectValue);
    }
  }
  return value;
}

function issue(path: string, message: string): SoloCoreParityIssueV1 {
  return Object.freeze({ code: 'VIEW_FIELD_MISMATCH', path, message });
}

function sortedIssues(issues: readonly SoloCoreParityIssueV1[]): readonly SoloCoreParityIssueV1[] {
  return Object.freeze([...issues].sort((left, right) => codeUnitCompare(left.path, right.path)));
}

function exactRecord(input: unknown, fields: readonly string[]): object {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected record');
  const prototype = Reflect.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Expected ordinary record');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !fields.includes(key))) {
    throw new TypeError('Expected exact record');
  }
  return input;
}

function dataValue(input: object, field: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, field);
  if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
    throw new TypeError('Expected enumerable data property');
  }
  return descriptor.value;
}

function stringValue(input: object, field: string): string {
  const value = dataValue(input, field);
  if (typeof value !== 'string') throw new TypeError('Expected string');
  return value;
}

function numberValue(input: object, field: string): number {
  const value = dataValue(input, field);
  if (typeof value !== 'number') throw new TypeError('Expected number');
  return value;
}

function nullableStringValue(input: object, field: string): string | null {
  const value = dataValue(input, field);
  if (value !== null && typeof value !== 'string') throw new TypeError('Expected nullable string');
  return value;
}

function mapDenseArray<T>(input: unknown, copy: (value: unknown) => T): T[] {
  if (!Array.isArray(input)) throw new TypeError('Expected array');
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) throw new TypeError('Expected array length');
  const length: unknown = lengthDescriptor.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) throw new TypeError('Expected valid array length');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length + 1 || !keys.includes('length')) throw new TypeError('Expected dense array');
  const result: T[] = [];
  for (let index = 0; index < length; index += 1) {
    result.push(copy(dataValue(input, String(index))));
  }
  return result;
}

function copyView(view: SoloCoreComparableViewV1): SoloCoreComparableViewV1 {
  const source = exactRecord(view, ['kind', 'schemaVersion', 'activePlayerId', 'turnNumber', 'turnPosition', 'orderedZones', 'commanders', 'combat']);
  const rawTurnPosition = exactRecord(dataValue(source, 'turnPosition'), ['phase', 'step']);
  const turnPosition = {
    phase: stringValue(rawTurnPosition, 'phase'),
    step: nullableStringValue(rawTurnPosition, 'step'),
  };
  const orderedZones = mapDenseArray(dataValue(source, 'orderedZones'), (rawZone) => {
    const zone = exactRecord(rawZone, ['playerId', 'zone', 'objectIds']);
    return {
      playerId: nullableStringValue(zone, 'playerId'),
      zone: stringValue(zone, 'zone'),
      objectIds: mapDenseArray(dataValue(zone, 'objectIds'), (objectId) => {
        if (typeof objectId !== 'string') throw new TypeError('Expected object ID');
        return objectId;
      }),
    };
  });
  const commanders = mapDenseArray(dataValue(source, 'commanders'), (rawCommander) => {
    const commander = exactRecord(rawCommander, ['physicalCardId', 'ownerPlayerId', 'castCount']);
    return {
      physicalCardId: stringValue(commander, 'physicalCardId'),
      ownerPlayerId: stringValue(commander, 'ownerPlayerId'),
      castCount: numberValue(commander, 'castCount'),
    };
  });
  const rawCombat = dataValue(source, 'combat');
  const combat = rawCombat === null ? null : (() => {
    const value = exactRecord(rawCombat, ['turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks']);
    return {
      turnNumber: numberValue(value, 'turnNumber'),
      step: stringValue(value, 'step'),
      attackingPlayerId: stringValue(value, 'attackingPlayerId'),
      defendingPlayerIds: mapDenseArray(dataValue(value, 'defendingPlayerIds'), (playerId) => {
        if (typeof playerId !== 'string') throw new TypeError('Expected player ID');
        return playerId;
      }),
      attacks: mapDenseArray(dataValue(value, 'attacks'), (rawAttack) => {
        const attack = exactRecord(rawAttack, ['attackerObjectId', 'attackerControllerPlayerId', 'defendingPlayerId']);
        return {
          attackerObjectId: stringValue(attack, 'attackerObjectId'),
          attackerControllerPlayerId: stringValue(attack, 'attackerControllerPlayerId'),
          defendingPlayerId: stringValue(attack, 'defendingPlayerId'),
        };
      }),
      blocks: mapDenseArray(dataValue(value, 'blocks'), (rawBlock) => {
        const block = exactRecord(rawBlock, ['blockerObjectId', 'blockerControllerPlayerId', 'attackedObjectId', 'defendingPlayerId']);
        return {
          blockerObjectId: stringValue(block, 'blockerObjectId'),
          blockerControllerPlayerId: stringValue(block, 'blockerControllerPlayerId'),
          attackedObjectId: stringValue(block, 'attackedObjectId'),
          defendingPlayerId: stringValue(block, 'defendingPlayerId'),
        };
      }),
    };
  })();
  return freezeDeep({
    kind: stringValue(source, 'kind'),
    schemaVersion: numberValue(source, 'schemaVersion'),
    activePlayerId: stringValue(source, 'activePlayerId'),
    turnNumber: numberValue(source, 'turnNumber'),
    turnPosition,
    orderedZones,
    commanders,
    combat,
  }) as unknown as SoloCoreComparableViewV1;
}

function emptySafeView(): SoloCoreComparableViewV1 {
  return freezeDeep({
    kind: 'solo-core-comparable-view-v1',
    schemaVersion: 1,
    activePlayerId: '' as SoloCoreComparableViewV1['activePlayerId'],
    turnNumber: 0,
    turnPosition: { phase: 'precombat-main' as const, step: null },
    orderedZones: [],
    commanders: [],
    combat: null,
  });
}

function safeCopyView(view: SoloCoreComparableViewV1): Readonly<{
  readonly value: SoloCoreComparableViewV1;
  readonly failed: boolean;
}> {
  try {
    return Object.freeze({ value: copyView(view), failed: false });
  } catch {
    return Object.freeze({ value: emptySafeView(), failed: true });
  }
}

function compareScalar(left: unknown, right: unknown, path: string, issues: SoloCoreParityIssueV1[]): void {
  if (left !== right) issues.push(issue(path, 'Comparable view fields differ'));
}

function compareArrays(left: readonly unknown[], right: readonly unknown[], path: string, issues: SoloCoreParityIssueV1[], compare: (a: unknown, b: unknown, p: string) => void): void {
  if (left.length !== right.length) issues.push(issue(path, 'Comparable array lengths differ'));
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (index >= left.length || index >= right.length) continue;
    compare(left[index], right[index], `${path}/${index}`);
  }
}

function compareViews(left: SoloCoreComparableViewV1, right: SoloCoreComparableViewV1): readonly SoloCoreParityIssueV1[] {
  const issues: SoloCoreParityIssueV1[] = [];
  compareScalar(left.kind, right.kind, '/kind', issues);
  compareScalar(left.schemaVersion, right.schemaVersion, '/schemaVersion', issues);
  compareScalar(left.activePlayerId, right.activePlayerId, '/activePlayerId', issues);
  compareScalar(left.turnNumber, right.turnNumber, '/turnNumber', issues);
  compareScalar(left.turnPosition.phase, right.turnPosition.phase, '/turnPosition/phase', issues);
  compareScalar(left.turnPosition.step, right.turnPosition.step, '/turnPosition/step', issues);
  compareArrays(left.orderedZones, right.orderedZones, '/orderedZones', issues, (a, b, path) => {
    const leftZone = a as SoloCoreComparableViewV1['orderedZones'][number];
    const rightZone = b as SoloCoreComparableViewV1['orderedZones'][number];
    compareScalar(leftZone.playerId, rightZone.playerId, `${path}/playerId`, issues);
    compareScalar(leftZone.zone, rightZone.zone, `${path}/zone`, issues);
    compareArrays(leftZone.objectIds, rightZone.objectIds, `${path}/objectIds`, issues, (x, y, childPath) => compareScalar(x, y, childPath, issues));
  });
  compareArrays(left.commanders, right.commanders, '/commanders', issues, (a, b, path) => {
    const leftCommander = a as SoloCoreComparableViewV1['commanders'][number];
    const rightCommander = b as SoloCoreComparableViewV1['commanders'][number];
    compareScalar(leftCommander.physicalCardId, rightCommander.physicalCardId, `${path}/physicalCardId`, issues);
    compareScalar(leftCommander.ownerPlayerId, rightCommander.ownerPlayerId, `${path}/ownerPlayerId`, issues);
    compareScalar(leftCommander.castCount, rightCommander.castCount, `${path}/castCount`, issues);
  });
  if (left.combat === null || right.combat === null) {
    if (left.combat !== right.combat) issues.push(issue('/combat', 'One comparable view has combat assignments and the other does not'));
  } else {
    compareScalar(left.combat.turnNumber, right.combat.turnNumber, '/combat/turnNumber', issues);
    compareScalar(left.combat.step, right.combat.step, '/combat/step', issues);
    compareScalar(left.combat.attackingPlayerId, right.combat.attackingPlayerId, '/combat/attackingPlayerId', issues);
    compareArrays(left.combat.defendingPlayerIds, right.combat.defendingPlayerIds, '/combat/defendingPlayerIds', issues, (a, b, path) => compareScalar(a, b, path, issues));
    compareArrays(left.combat.attacks, right.combat.attacks, '/combat/attacks', issues, (a, b, path) => {
      const x = a as SoloCoreComparableCombatV1['attacks'][number];
      const y = b as SoloCoreComparableCombatV1['attacks'][number];
      compareScalar(x.attackerObjectId, y.attackerObjectId, `${path}/attackerObjectId`, issues);
      compareScalar(x.attackerControllerPlayerId, y.attackerControllerPlayerId, `${path}/attackerControllerPlayerId`, issues);
      compareScalar(x.defendingPlayerId, y.defendingPlayerId, `${path}/defendingPlayerId`, issues);
    });
    compareArrays(left.combat.blocks, right.combat.blocks, '/combat/blocks', issues, (a, b, path) => {
      const x = a as SoloCoreComparableCombatV1['blocks'][number];
      const y = b as SoloCoreComparableCombatV1['blocks'][number];
      compareScalar(x.blockerObjectId, y.blockerObjectId, `${path}/blockerObjectId`, issues);
      compareScalar(x.blockerControllerPlayerId, y.blockerControllerPlayerId, `${path}/blockerControllerPlayerId`, issues);
      compareScalar(x.attackedObjectId, y.attackedObjectId, `${path}/attackedObjectId`, issues);
      compareScalar(x.defendingPlayerId, y.defendingPlayerId, `${path}/defendingPlayerId`, issues);
    });
  }
  return sortedIssues(issues);
}

export function compareSoloCoreCompatibilityV1(
  soloView: SoloCoreComparableViewV1,
  coreView: SoloCoreComparableViewV1,
): SoloCoreParityResultV1 {
  const soloCopy = safeCopyView(soloView);
  const coreCopy = safeCopyView(coreView);
  if (soloCopy.failed || coreCopy.failed) {
    return Object.freeze({
      kind: 'incompatible',
      soloView: soloCopy.value,
      coreView: coreCopy.value,
      issues: Object.freeze([issue('', 'Comparable views could not be inspected safely')]),
    });
  }
  const issues = compareViews(soloCopy.value, coreCopy.value);
  if (issues.length === 0) return Object.freeze({ kind: 'compatible', soloView: soloCopy.value, coreView: coreCopy.value, issues: Object.freeze([]) });
  return Object.freeze({ kind: 'incompatible', soloView: soloCopy.value, coreView: coreCopy.value, issues });
}
