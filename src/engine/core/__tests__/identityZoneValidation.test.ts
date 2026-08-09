import { describe, expect, it } from 'vitest';

import {
  coreZoneInformationClassOf,
  coreZoneScopeOf,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from '../index';
import { cloneFixture, fixtureRecord, isRecord } from './testHelpers';

function nestedRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be a record`);
  return value;
}

function nestedArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function rejected(value: unknown, code: string) {
  const result = validateModeNeutralCoreIdentityZoneSliceV1(value);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.issues.some((issue) => issue.code === code)).toBe(true);
  return result;
}

function valid(value: unknown): void {
  const result = validateModeNeutralCoreIdentityZoneSliceV1(value);
  expect(result.ok).toBe(true);
}

describe('strict Core identity/zone validation', () => {
  it('accepts the committed four-player fixture and all three hand-size override forms', () => {
    valid(fixtureRecord());
  });

  it('accepts a structurally valid one-player turn order', () => {
    const raw = cloneFixture();
    const players = nestedRecord(raw.players, 'players');
    const byPlayer = nestedRecord(nestedRecord(raw.zones, 'zones').byPlayer, 'byPlayer');
    delete players.P2;
    delete players.P3;
    delete players.P4;
    delete byPlayer.P2;
    delete byPlayer.P3;
    delete byPlayer.P4;
    raw.turnOrder = ['P1'];
    raw.activePlayerId = 'P1';
    const physicalCards = nestedRecord(raw.physicalCards, 'physicalCards');
    const cardObjects = nestedRecord(raw.cardObjects, 'cardObjects');
    for (const id of ['PC3', 'PC4', 'PC5', 'PC6']) delete physicalCards[id];
    for (const id of ['PC3:0', 'PC4:1', 'PC5:1', 'PC6:0']) delete cardObjects[id];
    const shared = nestedRecord(nestedRecord(raw.zones, 'zones').shared, 'shared');
    shared.battlefield = [];
    shared.stack = [];
    shared.exile = [];
    valid(raw);
  });

  it('rejects empty and duplicate turn orders and player set mismatches', () => {
    const empty = cloneFixture();
    empty.turnOrder = [];
    rejected(empty, 'INVALID_ARRAY_LENGTH');

    const duplicate = cloneFixture();
    duplicate.turnOrder = ['P1', 'P1', 'P2', 'P3'];
    rejected(duplicate, 'DUPLICATE_VALUE');

    const missing = cloneFixture();
    delete nestedRecord(missing.players, 'players').P4;
    rejected(missing, 'PLAYER_SET_MISMATCH');

    const extra = cloneFixture();
    nestedRecord(extra.players, 'players').P5 = nestedRecord(extra.players, 'players').P1;
    rejected(extra, 'PLAYER_SET_MISMATCH');

    const zoneMissing = cloneFixture();
    delete nestedRecord(nestedRecord(zoneMissing.zones, 'zones').byPlayer, 'byPlayer').P4;
    rejected(zoneMissing, 'PLAYER_SET_MISMATCH');

    const zoneExtra = cloneFixture();
    nestedRecord(nestedRecord(zoneExtra.zones, 'zones').byPlayer, 'byPlayer').P5 = nestedRecord(
      nestedRecord(zoneExtra.zones, 'zones').byPlayer,
      'byPlayer',
    ).P1;
    rejected(zoneExtra, 'PLAYER_SET_MISMATCH');
  });

  it('requires activePlayerId to be seated and preserves negative life', () => {
    const negativeLife = cloneFixture();
    nestedRecord(nestedRecord(negativeLife.players, 'players').P1, 'P1').life = -1;
    valid(negativeLife);

    const fractionalLife = cloneFixture();
    nestedRecord(nestedRecord(fractionalLife.players, 'players').P1, 'P1').life = 1.5;
    rejected(fractionalLife, 'INVALID_INTEGER');

    const active = cloneFixture();
    active.activePlayerId = 'P9';
    rejected(active, 'ACTIVE_PLAYER_NOT_SEATED');

    const negativePoison = cloneFixture();
    nestedRecord(nestedRecord(negativePoison.players, 'players').P1, 'P1').poison = -1;
    rejected(negativePoison, 'INVALID_INTEGER');
  });

  it('rejects mana shape drift and player metadata fields', () => {
    const missingMana = cloneFixture();
    delete nestedRecord(nestedRecord(nestedRecord(missingMana.players, 'players').P1, 'P1').manaPool, 'manaPool').C;
    rejected(missingMana, 'MISSING_FIELD');

    const extraMana = cloneFixture();
    nestedRecord(nestedRecord(nestedRecord(extraMana.players, 'players').P1, 'P1').manaPool, 'manaPool').X = 1;
    rejected(extraMana, 'UNKNOWN_FIELD');

    const metadata = cloneFixture();
    nestedRecord(nestedRecord(metadata.players, 'players').P1, 'P1').label = 'P1';
    rejected(metadata, 'UNKNOWN_FIELD');
  });

  it('rejects missing fields, numeric strings, non-finite numbers, and null nested values', () => {
    const missingRoot = cloneFixture();
    delete missingRoot.turnOrder;
    rejected(missingRoot, 'MISSING_FIELD');

    const missingNested = cloneFixture();
    delete nestedRecord(nestedRecord(missingNested.players, 'players').P1, 'P1').life;
    rejected(missingNested, 'MISSING_FIELD');

    const numericString = cloneFixture();
    nestedRecord(nestedRecord(numericString.players, 'players').P1, 'P1').life = '40';
    rejected(numericString, 'INVALID_NUMBER');

    const notFinite = cloneFixture();
    nestedRecord(nestedRecord(notFinite.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').manaValue = Number.NaN;
    rejected(notFinite, 'INVALID_NUMBER');

    const nullZones = cloneFixture();
    nestedRecord(nestedRecord(nullZones.zones, 'zones').byPlayer, 'byPlayer').P1 = null;
    rejected(nullZones, 'INVALID_TYPE');
  });

  it('rejects accessor records without executing getters', () => {
    const raw = cloneFixture();
    let getterExecuted = false;
    Object.defineProperty(raw, 'kind', {
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return 'mode-neutral-core-identity-zone-slice-v1';
      },
    });
    rejected(raw, 'INVALID_TYPE');
    expect(getterExecuted).toBe(false);
  });

  it('rejects non-enumerable fields instead of cloning an empty record', () => {
    const raw = cloneFixture();
    const root = { ...raw };
    for (const key of Object.keys(root)) {
      const value = root[key];
      delete root[key];
      Object.defineProperty(root, key, { value, enumerable: false, writable: true, configurable: true });
    }
    const result = validateModeNeutralCoreIdentityZoneSliceV1(root);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
  });

  it('rejects array accessors without executing them', () => {
    const raw = cloneFixture();
    let getterExecuted = false;
    Object.defineProperty(nestedArray(raw.turnOrder, 'turnOrder'), '0', {
      enumerable: true,
      get: () => {
        getterExecuted = true;
        return 'P1';
      },
    });
    rejected(raw, 'INVALID_TYPE');
    expect(getterExecuted).toBe(false);
  });

  it('rejects extra function and symbol properties on arrays', () => {
    const raw = cloneFixture();
    const turnOrder = nestedArray(raw.turnOrder, 'turnOrder');
    Object.defineProperty(turnOrder, 'extra', { value: () => undefined, enumerable: true });
    Object.defineProperty(turnOrder, Symbol('extra'), { value: 'forbidden', enumerable: true });
    rejected(raw, 'UNKNOWN_FIELD');
  });

  it('rejects invalid IDs and unsafe record keys', () => {
    const empty = cloneFixture();
    empty.turnOrder = [''];
    rejected(empty, 'INVALID_ID');

    const longId = cloneFixture();
    longId.turnOrder = ['P'.padEnd(129, '1')];
    rejected(longId, 'INVALID_ID');

    const unsafe = cloneFixture();
    const players = nestedRecord(unsafe.players, 'players');
    Object.defineProperty(players, '__proto__', { value: players.P1, enumerable: true });
    rejected(unsafe, 'UNSAFE_RECORD_KEY');

    const whitespace = cloneFixture();
    nestedRecord(whitespace.physicalCards, 'physicalCards')['bad id'] = nestedRecord(
      nestedRecord(whitespace.physicalCards, 'physicalCards'),
      'physicalCards',
    ).PC1;
    rejected(whitespace, 'INVALID_ID');
  });

  it('rejects object ID drift, fractional incarnation, and commander cast-count fields', () => {
    const mismatch = cloneFixture();
    nestedRecord(nestedRecord(mismatch.cardObjects, 'cardObjects')['PC4:1'], 'PC4:1').physicalCardId = 'PC1';
    rejected(mismatch, 'OBJECT_ID_MISMATCH');

    const fractional = cloneFixture();
    nestedRecord(nestedRecord(fractional.cardObjects, 'cardObjects')['PC4:1'], 'PC4:1').incarnation = 1.5;
    rejected(fractional, 'INVALID_INTEGER');

    const castCount = cloneFixture();
    nestedRecord(castCount.physicalCards, 'physicalCards').PC7 = {
      ...nestedRecord(castCount.physicalCards, 'physicalCards').PC7 as Record<string, unknown>,
      castCount: 1,
    };
    rejected(castCount, 'UNKNOWN_FIELD');
  });

  it('validates card-definition source, UUID, unused definitions, and snapshot-only fields', () => {
    const unused = cloneFixture();
    valid(unused);

    const sourceMismatch = cloneFixture();
    nestedRecord(nestedRecord(sourceMismatch.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').source = {
      kind: 'scryfall',
      scryfallId: '00000000-0000-0000-0000-000000000000',
      oracleId: '00000000-0000-0000-0000-000000000001',
    };
    rejected(sourceMismatch, 'CARD_DEFINITION_KEY_MISMATCH');

    const uuid = cloneFixture();
    nestedRecord(nestedRecord(uuid.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').source = {
      kind: 'scryfall',
      scryfallId: 'NOT-A-UUID',
      oracleId: 'NOT-A-UUID',
    };
    rejected(uuid, 'INVALID_STRING');

    const syntheticExtra = cloneFixture();
    nestedRecord(nestedRecord(syntheticExtra.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').source = {
      kind: 'engine-synthetic',
      scryfallId: 'forbidden',
    };
    rejected(syntheticExtra, 'UNKNOWN_FIELD');

    const display = cloneFixture();
    nestedRecord(nestedRecord(display.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').printedName = '表示名';
    rejected(display, 'UNKNOWN_FIELD');
  });

  it('validates mana values, canonical colors, keywords, faces, and Oracle text', () => {
    const fractional = cloneFixture();
    nestedRecord(nestedRecord(fractional.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').manaValue = 1.5;
    valid(fractional);

    const negative = cloneFixture();
    nestedRecord(nestedRecord(negative.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').manaValue = -1;
    rejected(negative, 'INVALID_NUMBER');

    const colorOrder = cloneFixture();
    nestedRecord(nestedRecord(colorOrder.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').colorIdentity = ['U', 'W'];
    rejected(colorOrder, 'INVALID_ORDER');

    const duplicateMana = cloneFixture();
    nestedRecord(nestedRecord(duplicateMana.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').producedMana = ['C', 'C'];
    rejected(duplicateMana, 'DUPLICATE_VALUE');

    const manaOrder = cloneFixture();
    nestedRecord(nestedRecord(manaOrder.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').producedMana = ['U', 'W'];
    rejected(manaOrder, 'INVALID_ORDER');

    const keywordOrder = cloneFixture();
    nestedRecord(nestedRecord(keywordOrder.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').keywords = ['zeta', 'alpha'];
    rejected(keywordOrder, 'INVALID_ORDER');

    const noFaces = cloneFixture();
    nestedRecord(nestedRecord(noFaces.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').faces = [];
    rejected(noFaces, 'INVALID_ARRAY_LENGTH');

    const oracleCr = cloneFixture();
    const faces = nestedArray(
      nestedRecord(nestedRecord(oracleCr.cardDefinitions, 'cardDefinitions')['def.fixture-card'], 'definition').faces,
      'faces',
    );
    nestedRecord(faces[0], 'face').oracleText = 'a\rb';
    rejected(oracleCr, 'INVALID_STRING');
  });

  it('rejects missing definitions, owners, controllers, and invalid zone controllers', () => {
    const definition = cloneFixture();
    nestedRecord(nestedRecord(definition.physicalCards, 'physicalCards').PC1, 'PC1').definitionId = 'missing';
    rejected(definition, 'CARD_DEFINITION_NOT_FOUND');

    const owner = cloneFixture();
    nestedRecord(nestedRecord(owner.physicalCards, 'physicalCards').PC1, 'PC1').ownerPlayerId = 'P9';
    rejected(owner, 'OWNER_NOT_SEATED');

    const controller = cloneFixture();
    nestedRecord(nestedRecord(controller.cardObjects, 'cardObjects')['PC4:1'], 'object').baseControllerPlayerId = 'P9';
    rejected(controller, 'BASE_CONTROLLER_NOT_SEATED');

    const battlefieldNull = cloneFixture();
    nestedRecord(nestedRecord(battlefieldNull.cardObjects, 'cardObjects')['PC4:1'], 'object').baseControllerPlayerId = null;
    rejected(battlefieldNull, 'INVALID_CONTROLLER_FOR_ZONE');

    const handController = cloneFixture();
    nestedRecord(nestedRecord(handController.cardObjects, 'cardObjects')['PC2:0'], 'object').baseControllerPlayerId = 'P1';
    rejected(handController, 'INVALID_CONTROLLER_FOR_ZONE');
  });

  it('enforces one object per physical card and one zone per object', () => {
    const noObject = cloneFixture();
    delete nestedRecord(noObject.cardObjects, 'cardObjects')['PC1:0'];
    rejected(noObject, 'PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT');

    const duplicateObject = cloneFixture();
    nestedRecord(nestedRecord(duplicateObject.cardObjects, 'cardObjects'), 'cardObjects')['PC1:1'] = {
      kind: 'card',
      physicalCardId: 'PC1',
      incarnation: 1,
      baseControllerPlayerId: null,
    };
    nestedRecord(nestedRecord(duplicateObject.zones, 'zones').shared, 'shared').exile = ['PC6:0', 'PC1:1'];
    rejected(duplicateObject, 'PHYSICAL_CARD_NOT_IN_EXACTLY_ONE_OBJECT');

    const unknownZoneObject = cloneFixture();
    nestedRecord(nestedRecord(unknownZoneObject.zones, 'zones').shared, 'shared').exile = ['unknown:0'];
    rejected(unknownZoneObject, 'ZONE_OBJECT_NOT_FOUND');

    const duplicateZone = cloneFixture();
    nestedRecord(nestedRecord(duplicateZone.zones, 'zones').shared, 'shared').exile = ['PC6:0', 'PC6:0'];
    rejected(duplicateZone, 'OBJECT_NOT_IN_EXACTLY_ONE_ZONE');
  });

  it('enforces player-private ownership and permits owner/controller separation', () => {
    const ownerMismatch = cloneFixture();
    const p1Zones = nestedRecord(nestedRecord(ownerMismatch.zones, 'zones').byPlayer, 'byPlayer').P1;
    const p2Zones = nestedRecord(nestedRecord(ownerMismatch.zones, 'zones').byPlayer, 'byPlayer').P2;
    nestedArray(nestedRecord(p1Zones, 'P1').library, 'library').splice(0, 1);
    nestedArray(nestedRecord(p2Zones, 'P2').library, 'library').push('PC1:0');
    rejected(ownerMismatch, 'OWNED_ZONE_OWNER_MISMATCH');

    valid(cloneFixture());
  });

  it('allows a commander outside command as a structural state', () => {
    const outsideCommand = cloneFixture();
    const shared = nestedRecord(nestedRecord(outsideCommand.zones, 'zones').shared, 'shared');
    nestedArray(shared.command, 'command').splice(0, 1);
    nestedArray(shared.exile, 'exile').push('PC7:0');
    valid(outsideCommand);
  });

  it('rejects root and nested unknown fields, missing fields, and non-plain records', () => {
    const rootUnknown = cloneFixture();
    rootUnknown.roomId = 'room';
    rejected(rootUnknown, 'UNKNOWN_FIELD');

    const nestedUnknown = cloneFixture();
    nestedRecord(nestedRecord(nestedUnknown.players, 'players').P1, 'P1').displayName = 'P1';
    rejected(nestedUnknown, 'UNKNOWN_FIELD');

    const missing = cloneFixture();
    delete nestedRecord(missing.players, 'players').P1;
    rejected(missing, 'PLAYER_SET_MISMATCH');

    rejected(null, 'INVALID_ROOT');
    rejected([], 'INVALID_ROOT');
    rejected(new Date(), 'INVALID_ROOT');
    rejected(new Map(), 'INVALID_ROOT');
    rejected(new Set(), 'INVALID_ROOT');
    rejected(() => undefined, 'INVALID_ROOT');
  });

  it('returns all issues in JSON Pointer path/code order without mutating input', () => {
    const raw = cloneFixture();
    raw.activePlayerId = 'P9';
    nestedRecord(nestedRecord(raw.players, 'players').P1, 'P1').life = 1.5;
    raw['field/name~'] = true;
    const before = structuredClone(raw);
    const result = rejected(raw, 'ACTIVE_PLAYER_NOT_SEATED');
    expect(raw).toEqual(before);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const keys = result.issues.map((issue) => `${issue.path}\u0000${issue.code}`);
      expect(keys).toEqual(keys.slice().sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
      expect(result.issues.some((issue) => issue.path === '/field~1name~0')).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('returns a separately allocated deeply frozen success value', () => {
    const raw = cloneFixture();
    const result = validateModeNeutralCoreIdentityZoneSliceV1(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(raw);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.zones.shared)).toBe(true);
    expect(Object.isFrozen(result.value.zones.shared.battlefield)).toBe(true);
  });

  it('classifies the fixed CR zone scope and information boundary', () => {
    expect(coreZoneScopeOf('library')).toBe('player-scoped');
    expect(coreZoneScopeOf('hand')).toBe('player-scoped');
    expect(coreZoneScopeOf('graveyard')).toBe('player-scoped');
    expect(coreZoneScopeOf('battlefield')).toBe('shared');
    expect(coreZoneScopeOf('stack')).toBe('shared');
    expect(coreZoneScopeOf('exile')).toBe('shared');
    expect(coreZoneScopeOf('command')).toBe('shared');
    expect(coreZoneInformationClassOf('library')).toBe('hidden-zone');
    expect(coreZoneInformationClassOf('hand')).toBe('hidden-zone');
    expect(coreZoneInformationClassOf('graveyard')).toBe('public-zone');
    expect(coreZoneInformationClassOf('battlefield')).toBe('public-zone');
    expect(coreZoneInformationClassOf('stack')).toBe('public-zone');
    expect(coreZoneInformationClassOf('exile')).toBe('public-zone');
    expect(coreZoneInformationClassOf('command')).toBe('public-zone');
  });
});
