import type { CoreObjectId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import { validateCoreRuleKeyV1 } from './ruleKeyV1';
import {
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
  canonicalCoreRuleRecordV1,
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
} from './ruleValidationSharedV1';
import {
  CoreRuleAuthorityOperationError,
  type CoreRuleAuthorityOperationErrorCodeV1,
} from './ruleAuthorityErrorV1';

export type CoreControlEffectDurationV1 =
  | Readonly<{ readonly kind: 'indefinite' }>
  | Readonly<{ readonly kind: 'until-end-of-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }>
  | Readonly<{
      readonly kind: 'while-source-controlled-by';
      readonly sourceObjectId: CoreObjectId;
      readonly controllerPlayerId: CorePlayerId;
    }>
  | Readonly<{
      readonly kind: 'while-source-attached-to-target';
      readonly sourceObjectId: CoreObjectId;
    }>
  | Readonly<{ readonly kind: 'manual' }>;

export type CoreControlEffectV1 = Readonly<{
  readonly targetObjectId: CoreObjectId;
  readonly gainingControllerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CoreControlEffectDurationV1;
}>;

export type CoreControlContinuityV1 = Readonly<{
  readonly controllerPlayerId: CorePlayerId;
  readonly continuousSinceMostRecentTurnBegan: boolean;
}>;

export type ModeNeutralCoreControlSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-control-slice-v1';
  readonly effectOrder: readonly CoreRuleKeyV1[];
  readonly byEffect: Readonly<Record<CoreRuleKeyV1, CoreControlEffectV1>>;
  readonly continuityByObject: Readonly<Record<CoreObjectId, CoreControlContinuityV1>>;
}>;

type Raw = Record<string, unknown>;

function id(value: unknown, path: string, issues: CoreRuleValidationIssueV1[]): value is string {
  if (!isCanonicalCoreObjectIdV2(value)) {
    issues.push(makeCoreRuleIssueV1('INVALID_ID', path, 'Invalid Core object ID'));
    return false;
  }
  return true;
}

function player(
  value: unknown,
  path: string,
  issues: CoreRuleValidationIssueV1[],
): value is CorePlayerId {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    issues.push(makeCoreRuleIssueV1('INVALID_ID', path, 'Invalid Core player ID'));
    return false;
  }
  return true;
}

function duration(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CoreControlEffectDurationV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['kind', 'turnNumber', 'sourceObjectId', 'controllerPlayerId'],
    path,
    ['kind'],
  );
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  const kind = record.kind;
  if (kind === 'indefinite' || kind === 'manual') {
    if (Object.keys(record).length !== 1)
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'Duration has fields for another kind'),
      );
    if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind }) as CoreControlEffectDurationV1 };
  } else if (kind === 'until-end-of-turn') {
    if (typeof record.turnNumber !== 'number' || !Number.isSafeInteger(record.turnNumber))
      issues.push(
        makeCoreRuleIssueV1(
          'INVALID_INTEGER',
          `${path}/turnNumber`,
          'Turn number must be a safe integer',
        ),
      );
    if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind, turnNumber: record.turnNumber as number }) };
  } else if (kind === 'while-source-exists' || kind === 'while-source-attached-to-target') {
    if (!id(record.sourceObjectId, `${path}/sourceObjectId`, issues))
      return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind,
          sourceObjectId: record.sourceObjectId as CoreObjectId,
        }) as CoreControlEffectDurationV1,
      };
  } else if (kind === 'while-source-controlled-by') {
    if (!id(record.sourceObjectId, `${path}/sourceObjectId`, issues))
      return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
    player(record.controllerPlayerId, `${path}/controllerPlayerId`, issues);
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind,
          sourceObjectId: record.sourceObjectId as CoreObjectId,
          controllerPlayerId: record.controllerPlayerId as CorePlayerId,
        }),
      };
  } else {
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid control duration kind'),
    );
  }
  return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
}

function effect(value: unknown, path: string): CoreRuleValidationResultV1<CoreControlEffectV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['targetObjectId', 'gainingControllerPlayerId', 'sourceObjectId', 'duration'],
    path,
  );
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  id(record.targetObjectId, `${path}/targetObjectId`, issues);
  player(record.gainingControllerPlayerId, `${path}/gainingControllerPlayerId`, issues);
  if (record.sourceObjectId !== null) id(record.sourceObjectId, `${path}/sourceObjectId`, issues);
  const checkedDuration = duration(record.duration, `${path}/duration`);
  if (!checkedDuration.ok) {
    issues.push(...checkedDuration.issues);
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  }
  if (issues.length > 0) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return {
    ok: true,
    value: Object.freeze({
      targetObjectId: record.targetObjectId as CoreObjectId,
      gainingControllerPlayerId: record.gainingControllerPlayerId as CorePlayerId,
      sourceObjectId: record.sourceObjectId as CoreObjectId | null,
      duration: checkedDuration.value,
    }),
  };
}

function canonicalSlice(input: unknown): CoreRuleValidationResultV1<ModeNeutralCoreControlSliceV1> {
  const read = readCoreRuleExactRecordV1(input, [
    'kind',
    'effectOrder',
    'byEffect',
    'continuityByObject',
  ]);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  if (record.kind !== 'mode-neutral-core-control-slice-v1')
    issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', '/kind', 'Invalid control slice kind'));
  const order: CoreRuleKeyV1[] = [];
  if (!Array.isArray(record.effectOrder))
    issues.push(
      makeCoreRuleIssueV1('INVALID_ARRAY', '/effectOrder', 'Expected an effect order array'),
    );
  else {
    const seen = new Set<string>();
    for (let index = 0; index < record.effectOrder.length; index += 1) {
      const checked = validateCoreRuleKeyV1(record.effectOrder[index], `/effectOrder/${index}`);
      if (!checked.ok) issues.push(...checked.issues);
      else {
        if (seen.has(checked.value))
          issues.push(
            makeCoreRuleIssueV1('DUPLICATE_VALUE', `/effectOrder/${index}`, 'Duplicate effect key'),
          );
        seen.add(checked.value);
        order.push(checked.value);
      }
    }
  }
  const byEffect = Object.create(null) as Record<string, CoreControlEffectV1>;
  const byEffectValue = record.byEffect;
  if (byEffectValue === null || typeof byEffectValue !== 'object' || Array.isArray(byEffectValue))
    issues.push(makeCoreRuleIssueV1('INVALID_TYPE', '/byEffect', 'Expected an effect record'));
  else {
    for (const key of Reflect.ownKeys(byEffectValue)) {
      if (typeof key !== 'string') {
        issues.push(
          makeCoreRuleIssueV1(
            'UNKNOWN_FIELD',
            '/byEffect/[symbol]',
            'Symbol fields are not allowed',
          ),
        );
        continue;
      }
      const checkedKey = validateCoreRuleKeyV1(key, `/byEffect/${key}`);
      if (!checkedKey.ok) issues.push(...checkedKey.issues);
      const checkedEffect = effect((byEffectValue as Raw)[key], `/byEffect/${key}`);
      if (!checkedEffect.ok) issues.push(...checkedEffect.issues);
      else byEffect[key] = checkedEffect.value;
    }
  }
  if (
    order.length !== Object.keys(byEffect).length ||
    order.some((key) => !Object.prototype.hasOwnProperty.call(byEffect, key))
  )
    issues.push(
      makeCoreRuleIssueV1('EFFECT_SET_MISMATCH', '', 'effectOrder and byEffect keys must match'),
    );
  const continuityByObject = Object.create(null) as Record<string, CoreControlContinuityV1>;
  const continuity = record.continuityByObject;
  if (continuity === null || typeof continuity !== 'object' || Array.isArray(continuity))
    issues.push(
      makeCoreRuleIssueV1('INVALID_TYPE', '/continuityByObject', 'Expected a continuity record'),
    );
  else {
    for (const key of Reflect.ownKeys(continuity)) {
      if (typeof key !== 'string') {
        issues.push(
          makeCoreRuleIssueV1(
            'UNKNOWN_FIELD',
            '/continuityByObject/[symbol]',
            'Symbol fields are not allowed',
          ),
        );
        continue;
      }
      if (!id(key, `/continuityByObject/${key}`, issues)) continue;
      const row = readCoreRuleExactRecordV1(
        (continuity as Raw)[key],
        ['controllerPlayerId', 'continuousSinceMostRecentTurnBegan'],
        `/continuityByObject/${key}`,
      );
      issues.push(...row.issues);
      if (row.record !== null) {
        player(
          row.record.controllerPlayerId,
          `/continuityByObject/${key}/controllerPlayerId`,
          issues,
        );
        if (typeof row.record.continuousSinceMostRecentTurnBegan !== 'boolean')
          issues.push(
            makeCoreRuleIssueV1(
              'INVALID_TYPE',
              `/continuityByObject/${key}/continuousSinceMostRecentTurnBegan`,
              'Expected a boolean',
            ),
          );
        if (
          issues.length === 0 ||
          (typeof row.record.controllerPlayerId === 'string' &&
            typeof row.record.continuousSinceMostRecentTurnBegan === 'boolean')
        )
          continuityByObject[key] = Object.freeze({
            controllerPlayerId: row.record.controllerPlayerId as CorePlayerId,
            continuousSinceMostRecentTurnBegan: row.record
              .continuousSinceMostRecentTurnBegan as boolean,
          });
      }
    }
  }
  if (issues.length > 0) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const result = {
    kind: 'mode-neutral-core-control-slice-v1' as const,
    effectOrder: order,
    byEffect: canonicalCoreRuleRecordV1<Readonly<Record<CoreRuleKeyV1, CoreControlEffectV1>>>(
      order,
      (key) => byEffect[key],
    ),
    continuityByObject,
  };
  return { ok: true, value: deepFreezeCoreRuleValueV1(result) };
}

export function validateModeNeutralCoreControlSliceV1(
  value: unknown,
): CoreRuleValidationResultV1<ModeNeutralCoreControlSliceV1> {
  return canonicalSlice(value);
}

export class CoreControlSliceCreationErrorV1 extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(`Invalid Core control slice (${issues.length} issue(s))`);
    this.name = 'CoreControlSliceCreationErrorV1';
    this.issues = issues;
  }
}

export function createModeNeutralCoreControlSliceV1(
  input: Omit<ModeNeutralCoreControlSliceV1, 'kind'>,
): ModeNeutralCoreControlSliceV1 {
  const result = canonicalSlice({ ...input, kind: 'mode-neutral-core-control-slice-v1' });
  if (!result.ok) throw new CoreControlSliceCreationErrorV1(result.issues);
  return result.value;
}

function checkedSlice(slice: ModeNeutralCoreControlSliceV1): ModeNeutralCoreControlSliceV1 {
  const result = canonicalSlice(slice);
  if (!result.ok) throwOperation('INVALID_OPERATION_INPUT', '', 'Invalid control slice');
  return result.value;
}

function throwOperation(
  code: CoreRuleAuthorityOperationErrorCodeV1,
  path: string,
  message: string,
): never {
  const error = new CoreRuleAuthorityOperationError({ code, path, message });
  error.message = `${code}: ${error.message}`;
  throw error;
}

function operation(
  value: ModeNeutralCoreControlSliceV1,
  changed: readonly CoreObjectId[],
): Readonly<{
  value: ModeNeutralCoreControlSliceV1;
  controllerChangedObjectIds: readonly CoreObjectId[];
}> {
  return Object.freeze({
    value: deepFreezeCoreRuleValueV1(value),
    controllerChangedObjectIds: Object.freeze([...changed]),
  });
}

function active(effectValue: CoreControlEffectV1, turnNumber?: number): boolean {
  return (
    effectValue.duration.kind !== 'until-end-of-turn' ||
    turnNumber === undefined ||
    effectValue.duration.turnNumber > turnNumber
  );
}

function effective(
  slice: ModeNeutralCoreControlSliceV1,
  objectId: string,
  baseline: CorePlayerId | null,
  turnNumber?: number,
): CorePlayerId | null {
  let result = baseline;
  for (const key of slice.effectOrder) {
    const candidate = slice.byEffect[key];
    if (candidate && candidate.targetObjectId === objectId && active(candidate, turnNumber))
      result = candidate.gainingControllerPlayerId;
  }
  return result;
}

function withContinuity(
  slice: ModeNeutralCoreControlSliceV1,
  previous: ModeNeutralCoreControlSliceV1,
  turnNumber?: number,
): ModeNeutralCoreControlSliceV1 {
  const next = Object.create(null) as Record<string, CoreControlContinuityV1>;
  for (const objectId of Object.keys(slice.continuityByObject) as CoreObjectId[]) {
    const old = previous.continuityByObject[objectId];
    const oldController = old?.controllerPlayerId ?? null;
    const nextController = effective(slice, objectId, oldController, turnNumber) ?? oldController;
    next[objectId] = Object.freeze({
      controllerPlayerId: nextController as CorePlayerId,
      continuousSinceMostRecentTurnBegan:
        old !== undefined && oldController === nextController
          ? old.continuousSinceMostRecentTurnBegan
          : false,
    });
  }
  return deepFreezeCoreRuleValueV1({ ...slice, continuityByObject: next });
}

function changedIds(
  before: ModeNeutralCoreControlSliceV1,
  after: ModeNeutralCoreControlSliceV1,
): readonly CoreObjectId[] {
  return (Object.keys(after.continuityByObject) as CoreObjectId[]).filter(
    (key) =>
      before.continuityByObject[key]?.controllerPlayerId !==
      after.continuityByObject[key]?.controllerPlayerId,
  );
}

export function currentCoreObjectControllerV1(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  slice: ModeNeutralCoreControlSliceV1,
  objectId: CoreObjectId,
): CorePlayerId | null {
  const object = registry.objects[objectId];
  if (!object) return null;
  const battlefield = registry.zones.shared.battlefield.includes(objectId);
  const stack = registry.zones.shared.stack.includes(objectId);
  if (
    (!battlefield && !stack) ||
    object.kind === 'activated-ability' ||
    object.kind === 'triggered-ability'
  )
    return null;
  const base =
    object.kind === 'spell-copy' ? object.controllerPlayerId : object.baseControllerPlayerId;
  return effective(checkedSlice(slice), objectId, base);
}

export function applyCoreControlEffectV1(
  slice: ModeNeutralCoreControlSliceV1,
  effectKey: CoreRuleKeyV1,
  effectValue: unknown,
) {
  const before = checkedSlice(slice);
  if (!validateCoreRuleKeyV1(effectKey).ok)
    throwOperation('INVALID_OPERATION_INPUT', '/effectKey', 'Invalid effect key');
  if (Object.prototype.hasOwnProperty.call(before.byEffect, effectKey))
    throwOperation('ID_COLLISION', `/byEffect/${effectKey}`, 'Effect key already exists');
  if (
    effectValue.targetObjectId.startsWith('@activated-ability:') ||
    effectValue.targetObjectId.startsWith('@triggered-ability:')
  )
    throwOperation(
      'OBJECT_NOT_CONTROLLABLE',
      '/effect/targetObjectId',
      'Ability objects are not controllable',
    );
  const checked = effect(effectValue, '/effect');
  if (!checked.ok) throwOperation('INVALID_OPERATION_INPUT', '/effect', 'Invalid control effect');
  const nextRaw = {
    ...before,
    effectOrder: [...before.effectOrder, effectKey],
    byEffect: { ...before.byEffect, [effectKey]: checked.value },
  };
  const next = withContinuity(checkedSlice(nextRaw), before);
  return operation(next, changedIds(before, next));
}

export function removeCoreControlEffectV1(
  slice: ModeNeutralCoreControlSliceV1,
  effectKey: CoreRuleKeyV1,
) {
  const before = checkedSlice(slice);
  if (!Object.prototype.hasOwnProperty.call(before.byEffect, effectKey))
    throwOperation('EFFECT_NOT_FOUND', `/byEffect/${effectKey}`, 'Effect was not found');
  const byEffect = { ...before.byEffect };
  delete byEffect[effectKey];
  const next = withContinuity(
    checkedSlice({
      ...before,
      effectOrder: before.effectOrder.filter((key) => key !== effectKey),
      byEffect,
    }),
    before,
  );
  return operation(next, changedIds(before, next));
}

export function replaceCoreControlEffectOrderV1(
  slice: ModeNeutralCoreControlSliceV1,
  order: readonly CoreRuleKeyV1[],
) {
  const before = checkedSlice(slice);
  const keys = new Set<string>();
  if (
    order.some(
      (key) =>
        keys.has(key) ||
        !Object.prototype.hasOwnProperty.call(before.byEffect, key) ||
        !validateCoreRuleKeyV1(key).ok,
    )
  )
    throwOperation(
      'EFFECT_ORDER_INVALID',
      '/effectOrder',
      'Effect order must be a unique permutation of effect keys',
    );
  for (const key of order) keys.add(key);
  if (keys.size !== Object.keys(before.byEffect).length)
    throwOperation(
      'EFFECT_ORDER_INVALID',
      '/effectOrder',
      'Effect order must contain every effect key',
    );
  const next = withContinuity(checkedSlice({ ...before, effectOrder: [...order] }), before);
  return operation(next, changedIds(before, next));
}

export function markCoreControlledPermanentsAtTurnStartV1(
  slice: ModeNeutralCoreControlSliceV1,
  playerId: CorePlayerId,
) {
  const before = checkedSlice(slice);
  const continuityByObject = Object.fromEntries(
    Object.entries(before.continuityByObject).map(([key, value]) => [
      key,
      Object.freeze({
        ...value,
        continuousSinceMostRecentTurnBegan:
          value.controllerPlayerId === playerId ? true : value.continuousSinceMostRecentTurnBegan,
      }),
    ]),
  );
  return operation(deepFreezeCoreRuleValueV1({ ...before, continuityByObject }), []);
}

export function expireCoreControlEffectsAtTurnBoundaryV1(
  slice: ModeNeutralCoreControlSliceV1,
  turnNumber: number,
) {
  const before = checkedSlice(slice);
  const expired = new Set(
    before.effectOrder.filter(
      (key) =>
        before.byEffect[key].duration.kind === 'until-end-of-turn' &&
        before.byEffect[key].duration.turnNumber <= turnNumber,
    ),
  );
  const byEffect = Object.fromEntries(
    Object.entries(before.byEffect).filter(([key]) => !expired.has(key)),
  );
  const next = withContinuity(
    checkedSlice({
      ...before,
      effectOrder: before.effectOrder.filter((key) => !expired.has(key)),
      byEffect,
    }),
    before,
  );
  return operation(next, changedIds(before, next));
}

export function coreHasContinuousControlSinceTurnStartV1(
  slice: ModeNeutralCoreControlSliceV1,
  objectId: CoreObjectId,
): boolean {
  return (
    checkedSlice(slice).continuityByObject[objectId]?.continuousSinceMostRecentTurnBegan === true
  );
}
