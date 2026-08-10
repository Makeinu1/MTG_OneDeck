import type { CoreObjectId } from '../ids';
import type {
  CoreStackCostChoiceSetV1,
  CoreStackVariableAnnouncementV1,
} from './choiceAnnouncementV1';
import type { CoreStackTargetSelectionV1 } from './targetAnnouncementV1';
import type {
  CoreStackAnnouncementRecordV1,
  CoreStackDistributionAnnouncementV1,
} from './stackAnnouncementRecordV1';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from './stackAnnouncementSliceV1';

type CanonicalEntries = readonly (readonly [CoreObjectId, CoreStackAnnouncementRecordV1])[];

function freezeDeep<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) freezeDeep(descriptor.value, seen);
  }
  Object.freeze(value);
  return value;
}

function cloneTarget(value: CoreStackTargetSelectionV1): CoreStackTargetSelectionV1 {
  const target = value.target.kind === 'object'
    ? { kind: 'object' as const, objectId: value.target.objectId }
    : { kind: 'player' as const, playerId: value.target.playerId };
  return { selectionId: value.selectionId, groupKey: value.groupKey, target };
}

function cloneVariables(value: readonly CoreStackVariableAnnouncementV1[]): readonly CoreStackVariableAnnouncementV1[] {
  return value.map((entry) => ({ variableKey: entry.variableKey, value: entry.value }));
}

function cloneDistribution(value: CoreStackDistributionAnnouncementV1): CoreStackDistributionAnnouncementV1 {
  return {
    distributionKey: value.distributionKey,
    assignments: value.assignments.map((assignment) => ({
      targetSelectionId: assignment.targetSelectionId,
      amount: assignment.amount,
    })),
  };
}

function cloneCosts(value: CoreStackCostChoiceSetV1): CoreStackCostChoiceSetV1 {
  return {
    alternativeCost: value.alternativeCost === null ? null : { costKey: value.alternativeCost.costKey },
    additionalCosts: value.additionalCosts.map((cost) => ({ costKey: cost.costKey, times: cost.times })),
  };
}

function cloneRecord(value: CoreStackAnnouncementRecordV1): CoreStackAnnouncementRecordV1 {
  const common = {
    chosenModeKeys: value.chosenModeKeys.slice(),
    targetSelections: value.targetSelections.map(cloneTarget),
    announcedVariables: cloneVariables(value.announcedVariables),
    distributions: value.distributions.map(cloneDistribution),
    costChoices: cloneCosts(value.costChoices),
  };
  if (value.kind === 'card-spell' || value.kind === 'spell-copy') {
    return { kind: value.kind, abilityTextSnapshot: null, ...common };
  }
  return { kind: value.kind, abilityTextSnapshot: value.abilityTextSnapshot, ...common };
}

export function canonicalizeModeNeutralCoreStackAnnouncementEntriesV1(
  entries: CanonicalEntries,
): ModeNeutralCoreStackAnnouncementSliceV1 {
  const byObject = Object.create(null) as Record<CoreObjectId, CoreStackAnnouncementRecordV1>;
  for (const [objectId, record] of entries) byObject[objectId] = cloneRecord(record);
  return freezeDeep({
    kind: 'mode-neutral-core-stack-announcement-slice-v1',
    byObject,
  });
}

export function canonicalizeModeNeutralCoreStackAnnouncementSliceV1(
  value: ModeNeutralCoreStackAnnouncementSliceV1,
): ModeNeutralCoreStackAnnouncementSliceV1 {
  const entries: Array<readonly [CoreObjectId, CoreStackAnnouncementRecordV1]> = [];
  for (const objectIdText of Object.keys(value.byObject)) {
    const objectId = objectIdText as CoreObjectId;
    entries.push([objectId, value.byObject[objectId]]);
  }
  return canonicalizeModeNeutralCoreStackAnnouncementEntriesV1(entries);
}
