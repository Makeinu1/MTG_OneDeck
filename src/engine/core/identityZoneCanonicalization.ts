import type {
  CoreCardDefinitionSnapshotV1,
  CoreCardFaceSnapshotV1,
  CoreCardDefinitionSourceV1,
  CorePhysicalCardV1,
} from './cardDefinition';
import type {
  CoreCardObjectIdentityV1,
  CoreManaPoolV1,
  CorePlayerStateV1,
  CorePlayerZonesV1,
  CoreSharedZonesV1,
  CoreZonesV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from './identityZoneState';

const ROOT_FIELDS = [
  'kind',
  'players',
  'turnOrder',
  'activePlayerId',
  'cardDefinitions',
  'physicalCards',
  'cardObjects',
  'zones',
] as const;
const ZONES_FIELDS = ['byPlayer', 'shared'] as const;
const PLAYER_FIELDS = [
  'life',
  'poison',
  'energy',
  'experience',
  'manaPool',
  'mulliganCount',
  'landsPlayedThisTurn',
  'spellsCastThisTurn',
  'drawnThisTurn',
  'maximumHandSizeOverride',
] as const;
const MANA_FIELDS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
const DEFINITION_FIELDS = [
  'source',
  'name',
  'layout',
  'manaValue',
  'colorIdentity',
  'typeLine',
  'keywords',
  'producedMana',
  'tokenKind',
  'faces',
] as const;
const SCRYFALL_SOURCE_FIELDS = ['kind', 'scryfallId', 'oracleId'] as const;
const ENGINE_SYNTHETIC_SOURCE_FIELDS = ['kind'] as const;
const FACE_FIELDS = [
  'name',
  'manaCost',
  'typeLine',
  'oracleText',
  'power',
  'toughness',
  'loyalty',
  'defense',
] as const;
const PHYSICAL_FIELDS = ['definitionId', 'ownerPlayerId', 'isCommander'] as const;
const OBJECT_FIELDS = ['kind', 'physicalCardId', 'incarnation', 'baseControllerPlayerId'] as const;
const PLAYER_ZONES_FIELDS = ['library', 'hand', 'graveyard'] as const;
const SHARED_ZONES_FIELDS = ['battlefield', 'stack', 'exile', 'command'] as const;

type CanonicalRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedKeys(record: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(record).sort(codeUnitCompare);
}

function dataValue(record: Readonly<Record<string, unknown>>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    throw new TypeError(`Canonicalization requires a data property: ${key}`);
  }
  return descriptor.value;
}

function canonicalRecord<T>(
  keys: readonly string[],
  valueForKey: (key: string) => unknown,
): T {
  const target: CanonicalRecord = Object.create(null) as CanonicalRecord;
  for (const key of keys) {
    Object.defineProperty(target, key, {
      value: valueForKey(key),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return new Proxy(target, {
    ownKeys: () => keys.slice(),
  }) as T;
}

function copyArray<T>(value: readonly T[]): readonly T[] {
  return value.slice();
}

function canonicalizeManaPool(value: CoreManaPoolV1): CoreManaPoolV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CoreManaPoolV1>(MANA_FIELDS, (key) => dataValue(record, key));
}

function canonicalizePlayerState(value: CorePlayerStateV1): CorePlayerStateV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CorePlayerStateV1>(PLAYER_FIELDS, (key) =>
    key === 'manaPool'
      ? canonicalizeManaPool(dataValue(record, key) as CoreManaPoolV1)
      : dataValue(record, key));
}

function canonicalizePlayerZones(value: CorePlayerZonesV1): CorePlayerZonesV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CorePlayerZonesV1>(PLAYER_ZONES_FIELDS, (key) =>
    copyArray(dataValue(record, key) as readonly string[]));
}

function canonicalizeSharedZones(value: CoreSharedZonesV1): CoreSharedZonesV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CoreSharedZonesV1>(SHARED_ZONES_FIELDS, (key) =>
    copyArray(dataValue(record, key) as readonly string[]));
}

function canonicalizeFace(value: CoreCardFaceSnapshotV1): CoreCardFaceSnapshotV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CoreCardFaceSnapshotV1>(FACE_FIELDS, (key) => dataValue(record, key));
}

function canonicalizeSource(value: CoreCardDefinitionSourceV1): CoreCardDefinitionSourceV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  const fields = dataValue(record, 'kind') === 'scryfall'
    ? SCRYFALL_SOURCE_FIELDS
    : ENGINE_SYNTHETIC_SOURCE_FIELDS;
  return canonicalRecord<CoreCardDefinitionSourceV1>(fields, (key) => dataValue(record, key));
}

function canonicalizeDefinition(value: CoreCardDefinitionSnapshotV1): CoreCardDefinitionSnapshotV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CoreCardDefinitionSnapshotV1>(DEFINITION_FIELDS, (key) => {
    if (key === 'source') return canonicalizeSource(dataValue(record, key) as CoreCardDefinitionSourceV1);
    if (key === 'colorIdentity' || key === 'keywords' || key === 'producedMana') {
      return copyArray(dataValue(record, key) as readonly string[]);
    }
    if (key === 'faces') {
      return (dataValue(record, key) as readonly CoreCardFaceSnapshotV1[]).map(canonicalizeFace);
    }
    return dataValue(record, key);
  });
}

function canonicalizePhysicalCard(value: CorePhysicalCardV1): CorePhysicalCardV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CorePhysicalCardV1>(PHYSICAL_FIELDS, (key) => dataValue(record, key));
}

function canonicalizeCardObject(value: CoreCardObjectIdentityV1): CoreCardObjectIdentityV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  return canonicalRecord<CoreCardObjectIdentityV1>(OBJECT_FIELDS, (key) => dataValue(record, key));
}

function canonicalizeZones(value: CoreZonesV1, turnOrder: readonly string[]): CoreZonesV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  const byPlayer = dataValue(record, 'byPlayer') as Readonly<Record<string, CorePlayerZonesV1>>;
  const shared = dataValue(record, 'shared') as CoreSharedZonesV1;
  return canonicalRecord<CoreZonesV1>(ZONES_FIELDS, (key) => {
    if (key === 'byPlayer') {
      return canonicalRecord<Readonly<Record<string, CorePlayerZonesV1>>>(turnOrder, (playerId) =>
        canonicalizePlayerZones(dataValue(byPlayer, playerId) as CorePlayerZonesV1));
    }
    return canonicalizeSharedZones(shared);
  });
}

export function canonicalizeModeNeutralCoreIdentityZoneSliceV1(
  value: ModeNeutralCoreIdentityZoneSliceV1,
): ModeNeutralCoreIdentityZoneSliceV1 {
  const record = value as unknown as Readonly<Record<string, unknown>>;
  const turnOrder = copyArray(value.turnOrder);
  const players = dataValue(record, 'players') as Readonly<Record<string, CorePlayerStateV1>>;
  const cardDefinitions = dataValue(record, 'cardDefinitions') as Readonly<Record<string, CoreCardDefinitionSnapshotV1>>;
  const physicalCards = dataValue(record, 'physicalCards') as Readonly<Record<string, CorePhysicalCardV1>>;
  const cardObjects = dataValue(record, 'cardObjects') as Readonly<Record<string, CoreCardObjectIdentityV1>>;
  const zones = dataValue(record, 'zones') as CoreZonesV1;

  return canonicalRecord<ModeNeutralCoreIdentityZoneSliceV1>(ROOT_FIELDS, (key) => {
    if (key === 'players') {
      return canonicalRecord<Readonly<Record<string, CorePlayerStateV1>>>(turnOrder, (playerId) =>
        canonicalizePlayerState(dataValue(players, playerId) as CorePlayerStateV1));
    }
    if (key === 'turnOrder') return turnOrder;
    if (key === 'cardDefinitions') {
      return canonicalRecord<Readonly<Record<string, CoreCardDefinitionSnapshotV1>>>(
        sortedKeys(cardDefinitions),
        (definitionId) => canonicalizeDefinition(dataValue(cardDefinitions, definitionId) as CoreCardDefinitionSnapshotV1),
      );
    }
    if (key === 'physicalCards') {
      return canonicalRecord<Readonly<Record<string, CorePhysicalCardV1>>>(
        sortedKeys(physicalCards),
        (physicalCardId) => canonicalizePhysicalCard(dataValue(physicalCards, physicalCardId) as CorePhysicalCardV1),
      );
    }
    if (key === 'cardObjects') {
      return canonicalRecord<Readonly<Record<string, CoreCardObjectIdentityV1>>>(
        sortedKeys(cardObjects),
        (objectId) => canonicalizeCardObject(dataValue(cardObjects, objectId) as CoreCardObjectIdentityV1),
      );
    }
    if (key === 'zones') return canonicalizeZones(zones, turnOrder);
    return dataValue(record, key);
  });
}
