import { describe, expect, it } from 'vitest';

import {
  SOLO_CORE_COMPATIBILITY_CATALOG_V1,
  compareSoloCoreCompatibilityV1,
  createSoloCoreIdentityMapV1,
  projectSoloCompatibilityViewV1,
  soloCoreCompatibilityEntryForV1,
  validateSoloCoreIdentityMapV1,
  type SoloCoreComparableViewV1,
} from '../index';

function deepFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor === undefined || !('value' in descriptor) || deepFrozen(descriptor.value, seen);
  });
}

function view(): SoloCoreComparableViewV1 {
  return {
    kind: 'solo-core-comparable-view-v1',
    schemaVersion: 1,
    activePlayerId: 'P1' as never,
    turnNumber: 1,
    turnPosition: { phase: 'precombat-main', step: null },
    orderedZones: [{ playerId: 'P1' as never, zone: 'library', objectIds: ['PC1:0' as never] }],
    commanders: [],
    combat: null,
  };
}

describe('O4P-02A judge-owned hostile compatibility evidence', () => {
  it('keeps every excluded concern outside transformable parity', () => {
    const excluded = SOLO_CORE_COMPATIBILITY_CATALOG_V1.filter((entry) => (
      entry.classification !== 'transformable'
    ));
    expect(excluded).toHaveLength(13);
    expect(excluded.map((entry) => entry.concern)).toContain('full-combat-damage');
    expect(excluded.map((entry) => entry.concern)).toContain('indexeddb-snapshot');
    expect(excluded.map((entry) => entry.concern)).toContain('core-replay-package');
    for (const entry of excluded) {
      const lookup = soloCoreCompatibilityEntryForV1(entry.concern);
      expect(lookup?.classification).toBe(entry.classification);
      expect(lookup).not.toBe(entry);
      expect(deepFrozen(lookup)).toBe(true);
    }
  });

  it('reports independent identity-map defects completely and deterministically', () => {
    const sparseObjects = [{ soloObjectId: 'solo-card:0', coreObjectId: 'PC1:0' }];
    sparseObjects.length = 2;
    const candidate = {
      kind: 'solo-core-identity-map-v1',
      schemaVersion: 1,
      players: [
        { soloPlayerId: 'solo-a', corePlayerId: 'P1' },
        { soloPlayerId: 'solo-a', corePlayerId: 'P1' },
      ],
      physicalCards: [
        { soloPhysicalCardId: 'solo-card', corePhysicalCardId: 'PC1' },
        { soloPhysicalCardId: 'solo-card-2', corePhysicalCardId: 'PC1' },
      ],
      objects: sparseObjects,
      extra: true,
    };
    const first = validateSoloCoreIdentityMapV1(candidate);
    const second = validateSoloCoreIdentityMapV1(candidate);
    expect(first.ok).toBe(false);
    expect(second).toEqual(first);
    if (!first.ok) {
      expect(first.issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
        'UNKNOWN_FIELD',
        'DUPLICATE_SOLO_KEY',
        'DUPLICATE_CORE_VALUE',
        'NON_DENSE_ARRAY',
      ]));
      expect(deepFrozen(first.issues)).toBe(true);
    }
  });

  it('does not echo source-only secret fields into the comparable view', () => {
    const secret = 'O4P-02A-SECRET-SENTINEL';
    const map = createSoloCoreIdentityMapV1({
      players: [{ soloPlayerId: 'solo-a', corePlayerId: 'P1' }],
      physicalCards: [{ soloPhysicalCardId: 'solo-card', corePhysicalCardId: 'PC1' }],
      objects: [{ soloObjectId: 'solo-card:0', coreObjectId: 'PC1:0' }],
    });
    const source = {
      cards: {
        'solo-card': {
          id: 'solo-card',
          ownerId: 'solo-a',
          controllerId: 'solo-a',
          zoneChangeCounter: 0,
          privateOracleText: secret,
        },
      },
      zones: {
        library: ['solo-card'],
        hand: [],
        graveyard: [],
        battlefield: [],
        stack: [],
        exile: [],
        command: [],
      },
      zonesByPlayer: {
        'solo-a': { library: ['solo-card'], hand: [], graveyard: [] },
      },
      turnOrder: ['solo-a'],
      activePlayerId: 'solo-a',
      turn: 1,
      phase: 'main1',
      commanders: [],
      combat: null,
      defs: { private: secret },
      eventLog: [{ private: secret }],
      log: [{ private: secret }],
    };
    const result = projectSoloCompatibilityViewV1(source, map);
    expect(result.kind).toBe('projected');
    if (result.kind === 'projected') {
      expect(JSON.stringify(result.view)).not.toContain(secret);
      expect(Object.keys(result.view)).toEqual([
        'kind',
        'schemaVersion',
        'activePlayerId',
        'turnNumber',
        'turnPosition',
        'orderedZones',
        'commanders',
        'combat',
      ]);
      expect(deepFrozen(result)).toBe(true);
    }
  });

  it('returns fresh frozen evidence rather than hostile comparator inputs', () => {
    const revoked = Proxy.revocable(view(), {});
    revoked.revoke();
    const ordinary = view();
    const result = compareSoloCoreCompatibilityV1(revoked.proxy, ordinary);
    expect(result.kind).toBe('incompatible');
    expect(Object.is(result.soloView, revoked.proxy)).toBe(false);
    expect(Object.is(result.coreView, ordinary)).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'VIEW_FIELD_MISMATCH', path: '' }),
    ]);
    expect(deepFrozen(result)).toBe(true);
  });
});
