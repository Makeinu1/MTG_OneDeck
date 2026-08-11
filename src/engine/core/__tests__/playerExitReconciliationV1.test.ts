import { describe, expect, it } from 'vitest';

import {
  CorePlayerExitReconciliationErrorV1,
  createCorePlayerExitReferenceBundleV1,
  reconcileCorePlayerExitV1,
} from '../player-lifecycle/playerExitReconciliationV1';

type Raw = Record<string, unknown>;

const lifecycle = (): Raw => ({
  players: [
    { playerId: 'P1', status: 'active', exitCause: null },
    { playerId: 'P2', status: 'active', exitCause: null },
    { playerId: 'P3', status: 'active', exitCause: null },
    { playerId: 'P4', status: 'active', exitCause: null },
  ],
});

const bundle = (): Raw => ({
  turnOrder: ['P1', 'P2', 'P3', 'P4'],
  eligiblePlayerIds: ['P4', 'P2', 'P3'],
  activePlayerId: 'P1',
  priorityHolderPlayerId: 'P1',
  ownedObjectIds: ['CardA:0', '@token:TokenA:0', '@spell-copy:OwnedCopy'],
  controlledObjectIds: [
    'CardB:0',
    'CardA:0',
    '@triggered-ability:StackA',
    '@activated-ability:AbilityA',
  ],
  nonCardStackObjectIds: [
    '@triggered-ability:StackA',
    '@spell-copy:OwnedCopy',
    '@activated-ability:StackB',
  ],
  combatParticipantObjectIds: ['CardC:0', '@token:TokenC:1'],
  controlEffectIds: ['control-z', 'control-a'],
  decisionAuthorityIds: ['authority-z', 'authority-a'],
  searchSessionIds: ['search-z', 'search-a'],
});

const request = (): Raw => ({ playerId: 'P1', cause: 'concession' });

function expectReconciliationError(action: () => unknown): CorePlayerExitReconciliationErrorV1 {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CorePlayerExitReconciliationErrorV1);
    if (error instanceof CorePlayerExitReconciliationErrorV1) return error;
  }
  throw new Error('expected CorePlayerExitReconciliationErrorV1');
}

function assertDeepFrozen(value: unknown): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) assertDeepFrozen((value as Raw)[key]);
}

describe('Core player exit reconciliation V1', () => {
  it('validates three inputs atomically and returns exact ordered disjoint cleanup directives', () => {
    const stateInput = lifecycle();
    const bundleInput = bundle();
    const requestInput = request();
    const before = JSON.stringify([stateInput, bundleInput, requestInput]);
    const result = reconcileCorePlayerExitV1(stateInput, bundleInput, requestInput);

    expect(Object.keys(result)).toEqual([
      'lifecycleState',
      'survivingTurnOrder',
      'activePlayerAfterExit',
      'priorityHandoffPlayerId',
      'ownedObjectsToLeaveGame',
      'controlEffectIdsToEnd',
      'nonCardStackObjectsToCease',
      'controlledObjectsToExile',
      'combatParticipantObjectIdsToClear',
      'decisionAuthorityIdsToClear',
      'searchSessionIdsToClose',
    ]);
    expect(result.lifecycleState.players[0]).toEqual({ playerId: 'P1', status: 'exited', exitCause: 'concession' });
    expect(result.survivingTurnOrder).toEqual(['P2', 'P3', 'P4']);
    expect(result.activePlayerAfterExit).toBeNull();
    expect(result.priorityHandoffPlayerId).toBe('P2');
    expect(result.ownedObjectsToLeaveGame).toEqual(['CardA:0', '@token:TokenA:0', '@spell-copy:OwnedCopy']);
    expect(result.controlEffectIdsToEnd).toEqual(['control-z', 'control-a']);
    expect(result.nonCardStackObjectsToCease).toEqual(['@triggered-ability:StackA', '@activated-ability:StackB']);
    expect(result.controlledObjectsToExile).toEqual(['CardB:0', '@activated-ability:AbilityA']);
    expect(result.combatParticipantObjectIdsToClear).toEqual(['CardC:0', '@token:TokenC:1']);
    expect(result.decisionAuthorityIdsToClear).toEqual(['authority-z', 'authority-a']);
    expect(result.searchSessionIdsToClose).toEqual(['search-z', 'search-a']);
    expect(Object.keys(createCorePlayerExitReferenceBundleV1(bundle()))).not.toContain('exitingPlayerId');
    expect(JSON.stringify([stateInput, bundleInput, requestInput])).toBe(before);
    assertDeepFrozen(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('keeps active holder, uses cyclic turn order for priority, and handles no eligible player', () => {
    const reference = bundle();
    reference.activePlayerId = 'P3';
    reference.priorityHolderPlayerId = 'P1';
    expect(reconcileCorePlayerExitV1(lifecycle(), reference, request())).toMatchObject({
      activePlayerAfterExit: 'P3',
      priorityHandoffPlayerId: 'P2',
    });

    const noEligible = bundle();
    noEligible.eligiblePlayerIds = [];
    expect(reconcileCorePlayerExitV1(lifecycle(), noEligible, request()).priorityHandoffPlayerId).toBeNull();

    const unchangedPriority = bundle();
    unchangedPriority.priorityHolderPlayerId = 'P4';
    expect(reconcileCorePlayerExitV1(lifecycle(), unchangedPriority, request()).priorityHandoffPlayerId).toBe('P4');
  });

  it('rejects every lifecycle/reference relation that would leave an invalid survivor', () => {
    const cases: Array<readonly [string, () => void]> = [
      ['turn order missing exiting', () => {
        const value = bundle();
        value.turnOrder = ['P2', 'P3', 'P4'];
        reconcileCorePlayerExitV1(lifecycle(), value, request());
      }],
      ['eligible contains exiting', () => {
        const value = bundle();
        value.eligiblePlayerIds = ['P1', 'P2'];
        reconcileCorePlayerExitV1(lifecycle(), value, request());
      }],
      ['eligible outside turn order', () => {
        const value = bundle();
        value.eligiblePlayerIds = ['P9'];
        reconcileCorePlayerExitV1(lifecycle(), value, request());
      }],
      ['active outside eligible or exiting', () => {
        const value = bundle();
        value.activePlayerId = 'P9';
        reconcileCorePlayerExitV1(lifecycle(), value, request());
      }],
      ['exited turn-order player', () => {
        const value = lifecycle();
        value.players = [
          { playerId: 'P1', status: 'active', exitCause: null },
          { playerId: 'P2', status: 'exited', exitCause: 'defeat' },
          { playerId: 'P3', status: 'active', exitCause: null },
          { playerId: 'P4', status: 'active', exitCause: null },
        ];
        reconcileCorePlayerExitV1(value, bundle(), request());
      }],
      ['request player not active', () => reconcileCorePlayerExitV1(lifecycle(), bundle(), { playerId: 'P2', cause: 'defeat' })],
    ];
    for (const [label, action] of cases) {
      expect(() => action(), label).toThrow(CorePlayerExitReconciliationErrorV1);
    }
  });

  it('accepts only canonical non-card stack objects and rejects card/token IDs', () => {
    for (const objectId of ['CardA:0', '@token:TokenA:0', '@unknown:StackA']) {
      const value = bundle();
      value.nonCardStackObjectIds = [objectId];
      expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(value));
    }
    const accepted = bundle();
    accepted.nonCardStackObjectIds = [
      '@spell-copy:CopyA',
      '@activated-ability:AbilityA',
      '@triggered-ability:TriggerA',
    ];
    expect(createCorePlayerExitReferenceBundleV1(accepted).nonCardStackObjectIds).toEqual(accepted.nonCardStackObjectIds);
  });

  it('rejects duplicate/sparse/accessor/non-index/symbol arrays and never invokes getters or proxy traps', () => {
    const duplicate = bundle();
    duplicate.turnOrder = ['P1', 'P1'];
    expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(duplicate));

    const sparse: string[] = [];
    sparse.length = 2;
    sparse[0] = 'P1';
    const sparseBundle = bundle();
    sparseBundle.turnOrder = sparse;
    expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(sparseBundle));

    let getterCalled = false;
    const getterArray: string[] = [];
    Object.defineProperty(getterArray, '0', {
      enumerable: true,
      get: () => { getterCalled = true; return 'P1'; },
    });
    Object.defineProperty(getterArray, 'length', { value: 1, writable: true });
    const getterBundle = bundle();
    getterBundle.turnOrder = getterArray;
    expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(getterBundle));
    expect(getterCalled).toBe(false);

    const extra = bundle();
    const extraArray = ['P1'];
    Object.defineProperty(extraArray, 'metadata', { enumerable: true, value: 'network' });
    extra.turnOrder = extraArray;
    expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(extra));

    const symbol = Symbol('unexpected');
    const symbolArray = ['P1'];
    Object.defineProperty(symbolArray, symbol, { enumerable: true, value: true });
    const symbolBundle = bundle();
    symbolBundle.turnOrder = symbolArray;
    expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(symbolBundle));

    const trapped = new Proxy(bundle(), { getPrototypeOf: () => { throw new Error('prototype trap'); } });
    const error = expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(trapped));
    expect(error.issues.every((current) => current.path === '')).toBe(true);
  });

  it('rejects a maximum-length sparse bundle array promptly with a frozen typed error', () => {
    const sparse: string[] = [];
    sparse.length = 0xffffffff;
    const value = bundle();
    value.turnOrder = sparse;

    const error = expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(value));
    expect(error.issues).toContainEqual({
      code: 'INVALID_TYPE',
      path: '/turnOrder/0',
      message: 'Array entries must be dense enumerable data properties',
    });
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.issues)).toBe(true);
  });

  it('accepts valid rule keys and rejects unsafe rule keys as INVALID_ID without mutating inputs', () => {
    const valid = bundle();
    const before = JSON.stringify(valid);
    const normalized = createCorePlayerExitReferenceBundleV1(valid);
    expect(normalized.controlEffectIds).toEqual(['control-z', 'control-a']);
    expect(normalized.decisionAuthorityIds).toEqual(['authority-z', 'authority-a']);
    expect(normalized.searchSessionIds).toEqual(['search-z', 'search-a']);
    expect(JSON.stringify(valid)).toBe(before);
    assertDeepFrozen(normalized);

    for (const field of ['controlEffectIds', 'decisionAuthorityIds', 'searchSessionIds'] as const) {
      for (const unsafeKey of ['constructor', '__proto__', 'prototype']) {
        const invalid = bundle();
        invalid[field] = [unsafeKey];
        const error = expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(invalid));
        expect(error.issues).toContainEqual(expect.objectContaining({
          code: 'INVALID_ID',
          path: `/${field}/0`,
        }));
      }
    }
  });

  it('sorts deterministic typed issues and rejects forbidden network metadata', () => {
    const first = bundle();
    first.connection = 'network';
    const second: Raw = { connection: 'network', ...bundle() };
    const firstError = expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(first));
    const secondError = expectReconciliationError(() => createCorePlayerExitReferenceBundleV1(second));
    expect(firstError.issues).toEqual(secondError.issues);
    expect(firstError.issues).toEqual([...firstError.issues].sort((left, right) => (
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
    )));

    const result = reconcileCorePlayerExitV1(lifecycle(), bundle(), request());
    const keys = Object.keys(result).concat(Object.keys(result.lifecycleState));
    expect(keys).not.toEqual(expect.arrayContaining(['disconnect', 'connection', 'transport', 'room', 'network']));
    expect(keys).toContain('searchSessionIdsToClose');
  });
});
