import { describe, expect, it } from 'vitest';

import {
  createModeNeutralCoreTurnLifecycleSliceV1,
  validateCoreTurnWindowV1,
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from '../turnLifecycleV1';
import type { CoreTurnWindowV1 } from '../turnLifecycleV1';
import type { CoreTurnPositionV1 } from '../turnPositionV1';

type Raw = Record<string, unknown>;

const TRIGGER_A = '@triggered-ability:a';
const TRIGGER_B = '@triggered-ability:b';

function validWindow(window: Raw): Raw {
  const result = validateCoreTurnWindowV1(window);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function validLifecycle(position: Raw, window: Raw, sequence = 0): Raw {
  const result = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: 1,
    positionSequence: sequence,
    position: position as unknown as CoreTurnPositionV1,
    window: window as unknown as CoreTurnWindowV1,
  });
  return result;
}

function issues(value: unknown): readonly { readonly code: string; readonly path: string }[] {
  const result = validateModeNeutralCoreTurnLifecycleSliceV1(value);
  return result.ok ? [] : result.issues;
}

function deepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) deepFrozen(descriptor.value, seen);
  }
}

describe('CoreTurnWindowV1 and CoreTurnLifecycleSliceV1', () => {
  it('accepts every window branch with its exact fields', () => {
    const windows: readonly Raw[] = [
      { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P1' },
      { kind: 'turn-based-action-required', action: 'draw-step-draw', playerId: 'P1' },
      { kind: 'turn-based-action-required', action: 'precombat-main-actions', playerId: 'P1' },
      { kind: 'sba-check-required', priorityRecipientPlayerId: 'P1', grantPriorityIfStable: false },
      {
        kind: 'trigger-order-required',
        priorityRecipientPlayerId: 'P1',
        grantPriorityIfStable: true,
        pendingObjectIds: [TRIGGER_A, TRIGGER_B],
        ambiguousGroups: [{ stackPlacementBucket: 'ordinary', controllerPlayerId: 'P1', pendingObjectIds: [TRIGGER_A, TRIGGER_B] }],
      },
      { kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P2', passedPlayerIds: ['P1'] },
      { kind: 'resolution-ready', objectId: TRIGGER_A },
      { kind: 'position-advance-ready' },
      { kind: 'cleanup-discard-required', playerId: 'P1', requiredCount: 2 },
      { kind: 'cleanup-state-actions-required', playerId: 'P1' },
      { kind: 'cleanup-repeat-ready' },
      { kind: 'turn-advance-ready' },
    ];
    for (const window of windows) expect(validWindow(window)).toEqual(window);
  });

  it('cross-validates turn-based and cleanup windows against position', () => {
    expect(issues({
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'beginning', step: 'untap' },
      window: { kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P1', passedPlayerIds: [] },
    }).map((issue) => issue.code)).toContain('INVALID_WINDOW_FOR_POSITION');
    expect(issues({
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'ending', step: 'cleanup' },
      window: { kind: 'position-advance-ready' },
    }).map((issue) => issue.code)).toContain('INVALID_WINDOW_FOR_POSITION');
    expect(issues({
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'combat', step: 'combat-damage' },
      window: { kind: 'cleanup-repeat-ready' },
    }).map((issue) => issue.code)).toContain('INVALID_WINDOW_FOR_POSITION');
    expect(validLifecycle({ phase: 'beginning', step: 'draw' }, { kind: 'turn-based-action-required', action: 'draw-step-draw', playerId: 'P1' })).toEqual({
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      turnNumber: 1,
      positionSequence: 0,
      position: { phase: 'beginning', step: 'draw' },
      window: { kind: 'turn-based-action-required', action: 'draw-step-draw', playerId: 'P1' },
    });
  });

  it('rejects sparse and extra-property arrays, accessors, symbols, and invalid IDs', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    const sparseResult = validateCoreTurnWindowV1({
      kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P2', passedPlayerIds: sparse,
    });
    expect(sparseResult.ok).toBe(false);
    if (!sparseResult.ok) expect(sparseResult.issues.map((issue) => issue.code)).toContain('INVALID_ARRAY');

    const extra = ['P1'] as unknown[] & { extra?: unknown };
    extra.extra = true;
    const extraResult = validateCoreTurnWindowV1({
      kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P2', passedPlayerIds: extra,
    });
    expect(extraResult.ok).toBe(false);
    if (!extraResult.ok) expect(extraResult.issues.map((issue) => issue.code)).toContain('INVALID_ARRAY');

    const accessor: Raw = { kind: 'resolution-ready' };
    let reads = 0;
    Object.defineProperty(accessor, 'objectId', { enumerable: true, get: () => { reads += 1; return TRIGGER_A; } });
    expect(validateCoreTurnWindowV1(accessor).ok).toBe(false);
    expect(reads).toBe(0);

    const symbolRoot: Raw = { kind: 'position-advance-ready' };
    Object.defineProperty(symbolRoot, Symbol('extra'), { value: true, enumerable: true });
    expect(validateCoreTurnWindowV1(symbolRoot).ok).toBe(false);
    expect(validateCoreTurnWindowV1({ kind: 'resolution-ready', objectId: 'not-an-object-id' }).ok).toBe(false);
  });

  it('rejects Array subclasses as non-canonical lifecycle arrays', () => {
    class ExtendedPlayerIds extends Array<string> {}
    const passedPlayerIds = new ExtendedPlayerIds('P1');
    const result = validateCoreTurnWindowV1({
      kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P2', passedPlayerIds,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain('INVALID_ARRAY');
  });

  it('reports all issues in deterministic order and does not coerce values', () => {
    const input: Raw = {
      window: { kind: 'priority', cycleStartPlayerId: 'P1', holderPlayerId: 'P1', passedPlayerIds: ['P1', 'P1'] },
      position: { step: 'not-a-step', phase: 'beginning' },
      positionSequence: -1,
      turnNumber: '1',
      kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
      extra: true,
    };
    const before = JSON.stringify(input);
    const found = issues(input);
    expect(found.map((issue) => issue.path)).toEqual(found.map((issue) => issue.path).slice().sort());
    expect(found.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'UNKNOWN_FIELD', 'INVALID_TYPE', 'INVALID_INTEGER', 'INVALID_POSITION', 'INVALID_PASS_SEQUENCE',
    ]));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('canonicalizes, deep-freezes, keeps values distinct, and survives JSON round trip', () => {
    const input: Raw = {
      window: { passedPlayerIds: [], holderPlayerId: 'P1', cycleStartPlayerId: 'P1', kind: 'priority' },
      position: { step: null, phase: 'precombat-main' },
      positionSequence: 3,
      turnNumber: 2,
    };
    const before = JSON.stringify(input);
    const first = validLifecycle(input.position as Raw, input.window as Raw, 3);
    const second = validLifecycle(input.position as Raw, input.window as Raw, 3);
    expect(Object.keys(first)).toEqual(['kind', 'turnNumber', 'positionSequence', 'position', 'window']);
    expect(Object.keys(first.window as Raw)).toEqual(['kind', 'cycleStartPlayerId', 'holderPlayerId', 'passedPlayerIds']);
    expect(first).not.toBe(second);
    expect(first.position).not.toBe(second.position);
    expect(JSON.stringify(input)).toBe(before);
    deepFrozen(first);
    const roundTrip = validateModeNeutralCoreTurnLifecycleSliceV1(JSON.parse(JSON.stringify(first)));
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.value).toEqual(first);
  });
});
