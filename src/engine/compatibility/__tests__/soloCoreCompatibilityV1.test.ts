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
        ['/combat/turn', 'INVALID_SOURCE'],
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
    ['attacker', 'declareAttackers', 'attackers', '/combat/attackers/0/objectId'],
    ['blocker', 'declareBlockers', 'blockers', '/combat/blockers/0/objectId'],
  ] as const)('rejects a stale stored %s object incarnation', (_label, step, collection, expectedPath) => {
    const malformed = state('combat') as Record<string, unknown>;
    const combat = {
      combatId: 'combat-1',
      turn: 4,
      step,
      attackingPlayerId: 'P1',
      defendingPlayerId: 'P2',
      attackers: [{
        cardId: 'c1', objectId: 'c1:0', controllerId: 'P1',
        target: { type: 'player', playerId: 'P2' }, blockedBy: [], declaredOrder: 0,
      }],
      blockers: [{
        cardId: 'c2', objectId: 'c2:0', controllerId: 'P2', blocking: ['c1'], declaredOrder: 0,
      }],
    };
    combat[collection][0].objectId = collection === 'attackers' ? 'c1:9' : 'c2:9';
    malformed.combat = combat;
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.issues).toContainEqual({
        code: 'STALE_SOLO_REFERENCE',
        path: expectedPath,
        message: 'Solo combat references a stale object incarnation',
      });
    }
  });

  it('preserves active and turn issues when a nested combat array traps', () => {
    const malformed = state('combat') as Record<string, unknown>;
    malformed.activePlayerId = 'missing-active';
    malformed.turn = 0;
    const hostileAttackers = new Proxy([], {
      ownKeys: () => { throw new Error('trap'); },
    });
    malformed.combat = {
      combatId: 'combat-1',
      turn: 0,
      step: 'declareAttackers',
      attackingPlayerId: 'P1',
      defendingPlayerId: 'P2',
      attackers: hostileAttackers,
      blockers: [],
    };
    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first).toEqual({
      kind: 'rejected',
      issues: [
        { code: 'UNMAPPED_PLAYER', path: '/activePlayerId', message: 'Active Solo player is not mapped' },
        { code: 'INVALID_SOURCE', path: '/combat', message: 'Combat assignments must be arrays' },
        { code: 'INVALID_DESCRIPTOR', path: '/combat/attackers', message: 'Array inspection is not safe' },
        { code: 'INVALID_SOURCE', path: '/combat/turn', message: 'Combat turn must be a positive safe integer matching Solo turn' },
        { code: 'INVALID_SOURCE', path: '/turn', message: 'Turn number is invalid' },
      ],
    });
    expect(second).toEqual(first);
    if (first.kind === 'rejected') {
      expect(Object.isFrozen(first.issues)).toBe(true);
      expect(first.issues.every((current) => Object.isFrozen(current))).toBe(true);
    }
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

function issuePaths(result: unknown): string[] {
  if (typeof result !== 'object' || result === null) return [];
  const record = result as { readonly kind?: unknown; readonly issues?: unknown };
  if (record.kind !== 'rejected' || !Array.isArray(record.issues)) return [];
  const issues = record.issues as readonly unknown[];
  const paths: string[] = [];
  for (const current of issues) {
    if (typeof current !== 'object' || current === null) continue;
    const currentRecord = current as { readonly path?: unknown };
    if (typeof currentRecord.path === 'string') paths.push(currentRecord.path);
  }
  return paths;
}

function combatForTests(step: 'declareAttackers' | 'declareBlockers' = 'declareAttackers'): Record<string, unknown> {
  return {
    combatId: 'combat-1',
    turn: 4,
    step,
    attackingPlayerId: 'P1',
    defendingPlayerId: 'P2',
    attackers: [],
    blockers: [],
  };
}

function hideArrayIndex<T>(input: T[], hiddenIndex: number): T[] {
  return new Proxy(input, {
    ownKeys: (target) => Reflect.ownKeys(target).filter((key) => key !== String(hiddenIndex)),
  });
}

describe('solo projection repair-cycle adversarial coverage', () => {
  it.each([
    ['missing', (malformed: Record<string, unknown>): void => { delete malformed.combat; }],
    ['undefined', (malformed: Record<string, unknown>): void => { malformed.combat = undefined; }],
    ['non-enumerable', (malformed: Record<string, unknown>): void => {
      Object.defineProperty(malformed, 'combat', { configurable: true, enumerable: false, value: null });
    }],
  ] as const)('rejects a %s combat field instead of treating it as explicit null', (_label, mutate) => {
    const malformed = state('combat') as Record<string, unknown>;
    mutate(malformed);
    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first).toEqual({
      kind: 'rejected',
      issues: [{
        code: 'INVALID_SOURCE',
        path: '/combat',
        message: 'Solo combat must be an explicit enumerable data property',
      }],
    });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('rejects an accessor combat field without invoking its getter', () => {
    const malformed = state('combat') as Record<string, unknown>;
    let getterCalls = 0;
    Object.defineProperty(malformed, 'combat', {
      configurable: true,
      enumerable: true,
      get: (): null => {
        getterCalls += 1;
        return null;
      },
    });
    const descriptor = Object.getOwnPropertyDescriptor(malformed, 'combat');
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result).toEqual({
      kind: 'rejected',
      issues: [{
        code: 'INVALID_SOURCE',
        path: '/combat',
        message: 'Solo combat must be an explicit enumerable data property',
      }],
    });
    expect(getterCalls).toBe(0);
    expect(Object.getOwnPropertyDescriptor(malformed, 'combat')).toEqual(descriptor);
  });

  it('rejects a trapping combat descriptor and retains independent sibling issues', () => {
    const target = state('combat') as Record<string, unknown>;
    target.activePlayerId = 'missing-active';
    target.turn = 0;
    target.commanders = [{ cardId: 'c1', castCount: -1 }];
    const malformed = new Proxy(target, {
      getOwnPropertyDescriptor: (current, property) => {
        if (property === 'combat') throw new Error('trap');
        return Reflect.getOwnPropertyDescriptor(current, property);
      },
    });
    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first).toEqual(second);
    expect(issuePaths(first)).toEqual(expect.arrayContaining([
      '/activePlayerId',
      '/combat',
      '/commanders/0/castCount',
      '/turn',
    ]));
    expect(Object.isFrozen(first)).toBe(true);
    if (first.kind === 'rejected') {
      expect(Object.isFrozen(first.issues)).toBe(true);
      expect(first.issues.every((current) => Object.isFrozen(current))).toBe(true);
    }
  });

  it('rejects a revoked Solo state without exposing a partial combat view', () => {
    const revoked = Proxy.revocable(state('combat') as object, {});
    revoked.revoke();
    const result = projectSoloCompatibilityViewV1(revoked.proxy, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    expect(issuePaths(result)).toContain('/combat');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ['turn order', (malformed: Record<string, unknown>): string => {
      malformed.turnOrder = hideArrayIndex(malformed.turnOrder as string[], 0);
      return '/turnOrder/0';
    }],
    ['shared zone', (malformed: Record<string, unknown>): string => {
      const zones = malformed.zones as Record<string, unknown>;
      zones.battlefield = hideArrayIndex(['c1'], 0);
      return '/zones/battlefield/0';
    }],
    ['private zone', (malformed: Record<string, unknown>): string => {
      const zonesByPlayer = malformed.zonesByPlayer as Record<string, unknown>;
      const p1 = zonesByPlayer.P1 as Record<string, unknown>;
      p1.library = hideArrayIndex(['c1'], 0);
      return '/zonesByPlayer/P1/library/0';
    }],
    ['commanders', (malformed: Record<string, unknown>): string => {
      malformed.commanders = hideArrayIndex([{ cardId: 'c1', castCount: 0 }], 0);
      return '/commanders/0';
    }],
    ['combat attackers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareAttackers');
      combat.attackers = hideArrayIndex([{
        cardId: 'c1',
        objectId: 'c1:0',
        controllerId: 'P1',
        target: { type: 'player', playerId: 'P2' },
      }], 0);
      malformed.combat = combat;
      return '/combat/attackers/0';
    }],
    ['combat blockers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      combat.blockers = hideArrayIndex([{
        cardId: 'c2',
        objectId: 'c2:0',
        controllerId: 'P2',
        blocking: [],
      }], 0);
      malformed.combat = combat;
      return '/combat/blockers/0';
    }],
    ['blocking assignments', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      combat.blockers = [{
        cardId: 'c2',
        objectId: 'c2:0',
        controllerId: 'P2',
        blocking: hideArrayIndex(['c1'], 0),
      }];
      malformed.combat = combat;
      return '/combat/blockers/0/blocking/0';
    }],
  ] as const)('rejects a hidden numeric index in %s without invoking an iterator', (_label, mutate: (malformed: Record<string, unknown>) => string) => {
    const malformed = state('combat') as Record<string, unknown>;
    const expectedPath = mutate(malformed);
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.issues).toContainEqual({
        code: 'NON_DENSE_ARRAY',
        path: expectedPath,
        message: 'Array must expose every dense index',
      });
    }
  });

  it('inspects private zones in identity-map order when turn order is unreadable', () => {
    const malformed = state('upkeep') as Record<string, unknown>;
    const turnOrder = malformed.turnOrder as object;
    malformed.turnOrder = new Proxy(turnOrder, { ownKeys: () => { throw new Error('trap'); } });
    const zonesByPlayer = malformed.zonesByPlayer as Record<string, unknown>;
    const p1 = zonesByPlayer.P1 as Record<string, unknown>;
    p1.library = hideArrayIndex(['c1'], 0);

    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first).toEqual({
      kind: 'rejected',
      issues: [
        { code: 'INVALID_DESCRIPTOR', path: '/turnOrder', message: 'Array inspection is not safe' },
        { code: 'NON_DENSE_ARRAY', path: '/zonesByPlayer/P1/library/0', message: 'Array must expose every dense index' },
      ],
    });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it.each([
    ['attackers', '/combat/attackers', '/combat/blockers/0', (combat: Record<string, unknown>): void => {
      combat.attackers = new Proxy([], { ownKeys: (): never => { throw new Error('trap'); } });
      combat.blockers = [null];
    }],
    ['blockers', '/combat/blockers', '/combat/attackers/0', (combat: Record<string, unknown>): void => {
      combat.attackers = [null];
      combat.blockers = new Proxy([], { ownKeys: (): never => { throw new Error('trap'); } });
    }],
  ] as const)('keeps inspecting the sibling combat array when %s is unreadable', (_label, trappedPath, siblingPath, mutate) => {
    const malformed = state('combat') as Record<string, unknown>;
    const combat = combatForTests('declareBlockers');
    mutate(combat);
    malformed.combat = combat;

    const first = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    const second = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(first).toEqual(second);
    expect(first.kind).toBe('rejected');
    expect(issuePaths(first)).toEqual(expect.arrayContaining([
      '/combat',
      trappedPath,
      siblingPath,
    ]));
  });

  it('collects stale attacker incarnation before unsupported battle target rejection', () => {
    const malformed = state('combat') as Record<string, unknown>;
    const combat = combatForTests('declareAttackers');
    combat.attackers = [{
      cardId: 'c1',
      objectId: 'c1:9',
      controllerId: 'P1',
      target: { type: 'battle', cardId: 'battle-1' },
    }];
    malformed.combat = combat;

    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result).toEqual({
      kind: 'rejected',
      issues: [
        {
          code: 'STALE_SOLO_REFERENCE',
          path: '/combat/attackers/0/objectId',
          message: 'Solo combat references a stale object incarnation',
        },
        {
          code: 'UNSUPPORTED_COMBAT_TARGET',
          path: '/combat/attackers/0/target',
          message: 'Battle targets are not transformable in V1',
        },
      ],
    });
  });

  it('collects independent issues when zones are hostile', () => {
    const malformed = state('combat') as Record<string, unknown>;
    const zones = malformed.zones as object;
    malformed.zones = new Proxy(zones, { getPrototypeOf: () => { throw new Error('trap'); } });
    malformed.activePlayerId = 'missing-active';
    malformed.turn = 0;
    malformed.combat = { turn: 'four', step: 'combatDamage' };
    malformed.commanders = [{ cardId: 'c1', castCount: -1 }];

    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    expect(issuePaths(result)).toEqual(expect.arrayContaining([
      '',
      '/activePlayerId',
      '/combat/step',
      '/combat/turn',
      '/commanders/0/castCount',
      '/turn',
      '/zones/battlefield',
      '/zones/command',
      '/zones/exile',
      '/zones/stack',
    ]));
  });

  it('does not let a trapping turn order suppress independent domains', () => {
    const malformed = state('combat') as Record<string, unknown>;
    const turnOrder = malformed.turnOrder as object;
    malformed.turnOrder = new Proxy(turnOrder, { ownKeys: () => { throw new Error('trap'); } });
    malformed.activePlayerId = 'missing-active';
    malformed.turn = 0;
    malformed.combat = { turn: 0, step: 'combatDamage' };
    malformed.commanders = [{ cardId: 'c1', castCount: -1 }];

    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    expect(issuePaths(result)).toEqual(expect.arrayContaining([
      '/activePlayerId',
      '/combat/step',
      '/combat/turn',
      '/commanders/0/castCount',
      '/turn',
      '/turnOrder',
    ]));
  });

  it.each([
    ['string', 'four'],
    ['zero', 0],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['mismatch', 5],
  ] as const)('rejects a combat turn that is %s at /combat/turn', (_label, combatTurn) => {
    const malformed = state('combat') as Record<string, unknown>;
    malformed.combat = { ...combatForTests(), turn: combatTurn };
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result).toEqual({
      kind: 'rejected',
      issues: [{
        code: 'INVALID_SOURCE',
        path: '/combat/turn',
        message: 'Combat turn must be a positive safe integer matching Solo turn',
      }],
    });
  });

  it('preserves original identity-map indices after sparse invalid entries', () => {
    const sparsePlayers: unknown[] = [];
    sparsePlayers.length = 3;
    sparsePlayers[1] = { soloPlayerId: 'P2', corePlayerId: 'P2', extra: true };
    sparsePlayers[2] = { soloPlayerId: 'P3', corePlayerId: 'P3', extra: true };
    const result = validateSoloCoreIdentityMapV1({
      kind: 'solo-core-identity-map-v1',
      schemaVersion: 1,
      players: sparsePlayers,
      physicalCards,
      objects,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map(({ path, code }) => [path, code])).toEqual([
        ['/players/0', 'NON_DENSE_ARRAY'],
        ['/players/1/extra', 'UNKNOWN_FIELD'],
        ['/players/2/extra', 'UNKNOWN_FIELD'],
      ]);
    }
  });

  it.each([
    ['private zone', (malformed: Record<string, unknown>): string => {
      const zonesByPlayer = malformed.zonesByPlayer as Record<string, unknown>;
      const p1 = zonesByPlayer.P1 as Record<string, unknown>;
      const library = p1.library as unknown[];
      library.length = 2;
      return '/zonesByPlayer/P1/library/1';
    }],
    ['shared zone', (malformed: Record<string, unknown>): string => {
      const zones = malformed.zones as Record<string, unknown>;
      const battlefield = zones.battlefield as unknown[] & Record<string, unknown>;
      Object.defineProperty(battlefield, 'extra', { enumerable: true, value: 'c1' });
      return '/zones/battlefield/extra';
    }],
    ['combat attackers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareAttackers');
      const attackers = combat.attackers as unknown[] & Record<string, unknown>;
      Object.defineProperty(attackers, 'extra', { enumerable: true, value: 'x' });
      malformed.combat = combat;
      return '/combat/attackers/extra';
    }],
    ['combat blockers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      const blockers = combat.blockers as unknown[] & Record<string, unknown>;
      Object.defineProperty(blockers, 'extra', { enumerable: true, value: 'x' });
      malformed.combat = combat;
      return '/combat/blockers/extra';
    }],
    ['blocking assignments', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      const blocking = ['c1'] as unknown[] & Record<string, unknown>;
      Object.defineProperty(blocking, 'extra', { enumerable: true, value: 'x' });
      combat.blockers = [{ cardId: 'c2', objectId: 'c2:0', controllerId: 'P2', blocking }];
      malformed.combat = combat;
      return '/combat/blockers/0/blocking/extra';
    }],
    ['commanders', (malformed: Record<string, unknown>): string => {
      const commanders = malformed.commanders as unknown[] & Record<string, unknown>;
      Object.defineProperty(commanders, 'extra', { enumerable: true, value: 'x' });
      return '/commanders/extra';
    }],
    ['turn order', (malformed: Record<string, unknown>): string => {
      const turnOrder = malformed.turnOrder as unknown[] & Record<string, unknown>;
      Object.defineProperty(turnOrder, 'extra', { enumerable: true, value: 'x' });
      return '/turnOrder/extra';
    }],
  ] as const)('rejects an extra property on the %s source array', (_label, mutate: (malformed: Record<string, unknown>) => string) => {
    const malformed = state('upkeep') as Record<string, unknown>;
    const expectedPath = mutate(malformed);
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    expect(issuePaths(result)).toContain(expectedPath);
  });

  it.each([
    ['private zone', (malformed: Record<string, unknown>): string => {
      const zonesByPlayer = malformed.zonesByPlayer as Record<string, unknown>;
      const p1 = zonesByPlayer.P1 as Record<string, unknown>;
      const library = p1.library as unknown[];
      library.length = 2;
      return '/zonesByPlayer/P1/library/1';
    }],
    ['shared zone', (malformed: Record<string, unknown>): string => {
      const zones = malformed.zones as Record<string, unknown>;
      const battlefield = zones.battlefield as unknown[];
      battlefield.length = 1;
      return '/zones/battlefield/0';
    }],
    ['combat attackers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareAttackers');
      const attackers = combat.attackers as unknown[];
      attackers.length = 1;
      malformed.combat = combat;
      return '/combat/attackers/0';
    }],
    ['combat blockers', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      const blockers = combat.blockers as unknown[];
      blockers.length = 1;
      malformed.combat = combat;
      return '/combat/blockers/0';
    }],
    ['blocking assignments', (malformed: Record<string, unknown>): string => {
      const combat = combatForTests('declareBlockers');
      const blocking = ['c1'] as unknown[];
      blocking.length = 2;
      combat.blockers = [{ cardId: 'c2', objectId: 'c2:0', controllerId: 'P2', blocking }];
      malformed.combat = combat;
      return '/combat/blockers/0/blocking/1';
    }],
    ['commanders', (malformed: Record<string, unknown>): string => {
      const commanders = malformed.commanders as unknown[];
      commanders.length = 1;
      return '/commanders/0';
    }],
    ['turn order', (malformed: Record<string, unknown>): string => {
      const turnOrder = malformed.turnOrder as unknown[];
      turnOrder.length = 5;
      return '/turnOrder/4';
    }],
  ] as const)('rejects a sparse entry on the %s source array', (_label, mutate: (malformed: Record<string, unknown>) => string) => {
    const malformed = state('upkeep') as Record<string, unknown>;
    const expectedPath = mutate(malformed);
    const result = projectSoloCompatibilityViewV1(malformed, createSoloCoreIdentityMapV1(mapInput()));
    expect(result.kind).toBe('rejected');
    expect(issuePaths(result)).toContain(expectedPath);
  });

  it('returns deterministic fresh frozen evidence without mutating caller-owned data', () => {
    const malformed = state('combat') as Record<string, unknown>;
    malformed.turn = 0;
    malformed.combat = { ...combatForTests(), turn: 0 };
    const identityInput = mapInput();
    const identityBefore = JSON.stringify(identityInput);
    const before = JSON.stringify(malformed);
    const first = projectSoloCompatibilityViewV1(malformed, identityInput);
    const second = projectSoloCompatibilityViewV1(malformed, identityInput);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(JSON.stringify(malformed)).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.kind === 'rejected') {
      expect(Object.isFrozen(first.issues)).toBe(true);
      expect(first.issues.every((current) => Object.isFrozen(current))).toBe(true);
    }
    expect(JSON.stringify(identityInput)).toBe(identityBefore);
  });
});
