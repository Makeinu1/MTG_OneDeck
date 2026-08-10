import type { CoreObjectId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import {
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
} from './ruleValidationSharedV1';
import { validateCoreRuleKeyV1, type CoreRuleKeyV1 } from './ruleKeyV1';
import { validateCoreRuleZoneRefV1, type CoreRuleZoneRefV1 } from './ruleZoneRefV1';
import { CoreRuleAuthorityOperationError } from './ruleAuthorityErrorV1';

export type CorePlayPermissionActionV1 = 'cast-spell' | 'play-land' | 'play-card';
export type CorePlayPermissionDurationV1 =
  | Readonly<{ readonly kind: 'indefinite' }>
  | Readonly<{ readonly kind: 'until-end-of-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'single-use' }>
  | Readonly<{ readonly kind: 'manual' }>;
export type CorePlayPermissionSubjectV1 =
  | Readonly<{
      readonly kind: 'object';
      readonly objectId: CoreObjectId;
      readonly expectedZone: CoreRuleZoneRefV1;
    }>
  | Readonly<{ readonly kind: 'top-of-library'; readonly playerId: CorePlayerId }>;
export type CorePlayPermissionV1 = Readonly<{
  readonly allowedPlayerId: CorePlayerId;
  readonly action: CorePlayPermissionActionV1;
  readonly subject: CorePlayPermissionSubjectV1;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CorePlayPermissionDurationV1;
}>;
export type ModeNeutralCorePlayPermissionSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-play-permission-slice-v1';
  readonly permissionOrder: readonly CoreRuleKeyV1[];
  readonly byPermission: Readonly<Record<CoreRuleKeyV1, CorePlayPermissionV1>>;
}>;

type Raw = Record<string, unknown>;
const KIND = 'mode-neutral-core-play-permission-slice-v1' as const;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PLAYER = KEY;

function player(
  value: unknown,
  path: string,
  issues: CoreRuleValidationIssueV1[],
): value is CorePlayerId {
  if (typeof value !== 'string' || !PLAYER.test(value)) {
    issues.push(makeCoreRuleIssueV1('INVALID_ID', path, 'Invalid Core player ID'));
    return false;
  }
  return true;
}

function duration(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CorePlayPermissionDurationV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'turnNumber', 'sourceObjectId'], path, [
    'kind',
  ]);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const kind = read.record.kind;
  if (kind === 'indefinite' || kind === 'single-use' || kind === 'manual') {
    if (Object.keys(read.record).length !== 1)
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'Duration has fields for another kind'),
      );
  } else if (kind === 'until-end-of-turn') {
    if (
      typeof read.record.turnNumber !== 'number' ||
      !Number.isSafeInteger(read.record.turnNumber) ||
      read.record.turnNumber < 0
    )
      issues.push(
        makeCoreRuleIssueV1(
          'INVALID_INTEGER',
          `${path}/turnNumber`,
          'Turn number must be a non-negative safe integer',
        ),
      );
  } else if (kind === 'while-source-exists') {
    if (!isCanonicalCoreObjectIdV2(read.record.sourceObjectId))
      issues.push(
        makeCoreRuleIssueV1(
          'INVALID_ID',
          `${path}/sourceObjectId`,
          'Source object ID must be a canonical object ID',
        ),
      );
  } else
    issues.push(
      makeCoreRuleIssueV1(
        'INVALID_LITERAL',
        `${path}/kind`,
        'Invalid play permission duration kind',
      ),
    );
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      kind,
      ...(kind === 'until-end-of-turn' ? { turnNumber: read.record.turnNumber } : {}),
      ...(kind === 'while-source-exists' ? { sourceObjectId: read.record.sourceObjectId } : {}),
    }) as CorePlayPermissionDurationV1,
  };
}

function subject(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CorePlayPermissionSubjectV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['kind', 'objectId', 'expectedZone', 'playerId'],
    path,
    ['kind'],
  );
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const kind = read.record.kind;
  if (kind === 'object') {
    if (Object.keys(read.record).some((key) => !['kind', 'objectId', 'expectedZone'].includes(key)))
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'Object subject has fields for another kind'),
      );
    if (!isCanonicalCoreObjectIdV2(read.record.objectId))
      issues.push(makeCoreRuleIssueV1('INVALID_ID', `${path}/objectId`, 'Invalid object ID'));
    const zone = validateCoreRuleZoneRefV1(read.record.expectedZone);
    if (!zone.ok)
      issues.push(
        ...zone.issues.map((issue) =>
          makeCoreRuleIssueV1(issue.code, `${path}/expectedZone${issue.path}`, issue.message),
        ),
      );
    if (issues.length === 0)
      return {
        ok: true,
        value: {
          kind,
          objectId: read.record.objectId as CoreObjectId,
          expectedZone: zone.ok ? zone.value : (undefined as never),
        },
      };
  } else if (kind === 'top-of-library') {
    if (Object.keys(read.record).some((key) => !['kind', 'playerId'].includes(key)))
      issues.push(
        makeCoreRuleIssueV1(
          'UNKNOWN_FIELD',
          path,
          'Top-library subject has fields for another kind',
        ),
      );
    player(read.record.playerId, `${path}/playerId`, issues);
    if (issues.length === 0)
      return { ok: true, value: { kind, playerId: read.record.playerId as CorePlayerId } };
  } else
    issues.push(
      makeCoreRuleIssueV1(
        'INVALID_LITERAL',
        `${path}/kind`,
        'Invalid play permission subject kind',
      ),
    );
  return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
}

function permission(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CorePlayPermissionV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['allowedPlayerId', 'action', 'subject', 'sourceObjectId', 'duration'],
    path,
  );
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  player(read.record.allowedPlayerId, `${path}/allowedPlayerId`, issues);
  if (
    read.record.action !== 'cast-spell' &&
    read.record.action !== 'play-land' &&
    read.record.action !== 'play-card'
  )
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/action`, 'Invalid play permission action'),
    );
  if (read.record.sourceObjectId !== null && !isCanonicalCoreObjectIdV2(read.record.sourceObjectId))
    issues.push(
      makeCoreRuleIssueV1('INVALID_ID', `${path}/sourceObjectId`, 'Invalid source object ID'),
    );
  const checkedSubject = subject(read.record.subject, `${path}/subject`);
  const checkedDuration = duration(read.record.duration, `${path}/duration`);
  if (!checkedSubject.ok) issues.push(...checkedSubject.issues);
  if (!checkedDuration.ok) issues.push(...checkedDuration.issues);
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (!checkedSubject.ok || !checkedDuration.ok)
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      allowedPlayerId: read.record.allowedPlayerId as CorePlayerId,
      action: read.record.action as CorePlayPermissionActionV1,
      subject: checkedSubject.value,
      sourceObjectId: read.record.sourceObjectId as CoreObjectId | null,
      duration: checkedDuration.value,
    }),
  };
}

export function validateModeNeutralCorePlayPermissionSliceV1(
  input: unknown,
): CoreRuleValidationResultV1<ModeNeutralCorePlayPermissionSliceV1> {
  const read = readCoreRuleExactRecordV1(input, ['kind', 'permissionOrder', 'byPermission']);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind !== KIND)
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', '/kind', 'Invalid play permission slice kind'),
    );
  const order: CoreRuleKeyV1[] = [];
  if (!Array.isArray(read.record.permissionOrder))
    issues.push(
      makeCoreRuleIssueV1('INVALID_ARRAY', '/permissionOrder', 'permissionOrder must be an array'),
    );
  else
    read.record.permissionOrder.forEach((key, index) => {
      const checked = validateCoreRuleKeyV1(key, `/permissionOrder/${index}`);
      if (!checked.ok) issues.push(...checked.issues);
      else if (order.includes(checked.value))
        issues.push(
          makeCoreRuleIssueV1(
            'DUPLICATE_VALUE',
            `/permissionOrder/${index}`,
            'Duplicate permission key',
          ),
        );
      else order.push(checked.value);
    });
  const raw = read.record.byPermission;
  const checked: Record<string, CorePlayPermissionV1> = Object.create(null) as Record<
    string,
    CorePlayPermissionV1
  >;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    issues.push(
      makeCoreRuleIssueV1('INVALID_TYPE', '/byPermission', 'byPermission must be a record'),
    );
  else
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string' || !KEY.test(key)) {
        issues.push(
          makeCoreRuleIssueV1(
            'INVALID_ID',
            `/byPermission/${String(key)}`,
            'Invalid permission key',
          ),
        );
        continue;
      }
      const result = permission((raw as Raw)[key], `/byPermission/${key}`);
      if (!result.ok) issues.push(...result.issues);
      else checked[key] = result.value;
    }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of order)
      if (!Object.prototype.hasOwnProperty.call(raw, key))
        issues.push(
          makeCoreRuleIssueV1(
            'PERMISSION_SET_MISMATCH',
            '/permissionOrder',
            `Missing permission entry: ${key}`,
          ),
        );
    for (const key of Object.keys(raw))
      if (!order.includes(key))
        issues.push(
          makeCoreRuleIssueV1(
            'PERMISSION_SET_MISMATCH',
            '/byPermission',
            `Unordered permission entry: ${key}`,
          ),
        );
  }
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const byPermission: Record<string, CorePlayPermissionV1> = Object.create(null) as Record<
    string,
    CorePlayPermissionV1
  >;
  for (const key of order) byPermission[key] = checked[key] as CorePlayPermissionV1;
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      kind: KIND,
      permissionOrder: Object.freeze(order.slice()),
      byPermission,
    }),
  };
}

export class CorePlayPermissionSliceCreationErrorV1 extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(`Invalid Core play permission slice (${issues.length} issue(s))`);
    this.name = 'CorePlayPermissionSliceCreationErrorV1';
    this.issues = issues;
  }
}
export function createModeNeutralCorePlayPermissionSliceV1(
  input: Omit<ModeNeutralCorePlayPermissionSliceV1, 'kind'>,
): ModeNeutralCorePlayPermissionSliceV1 {
  const result = validateModeNeutralCorePlayPermissionSliceV1({ ...input, kind: KIND });
  if (!result.ok) throw new CorePlayPermissionSliceCreationErrorV1(result.issues);
  return result.value;
}

function checked(
  input: ModeNeutralCorePlayPermissionSliceV1,
): ModeNeutralCorePlayPermissionSliceV1 {
  const result = validateModeNeutralCorePlayPermissionSliceV1(input);
  if (!result.ok)
    throw new CoreRuleAuthorityOperationError({
      code: 'INVALID_OPERATION_INPUT',
      path: '',
      message: 'Invalid play permission slice',
    });
  return result.value;
}
function operation(value: ModeNeutralCorePlayPermissionSliceV1) {
  return Object.freeze({ value: deepFreezeCoreRuleValueV1(value) });
}
export function addCorePlayPermissionV1(
  sliceInput: ModeNeutralCorePlayPermissionSliceV1,
  permissionKey: CoreRuleKeyV1,
  value: CorePlayPermissionV1,
) {
  const slice = checked(sliceInput);
  if (
    !KEY.test(permissionKey) ||
    Object.prototype.hasOwnProperty.call(slice.byPermission, permissionKey)
  )
    throw new CoreRuleAuthorityOperationError({
      code: 'ID_COLLISION',
      path: `/byPermission/${permissionKey}`,
      message: 'Permission key already exists or is invalid',
    });
  const valid = permission(value, `/byPermission/${permissionKey}`);
  if (!valid.ok)
    throw new CoreRuleAuthorityOperationError({
      code: 'INVALID_OPERATION_INPUT',
      path: `/byPermission/${permissionKey}`,
      message: 'Invalid play permission',
    });
  return operation(
    createModeNeutralCorePlayPermissionSliceV1({
      permissionOrder: [...slice.permissionOrder, permissionKey],
      byPermission: { ...slice.byPermission, [permissionKey]: valid.value },
    }),
  );
}
export function removeCorePlayPermissionV1(
  sliceInput: ModeNeutralCorePlayPermissionSliceV1,
  permissionKey: CoreRuleKeyV1,
) {
  const slice = checked(sliceInput);
  if (!Object.prototype.hasOwnProperty.call(slice.byPermission, permissionKey))
    throw new CoreRuleAuthorityOperationError({
      code: 'PERMISSION_NOT_FOUND',
      path: `/byPermission/${permissionKey}`,
      message: 'Permission was not found',
    });
  const order = slice.permissionOrder.filter((key) => key !== permissionKey);
  const by = Object.fromEntries(order.map((key) => [key, slice.byPermission[key]]));
  return operation(
    createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: order, byPermission: by }),
  );
}
export function consumeCorePlayPermissionV1(
  sliceInput: ModeNeutralCorePlayPermissionSliceV1,
  permissionKey: CoreRuleKeyV1,
) {
  return removeCorePlayPermissionV1(sliceInput, permissionKey);
}
export function findCorePlayPermissionsV1(
  sliceInput: ModeNeutralCorePlayPermissionSliceV1,
  allowedPlayerId: CorePlayerId,
  action: CorePlayPermissionActionV1,
): readonly CorePlayPermissionV1[] {
  const slice = checked(sliceInput);
  return Object.freeze(
    slice.permissionOrder
      .filter(
        (key) =>
          slice.byPermission[key].allowedPlayerId === allowedPlayerId &&
          slice.byPermission[key].action === action,
      )
      .map((key) => slice.byPermission[key]),
  );
}

type VisibilityLike = { readonly byGrant?: Readonly<Record<string, unknown>> };
function hasFaceDownIdentityVisibility(
  visibility: unknown,
  playerId: string,
  objectId: string,
): boolean {
  if (visibility === null || typeof visibility !== 'object') return false;
  const grants = (visibility as VisibilityLike).byGrant;
  if (grants === null || typeof grants !== 'object') return false;
  for (const grant of Object.values(grants)) {
    if (grant === null || typeof grant !== 'object') continue;
    const row = grant as Raw;
    const target = row.subject;
    if (target === null || typeof target !== 'object') continue;
    const subject = target as Raw;
    if (subject.kind !== 'object' || subject.objectId !== objectId) continue;
    const audience = row.audience;
    if (audience === null || typeof audience !== 'object') continue;
    const players = (audience as Raw).playerIds;
    if (Array.isArray(players) && players.includes(playerId)) return true;
  }
  return false;
}
function currentLocation(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  objectId: string,
): { readonly zone: string; readonly playerId?: string; readonly index: number } | null {
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      const index = zones[zone].indexOf(objectId as CoreObjectId);
      if (index >= 0) return { zone, playerId, index };
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    const index = registry.zones.shared[zone].indexOf(objectId as CoreObjectId);
    if (index >= 0) return { zone, index };
  }
  return null;
}
function zoneMatches(
  location: ReturnType<typeof currentLocation>,
  zone: CoreRuleZoneRefV1,
): boolean {
  if (location === null) return false;
  if (zone.kind === 'shared-zone')
    return location.zone === zone.zone && location.playerId === undefined;
  return location.zone === zone.zone && location.playerId === zone.playerId;
}
export function coreCanPlayerAttemptPlayObjectV1(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  visibility: unknown,
  sliceInput: ModeNeutralCorePlayPermissionSliceV1,
  playerId: CorePlayerId,
  objectId: CoreObjectId,
): boolean {
  const slice = checked(sliceInput);
  const location = currentLocation(registry, objectId);
  if (location === null) return false;
  for (let index = slice.permissionOrder.length - 1; index >= 0; index -= 1) {
    const grant = slice.byPermission[slice.permissionOrder[index]];
    if (grant.allowedPlayerId !== playerId) continue;
    const candidate = grant.subject;
    if (candidate.kind === 'object' && candidate.objectId === objectId) {
      if (!zoneMatches(location, candidate.expectedZone)) continue;
      if (location.zone === 'exile')
        return hasFaceDownIdentityVisibility(visibility, playerId, objectId);
      return true;
    } else if (
      candidate.kind === 'top-of-library' &&
      location.zone === 'library' &&
      location.playerId === candidate.playerId &&
      location.index === 0
    )
      return true;
  }
  return false;
}
