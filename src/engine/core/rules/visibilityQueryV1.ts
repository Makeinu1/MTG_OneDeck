import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCoreBaseId } from '../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../object/objectRegistryStateV2';
import type { ModeNeutralCoreObjectRuntimeStateV2 } from '../object/objectRegistryStateV2';
import type { ModeNeutralCoreVisibilitySliceV1, CoreVisibilityGrantV1 } from './visibilityGrantV1';
import { validateModeNeutralCoreVisibilitySliceV1 } from './visibilityGrantV1';
import { currentCoreObjectControllerV1 } from './controlEffectV1';
import type { ModeNeutralCoreControlSliceV1 } from './controlEffectV1';

export type CoreVisibilityDecisionContextV1 = Readonly<{
  readonly controlledPlayerId?: CorePlayerId;
  readonly decisionMakerPlayerId?: CorePlayerId;
  readonly rulesActorPlayerId?: CorePlayerId;
  readonly selectorPlayerId?: CorePlayerId;
  readonly candidateObjectIds?: readonly CoreObjectId[];
  readonly outsideGame?: boolean;
}>;
export type CoreVisibilityQueryBundleV1 = Readonly<{
  readonly objectRegistry?: ModeNeutralCoreObjectRegistryStateV2;
  readonly objectRuntime?: ModeNeutralCoreObjectRuntimeStateV2;
  readonly registry?: ModeNeutralCoreObjectRegistryStateV2;
  readonly runtime?: ModeNeutralCoreObjectRuntimeStateV2;
  readonly visibility: ModeNeutralCoreVisibilitySliceV1;
  readonly control?: ModeNeutralCoreControlSliceV1;
}>;

type AnyRecord = Record<string, unknown>;
function record(value: unknown): AnyRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}
function extractRegistry(value: unknown): ModeNeutralCoreObjectRegistryStateV2 | null {
  const r = record(value);
  if (!r) return null;
  if (r.objects && r.zones) return value as ModeNeutralCoreObjectRegistryStateV2;
  const direct = r.registry ?? r.objectRegistry;
  if (direct && record(direct)?.objects && record(direct)?.zones)
    return direct as ModeNeutralCoreObjectRegistryStateV2;
  const stack = record(r.stackBundle);
  const nested = stack?.objectRegistry;
  return nested && record(nested)?.objects && record(nested)?.zones
    ? (nested as ModeNeutralCoreObjectRegistryStateV2)
    : null;
}
function extractRuntime(value: unknown): ModeNeutralCoreObjectRuntimeStateV2 | null {
  const r = record(value);
  if (!r) return null;
  const direct = r.runtime ?? r.objectRuntime;
  if (direct && record(direct)?.byObject) return direct as ModeNeutralCoreObjectRuntimeStateV2;
  const stack = record(r.stackBundle);
  const nested = stack?.objectRuntime;
  return nested && record(nested)?.byObject
    ? (nested as ModeNeutralCoreObjectRuntimeStateV2)
    : null;
}
function extractVisibility(value: unknown): ModeNeutralCoreVisibilitySliceV1 | null {
  const r = record(value);
  return r?.visibility ? (r.visibility as ModeNeutralCoreVisibilitySliceV1) : null;
}
function inZone(
  registry: ModeNeutralCoreObjectRegistryStateV2,
  objectId: string,
): { zone: string; playerId?: CorePlayerId; index: number } | null {
  for (const playerId of Object.keys(registry.zones.byPlayer) as CorePlayerId[])
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      const index = registry.zones.byPlayer[playerId]?.[zone].indexOf(objectId as CoreObjectId);
      if (index >= 0) return { zone, playerId, index };
    }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    const index = registry.zones.shared[zone].indexOf(objectId as CoreObjectId);
    if (index >= 0) return { zone, index };
  }
  return null;
}
function audienceIncludes(grant: CoreVisibilityGrantV1, viewer: string): boolean {
  return (
    grant.audience.kind === 'all-players' ||
    grant.audience.playerIds.includes(viewer as CorePlayerId)
  );
}
function grantMatches(
  grant: CoreVisibilityGrantV1,
  objectId: string,
  location: { zone: string; playerId?: CorePlayerId; index: number },
): boolean {
  if (grant.subject.kind === 'object') return grant.subject.objectId === objectId;
  if (grant.subject.kind === 'zone')
    return grant.subject.zone.kind === 'shared-zone'
      ? grant.subject.zone.zone === location.zone
      : grant.subject.zone.zone === location.zone &&
          grant.subject.zone.playerId === location.playerId;
  return (
    location.zone === 'library' &&
    location.playerId === grant.subject.playerId &&
    location.index < grant.subject.count
  );
}

export function coreCanPlayerViewObjectIdentityV1(...args: unknown[]): boolean {
  let registry: ModeNeutralCoreObjectRegistryStateV2 | null;
  let runtime: ModeNeutralCoreObjectRuntimeStateV2 | null;
  let visibility: ModeNeutralCoreVisibilitySliceV1 | null;
  let control: ModeNeutralCoreControlSliceV1 | undefined;
  let viewer: string;
  let objectId: string;
  let context: CoreVisibilityDecisionContextV1 | undefined;
  if (typeof args[1] === 'string') {
    registry = extractRegistry(args[0]);
    runtime = extractRuntime(args[0]);
    visibility = extractVisibility(args[0]);
    control = record(args[0])?.control as ModeNeutralCoreControlSliceV1 | undefined;
    viewer = args[1];
    objectId = args[2] as string;
    context = args[3] as CoreVisibilityDecisionContextV1 | undefined;
  } else {
    registry = extractRegistry(args[0]);
    runtime = extractRuntime(args[0]);
    visibility = (args[1] as ModeNeutralCoreVisibilitySliceV1) ?? null;
    viewer = args[2] as string;
    objectId = args[3] as string;
    context = args[4] as CoreVisibilityDecisionContextV1 | undefined;
  }
  if (
    !registry ||
    !visibility ||
    !isCoreBaseId(viewer) ||
    typeof objectId !== 'string' ||
    context?.outsideGame
  )
    return false;
  const valid = validateModeNeutralCoreVisibilitySliceV1(visibility);
  if (!valid.ok) return false;
  visibility = valid.value;
  const location = inZone(registry, objectId);
  if (!location || !registry.objects[objectId as CoreObjectId]) return false;
  if (
    context?.candidateObjectIds?.includes(objectId as CoreObjectId) &&
    (context.rulesActorPlayerId === viewer || context.selectorPlayerId === viewer)
  )
    return true;
  const orientation = runtime?.byObject[objectId as CoreObjectId]?.orientation;
  const faceDown =
    orientation?.faceDown === true || (orientation === undefined && location.zone === 'exile');
  if (location.zone === 'hand') {
    if (location.playerId === viewer) return true;
  }
  if (location.zone === 'library') {
    /* only an explicit top/object grant can expose identity */
  }
  if (location.zone === 'battlefield' || location.zone === 'stack') {
    if (faceDown) {
      const controller = control
        ? currentCoreObjectControllerV1(registry, control, objectId as CoreObjectId)
        : ((
            registry.objects[objectId as CoreObjectId] as {
              baseControllerPlayerId?: CorePlayerId;
              controllerPlayerId?: CorePlayerId;
            }
          ).baseControllerPlayerId ??
          (registry.objects[objectId as CoreObjectId] as { controllerPlayerId?: CorePlayerId })
            .controllerPlayerId ??
          null);
      if (controller === viewer) return true;
    } else return true;
  } else if (location.zone === 'exile' && !faceDown) return true;
  else if (location.zone === 'graveyard' || location.zone === 'command') return true;
  for (const key of visibility.grantOrder) {
    const grant = visibility.byGrant[key];
    if (audienceIncludes(grant, viewer) && grantMatches(grant, objectId, location)) return true;
  }
  if (
    context?.controlledPlayerId === viewer &&
    context.decisionMakerPlayerId &&
    context.decisionMakerPlayerId !== viewer
  )
    return false;
  return false;
}
