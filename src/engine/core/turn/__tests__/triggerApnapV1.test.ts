import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  analyzeCorePendingTriggerPlacementV1,
  coreApnapPlayerOrderV1,
  validateCorePendingTriggerOrderV1,
} from '../triggerApnapV1';
import { createModeNeutralCorePendingTriggerSliceV1 } from '../pendingTriggerV1';

type Raw = Record<string, unknown>;
const registry = JSON.parse(readFileSync(new URL('../../object/fixtures/object-registry-v2.json', import.meta.url), 'utf8')) as Raw;

function record(controllerPlayerId: string, bucket: string, key: string): Raw {
  return {
    stackPlacementBucket: bucket,
    object: { kind: 'triggered-ability', controllerPlayerId, sourceObjectId: '@triggered-ability:historical', abilityKey: key },
    announcement: {
      kind: 'triggered-ability',
      abilityTextSnapshot: `When ${key}.`,
      chosenModeKeys: [],
      targetSelections: [],
      announcedVariables: [],
      distributions: [],
      costChoices: { alternativeCost: null, additionalCosts: [] },
    },
  };
}

function pending(): ReturnType<typeof createModeNeutralCorePendingTriggerSliceV1> {
  const ids = [
    '@triggered-ability:ordinary-p1',
    '@triggered-ability:ordinary-p2-a',
    '@triggered-ability:ordinary-p2-b',
    '@triggered-ability:ability-p4',
    '@triggered-ability:ability-p1',
  ];
  return createModeNeutralCorePendingTriggerSliceV1(registry as never, {
    pendingObjectIds: ids,
    byObject: {
      [ids[0]]: record('P1', 'ordinary', 'p1'),
      [ids[1]]: record('P2', 'ordinary', 'p2-a'),
      [ids[2]]: record('P2', 'ordinary', 'p2-b'),
      [ids[3]]: record('P4', 'ability-triggered', 'p4'),
      [ids[4]]: record('P1', 'ability-triggered', 'p1-ability'),
    },
  } as never);
}

describe('O4P-01K-F APNAP trigger analysis', () => {
  it('rotates turn order from the active player and orders buckets before controllers', () => {
    expect(coreApnapPlayerOrderV1(registry as never)).toEqual(['P2', 'P3', 'P4', 'P1']);
    const analysis = analyzeCorePendingTriggerPlacementV1(registry as never, pending());
    expect(analysis.kind).toBe('manual-order-required');
    expect(analysis.groups).toEqual([
      { stackPlacementBucket: 'ordinary', controllerPlayerId: 'P2', pendingObjectIds: ['@triggered-ability:ordinary-p2-a', '@triggered-ability:ordinary-p2-b'] },
      { stackPlacementBucket: 'ordinary', controllerPlayerId: 'P1', pendingObjectIds: ['@triggered-ability:ordinary-p1'] },
      { stackPlacementBucket: 'ability-triggered', controllerPlayerId: 'P4', pendingObjectIds: ['@triggered-ability:ability-p4'] },
      { stackPlacementBucket: 'ability-triggered', controllerPlayerId: 'P1', pendingObjectIds: ['@triggered-ability:ability-p1'] },
    ]);
    expect(analysis.orderedObjectIds).toEqual([
      '@triggered-ability:ordinary-p2-a', '@triggered-ability:ordinary-p2-b',
      '@triggered-ability:ordinary-p1', '@triggered-ability:ability-p4', '@triggered-ability:ability-p1',
    ]);
  });

  it('accepts arbitrary order within one controller group but rejects bucket/controller crossing', () => {
    const current = pending();
    const accepted = validateCorePendingTriggerOrderV1(registry as never, current, [
      '@triggered-ability:ordinary-p2-b', '@triggered-ability:ordinary-p2-a',
      '@triggered-ability:ordinary-p1', '@triggered-ability:ability-p4', '@triggered-ability:ability-p1',
    ]);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(Object.isFrozen(accepted.value)).toBe(true);
    const rejected = validateCorePendingTriggerOrderV1(registry as never, current, [
      '@triggered-ability:ordinary-p1', '@triggered-ability:ordinary-p2-a', '@triggered-ability:ordinary-p2-b',
      '@triggered-ability:ability-p4', '@triggered-ability:ability-p1',
    ]);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues.map((issue) => issue.code)).toContain('INVALID_TRIGGER_ORDER');
  });

  it('validates exact ordered-list structure and does not sort or deduplicate input', () => {
    const current = pending();
    const duplicate = validateCorePendingTriggerOrderV1(current, [
      '@triggered-ability:ordinary-p2-a', '@triggered-ability:ordinary-p2-a',
      '@triggered-ability:ordinary-p1', '@triggered-ability:ability-p4', '@triggered-ability:ability-p1',
    ]);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.issues.map((issue) => issue.code)).toContain('DUPLICATE_VALUE');
    const hostile = ['@triggered-ability:ordinary-p2-a'] as unknown[] & { extra?: unknown };
    hostile.extra = true;
    expect(validateCorePendingTriggerOrderV1(current, hostile).ok).toBe(false);
  });
});
