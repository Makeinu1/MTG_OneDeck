import type { CoreObjectId, CorePlayerId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import {
  createModeNeutralCoreControlSliceV1,
  expireCoreControlEffectsAtTurnBoundaryV1,
  currentCoreObjectControllerV1,
  type ModeNeutralCoreControlSliceV1,
} from './controlEffectV1';
import {
  activateCorePendingDecisionAuthoritiesAtTurnStartV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
  expireCoreDecisionAuthoritiesAfterTurnV1,
} from './decisionAuthorityV1';
import { createModeNeutralCoreVisibilitySliceV1 } from './visibilityGrantV1';
import { createModeNeutralCorePlayPermissionSliceV1 } from './playPermissionV1';
import {
  createCoreRuleAuthorityBundleV1,
  type CoreRuleAuthorityBundleV1,
} from './ruleAuthorityBundleV1';
import { validateCoreRuleAuthorityBundleV1 } from './ruleAuthorityBundleValidationV1';
import { CoreRuleAuthorityOperationError } from './ruleAuthorityErrorV1';
import { deepFreezeCoreRuleValueV1 } from './ruleValidationSharedV1';

export type CoreRuleAuthorityLifecycleResultV1 = Readonly<{
  readonly value: CoreRuleAuthorityBundleV1;
  readonly controllerChangedObjectIds: readonly CoreObjectId[];
}>;

function checkedBundle(input: unknown): CoreRuleAuthorityBundleV1 {
  const result = validateCoreRuleAuthorityBundleV1(input);
  if (!result.ok)
    throw new CoreRuleAuthorityOperationError({
      code: 'INVALID_RULE_AUTHORITY_BUNDLE',
      path: '',
      message: 'Invalid rule authority bundle',
    });
  if (Object.isFrozen(input)) return input as CoreRuleAuthorityBundleV1;
  return result.value;
}

function boundaryTurn(bundle: CoreRuleAuthorityBundleV1, turnNumber: number): void {
  if (
    !Number.isSafeInteger(turnNumber) ||
    turnNumber < 1 ||
    bundle.turnPriorityBundle.lifecycle.turnNumber !== turnNumber
  )
    throw new CoreRuleAuthorityOperationError({
      code: 'TURN_BOUNDARY_MISMATCH',
      path: '/turnNumber',
      message: 'Turn number must equal the canonical turn lifecycle number',
    });
}

function result(
  bundle: CoreRuleAuthorityBundleV1,
  controllerChangedObjectIds: readonly CoreObjectId[],
): CoreRuleAuthorityLifecycleResultV1 {
  return Object.freeze({
    value: deepFreezeCoreRuleValueV1(bundle),
    controllerChangedObjectIds: Object.freeze([...controllerChangedObjectIds]),
  });
}

function filterControl(
  slice: ModeNeutralCoreControlSliceV1,
  registry: ModeNeutralCoreObjectRegistryStateV2,
): ModeNeutralCoreControlSliceV1 {
  const order = slice.effectOrder.filter((key) => {
    const duration = slice.byEffect[key].duration;
    if (
      duration.kind === 'while-source-exists' ||
      duration.kind === 'while-source-attached-to-target'
    )
      return Object.prototype.hasOwnProperty.call(registry.objects, duration.sourceObjectId);
    return true;
  });
  return order.length === slice.effectOrder.length
    ? slice
    : (() => {
        const byEffect: Record<string, ModeNeutralCoreControlSliceV1['byEffect'][string]> =
          Object.create(null) as Record<string, ModeNeutralCoreControlSliceV1['byEffect'][string]>;
        for (const key of order) byEffect[key] = slice.byEffect[key];
        return {
          kind: slice.kind,
          effectOrder: order,
          byEffect,
          continuityByObject: slice.continuityByObject,
        };
      })();
}

function reconcileControlWithRegistry(
  slice: ModeNeutralCoreControlSliceV1,
  registry: ModeNeutralCoreObjectRegistryStateV2,
): ModeNeutralCoreControlSliceV1 {
  const continuityByObject = Object.fromEntries(
    Object.entries(slice.continuityByObject).map(([objectId, row]) => {
      const controller =
        currentCoreObjectControllerV1(registry, slice, objectId as CoreObjectId) ??
        row.controllerPlayerId;
      return [
        objectId,
        {
          controllerPlayerId: controller,
          continuousSinceMostRecentTurnBegan:
            controller === row.controllerPlayerId ? row.continuousSinceMostRecentTurnBegan : false,
        },
      ];
    }),
  );
  return createModeNeutralCoreControlSliceV1({
    effectOrder: slice.effectOrder,
    byEffect: slice.byEffect,
    continuityByObject,
  });
}

function changedControllerIds(
  before: ModeNeutralCoreControlSliceV1,
  after: ModeNeutralCoreControlSliceV1,
): readonly CoreObjectId[] {
  return Object.keys(after.continuityByObject).filter(
    (objectId) =>
      before.continuityByObject[objectId as CoreObjectId]?.controllerPlayerId !==
      after.continuityByObject[objectId as CoreObjectId]?.controllerPlayerId,
  ) as CoreObjectId[];
}

export function expireCoreRuleAuthorityAtTurnBoundaryV1(
  input: CoreRuleAuthorityBundleV1,
  turnNumber: number,
): CoreRuleAuthorityLifecycleResultV1 {
  const bundle = checkedBundle(input);
  boundaryTurn(bundle, turnNumber);
  const control = expireCoreControlEffectsAtTurnBoundaryV1(bundle.control, turnNumber);
  const registry = bundle.turnPriorityBundle.stackBundle.objectRegistry;
  const reconciledControl = reconcileControlWithRegistry(control.value, registry);
  const visibility = createModeNeutralCoreVisibilitySliceV1({
    grantOrder: bundle.visibility.grantOrder.filter((key) => {
      const duration = bundle.visibility.byGrant[key].duration;
      return duration.kind !== 'until-end-of-turn' || duration.turnNumber > turnNumber;
    }),
    byGrant: Object.fromEntries(
      bundle.visibility.grantOrder
        .filter((key) => {
          const duration = bundle.visibility.byGrant[key].duration;
          return duration.kind !== 'until-end-of-turn' || duration.turnNumber > turnNumber;
        })
        .map((key) => [key, bundle.visibility.byGrant[key]]),
    ),
  });
  const playOrder = bundle.playPermissions.permissionOrder.filter((key) => {
    const duration = bundle.playPermissions.byPermission[key].duration;
    return duration.kind !== 'until-end-of-turn' || duration.turnNumber > turnNumber;
  });
  const playPermissions = createModeNeutralCorePlayPermissionSliceV1({
    permissionOrder: playOrder,
    byPermission: Object.fromEntries(
      playOrder.map((key) => [key, bundle.playPermissions.byPermission[key]]),
    ),
  });
  const decisionAuthorities = expireCoreDecisionAuthoritiesAfterTurnV1(
    bundle.decisionAuthorities,
    turnNumber,
  ).value;
  const next = createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: bundle.turnPriorityBundle,
    control: reconciledControl,
    visibility,
    searchSessions: bundle.searchSessions,
    playPermissions,
    decisionAuthorities,
  });
  return result(next, changedControllerIds(bundle.control, reconciledControl));
}

export function pruneCoreRuleAuthorityForMissingSourcesV1(
  input: CoreRuleAuthorityBundleV1,
  registry: ModeNeutralCoreObjectRegistryStateV2,
): CoreRuleAuthorityLifecycleResultV1 {
  const bundle = checkedBundle(input);
  const control = reconcileControlWithRegistry(filterControl(bundle.control, registry), registry);
  const controlCanonical = createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: bundle.turnPriorityBundle,
    control,
    visibility: bundle.visibility,
    searchSessions: bundle.searchSessions,
    playPermissions: bundle.playPermissions,
    decisionAuthorities: bundle.decisionAuthorities,
  });
  const visibilityOrder = bundle.visibility.grantOrder.filter((key) => {
    const source = bundle.visibility.byGrant[key].duration;
    return (
      source.kind !== 'while-source-exists' ||
      Object.prototype.hasOwnProperty.call(registry.objects, source.sourceObjectId)
    );
  });
  const visibility = createModeNeutralCoreVisibilitySliceV1({
    grantOrder: visibilityOrder,
    byGrant: Object.fromEntries(
      visibilityOrder.map((key) => [key, bundle.visibility.byGrant[key]]),
    ),
  });
  const playOrder = bundle.playPermissions.permissionOrder.filter((key) => {
    const source = bundle.playPermissions.byPermission[key].duration;
    return (
      source.kind !== 'while-source-exists' ||
      Object.prototype.hasOwnProperty.call(registry.objects, source.sourceObjectId)
    );
  });
  const playPermissions = createModeNeutralCorePlayPermissionSliceV1({
    permissionOrder: playOrder,
    byPermission: Object.fromEntries(
      playOrder.map((key) => [key, bundle.playPermissions.byPermission[key]]),
    ),
  });
  const decisionAuthorityOrder = bundle.decisionAuthorities.authorityOrder.filter((key) => {
    const sourceObjectId = bundle.decisionAuthorities.byAuthority[key].sourceObjectId;
    return (
      sourceObjectId === null ||
      Object.prototype.hasOwnProperty.call(registry.objects, sourceObjectId)
    );
  });
  const decisionAuthorities = createModeNeutralCoreDecisionAuthoritySliceV1({
    authorityOrder: decisionAuthorityOrder,
    byAuthority: Object.fromEntries(
      decisionAuthorityOrder.map((key) => [key, bundle.decisionAuthorities.byAuthority[key]]),
    ),
  });
  const next = createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: controlCanonical.turnPriorityBundle,
    control: controlCanonical.control,
    visibility,
    searchSessions: controlCanonical.searchSessions,
    playPermissions,
    decisionAuthorities,
  });
  return result(next, changedControllerIds(bundle.control, control));
}

export function activateCoreRuleAuthorityAtTurnStartV1(
  input: CoreRuleAuthorityBundleV1,
  playerId: CorePlayerId,
  turnNumber: number,
): CoreRuleAuthorityLifecycleResultV1 {
  const bundle = checkedBundle(input);
  boundaryTurn(bundle, turnNumber);
  const control = bundle.control;
  const marked = Object.fromEntries(
    Object.entries(control.continuityByObject).map(([objectId, row]) => [
      objectId,
      {
        ...row,
        continuousSinceMostRecentTurnBegan:
          row.controllerPlayerId === playerId || row.continuousSinceMostRecentTurnBegan,
      },
    ]),
  );
  const markedControl = {
    ...control,
    continuityByObject: marked,
  } as ModeNeutralCoreControlSliceV1;
  const decisionAuthorities = activateCorePendingDecisionAuthoritiesAtTurnStartV1(
    bundle.decisionAuthorities,
    playerId,
    turnNumber,
  ).value;
  const next = createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: bundle.turnPriorityBundle,
    control: markedControl,
    visibility: bundle.visibility,
    searchSessions: bundle.searchSessions,
    playPermissions: bundle.playPermissions,
    decisionAuthorities,
  });
  return result(next, []);
}
