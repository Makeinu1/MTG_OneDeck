import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/o4p-04b-table-display-v1.json';
import {
  TableDisplayProjectionErrorV1,
  buildTableDisplayViewV1,
} from '../index';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(Reflect.get(value, key), seen));
}

describe('Table Display view model', () => {
  it('copies only the allowlisted Table facts into a fresh frozen view', () => {
    const input = clone(fixture);
    const before = JSON.stringify(input);
    const first = buildTableDisplayViewV1(input);
    const second = buildTableDisplayViewV1(input);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(deeplyFrozen(first)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(first.players.map((player) => player.handCount)).toEqual([2, 1, 1, 0]);
    expect(first.zones.battlefield.cards.map((card) => card.label))
      .toEqual(['《炎樹族の使者》', '《裏向きのカード》']);
    expect(JSON.stringify(first)).not.toMatch(/hidden-card|oracleText|visibilityGrants|searchSessions|playPermissions/);
  });

  it('keeps shared-zone order and rejects a shared hidden entry', () => {
    const input = clone(fixture);
    input.game.zones.battlefield.entries.reverse();
    const reordered = buildTableDisplayViewV1(input);
    expect(reordered.zones.battlefield.cards.map((card) => card.label))
      .toEqual(['《裏向きのカード》', '《炎樹族の使者》']);

    const invalid = clone(fixture) as unknown as {
      game: { zones: { exile: { entries: Array<Record<string, unknown>> } } };
    };
    invalid.game.zones.exile.entries = [{ kind: 'hidden-card' }];
    expect(() => buildTableDisplayViewV1(invalid)).toThrow(TableDisplayProjectionErrorV1);
  });

  it('represents synthetic stack objects through fixed public labels only', () => {
    const view = buildTableDisplayViewV1(fixture);
    expect(view.zones.stack.cards.map((card) => card.kind === 'stack-object' ? card.label : null))
      .toEqual(['呪文のコピー', '起動型能力', '誘発型能力']);
  });
});
