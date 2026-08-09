import type {
  CoreCardDefinitionRecordV1,
  CoreCardDefinitionSnapshotV1,
  CorePhysicalCardRecordV1,
  CorePhysicalCardV1,
} from './cardDefinition';
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePlayerId,
  CorePhysicalCardId,
} from './ids';
import {
  CoreIdentityZoneCreationError,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from './identityZoneValidation';
import type { CoreIdentityZoneValidationIssue } from './identityZoneValidation';

export interface CoreManaPoolV1 {
  readonly W: number;
  readonly U: number;
  readonly B: number;
  readonly R: number;
  readonly G: number;
  readonly C: number;
}

export interface CorePlayerStateV1 {
  readonly life: number;
  readonly poison: number;
  readonly energy: number;
  readonly experience: number;
  readonly manaPool: CoreManaPoolV1;
  readonly mulliganCount: number;
  readonly landsPlayedThisTurn: number;
  readonly spellsCastThisTurn: number;
  readonly drawnThisTurn: number;
  readonly maximumHandSizeOverride: number | 'none' | null;
}

export interface CoreCardObjectIdentityV1 {
  readonly kind: 'card';
  readonly physicalCardId: CorePhysicalCardId;
  readonly incarnation: number;
  readonly baseControllerPlayerId: CorePlayerId | null;
}

export type CorePlayerScopedZoneIdV1 = 'library' | 'hand' | 'graveyard';
export type CoreSharedZoneIdV1 = 'battlefield' | 'stack' | 'exile' | 'command';
export type CoreZoneIdV1 = CorePlayerScopedZoneIdV1 | CoreSharedZoneIdV1;

export interface CorePlayerZonesV1 {
  readonly library: readonly CoreObjectId[];
  readonly hand: readonly CoreObjectId[];
  readonly graveyard: readonly CoreObjectId[];
}

export interface CoreSharedZonesV1 {
  readonly battlefield: readonly CoreObjectId[];
  readonly stack: readonly CoreObjectId[];
  readonly exile: readonly CoreObjectId[];
  readonly command: readonly CoreObjectId[];
}

export interface CoreZonesV1 {
  readonly byPlayer: Readonly<Record<CorePlayerId, CorePlayerZonesV1>>;
  readonly shared: CoreSharedZonesV1;
}

export type CoreZoneScopeV1 = 'player-scoped' | 'shared';
export type CoreZoneInformationClassV1 = 'hidden-zone' | 'public-zone';

export interface ModeNeutralCoreIdentityZoneSliceV1 {
  readonly kind: 'mode-neutral-core-identity-zone-slice-v1';
  readonly players: Readonly<Record<CorePlayerId, CorePlayerStateV1>>;
  readonly turnOrder: readonly CorePlayerId[];
  readonly activePlayerId: CorePlayerId;
  readonly cardDefinitions: CoreCardDefinitionRecordV1;
  readonly physicalCards: CorePhysicalCardRecordV1;
  readonly cardObjects: Readonly<Record<CoreObjectId, CoreCardObjectIdentityV1>>;
  readonly zones: CoreZonesV1;
}

export interface CreateModeNeutralCoreIdentityZoneSliceV1Input {
  readonly players: Readonly<Record<CorePlayerId, CorePlayerStateV1>>;
  readonly turnOrder: readonly CorePlayerId[];
  readonly activePlayerId: CorePlayerId;
  readonly cardDefinitions: CoreCardDefinitionRecordV1;
  readonly physicalCards: CorePhysicalCardRecordV1;
  readonly cardObjects: Readonly<Record<CoreObjectId, CoreCardObjectIdentityV1>>;
  readonly zones: CoreZonesV1;
}

export interface CorePlayerScopedLocationV1 {
  readonly scope: 'player-scoped';
  readonly playerId: CorePlayerId;
  readonly zone: CorePlayerScopedZoneIdV1;
  readonly index: number;
}

export interface CoreSharedLocationV1 {
  readonly scope: 'shared';
  readonly zone: CoreSharedZoneIdV1;
  readonly index: number;
}

export type CoreObjectLocationV1 = CorePlayerScopedLocationV1 | CoreSharedLocationV1;

const PLAYER_SCOPED_ZONES: readonly CorePlayerScopedZoneIdV1[] = [
  'library',
  'hand',
  'graveyard',
];
const SHARED_ZONES: readonly CoreSharedZoneIdV1[] = [
  'battlefield',
  'stack',
  'exile',
  'command',
];

export function coreZoneScopeOf(zoneId: CoreZoneIdV1): CoreZoneScopeV1 {
  return PLAYER_SCOPED_ZONES.includes(zoneId as CorePlayerScopedZoneIdV1)
    ? 'player-scoped'
    : 'shared';
}

export function coreZoneInformationClassOf(
  zoneId: CoreZoneIdV1,
): CoreZoneInformationClassV1 {
  return zoneId === 'library' || zoneId === 'hand' ? 'hidden-zone' : 'public-zone';
}

export function locateCoreObjectV1(
  state: ModeNeutralCoreIdentityZoneSliceV1,
  objectId: CoreObjectId,
): CoreObjectLocationV1 | null {
  for (const playerId of state.turnOrder) {
    const zones = state.zones.byPlayer[playerId];
    for (const zone of PLAYER_SCOPED_ZONES) {
      const index = zones[zone].indexOf(objectId);
      if (index >= 0) return { scope: 'player-scoped', playerId, zone, index };
    }
  }
  for (const zone of SHARED_ZONES) {
    const index = state.zones.shared[zone].indexOf(objectId);
    if (index >= 0) return { scope: 'shared', zone, index };
  }
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function factoryInputKindIssue(): CoreIdentityZoneValidationIssue {
  return {
    code: 'UNKNOWN_FIELD',
    path: '/kind',
    message: 'Factory input must omit kind',
  };
}

function candidateFromInput(input: unknown): unknown {
  if (!isPlainRecord(input)) return input;
  const candidate: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
  }
  Object.defineProperty(candidate, 'kind', {
    value: 'mode-neutral-core-identity-zone-slice-v1',
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return candidate;
}

export function createModeNeutralCoreIdentityZoneSliceV1(
  input: CreateModeNeutralCoreIdentityZoneSliceV1Input,
): ModeNeutralCoreIdentityZoneSliceV1 {
  if (isPlainRecord(input) && Object.prototype.hasOwnProperty.call(input, 'kind')) {
    throw new CoreIdentityZoneCreationError([factoryInputKindIssue()]);
  }
  const validation = validateModeNeutralCoreIdentityZoneSliceV1(candidateFromInput(input));
  if (!validation.ok) {
    throw new CoreIdentityZoneCreationError(validation.issues);
  }
  return validation.value;
}

export type {
  CoreCardDefinitionId,
  CoreCardDefinitionSnapshotV1,
  CorePhysicalCardId,
  CorePhysicalCardV1,
};
