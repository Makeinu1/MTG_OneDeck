import { describe, expect, it } from 'vitest';
import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  CoreCombatContextAdditionErrorV1,
  CoreCombatContextCreationErrorV1,
  CoreCombatContextReconciliationErrorV1,
  CoreCombatContextStepErrorV1,
  addCoreCombatContextAttackV1,
  addCoreCombatContextBlockV1,
  createCoreCombatContextV1,
  reconcileCoreCombatContextForPlayerExitV1,
  setCoreCombatContextStepV1,
} from '../combat/combatContextV1';

const A1 = 'card-a:0' as CoreObjectId;
const A2 = 'card-b:0' as CoreObjectId;
const B1 = 'card-c:0' as CoreObjectId;
const B2 = 'card-d:0' as CoreObjectId;
const P1 = 'player-1' as CorePlayerId;
const P2 = 'player-2' as CorePlayerId;
const P3 = 'player-3' as CorePlayerId;
const P4 = 'player-4' as CorePlayerId;
const P9 = 'player-9' as CorePlayerId;

const emptyContext = () => ({
  combatId: 'combat-1',
  turnNumber: 7,
  step: 'declare-attackers' as const,
  attackingPlayerId: P1,
  defendingPlayerIds: [P3, P2, P4],
  attacks: [],
  blocks: [],
});

function attack(attackerObjectId: CoreObjectId, defendingPlayerId: CorePlayerId) {
  return { attackerObjectId, attackerControllerPlayerId: P1, defendingPlayerId };
}

function block(
  blockerObjectId: CoreObjectId,
  attackedObjectId: CoreObjectId,
  defendingPlayerId: CorePlayerId,
) {
  return {
    blockerObjectId,
    blockerControllerPlayerId: defendingPlayerId,
    attackedObjectId,
    defendingPlayerId,
  };
}

function expectFrozenContext(context: ReturnType<typeof createCoreCombatContextV1>): void {
  expect(Object.isFrozen(context)).toBe(true);
  expect(Object.isFrozen(context.defendingPlayerIds)).toBe(true);
  expect(Object.isFrozen(context.attacks)).toBe(true);
  expect(Object.isFrozen(context.blocks)).toBe(true);
  expect(context.attacks.every(Object.isFrozen)).toBe(true);
  expect(context.blocks.every(Object.isFrozen)).toBe(true);
}

function expectTypedFrozenError(action: () => unknown, errorType: typeof CoreCombatContextCreationErrorV1): void {
  expect(action).toThrow(errorType);
  try {
    action();
    expect.fail('expected a typed error');
  } catch (error) {
    expect(error).toBeInstanceOf(errorType);
    expect(Object.isFrozen(error)).toBe(true);
    if ('issues' in (error as object)) {
      const issues = (error as { readonly issues: readonly unknown[] }).issues;
      expect(Object.isFrozen(issues)).toBe(true);
      expect(issues.every(Object.isFrozen)).toBe(true);
    }
  }
}

describe('combatContextV1', () => {
  it('is the unified ordered structural combat authority', () => {
    const initial = createCoreCombatContextV1(emptyContext());
    const withAttacks = addCoreCombatContextAttackV1(initial, attack(A1, P3));
    const withSecondAttack = addCoreCombatContextAttackV1(withAttacks, attack(A2, P2));
    const blockerStep = setCoreCombatContextStepV1(withSecondAttack, 'declare-blockers');
    const withFirstBlock = addCoreCombatContextBlockV1(blockerStep, block(B1, A1, P3));
    const final = addCoreCombatContextBlockV1(withFirstBlock, block(B2, A2, P2));

    expect(final).toEqual({
      combatId: 'combat-1',
      turnNumber: 7,
      step: 'declare-blockers',
      attackingPlayerId: P1,
      defendingPlayerIds: [P3, P2, P4],
      attacks: [attack(A1, P3), attack(A2, P2)],
      blocks: [block(B1, A1, P3), block(B2, A2, P2)],
    });
    expectFrozenContext(final);
  });

  it('allows one blocker to block multiple distinct attackers', () => {
    const initial = createCoreCombatContextV1({
      ...emptyContext(),
      attacks: [attack(A1, P3), attack(A2, P3)],
      step: 'declare-blockers',
    });
    const result = addCoreCombatContextBlockV1(initial, block(B1, A1, P3));
    const final = addCoreCombatContextBlockV1(result, block(B1, A2, P3));
    expect(final.blocks).toEqual([block(B1, A1, P3), block(B1, A2, P3)]);
  });

  it('rejects constructor reuse of one blocker across different defenders', () => {
    expect(() => createCoreCombatContextV1({
      ...emptyContext(),
      attacks: [attack(A1, P3), attack(A2, P2)],
      step: 'declare-blockers',
      blocks: [block(B1, A1, P3), block(B1, A2, P2)],
    })).toThrow(CoreCombatContextCreationErrorV1);

    try {
      createCoreCombatContextV1({
        ...emptyContext(),
        attacks: [attack(A1, P3), attack(A2, P2)],
        step: 'declare-blockers',
        blocks: [block(B1, A1, P3), block(B1, A2, P2)],
      });
      expect.fail('expected a creation error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCombatContextCreationErrorV1);
      if (error instanceof CoreCombatContextCreationErrorV1) {
        expect(error.issues.map((current) => `${current.path}|${current.code}`)).toEqual([
          '/blocks/1/blockerControllerPlayerId|BLOCK_CONTROLLER_MISMATCH',
          '/blocks/1/defendingPlayerId|BLOCK_DEFENDER_MISMATCH',
        ]);
      }
    }
  });

  it('rejects add-path reuse of one blocker across different defenders', () => {
    const initial = createCoreCombatContextV1({
      ...emptyContext(),
      attacks: [attack(A1, P3), attack(A2, P2)],
      step: 'declare-blockers',
      blocks: [block(B1, A1, P3)],
    });

    try {
      addCoreCombatContextBlockV1(initial, block(B1, A2, P2));
      expect.fail('expected an addition error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCombatContextAdditionErrorV1);
      if (error instanceof CoreCombatContextAdditionErrorV1) {
        expect(error.issues.map((current) => `${current.path}|${current.code}`)).toEqual([
          '/blockerControllerPlayerId|BLOCK_CONTROLLER_MISMATCH',
          '/defendingPlayerId|BLOCK_DEFENDER_MISMATCH',
        ]);
      }
    }
  });

  it('enforces all participant relations and step gates', () => {
    expect(() => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: [P1, P2] }))
      .toThrow(CoreCombatContextCreationErrorV1);
    expect(() => createCoreCombatContextV1({ ...emptyContext(), turnNumber: 0 }))
      .toThrow(CoreCombatContextCreationErrorV1);
    expect(() => createCoreCombatContextV1({ ...emptyContext(), turnNumber: Number.MAX_SAFE_INTEGER + 1 }))
      .toThrow(CoreCombatContextCreationErrorV1);
    expect(() => addCoreCombatContextAttackV1(createCoreCombatContextV1(emptyContext()), {
      ...attack(A1, P2), attackerControllerPlayerId: P2,
    })).toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => addCoreCombatContextAttackV1(createCoreCombatContextV1(emptyContext()), attack(A1, P1)))
      .toThrow(CoreCombatContextAdditionErrorV1);

    const attacked = addCoreCombatContextAttackV1(createCoreCombatContextV1(emptyContext()), attack(A1, P3));
    expect(() => addCoreCombatContextAttackV1(attacked, attack(A1, P2))).toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => addCoreCombatContextAttackV1(attacked, attack(A2, 'player-9' as CorePlayerId)))
      .toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => addCoreCombatContextBlockV1(attacked, block(B1, A1, P3)))
      .toThrow(CoreCombatContextAdditionErrorV1);

    const blockers = setCoreCombatContextStepV1(attacked, 'declare-blockers');
    expect(() => addCoreCombatContextAttackV1(blockers, attack(A2, P2))).toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => addCoreCombatContextBlockV1(blockers, block(B1, A2, P3))).toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => addCoreCombatContextBlockV1(blockers, {
      ...block(B1, A1, P3), blockerControllerPlayerId: P2,
    })).toThrow(CoreCombatContextAdditionErrorV1);
    const blocked = addCoreCombatContextBlockV1(blockers, block(B1, A1, P3));
    expect(() => addCoreCombatContextBlockV1(blocked, block(B1, A1, P3))).toThrow(CoreCombatContextAdditionErrorV1);
    expect(() => setCoreCombatContextStepV1(blocked, 'declare-attackers')).toThrow(CoreCombatContextStepErrorV1);
  });

  it('rejects sparse, accessor, non-enumerable, symbol, and extra array properties without getters', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(() => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: sparse }))
      .toThrow(CoreCombatContextCreationErrorV1);

    let accessed = false;
    const accessorArray = [P2];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get: () => {
        accessed = true;
        return P2;
      },
    });
    expect(() => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: accessorArray }))
      .toThrow(CoreCombatContextCreationErrorV1);
    expect(accessed).toBe(false);

    const hidden = [P2];
    Object.defineProperty(hidden, '0', { enumerable: false, value: P2 });
    expect(() => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: hidden }))
      .toThrow(CoreCombatContextCreationErrorV1);

    const symbol = Symbol('extra');
    const extra = [P2];
    Object.defineProperty(extra, 'extra', { enumerable: true, value: true });
    Object.defineProperty(extra, symbol, { enumerable: true, value: true });
    expect(() => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: extra }))
      .toThrow(CoreCombatContextCreationErrorV1);

    let recordAccessed = false;
    const record = { ...emptyContext() };
    Object.defineProperty(record, 'combatId', {
      enumerable: true,
      get: () => {
        recordAccessed = true;
        return 'combat-1';
      },
    });
    expect(() => createCoreCombatContextV1(record)).toThrow(CoreCombatContextCreationErrorV1);
    expect(recordAccessed).toBe(false);
  });

  it('rejects a maximum-length sparse array without scanning its declared length', () => {
    const sparse: unknown[] = [];
    sparse.length = 0xffffffff;
    expectTypedFrozenError(
      () => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: sparse }),
      CoreCombatContextCreationErrorV1,
    );
  });

  it('turns prototype, ownKeys, and descriptor proxy traps into deterministic frozen errors', () => {
    const handlers: ProxyHandler<object>[] = [
      { getPrototypeOf: () => { throw new Error('prototype trap'); } },
      { ownKeys: () => { throw new Error('ownKeys trap'); } },
      { getOwnPropertyDescriptor: () => { throw new Error('descriptor trap'); } },
    ];
    for (const handler of handlers) {
      expectTypedFrozenError(
        () => createCoreCombatContextV1(new Proxy(emptyContext(), handler)),
        CoreCombatContextCreationErrorV1,
      );
    }

    const arrayTrap = new Proxy([P2], { getPrototypeOf: () => { throw new Error('array prototype trap'); } });
    expectTypedFrozenError(
      () => createCoreCombatContextV1({ ...emptyContext(), defendingPlayerIds: arrayTrap }),
      CoreCombatContextCreationErrorV1,
    );
  });

  it('sorts issues by code-unit path then code and does not mutate rejected input', () => {
    const malformed = {
      ...emptyContext(),
      turnNumber: 0,
      defendingPlayerIds: [P2, P2],
      attacks: [{ attackerObjectId: 'bad id', attackerControllerPlayerId: P2, defendingPlayerId: P9 }],
    };
    const before = structuredClone(malformed);
    try {
      createCoreCombatContextV1(malformed);
      expect.fail('expected a creation error');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreCombatContextCreationErrorV1);
      if (error instanceof CoreCombatContextCreationErrorV1) {
        expect(error.issues.map((current) => `${current.path}|${current.code}`)).toEqual([
          '/attacks/0/attackerObjectId|INVALID_ID',
          '/defendingPlayerIds/1|DUPLICATE_DEFENDER',
          '/turnNumber|INVALID_TURN_NUMBER',
        ]);
      }
    }
    expect(malformed).toEqual(before);
  });

  it('reconciles player exit atomically, preserving surviving declaration order', () => {
    const initial = createCoreCombatContextV1({
      ...emptyContext(),
      attacks: [attack(A1, P2), attack(A2, P3)],
      step: 'declare-blockers',
      blocks: [block(B1, A1, P2), block(B2, A2, P3)],
    });
    const input = { exitingPlayerId: P2, participantObjectIdsToClear: [B2] };
    const before = structuredClone(input);
    const result = reconcileCoreCombatContextForPlayerExitV1(initial, input);

    expect(result).toEqual({
      combatId: 'combat-1',
      turnNumber: 7,
      step: 'declare-blockers',
      attackingPlayerId: P1,
      defendingPlayerIds: [P3, P4],
      attacks: [attack(A2, P3)],
      blocks: [],
    });
    expect(input).toEqual(before);
    expect(result).not.toBe(initial);
    if (result !== null) expectFrozenContext(result);
    expect(reconcileCoreCombatContextForPlayerExitV1(initial, {
      exitingPlayerId: P1,
      participantObjectIdsToClear: [],
    })).toBeNull();
    expect(() => reconcileCoreCombatContextForPlayerExitV1(initial, {
      exitingPlayerId: P2,
      participantObjectIdsToClear: [B1, B1],
    })).toThrow(CoreCombatContextReconciliationErrorV1);

    const clearedAttacker = reconcileCoreCombatContextForPlayerExitV1(initial, {
      exitingPlayerId: P4,
      participantObjectIdsToClear: [A1],
    });
    expect(clearedAttacker?.attacks).toEqual([attack(A2, P3)]);
    expect(clearedAttacker?.blocks).toEqual([block(B2, A2, P3)]);
  });

  it('keeps the public value structural and explicitly defers damage, SBA, turn, and priority', () => {
    const context = createCoreCombatContextV1(emptyContext());
    expect(Object.keys(context)).toEqual([
      'combatId', 'turnNumber', 'step', 'attackingPlayerId', 'defendingPlayerIds', 'attacks', 'blocks',
    ]);
    expect(JSON.stringify(context)).not.toMatch(/damage|state.?based|priority|automatic|network|session|connection/i);
    expect(context).not.toHaveProperty('damageAssignment');
    expect(context).not.toHaveProperty('stateBasedActions');
    expect(context).not.toHaveProperty('priorityHolderPlayerId');
  });
});
