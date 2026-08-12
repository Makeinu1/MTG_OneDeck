import { describe, expect, it } from 'vitest';
import {
  SOLO_CORE_COMPATIBILITY_CATALOG_V1,
  createSoloCoreIdentityMapV1,
  projectSoloCompatibilityViewV1,
  soloCoreCompatibilityEntryForV1,
  validateSoloCoreIdentityMapV1,
} from '../soloCoreCompatibilityV1';

const players = ['P1', 'P2', 'P3', 'P4'] as const;
const physicalCards = players.map((_, index) => ({ soloPhysicalCardId: `c${index + 1}`, corePhysicalCardId: `PC${index + 1}` }));
const objects = players.map((_, index) => ({ soloObjectId: `c${index + 1}:0`, coreObjectId: `PC${index + 1}:0` }));

function mapInput() {
  return {
    players: players.map((soloPlayerId) => ({ soloPlayerId, corePlayerId: soloPlayerId })),
    physicalCards,
    objects,
  };
}

function state(phase: string = 'upkeep'): unknown {
  const cards = Object.fromEntries(players.map((playerId, index) => [
    `c${index + 1}`,
    { id: `c${index + 1}`, zone: 'library', ownerId: playerId, controllerId: playerId, zoneChangeCounter: 0 },
  ]));
  return {
    cards,
    zones: {
      library: ['c1', 'c2', 'c3', 'c4'], hand: [], battlefield: [], graveyard: [], exile: [], command: [], stack: [],
    },
    zonesByPlayer: Object.fromEntries(players.map((playerId, index) => [playerId, { library: [`c${index + 1}`], hand: [], graveyard: [] }])),
    turnOrder: [...players],
    activePlayerId: 'P1',
    turn: 4,
    phase,
    combat: null,
    commanders: [],
  };
}

describe('soloCoreCompatibilityV1 catalog and identity maps', () => {
  it('exposes the exact dense honest catalog and frozen lookup copies', () => {
    expect(SOLO_CORE_COMPATIBILITY_CATALOG_V1).toHaveLength(20);
    expect(SOLO_CORE_COMPATIBILITY_CATALOG_V1.map((entry) => entry.concern)).toEqual([
      'player-roster', 'active-player', 'turn-position', 'ordered-zones', 'commander-identity',
      'commander-cast-count', 'commander-damage', 'combat-assignments', 'general-life', 'stack-subset',
      'search-control-subset', 'random-zone-order', 'full-combat-damage', 'pending-trigger-sba-turn-advance',
      'poison-energy-experience', 'mana-payment', 'undo-redo', 'indexeddb-snapshot',
      'typed-manual-correction', 'core-replay-package',
    ]);
    expect(Object.isFrozen(SOLO_CORE_COMPATIBILITY_CATALOG_V1)).toBe(true);
    expect(soloCoreCompatibilityEntryForV1('mana-payment')).toEqual({ concern: 'mana-payment', classification: 'solo-only', reasonCode: 'MANA_PAYMENT_SOLO_ONLY' });
    expect(soloCoreCompatibilityEntryForV1('mana-payment')).not.toBe(SOLO_CORE_COMPATIBILITY_CATALOG_V1[15]);
    expect(Object.isFrozen(soloCoreCompatibilityEntryForV1('mana-payment'))).toBe(true);
  });

  it('preserves valid four-player order and deeply freezes fresh output', () => {
    const input = mapInput();
    const before = JSON.stringify(input);
    const result = validateSoloCoreIdentityMapV1({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...input });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.players.map((entry) => entry.soloPlayerId)).toEqual([...players]);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.players)).toBe(true);
      expect(Object.isFrozen(result.value.players[0])).toBe(true);
    }
    expect(JSON.stringify(input)).toBe(before);
  });

  it('rejects duplicate, stale, sparse, accessor, unknown, symbol, and hostile map input', () => {
    const duplicate = mapInput();
    duplicate.players[1] = { ...duplicate.players[1], soloPlayerId: duplicate.players[0].soloPlayerId };
    const duplicateResult = validateSoloCoreIdentityMapV1({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...duplicate });
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) expect(duplicateResult.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_SOLO_KEY', path: '/players/1/soloPlayerId' })]));

    const sparse = mapInput();
    const sparsePlayers = [sparse.players[0], sparse.players[1]];
    sparsePlayers.length = 3;
    const sparseResult = validateSoloCoreIdentityMapV1({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...sparse, players: sparsePlayers });
    expect(sparseResult.ok).toBe(false);
    if (!sparseResult.ok) expect(sparseResult.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NON_DENSE_ARRAY' })]));

    const getter = mapInput();
    let called = false;
    Object.defineProperty(getter.players[0], 'corePlayerId', { enumerable: true, get: () => { called = true; return 'P1'; } });
    expect(validateSoloCoreIdentityMapV1({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...getter }).ok).toBe(false);
    expect(called).toBe(false);

    const hostile = new Proxy({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...mapInput() }, { ownKeys: () => { throw new Error('trap'); } });
    expect(() => validateSoloCoreIdentityMapV1(hostile)).not.toThrow();
    expect(validateSoloCoreIdentityMapV1({ kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...mapInput(), extra: true }).ok).toBe(false);
    const symbolRoot = { kind: 'solo-core-identity-map-v1', schemaVersion: 1, ...mapInput(), [Symbol('x')]: true };
    expect(validateSoloCoreIdentityMapV1(symbolRoot).ok).toBe(false);
  });

  it('rejects mismatched physical-card and object cross-links at both exact object fields', () => {
    const input = mapInput();
    const mismatched = {
      kind: 'solo-core-identity-map-v1',
      schemaVersion: 1,
      ...input,
      objects: [{ soloObjectId: 'c1:0', coreObjectId: 'PC2:0' }],
    };
    const before = JSON.stringify(mismatched);
    const first = validateSoloCoreIdentityMapV1(mismatched);
    const second = validateSoloCoreIdentityMapV1(mismatched);
    expect(first).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_ID',
          path: '/objects/0/coreObjectId',
          message: 'Core object physical identity does not match the physical-card map',
        },
        {
          code: 'INVALID_ID',
          path: '/objects/0/soloObjectId',
          message: 'Solo object physical identity does not match the physical-card map',
        },
      ],
    });
    expect(second).toEqual(first);
    if (!first.ok) {
      expect(Object.isFrozen(first.issues)).toBe(true);
      expect(first.issues.every((current) => Object.isFrozen(current))).toBe(true);
    }
    expect(JSON.stringify(mismatched)).toBe(before);
  });
});

describe('solo projection phase and honesty boundaries', () => {
  it.each([
    ['untap', { phase: 'beginning', step: 'untap' }],
    ['upkeep', { phase: 'beginning', step: 'upkeep' }],
    ['draw', { phase: 'beginning', step: 'draw' }],
    ['main1', { phase: 'precombat-main', step: null }],
    ['combat', { phase: 'combat', step: 'beginning-of-combat' }],
    ['main2', { phase: 'postcombat-main', step: null }],
    ['end', { phase: 'ending', step: 'end' }],
    ['cleanup', { phase: 'ending', step: 'cleanup' }],
  ])('maps Solo phase %s exactly', (phase, expected) => {
    const result = projectSoloCompatibilityViewV1(state(phase), createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('projected');
    if (result.kind === 'projected') expect(result.view.turnPosition).toEqual(expected);
  });

  it('rejects stale identity entries and preserves input order without sorting', () => {
    const input = mapInput();
    const map = createSoloCoreIdentityMapV1({ ...input, objects: [...input.objects].reverse() });
    const result = projectSoloCompatibilityViewV1(state(), map);
    expect(result.kind).toBe('projected');
    if (result.kind === 'projected') expect(result.view.orderedZones[0]?.objectIds).toEqual(['PC1:0']);
    const stale = createSoloCoreIdentityMapV1({ ...input, objects: [{ soloObjectId: 'c1:9', coreObjectId: 'PC1:0' }, ...input.objects.slice(1)] });
    const rejected = projectSoloCompatibilityViewV1(state(), stale);
    expect(rejected.kind).toBe('rejected');
    if (rejected.kind === 'rejected') expect(rejected.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'STALE_SOLO_REFERENCE' })]));
  });

  it('collects every safely inspectable active, turn, combat, zone, and commander issue in stable order', () => {
    const malformed = state('combat') as Record<string, unknown>;
    const cards = malformed.cards as Record<string, unknown>;
    cards.commanderFault = {
      id: 'missing-physical',
      zone: 'command',
      ownerId: 'missing-owner',
      controllerId: 'missing-owner',
      zoneChangeCounter: 0,
    };
    malformed.activePlayerId = 'missing-active';
    malformed.turn = 0;
    malformed.combat = { step: 'combatDamage' };
    malformed.zones = {
      ...(malformed.zones as Record<string, unknown>),
      battlefield: ['missing-zone-card'],
    };
    malformed.commanders = [{ cardId: 'commanderFault', castCount: -1 }];
    const before = JSON.stringify(malformed);
    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first.kind).toBe('rejected');
    expect(second.kind).toBe('rejected');
    if (first.kind === 'rejected' && second.kind === 'rejected') {
      expect(first.issues.map(({ path, code }) => [path, code])).toEqual([
        ['/activePlayerId', 'UNMAPPED_PLAYER'],
        ['/combat/step', 'UNSUPPORTED_COMBAT_STEP'],
        ['/commanders/0/cardId', 'UNMAPPED_PHYSICAL_CARD'],
        ['/commanders/0/castCount', 'INVALID_SOURCE'],
        ['/commanders/0/ownerId', 'UNMAPPED_PLAYER'],
        ['/turn', 'INVALID_SOURCE'],
        ['/zones/battlefield/0', 'STALE_SOLO_REFERENCE'],
      ]);
      expect(second.issues).toEqual(first.issues);
    }
    expect(JSON.stringify(malformed)).toBe(before);
  });

  it.each([
    ['revoked', () => {
      const revocable = Proxy.revocable({}, {});
      revocable.revoke();
      return revocable.proxy;
    }],
    ['trapping', () => new Proxy({}, { getPrototypeOf: () => { throw new Error('trap'); } })],
  ])('collects independent active and turn issues when cards are %s', (_label, hostileCards) => {
    const malformed = state() as Record<string, unknown>;
    const cards = hostileCards();
    malformed.cards = cards;
    malformed.activePlayerId = 'missing-active';
    malformed.turn = 0;
    const keysBefore = Reflect.ownKeys(malformed);
    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const expected = [
      { code: 'INVALID_SOURCE', path: '', message: 'Solo source state is not readable' },
      { code: 'UNMAPPED_PLAYER', path: '/activePlayerId', message: 'Active Solo player is not mapped' },
      { code: 'INVALID_SOURCE', path: '/turn', message: 'Turn number is invalid' },
    ];
    expect(first).toEqual({ kind: 'rejected', issues: expected });
    expect(second).toEqual(first);
    if (first.kind === 'rejected') {
      expect(Object.isFrozen(first.issues)).toBe(true);
      expect(first.issues.every((current) => Object.isFrozen(current))).toBe(true);
      expect(first.issues.some((current) => current.message.includes('could not be inspected safely'))).toBe(false);
    }
    expect(Reflect.ownKeys(malformed)).toEqual(keysBefore);
    expect(Object.is(Object.getOwnPropertyDescriptor(malformed, 'cards')?.value, cards)).toBe(true);
    expect(malformed.activePlayerId).toBe('missing-active');
    expect(malformed.turn).toBe(0);
  });
});
