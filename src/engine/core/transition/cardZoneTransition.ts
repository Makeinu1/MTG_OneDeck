import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  createModeNeutralCoreIdentityZoneSliceV1,
} from '../identityZoneState';
import type {
  CoreCardObjectIdentityV1,
  CoreObjectLocationV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from '../identityZoneState';
import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../identityZoneValidation';
import {
  createDefaultCoreCardRuntimeAfterZoneChangeV1,
  nextCoreCardIncarnationV1,
  nextCoreCardObjectIdV1,
} from './cardReincarnation';
import type {
  ModeNeutralCoreCardRuntimeSliceV1,
} from '../runtime/cardRuntimeState';
import {
  createModeNeutralCoreCardRuntimeSliceV1,
} from '../runtime/cardRuntimeState';
import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../runtime/cardRuntimeValidation';
import {
  validateCoreCardZoneDestinationV1,
} from './zoneDestination';
import type { CoreCardZoneDestinationV1 } from './zoneDestination';
import { isCanonicalCoreObjectIdV1 } from '../runtime/attachment';

export interface CoreCardZoneTransitionInputV1 {
  readonly objectId: CoreObjectId;
  readonly destination: CoreCardZoneDestinationV1;
}

export interface CoreCardZoneTransitionResultV1 {
  readonly identityZoneState: ModeNeutralCoreIdentityZoneSliceV1;
  readonly cardRuntimeState: ModeNeutralCoreCardRuntimeSliceV1;
}

export type CoreCardZoneTransitionErrorCodeV1 =
  | 'INVALID_TRANSITION_INPUT'
  | 'INVALID_DESTINATION'
  | 'INVALID_IDENTITY_STATE'
  | 'INVALID_RUNTIME_STATE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_DUPLICATED'
  | 'SAME_ZONE_TRANSITION'
  | 'INVALID_LIBRARY_INDEX'
  | 'TRANSITION_CANDIDATE_INVALID';

export class CoreCardZoneTransitionErrorV1 extends Error {
  readonly code: CoreCardZoneTransitionErrorCodeV1;
  readonly issues: readonly unknown[];

  constructor(
    code: CoreCardZoneTransitionErrorCodeV1,
    message: string,
    issues: readonly unknown[] = [],
  ) {
    super(message);
    this.name = 'CoreCardZoneTransitionErrorV1';
    this.code = code;
    this.issues = Object.freeze(issues.slice());
  }
}

type TransitionRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is TransitionRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataValue(record: TransitionRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    return undefined;
  }
  return descriptor.value;
}

function readTransitionInput(value: unknown): CoreCardZoneTransitionInputV1 {
  if (!isPlainRecord(value)) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_TRANSITION_INPUT', 'Transition input must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || (key !== 'objectId' && key !== 'destination'))) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_TRANSITION_INPUT', 'Transition input contains an unknown field');
  }
  const objectId = ownDataValue(value, 'objectId');
  const destination = ownDataValue(value, 'destination');
  if (!isCanonicalCoreObjectIdV1(objectId)) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_TRANSITION_INPUT', 'Transition input objectId is invalid');
  }
  if (destination === undefined) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_TRANSITION_INPUT', 'Transition input destination is missing');
  }
  return { objectId, destination: destination as CoreCardZoneDestinationV1 };
}

function recordOf<T>(entries: readonly (readonly [string, T])[]): Record<string, T> {
  const result: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const [key, value] of entries) result[key] = value;
  return result;
}

function allZoneLocations(
  state: ModeNeutralCoreIdentityZoneSliceV1,
  objectId: CoreObjectId,
): readonly CoreObjectLocationV1[] {
  const locations: CoreObjectLocationV1[] = [];
  for (const playerId of state.turnOrder) {
    const zones = state.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      zones[zone].forEach((candidate, index) => {
        if (candidate === objectId) locations.push({ scope: 'player-scoped', playerId, zone, index });
      });
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    state.zones.shared[zone].forEach((candidate, index) => {
      if (candidate === objectId) locations.push({ scope: 'shared', zone, index });
    });
  }
  return locations;
}

function destinationLocation(
  state: ModeNeutralCoreIdentityZoneSliceV1,
  card: CoreCardObjectIdentityV1,
  destination: CoreCardZoneDestinationV1,
): { readonly scope: 'player-scoped'; readonly playerId: CorePlayerId; readonly zone: 'library' | 'hand' | 'graveyard' }
  | { readonly scope: 'shared'; readonly zone: 'battlefield' | 'stack' | 'exile' | 'command' } {
  const ownerPlayerId = state.physicalCards[card.physicalCardId].ownerPlayerId;
  if (destination.kind === 'owner-library') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'library' };
  if (destination.kind === 'owner-hand') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'hand' };
  if (destination.kind === 'owner-graveyard') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'graveyard' };
  return { scope: 'shared', zone: destination.kind };
}

function sameLocation(left: CoreObjectLocationV1, right: ReturnType<typeof destinationLocation>): boolean {
  return left.scope === right.scope
    && left.zone === right.zone
    && (left.scope === 'shared' || right.scope === 'shared' || left.playerId === right.playerId);
}

function replaceSource(
  state: ModeNeutralCoreIdentityZoneSliceV1,
  source: CoreObjectLocationV1,
): ModeNeutralCoreIdentityZoneSliceV1['zones'] {
  const byPlayerEntries: [CorePlayerId, ModeNeutralCoreIdentityZoneStateV1['byPlayer'][CorePlayerId]][] = [];
  for (const playerId of state.turnOrder) {
    const current = state.zones.byPlayer[playerId];
    const zones: { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] } = {
      library: [...current.library],
      hand: [...current.hand],
      graveyard: [...current.graveyard],
    };
    if (source.scope === 'player-scoped' && source.playerId === playerId) {
      zones[source.zone].splice(source.index, 1);
    }
    byPlayerEntries.push([playerId, zones]);
  }
  const shared: { battlefield: CoreObjectId[]; stack: CoreObjectId[]; exile: CoreObjectId[]; command: CoreObjectId[] } = {
    battlefield: [...state.zones.shared.battlefield],
    stack: [...state.zones.shared.stack],
    exile: [...state.zones.shared.exile],
    command: [...state.zones.shared.command],
  };
  if (source.scope === 'shared') shared[source.zone].splice(source.index, 1);
  return { byPlayer: recordOf(byPlayerEntries), shared };
}

function insertDestination(
  zones: ModeNeutralCoreIdentityZoneSliceV1['zones'],
  destinationLocationValue: ReturnType<typeof destinationLocation>,
  destination: CoreCardZoneDestinationV1,
  objectId: CoreObjectId,
): ModeNeutralCoreIdentityZoneStateV1 {
  const byPlayer: Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }> = recordOf(Object.entries(zones.byPlayer).map(([playerId, value]) => [playerId, {
    library: [...value.library], hand: [...value.hand], graveyard: [...value.graveyard],
  }] as const));
  const shared: { battlefield: CoreObjectId[]; stack: CoreObjectId[]; exile: CoreObjectId[]; command: CoreObjectId[] } = {
    battlefield: [...zones.shared.battlefield], stack: [...zones.shared.stack],
    exile: [...zones.shared.exile], command: [...zones.shared.command],
  };
  if (destinationLocationValue.scope === 'player-scoped') {
    const target = byPlayer[destinationLocationValue.playerId];
    const zone = target[destinationLocationValue.zone];
    if (destination.kind === 'owner-library') {
      const index = destination.placement.kind === 'top'
        ? 0
        : destination.placement.kind === 'bottom' ? zone.length : destination.placement.index;
      if (index > zone.length) {
        throw new CoreCardZoneTransitionErrorV1('INVALID_LIBRARY_INDEX', 'Library placement index exceeds the pre-insertion length');
      }
      zone.splice(index, 0, objectId);
    } else zone.push(objectId);
  } else shared[destinationLocationValue.zone].push(objectId);
  return { byPlayer, shared };
}

type ModeNeutralCoreIdentityZoneStateV1 = ModeNeutralCoreIdentityZoneSliceV1['zones'];

export function applyCoreCardZoneTransitionV1(
  identityZoneState: unknown,
  cardRuntimeState: unknown,
  transitionInput: unknown,
): CoreCardZoneTransitionResultV1 {
  const input = readTransitionInput(transitionInput);
  const identityValidation = validateModeNeutralCoreIdentityZoneSliceV1(identityZoneState);
  if (!identityValidation.ok) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_IDENTITY_STATE', 'Identity/zone state is invalid', identityValidation.issues);
  }
  const identity = identityValidation.value;
  const destinationValidation = validateCoreCardZoneDestinationV1(input.destination);
  if (!destinationValidation.ok) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_DESTINATION', 'Zone destination is invalid', destinationValidation.issues);
  }
  const destination = destinationValidation.value;
  const runtimeValidation = validateModeNeutralCoreCardRuntimeSliceV1(identity, cardRuntimeState);
  if (!runtimeValidation.ok) {
    throw new CoreCardZoneTransitionErrorV1('INVALID_RUNTIME_STATE', 'Card runtime state is invalid', runtimeValidation.issues);
  }
  const runtime = runtimeValidation.value;
  const locations = allZoneLocations(identity, input.objectId);
  if (locations.length === 0 || identity.cardObjects[input.objectId] === undefined) {
    throw new CoreCardZoneTransitionErrorV1('SOURCE_NOT_FOUND', 'Source object is not present exactly once');
  }
  if (locations.length !== 1) {
    throw new CoreCardZoneTransitionErrorV1('SOURCE_DUPLICATED', 'Source object is present more than once');
  }
  const source = locations[0];
  const card = identity.cardObjects[input.objectId];
  const target = destinationLocation(identity, card, destination);
  if (sameLocation(source, target)) {
    throw new CoreCardZoneTransitionErrorV1('SAME_ZONE_TRANSITION', 'Same-zone reorder is outside this transition');
  }

  const nextIncarnation = nextCoreCardIncarnationV1(card.incarnation);
  const nextObjectId = nextCoreCardObjectIdV1(card.physicalCardId, card.incarnation);
  const baseControllerPlayerId = destination.kind === 'battlefield' || destination.kind === 'stack'
    ? destination.baseControllerPlayerId
    : null;
  const nextCard: CoreCardObjectIdentityV1 = {
    kind: 'card', physicalCardId: card.physicalCardId,
    incarnation: nextIncarnation, baseControllerPlayerId,
  };
  const withoutSource = replaceSource(identity, source);
  const nextZones = insertDestination(withoutSource, target, destination, nextObjectId);
  const cardObjects = recordOf(Object.entries(identity.cardObjects)
    .filter(([objectId]) => objectId !== input.objectId)
    .concat([[nextObjectId, nextCard]]));
  const candidateIdentityInput = {
    players: identity.players, turnOrder: identity.turnOrder, activePlayerId: identity.activePlayerId,
    cardDefinitions: identity.cardDefinitions, physicalCards: identity.physicalCards,
    cardObjects, zones: nextZones,
  };
  let nextIdentity: ModeNeutralCoreIdentityZoneSliceV1;
  try {
    nextIdentity = createModeNeutralCoreIdentityZoneSliceV1(candidateIdentityInput);
  } catch (error: unknown) {
    throw new CoreCardZoneTransitionErrorV1('TRANSITION_CANDIDATE_INVALID', 'Transition identity candidate is invalid', [error]);
  }

  const runtimeEntries = Object.entries(runtime.byObject)
    .filter(([objectId]) => objectId !== input.objectId)
    .concat([[nextObjectId, createDefaultCoreCardRuntimeAfterZoneChangeV1()]]);
  const candidateRuntimeInput = { byObject: recordOf(runtimeEntries) };
  let nextRuntime: ModeNeutralCoreCardRuntimeSliceV1;
  try {
    nextRuntime = createModeNeutralCoreCardRuntimeSliceV1(nextIdentity, candidateRuntimeInput);
  } catch (error: unknown) {
    throw new CoreCardZoneTransitionErrorV1('TRANSITION_CANDIDATE_INVALID', 'Transition runtime candidate is invalid', [error]);
  }
  return Object.freeze({ identityZoneState: nextIdentity, cardRuntimeState: nextRuntime });
}
