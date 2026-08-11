import { describe, expect, it } from 'vitest';

import {
  applyCorePlayerExitV1,
  corePlayerLifecycleExitCauseV1,
  corePlayerLifecycleStatusV1,
  createCorePlayerLifecycleStateV1,
  CorePlayerLifecycleErrorV1,
} from '../player-lifecycle/playerLifecycleV1';

type Raw = Record<string, unknown>;

const activeRoster = (): Raw => ({
  players: [
    { playerId: 'P3', status: 'active', exitCause: null },
    { playerId: 'P1', status: 'active', exitCause: null },
    { playerId: 'P4', status: 'active', exitCause: null },
    { playerId: 'P2', status: 'active', exitCause: null },
  ],
});

function expectLifecycleError(action: () => unknown): CorePlayerLifecycleErrorV1 {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CorePlayerLifecycleErrorV1);
    if (error instanceof CorePlayerLifecycleErrorV1) return error;
  }
  throw new Error('expected CorePlayerLifecycleErrorV1');
}

function assertDeepFrozen(value: unknown): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) assertDeepFrozen((value as Raw)[key]);
}

describe('Core player lifecycle V1', () => {
  it('normalizes exact entries, preserves roster order, and distinguishes status from cause', () => {
    const state = createCorePlayerLifecycleStateV1(activeRoster());
    expect(state.players.map((entry) => entry.playerId)).toEqual(['P3', 'P1', 'P4', 'P2']);
    expect(state.players[0]).toEqual({ playerId: 'P3', status: 'active', exitCause: null });
    expect(Object.keys(state.players[0])).toEqual(['playerId', 'status', 'exitCause']);

    const conceded = applyCorePlayerExitV1(state, { playerId: 'P1', cause: 'concession' });
    const defeated = applyCorePlayerExitV1(conceded, { playerId: 'P2', cause: 'defeat' });
    expect(defeated.players).toEqual([
      { playerId: 'P3', status: 'active', exitCause: null },
      { playerId: 'P1', status: 'exited', exitCause: 'concession' },
      { playerId: 'P4', status: 'active', exitCause: null },
      { playerId: 'P2', status: 'exited', exitCause: 'defeat' },
    ]);
    expect(corePlayerLifecycleStatusV1(defeated, 'P1')).toBe('exited');
    expect(corePlayerLifecycleStatusV1(defeated, 'P3')).toBe('active');
    expect(corePlayerLifecycleExitCauseV1(defeated, 'P1')).toBe('concession');
    expect(corePlayerLifecycleExitCauseV1(defeated, 'P2')).toBe('defeat');
    expect(corePlayerLifecycleExitCauseV1(defeated, 'P3')).toBeNull();
    assertDeepFrozen(defeated);
    expect(JSON.parse(JSON.stringify(defeated))).toEqual(defeated);
  });

  it('accepts valid pre-exited entries and rejects status/cause mismatches', () => {
    const state = createCorePlayerLifecycleStateV1({
      players: [{ playerId: 'P1', status: 'exited', exitCause: 'defeat' }],
    });
    expect(corePlayerLifecycleStatusV1(state, 'P1')).toBe('exited');
    expect(() => applyCorePlayerExitV1(state, { playerId: 'P1', cause: 'concession' }))
      .toThrow(CorePlayerLifecycleErrorV1);

    for (const entry of [
      { playerId: 'P1', status: 'active', exitCause: 'defeat' },
      { playerId: 'P1', status: 'exited', exitCause: null },
    ]) {
      expectLifecycleError(() => createCorePlayerLifecycleStateV1({ players: [entry] }));
    }
  });

  it('rejects duplicates, unknown players, invalid requests, and extra keys atomically', () => {
    const duplicate = activeRoster();
    duplicate.players = [
      { playerId: 'P1', status: 'active', exitCause: null },
      { playerId: 'P1', status: 'active', exitCause: null },
    ];
    expectLifecycleError(() => createCorePlayerLifecycleStateV1(duplicate));

    const state = createCorePlayerLifecycleStateV1(activeRoster());
    const before = JSON.stringify(state);
    expectLifecycleError(() => applyCorePlayerExitV1(state, { playerId: 'P9', cause: 'defeat' }));
    expectLifecycleError(() => applyCorePlayerExitV1(state, { playerId: 'P1', cause: 'unknown' }));
    expectLifecycleError(() => applyCorePlayerExitV1(state, { playerId: 'P1', cause: 'defeat', extra: true }));
    expect(JSON.stringify(state)).toBe(before);
    expectLifecycleError(() => corePlayerLifecycleStatusV1(state, 'P9'));
  });

  it('rejects sparse, accessor, symbol, non-index, and trap-backed records without invoking getters', () => {
    const sparse: Raw[] = [];
    sparse.length = 1;
    expectLifecycleError(() => createCorePlayerLifecycleStateV1({ players: sparse }));

    let getterCalled = false;
    const accessorEntry = {} as Raw;
    Object.defineProperty(accessorEntry, 'playerId', {
      enumerable: true,
      get: () => { getterCalled = true; return 'P1'; },
    });
    Object.assign(accessorEntry, { status: 'active', exitCause: null });
    expectLifecycleError(() => createCorePlayerLifecycleStateV1({ players: [accessorEntry] }));
    expect(getterCalled).toBe(false);

    const symbol = Symbol('unexpected');
    const symbolRoot: Raw = { players: activeRoster().players };
    Object.defineProperty(symbolRoot, symbol, { enumerable: true, value: true });
    expectLifecycleError(() => createCorePlayerLifecycleStateV1(symbolRoot));

    const nonIndex = activeRoster().players as Raw[];
    Object.defineProperty(nonIndex, 'extra', { enumerable: true, value: true });
    expectLifecycleError(() => createCorePlayerLifecycleStateV1({ players: nonIndex }));

    const proxy = new Proxy(activeRoster(), { ownKeys: () => { throw new Error('ownKeys trap'); } });
    const error = expectLifecycleError(() => createCorePlayerLifecycleStateV1(proxy));
    expect(error.issues.every((current) => current.path === '')).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.issues)).toBe(true);
  });

  it('rejects a maximum-length sparse players array promptly with a frozen typed error', () => {
    const sparse: Raw[] = [];
    sparse.length = 0xffffffff;

    const error = expectLifecycleError(() => createCorePlayerLifecycleStateV1({ players: sparse }));
    expect(error.issues).toEqual([{
      code: 'INVALID_TYPE',
      path: '/players/0',
      message: 'Array entries must be dense enumerable data properties',
    }]);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.issues)).toBe(true);
  });

  it('sorts equivalent issues deterministically by code-unit path then code', () => {
    const first = { players: [{ playerId: '', status: 'wrong', exitCause: 'wrong' }] };
    const second = { players: [{ exitCause: 'wrong', status: 'wrong', playerId: '' }] };
    const firstError = expectLifecycleError(() => createCorePlayerLifecycleStateV1(first));
    const secondError = expectLifecycleError(() => createCorePlayerLifecycleStateV1(second));
    expect(firstError.issues).toEqual(secondError.issues);
    expect(firstError.issues).toEqual([...firstError.issues].sort((left, right) => (
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
    )));
  });
});
