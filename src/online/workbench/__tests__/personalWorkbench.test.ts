import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/o4p-04a-personal-workbench-v1.json';
import {
  PersonalWorkbenchProjectionErrorV1,
  buildPersonalWorkbenchViewV1,
} from '../index';
import type { PersonalWorkbenchStackObjectV1 } from '../index';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDeeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => isDeeplyFrozen(Reflect.get(value, key), seen));
}

describe('Personal Workbench view model', () => {
  it('copies the allowed Player projection facts in projected order', () => {
    const input = clone(fixture);
    const before = JSON.stringify(input);
    const view = buildPersonalWorkbenchViewV1(input);

    expect(view.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(view.zones.ownHand.cards.map((card) => card.kind)).toEqual(['visible-card', 'visible-card']);
    expect(view.zones.battlefield.cards.map((card) => card.kind)).toEqual(['visible-card', 'concealed-card']);
    expect(view.zones.battlefield.cards[1]).toMatchObject({ label: '《裏向きのカード》' });
    expect(JSON.stringify(input)).toBe(before);
    expect(isDeeplyFrozen(view)).toBe(true);
  });

  it('returns fresh deterministic frozen values and fails closed for relation drift', () => {
    const first = buildPersonalWorkbenchViewV1(fixture);
    const second = buildPersonalWorkbenchViewV1(fixture);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);

    const invalid = clone(fixture) as { role: string; corePlayerId: string | null };
    invalid.role = 'spectator';
    invalid.corePlayerId = null;
    expect(() => buildPersonalWorkbenchViewV1(invalid)).toThrow(PersonalWorkbenchProjectionErrorV1);
  });

  it('keeps every synthetic stack kind in the fixed closed public form', () => {
    const stackObjects = [
      {
        kind: 'stack-object',
        objectId: 'public-spell-copy',
        objectKind: 'spell-copy',
        label: '呪文のコピー',
        controllerPlayerId: 'P1',
      },
      {
        kind: 'stack-object',
        objectId: 'public-activated-ability',
        objectKind: 'activated-ability',
        label: '起動型能力',
        controllerPlayerId: 'P2',
      },
      {
        kind: 'stack-object',
        objectId: 'public-triggered-ability',
        objectKind: 'triggered-ability',
        label: '誘発型能力',
        controllerPlayerId: null,
      },
    ] as const satisfies readonly PersonalWorkbenchStackObjectV1[];

    expect(stackObjects.map((entry) => [entry.objectKind, entry.label])).toEqual([
      ['spell-copy', '呪文のコピー'],
      ['activated-ability', '起動型能力'],
      ['triggered-ability', '誘発型能力'],
    ]);
  });
});
