import { describe, expect, it } from 'vitest';
import {
  createDefaultCoreCardRuntimeAfterZoneChangeV1,
} from '../../../transition/cardReincarnation';
import {
  validateCoreStackTransactionBundleV1,
} from '../stackTransactionBundleV1';
import {
  commitCoreCardSpellToStackV1,
} from '../cardSpellCommitV1';
import type { CoreObjectId, CorePlayerId } from '../../../ids';

const P2 = 'p2' as CorePlayerId;
const SOURCE = 'pc1:0' as CoreObjectId;
const COMMITTED = 'pc1:1' as CoreObjectId;
const EXISTING_STACK = 'pc2:0' as CoreObjectId;

function player(): Record<string, unknown> {
  return {
    life: 40, poison: 0, energy: 0, experience: 0,
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0,
    drawnThisTurn: 0, maximumHandSizeOverride: 'none',
  };
}

function definition(): Record<string, unknown> {
  return {
    source: { kind: 'engine-synthetic' }, name: 'Fixture Card', layout: 'normal',
    manaValue: 1, colorIdentity: [], typeLine: 'Sorcery', keywords: [],
    producedMana: [], tokenKind: null,
    faces: [{ name: 'Fixture Card', manaCost: '{1}', typeLine: 'Sorcery', oracleText: '', power: null, toughness: null, loyalty: null, defense: null }],
  };
}

function announcement(): Record<string, unknown> {
  return {
    kind: 'card-spell', abilityTextSnapshot: null, chosenModeKeys: [],
    targetSelections: [], announcedVariables: [], distributions: [],
    costChoices: { alternativeCost: null, additionalCosts: [] },
  };
}

function runtimeRow(): ReturnType<typeof createDefaultCoreCardRuntimeAfterZoneChangeV1> {
  return createDefaultCoreCardRuntimeAfterZoneChangeV1();
}

function bundle(sourceZone: 'library' | 'hand' | 'graveyard' | 'battlefield' | 'exile' | 'command' | 'stack' = 'hand') {
  const playerZones = {
    p1: { library: [], hand: [], graveyard: [] },
    p2: { library: [], hand: [], graveyard: [] },
  } as Record<string, { library: string[]; hand: string[]; graveyard: string[] }>;
  const shared = { battlefield: [], stack: [EXISTING_STACK], exile: [], command: [] } as Record<string, string[]>;
  if (sourceZone === 'library' || sourceZone === 'hand' || sourceZone === 'graveyard') playerZones.p1[sourceZone].push(SOURCE);
  else shared[sourceZone].push(SOURCE);
  const raw = {
    objectRegistry: {
      kind: 'mode-neutral-core-object-registry-slice-v2', players: { p1: player(), p2: player() },
      turnOrder: ['p1', 'p2'], activePlayerId: 'p1', cardDefinitions: { def1: definition() },
      physicalCards: {
        pc1: { definitionId: 'def1', ownerPlayerId: 'p1', isCommander: false },
        pc2: { definitionId: 'def1', ownerPlayerId: 'p1', isCommander: false },
      },
      objects: {
        [SOURCE]: { kind: 'card', physicalCardId: 'pc1', incarnation: 0, baseControllerPlayerId: sourceZone === 'battlefield' || sourceZone === 'stack' ? 'p1' : null },
        [EXISTING_STACK]: { kind: 'card', physicalCardId: 'pc2', incarnation: 0, baseControllerPlayerId: 'p1' },
      },
      zones: { byPlayer: playerZones, shared },
    },
    objectRuntime: { kind: 'mode-neutral-core-object-runtime-slice-v2', byObject: { [SOURCE]: runtimeRow(), [EXISTING_STACK]: runtimeRow() } },
    stackAnnouncements: {
      kind: 'mode-neutral-core-stack-announcement-slice-v1',
      byObject: sourceZone === 'stack'
        ? { [EXISTING_STACK]: announcement(), [SOURCE]: announcement() }
        : { [EXISTING_STACK]: announcement() },
    },
  };
  const result = validateCoreStackTransactionBundleV1(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function input(): Record<string, unknown> {
  return { sourceObjectId: SOURCE, controllerPlayerId: P2, announcement: announcement() };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) expectDeepFrozen(descriptor.value, seen);
  }
}

describe('commitCoreCardSpellToStackV1', () => {
  it.each(['hand', 'graveyard', 'exile', 'command', 'library', 'battlefield'] as const)(
    'commits a card from %s with one V2 incarnation transition',
    (sourceZone) => {
      const original = bundle(sourceZone);
      const before = JSON.stringify(original);
      const result = commitCoreCardSpellToStackV1(original, input());

      expect(result.previousObjectId).toBe(SOURCE);
      expect(result.committedObjectId).toBe(COMMITTED);
      expect(result.bundle.objectRegistry.objects[SOURCE]).toBeUndefined();
      expect(result.bundle.objectRegistry.objects[COMMITTED]).toEqual({
        kind: 'card', physicalCardId: 'pc1', incarnation: 1, baseControllerPlayerId: P2,
      });
      expect(result.bundle.objectRegistry.zones.shared.stack).toEqual([EXISTING_STACK, COMMITTED]);
      expect(result.bundle.objectRuntime.byObject[SOURCE]).toBeUndefined();
      expect(result.bundle.objectRuntime.byObject[COMMITTED]).toEqual(runtimeRow());
      expect(result.bundle.stackAnnouncements.byObject[COMMITTED]).toEqual(announcement());
      expect(result.bundle.stackAnnouncements.byObject[EXISTING_STACK]).toEqual(announcement());
      expect(JSON.stringify(original)).toBe(before);
      expectDeepFrozen(result);
    },
  );

  it('rejects a source already on the stack atomically', () => {
    const original = bundle('stack');
    const before = JSON.stringify(original);
    expect(() => commitCoreCardSpellToStackV1(original, { ...input(), sourceObjectId: EXISTING_STACK })).toThrowError(/SOURCE_ALREADY_ON_STACK/);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('rejects hostile operation descriptors and preserves the input', () => {
    const original = bundle();
    const hostile = input();
    Object.defineProperty(hostile, 'controllerPlayerId', {
      enumerable: true,
      get(): never { throw new Error('getter must not run'); },
    });
    expect(() => commitCoreCardSpellToStackV1(original, hostile)).toThrowError(/INVALID_OPERATION_INPUT/);
  });

  it('fails atomically when the announcement candidate is invalid', () => {
    const original = bundle();
    const before = JSON.stringify(original);
    const invalid = input();
    (invalid.announcement as Record<string, unknown>).chosenModeKeys = ['bad key'];
    expect(() => commitCoreCardSpellToStackV1(original, invalid)).toThrowError(/CANDIDATE_INVALID|INVALID_OPERATION_INPUT/);
    expect(JSON.stringify(original)).toBe(before);
  });
});
