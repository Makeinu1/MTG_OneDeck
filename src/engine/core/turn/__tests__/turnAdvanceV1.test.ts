import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateModeNeutralCoreObjectRegistrySliceV2 } from '../../object/objectRegistryValidationV2';
import { validateModeNeutralCoreObjectRuntimeSliceV2 } from '../../object/objectRuntimeV2';
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../index';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import type { CoreTurnLifecycleSliceV1 } from '../turnLifecycleV1';
import {
  advanceCoreToNextTurnV1,
  advanceCoreTurnPositionV1,
  completeCoreTurnBasedActionCheckpointV1,
  type CoreTurnAdvanceBundleV1,
} from '../turnAdvanceV1';
import { CoreTurnPriorityErrorV1 } from '../turnPriorityErrorV1';

type Raw = Record<string, unknown>;

const P1 = 'P1' as CorePlayerId;
const P2 = 'P2' as CorePlayerId;
const P3 = 'P3' as CorePlayerId;
const PC10 = 'PC1:0' as CoreObjectId;

function json(url: URL): Raw {
  return JSON.parse(readFileSync(url, 'utf8')) as Raw;
}

function registry() {
  const raw = json(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url));
  const result = validateModeNeutralCoreObjectRegistrySliceV2(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function emptyStackRegistry(fullRegistry: ReturnType<typeof registry>) {
  return {
    ...fullRegistry,
    zones: {
      ...fullRegistry.zones,
      shared: { ...fullRegistry.zones.shared, stack: [] },
    },
  };
}

function runtime(identity: ReturnType<typeof registry>) {
  const raw = json(new URL('../../fixtures/card-runtime-slice-v1.json', import.meta.url));
  raw.kind = 'mode-neutral-core-object-runtime-slice-v2';
  const byObject = raw.byObject as Raw;
  byObject['@token:fixture-token:0'] = structuredClone(byObject['PC4:1']);
  const result = validateModeNeutralCoreObjectRuntimeSliceV2(identity, raw);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function emptyAnnouncements(identity: ReturnType<typeof registry>) {
  const result = validateModeNeutralCoreStackAnnouncementSliceV1(identity, {
    ...json(new URL('../../stack/fixtures/stack-announcement-v1.json', import.meta.url)),
    kind: 'mode-neutral-core-stack-announcement-slice-v1',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function lifecycle(
  position: CoreTurnLifecycleSliceV1['position'],
  window: CoreTurnLifecycleSliceV1['window'],
  positionSequence = 0,
  turnNumber = 1,
): CoreTurnLifecycleSliceV1 {
  return {
    kind: 'mode-neutral-core-turn-lifecycle-slice-v1',
    turnNumber,
    positionSequence,
    position,
    window,
  };
}

function bundle(
  position: CoreTurnLifecycleSliceV1['position'],
  window: CoreTurnLifecycleSliceV1['window'],
  positionSequence = 0,
): CoreTurnAdvanceBundleV1 {
  const objectRegistry = registry();
  return {
    stackBundle: {
      objectRegistry: emptyStackRegistry(objectRegistry),
      objectRuntime: runtime(objectRegistry),
      stackAnnouncements: emptyAnnouncements(objectRegistry),
    },
    pendingTriggers: { pendingObjectIds: [] },
    lifecycle: lifecycle(position, window, positionSequence),
  };
}

function positionAdvanceBundle(
  position: CoreTurnLifecycleSliceV1['position'],
  positionSequence = 0,
): CoreTurnAdvanceBundleV1 {
  return bundle(position, { kind: 'position-advance-ready' }, positionSequence);
}

function manaTotal(bundleValue: CoreTurnAdvanceBundleV1): number {
  return bundleValue.stackBundle.objectRegistry.turnOrder
    .flatMap((playerId) => {
      const manaPool = bundleValue.stackBundle.objectRegistry.players[playerId].manaPool;
      return [manaPool.W, manaPool.U, manaPool.B, manaPool.R, manaPool.G, manaPool.C];
    })
    .reduce((sum, value) => sum + value, 0);
}

function thrownCode(action: () => unknown): string {
  try {
    action();
  } catch (error: unknown) {
    if (error instanceof CoreTurnPriorityErrorV1) {
      return error.code;
    }
  }
  throw new Error('Expected operation to throw');
}

describe('turn advance component V1', () => {
  it('completes untap without priority and creates exact draw/main checkpoints', () => {
    const start = bundle(
      { phase: 'beginning', step: 'untap' },
      { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: P2 },
    );
    const upkeep = completeCoreTurnBasedActionCheckpointV1(start, 'untap-step-actions');
    expect(upkeep.lifecycle.position).toEqual({ phase: 'beginning', step: 'upkeep' });
    expect(upkeep.lifecycle.window).toEqual({
      kind: 'sba-check-required', priorityRecipientPlayerId: P2, grantPriorityIfStable: true,
    });
    const draw = advanceCoreTurnPositionV1(
      { ...upkeep, lifecycle: { ...upkeep.lifecycle, window: { kind: 'position-advance-ready' } } },
      { nextPosition: { phase: 'beginning', step: 'draw' } },
    );
    expect(draw.lifecycle.window).toEqual({
      kind: 'turn-based-action-required', action: 'draw-step-draw', playerId: 'P2',
    });
    const afterDraw = completeCoreTurnBasedActionCheckpointV1(draw, 'draw-step-draw');
    expect(afterDraw.lifecycle.window.kind).toBe('sba-check-required');
    const main = advanceCoreTurnPositionV1(
      { ...afterDraw, lifecycle: { ...afterDraw.lifecycle, window: { kind: 'position-advance-ready' } } },
      { nextPosition: { phase: 'precombat-main', step: null } },
    );
    expect(main.lifecycle.window).toEqual({
      kind: 'turn-based-action-required', action: 'precombat-main-actions', playerId: 'P2',
    });
  });

  it('accepts every bounded successor including repeated combat damage and rejects branches', () => {
    const transitions: readonly [CoreTurnLifecycleSliceV1['position'], CoreTurnLifecycleSliceV1['position']][] = [
      [{ phase: 'beginning', step: 'upkeep' }, { phase: 'beginning', step: 'draw' }],
      [{ phase: 'beginning', step: 'draw' }, { phase: 'precombat-main', step: null }],
      [{ phase: 'precombat-main', step: null }, { phase: 'combat', step: 'beginning-of-combat' }],
      [{ phase: 'combat', step: 'beginning-of-combat' }, { phase: 'combat', step: 'declare-attackers' }],
      [{ phase: 'combat', step: 'declare-attackers' }, { phase: 'combat', step: 'declare-blockers' }],
      [{ phase: 'combat', step: 'declare-attackers' }, { phase: 'combat', step: 'end-of-combat' }],
      [{ phase: 'combat', step: 'declare-blockers' }, { phase: 'combat', step: 'combat-damage' }],
      [{ phase: 'combat', step: 'declare-blockers' }, { phase: 'combat', step: 'end-of-combat' }],
      [{ phase: 'combat', step: 'combat-damage' }, { phase: 'combat', step: 'combat-damage' }],
      [{ phase: 'combat', step: 'combat-damage' }, { phase: 'combat', step: 'end-of-combat' }],
      [{ phase: 'combat', step: 'end-of-combat' }, { phase: 'postcombat-main', step: null }],
      [{ phase: 'postcombat-main', step: null }, { phase: 'ending', step: 'end' }],
      [{ phase: 'ending', step: 'end' }, { phase: 'ending', step: 'cleanup' }],
    ];
    for (const [from, to] of transitions) {
      const result = advanceCoreTurnPositionV1(positionAdvanceBundle(from), { nextPosition: to });
      expect(result.lifecycle.position).toEqual(to);
      expect(result.lifecycle.positionSequence).toBe(1);
      expect(manaTotal(result)).toBe(0);
    }
    expect(thrownCode(() => advanceCoreTurnPositionV1(
      positionAdvanceBundle({ phase: 'combat', step: 'end-of-combat' }),
      { nextPosition: { phase: 'combat', step: 'combat-damage' } },
    ))).toBe('POSITION_TRANSITION_INVALID');
  });

  it('refuses nonempty-stack transitions and safe-integer position overflow', () => {
    const nonempty = bundle(
      { phase: 'beginning', step: 'upkeep' },
      { kind: 'position-advance-ready' },
    );
    const registryValue = nonempty.stackBundle.objectRegistry;
    const withStack: CoreTurnAdvanceBundleV1 = {
      ...nonempty,
      stackBundle: {
        ...nonempty.stackBundle,
        objectRegistry: {
          ...registryValue,
          zones: {
            ...registryValue.zones,
            shared: { ...registryValue.zones.shared, stack: [PC10] },
          },
        },
      },
    };
    expect(thrownCode(() => advanceCoreTurnPositionV1(withStack, { nextPosition: { phase: 'beginning', step: 'draw' } })))
      .toBe('WINDOW_MISMATCH');
    expect(thrownCode(() => advanceCoreTurnPositionV1(
      positionAdvanceBundle({ phase: 'beginning', step: 'upkeep' }, Number.MAX_SAFE_INTEGER),
      { nextPosition: { phase: 'beginning', step: 'draw' } },
    ))).toBe('POSITION_SEQUENCE_OVERFLOW');
  });

  it('rotates the Registry active player and resets only turn-local counters and mana', () => {
    const start = bundle(
      { phase: 'ending', step: 'cleanup' },
      { kind: 'turn-advance-ready' },
    );
    const registryValue = start.stackBundle.objectRegistry;
    const players = { ...registryValue.players };
    players[P1] = { ...players[P1], life: 31, manaPool: { W: 2, U: 0, B: 0, R: 0, G: 0, C: 0 }, landsPlayedThisTurn: 2 };
    players[P2] = { ...players[P2], spellsCastThisTurn: 4, drawnThisTurn: 1 };
    const result = advanceCoreToNextTurnV1({
      ...start,
      stackBundle: {
        ...start.stackBundle,
        objectRegistry: { ...registryValue, players, activePlayerId: P2 },
      },
    });
    expect(result.lifecycle).toMatchObject({
      turnNumber: 2, positionSequence: 0, position: { phase: 'beginning', step: 'untap' },
      window: { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: P3 },
    });
    expect(result.stackBundle.objectRegistry.activePlayerId).toBe('P3');
    expect(result.stackBundle.objectRegistry.players[P1]).toMatchObject({
      life: 31, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0,
      manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    expect(result.stackBundle.objectRegistry.players[P2].maximumHandSizeOverride).toBe('none');
  });
});
