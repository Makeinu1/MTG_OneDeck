import type { CoreObjectId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import {
  validateCoreTurnPriorityBundleV1,
  type CoreTurnPriorityBundleV1,
} from '../turn/turnPriorityBundleV1';
import {
  validateModeNeutralCoreControlSliceV1,
  type ModeNeutralCoreControlSliceV1,
} from './controlEffectV1';
import {
  validateModeNeutralCoreDecisionAuthoritySliceV1,
  type ModeNeutralCoreDecisionAuthoritySliceV1,
} from './decisionAuthorityV1';
import {
  validateModeNeutralCoreSearchSessionSliceV1,
  type ModeNeutralCoreSearchSessionSliceV1,
} from './searchSessionV1';
import {
  validateModeNeutralCoreVisibilitySliceV1,
  type ModeNeutralCoreVisibilitySliceV1,
} from './visibilityGrantV1';
import {
  validateModeNeutralCorePlayPermissionSliceV1,
  type ModeNeutralCorePlayPermissionSliceV1,
} from './playPermissionV1';
import {
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
  type CoreRuleRawRecordV1,
  type CoreRuleValidationCodeV1,
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
} from './ruleValidationSharedV1';
import type { CoreRuleAuthorityBundleV1 } from './ruleAuthorityBundleV1';

export type CoreRuleAuthorityBundleValidationCodeV1 = CoreRuleValidationCodeV1;
export type CoreRuleAuthorityBundleValidationIssueV1 = CoreRuleValidationIssueV1;
export type CoreRuleAuthorityBundleValidationResultV1 =
  CoreRuleValidationResultV1<CoreRuleAuthorityBundleV1>;

const ROOT_FIELDS = [
  'turnPriorityBundle',
  'control',
  'visibility',
  'searchSessions',
  'playPermissions',
  'decisionAuthorities',
] as const;

type Registry = ModeNeutralCoreObjectRegistryStateV2;
type Raw = CoreRuleRawRecordV1;

function issue(code: CoreRuleValidationCodeV1, path: string, message: string): CoreRuleValidationIssueV1 {
  return makeCoreRuleIssueV1(code, path, message);
}

function safeValidatedValue<T>(
  validate: () => { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly unknown[] },
): T | null {
  try {
    const result = validate();
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

function playerPresent(registry: Registry, playerId: CorePlayerId): boolean {
  return Object.prototype.hasOwnProperty.call(registry.players, playerId);
}

function objectPresent(registry: Registry, objectId: CoreObjectId): boolean {
  return Object.prototype.hasOwnProperty.call(registry.objects, objectId);
}

function locationOf(
  registry: Registry,
  objectId: CoreObjectId,
): { readonly kind: 'player-zone'; readonly playerId: CorePlayerId; readonly zone: string; readonly index: number }
  | { readonly kind: 'shared-zone'; readonly zone: string; readonly index: number }
  | null {
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      const index = zones[zone].indexOf(objectId);
      if (index >= 0) return { kind: 'player-zone', playerId, zone, index };
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    const index = registry.zones.shared[zone].indexOf(objectId);
    if (index >= 0) return { kind: 'shared-zone', zone, index };
  }
  return null;
}

function zoneContains(
  registry: Registry,
  objectId: CoreObjectId,
  zone: { readonly kind: string; readonly playerId?: string; readonly zone: string },
): boolean {
  const location = locationOf(registry, objectId);
  if (!location || location.kind !== zone.kind || location.zone !== zone.zone) return false;
  return location.kind === 'shared-zone' || location.playerId === zone.playerId;
}

function idsInZone(
  registry: Registry,
  zone: { readonly kind: string; readonly playerId?: string; readonly zone: string },
): readonly CoreObjectId[] {
  if (zone.kind === 'player-zone') {
    return registry.zones.byPlayer[zone.playerId as CorePlayerId]?.[
      zone.zone as 'library' | 'hand' | 'graveyard'
    ] ?? [];
  }
  return registry.zones.shared[zone.zone as 'battlefield' | 'stack' | 'exile' | 'command'];
}

function baseController(registry: Registry, objectId: CoreObjectId): CorePlayerId | null {
  const object = registry.objects[objectId] as unknown as Raw | undefined;
  if (!object) return null;
  const value = object.kind === 'spell-copy' ? object.controllerPlayerId : object.baseControllerPlayerId;
  return typeof value === 'string' ? value as CorePlayerId : null;
}

function effectiveController(
  registry: Registry,
  control: ModeNeutralCoreControlSliceV1,
  objectId: CoreObjectId,
): CorePlayerId | null {
  const object = registry.objects[objectId] as unknown as Raw | undefined;
  const location = locationOf(registry, objectId);
  if (!object || !location || location.kind !== 'shared-zone') return null;
  if (location.zone !== 'battlefield' && location.zone !== 'stack') return null;
  if (object.kind === 'activated-ability' || object.kind === 'triggered-ability') return null;
  let controller = baseController(registry, objectId);
  for (const key of control.effectOrder) {
    const effect = control.byEffect[key];
    if (effect.targetObjectId === objectId) controller = effect.gainingControllerPlayerId;
  }
  return controller;
}

function validateCrossSlice(
  registry: Registry,
  control: ModeNeutralCoreControlSliceV1,
  visibility: ModeNeutralCoreVisibilitySliceV1,
  searchSessions: ModeNeutralCoreSearchSessionSliceV1,
  playPermissions: ModeNeutralCorePlayPermissionSliceV1,
  decisionAuthorities: ModeNeutralCoreDecisionAuthoritySliceV1,
): readonly CoreRuleValidationIssueV1[] {
  const issues: CoreRuleValidationIssueV1[] = [];
  const seated = (playerId: CorePlayerId, path: string): void => {
    if (!playerPresent(registry, playerId)) issues.push(issue('PLAYER_NOT_SEATED', path, 'Player must be seated'));
  };
  const present = (objectId: CoreObjectId, path: string): void => {
    if (!objectPresent(registry, objectId)) issues.push(issue('OBJECT_NOT_FOUND', path, 'Object must be present'));
  };

  const battlefieldIds = registry.zones.shared.battlefield.filter((objectId) => {
    const kind = (registry.objects[objectId] as unknown as Raw | undefined)?.kind;
    return kind === 'card' || kind === 'token';
  });
  const continuityIds = Object.keys(control.continuityByObject);
  for (const objectId of battlefieldIds) {
    if (!Object.prototype.hasOwnProperty.call(control.continuityByObject, objectId))
      issues.push(issue('CONTINUITY_SET_MISMATCH', '/control/continuityByObject', `Missing continuity entry: ${objectId}`));
  }
  for (const objectId of continuityIds) {
    const typedObjectId = objectId as CoreObjectId;
    const kind = (registry.objects[typedObjectId] as unknown as Raw | undefined)?.kind;
    if (!registry.zones.shared.battlefield.includes(typedObjectId) || (kind !== 'card' && kind !== 'token'))
      issues.push(issue('CONTINUITY_SET_MISMATCH', '/control/continuityByObject', `Invalid continuity entry: ${objectId}`));
    const row = control.continuityByObject[typedObjectId];
    if (!row) continue;
    seated(row.controllerPlayerId, `/control/continuityByObject/${objectId}/controllerPlayerId`);
    const effective = effectiveController(registry, control, typedObjectId);
    if (effective !== row.controllerPlayerId)
      issues.push(issue('CONTINUITY_CONTROLLER_MISMATCH', `/control/continuityByObject/${objectId}`, 'Continuity controller must equal effective controller'));
  }
  for (const key of control.effectOrder) {
    const effect = control.byEffect[key];
    present(effect.targetObjectId, `/control/byEffect/${key}/targetObjectId`);
    seated(effect.gainingControllerPlayerId, `/control/byEffect/${key}/gainingControllerPlayerId`);
    if (effect.sourceObjectId !== null) present(effect.sourceObjectId, `/control/byEffect/${key}/sourceObjectId`);
    if (effect.duration.kind === 'while-source-controlled-by') {
      seated(effect.duration.controllerPlayerId, `/control/byEffect/${key}/duration/controllerPlayerId`);
      present(effect.duration.sourceObjectId, `/control/byEffect/${key}/duration/sourceObjectId`);
    } else if (effect.duration.kind === 'while-source-exists' || effect.duration.kind === 'while-source-attached-to-target') {
      present(effect.duration.sourceObjectId, `/control/byEffect/${key}/duration/sourceObjectId`);
    }
    const target = registry.objects[effect.targetObjectId] as unknown as Raw | undefined;
    const targetLocation = locationOf(registry, effect.targetObjectId);
    if (!target || !targetLocation || targetLocation.kind !== 'shared-zone'
      || (targetLocation.zone !== 'battlefield' && targetLocation.zone !== 'stack')
      || target.kind === 'activated-ability' || target.kind === 'triggered-ability') {
      issues.push(issue('OBJECT_NOT_CONTROLLABLE', `/control/byEffect/${key}/targetObjectId`, 'Target is not a controllable battlefield or stack object'));
    }
  }

  for (const key of decisionAuthorities.authorityOrder) {
    const authority = decisionAuthorities.byAuthority[key];
    seated(authority.controlledPlayerId, `/decisionAuthorities/byAuthority/${key}/controlledPlayerId`);
    seated(authority.decisionMakerPlayerId, `/decisionAuthorities/byAuthority/${key}/decisionMakerPlayerId`);
    if (authority.sourceObjectId !== null) present(authority.sourceObjectId, `/decisionAuthorities/byAuthority/${key}/sourceObjectId`);
    if (authority.scope.kind === 'search-session' && !Object.prototype.hasOwnProperty.call(searchSessions.bySession, authority.scope.searchSessionId))
      issues.push(issue('DECISION_AUTHORITY_MISMATCH', `/decisionAuthorities/byAuthority/${key}/scope/searchSessionId`, 'Search session authority must name an existing session'));
  }

  for (const key of searchSessions.sessionOrder) {
    const session = searchSessions.bySession[key];
    seated(session.rulesActorPlayerId, `/searchSessions/bySession/${key}/rulesActorPlayerId`);
    seated(session.selectorPlayerId, `/searchSessions/bySession/${key}/selectorPlayerId`);
    if (session.zone.kind === 'player-zone') seated(session.zone.playerId, `/searchSessions/bySession/${key}/zone/playerId`);
    const current = idsInZone(registry, session.zone);
    const portion = session.portion.kind === 'all' ? current : current.slice(0, session.portion.count);
    if (portion.length !== session.candidateObjectIds.length || portion.some((id, index) => id !== session.candidateObjectIds[index]))
      issues.push(issue('SEARCH_SNAPSHOT_MISMATCH', `/searchSessions/bySession/${key}/candidateObjectIds`, 'Search candidates must equal the current zone snapshot'));
    session.candidateObjectIds.forEach((objectId, index) => present(objectId, `/searchSessions/bySession/${key}/candidateObjectIds/${index}`));
  }

  for (const key of visibility.grantOrder) {
    const grant = visibility.byGrant[key];
    if (grant.sourceObjectId !== null) present(grant.sourceObjectId, `/visibility/byGrant/${key}/sourceObjectId`);
    if (grant.subject.kind === 'object') present(grant.subject.objectId, `/visibility/byGrant/${key}/subject/objectId`);
    if (grant.subject.kind === 'top-of-library') seated(grant.subject.playerId, `/visibility/byGrant/${key}/subject/playerId`);
    if (grant.subject.kind === 'zone' && grant.subject.zone.kind === 'player-zone') seated(grant.subject.zone.playerId, `/visibility/byGrant/${key}/subject/zone/playerId`);
    if (grant.audience.kind === 'players') grant.audience.playerIds.forEach((playerId, index) => seated(playerId, `/visibility/byGrant/${key}/audience/playerIds/${index}`));
  }

  for (const key of playPermissions.permissionOrder) {
    const permission = playPermissions.byPermission[key];
    seated(permission.allowedPlayerId, `/playPermissions/byPermission/${key}/allowedPlayerId`);
    if (permission.sourceObjectId !== null) present(permission.sourceObjectId, `/playPermissions/byPermission/${key}/sourceObjectId`);
    if (permission.subject.kind === 'top-of-library') seated(permission.subject.playerId, `/playPermissions/byPermission/${key}/subject/playerId`);
    if (permission.subject.kind === 'object') {
      present(permission.subject.objectId, `/playPermissions/byPermission/${key}/subject/objectId`);
      if (!zoneContains(registry, permission.subject.objectId, permission.subject.expectedZone))
        issues.push(issue('PLAY_SUBJECT_MISMATCH', `/playPermissions/byPermission/${key}/subject/expectedZone`, 'Permission subject is not in its expected zone'));
    }
  }
  return issues;
}

export function validateCoreRuleAuthorityBundleV1(input: unknown): CoreRuleAuthorityBundleValidationResultV1 {
  const read = readCoreRuleExactRecordV1(input, ROOT_FIELDS);
  if (read.record === null)
    return { ok: false, issues: Object.freeze([issue('INVALID_ROOT', '', 'Rule authority bundle must be a plain object')]) };
  const issues = [...read.issues];
  const values = read.record;
  let turnPriorityBundle: CoreTurnPriorityBundleV1 | null = null;
  let control: ModeNeutralCoreControlSliceV1 | null = null;
  let decisionAuthorities: ModeNeutralCoreDecisionAuthoritySliceV1 | null = null;
  let searchSessions: ModeNeutralCoreSearchSessionSliceV1 | null = null;
  let visibility: ModeNeutralCoreVisibilitySliceV1 | null = null;
  let playPermissions: ModeNeutralCorePlayPermissionSliceV1 | null = null;

  const turnValue = safeValidatedValue(() => validateCoreTurnPriorityBundleV1(values.turnPriorityBundle));
  if (turnValue) turnPriorityBundle = turnValue;
  else issues.push(issue('INVALID_TURN_PRIORITY_BUNDLE', '/turnPriorityBundle', 'Turn priority bundle is invalid'));
  const controlValue = safeValidatedValue(() => validateModeNeutralCoreControlSliceV1(values.control));
  if (controlValue) control = controlValue;
  else issues.push(issue('INVALID_CONTROL_SLICE', '/control', 'Control slice is invalid'));
  const decisionValue = safeValidatedValue(() => validateModeNeutralCoreDecisionAuthoritySliceV1(values.decisionAuthorities));
  if (decisionValue) decisionAuthorities = decisionValue;
  else issues.push(issue('INVALID_DECISION_AUTHORITY_SLICE', '/decisionAuthorities', 'Decision authority slice is invalid'));
  const searchValue = safeValidatedValue(() => validateModeNeutralCoreSearchSessionSliceV1(values.searchSessions));
  if (searchValue) searchSessions = searchValue;
  else issues.push(issue('INVALID_SEARCH_SESSION_SLICE', '/searchSessions', 'Search session slice is invalid'));
  const visibilityValue = safeValidatedValue(() => validateModeNeutralCoreVisibilitySliceV1(values.visibility));
  if (visibilityValue) visibility = visibilityValue;
  else issues.push(issue('INVALID_VISIBILITY_SLICE', '/visibility', 'Visibility slice is invalid'));
  const playValue = safeValidatedValue(() => validateModeNeutralCorePlayPermissionSliceV1(values.playPermissions));
  if (playValue) playPermissions = playValue;
  else issues.push(issue('INVALID_PLAY_PERMISSION_SLICE', '/playPermissions', 'Play permission slice is invalid'));

  if (turnPriorityBundle && control && visibility && searchSessions && playPermissions && decisionAuthorities) {
    const registry = turnPriorityBundle.stackBundle.objectRegistry;
    issues.push(...validateCrossSlice(registry, control, visibility, searchSessions, playPermissions, decisionAuthorities));
  }
  const ordered = sortCoreRuleIssuesV1(issues);
  if (ordered.length > 0 || !turnPriorityBundle || !control || !visibility || !searchSessions || !playPermissions || !decisionAuthorities)
    return { ok: false, issues: ordered };
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      turnPriorityBundle,
      control,
      visibility,
      searchSessions,
      playPermissions,
      decisionAuthorities,
    }),
  };
}
