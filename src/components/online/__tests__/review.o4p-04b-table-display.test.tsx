import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { TableDisplay } from '../TableDisplay';
import { buildTableDisplayViewV1 } from '../../../online/tableDisplay/index';
import fixture from '../../../online/tableDisplay/fixtures/o4p-04b-table-display-v1.json';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MutableFixture = {
  participantId: string;
  role: string;
  corePlayerId: string | null;
  room: {
    participants: Array<Record<string, unknown>>;
  };
  game: {
    turnOrder: string[];
    players: Array<{ playerId: string }>;
    zones: {
      byPlayer: Array<{
        playerId: string;
        zones: {
          library: { count: number; entries: Array<Record<string, unknown>> };
          hand: { count: number; entries: Array<Record<string, unknown>> };
          graveyard: { count: number; entries: Array<Record<string, unknown>> };
        };
      }>;
      battlefield: { count: number; entries: Array<Record<string, unknown>> };
      stack: { count: number; entries: Array<Record<string, unknown>> };
      exile: { count: number; entries: Array<Record<string, unknown>> };
      command: { count: number; entries: Array<Record<string, unknown>> };
    };
  };
};

function mutableFixture(): MutableFixture {
  return clone(fixture);
}

function deeplyFrozen(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen(Reflect.get(value, key), seen));
}

function required<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing judge-owned selector: ${selector}`);
  return element;
}

function mount(projection: unknown = fixture): Readonly<{
  container: HTMLDivElement;
  root: Root;
}> {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<TableDisplay projection={projection} />));
  return { container, root };
}

describe('O4P-04B Table Display judge acceptance', () => {
  it('builds a fresh frozen Table-only view without mutating or reordering the projection', () => {
    const input = mutableFixture();
    const before = JSON.stringify(input);
    const first = buildTableDisplayViewV1(input);
    const second = buildTableDisplayViewV1(input);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(deeplyFrozen(first)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(first).toMatchObject({
      kind: 'table-display-view-v1',
      schemaVersion: 1,
      revision: 21,
      roomLifecycle: 'active',
      tablePresence: 'connected',
      turn: {
        activePlayerId: 'P1',
        turnNumber: 8,
        phase: 'combat',
        step: 'declare-attackers',
      },
    });
    expect(first.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(first.players.map((player) => player.seatIndex)).toEqual([0, 1, 2, 3]);
    expect(first.players.map((player) => player.handCount)).toEqual([2, 1, 1, 0]);
    expect(first.zones.battlefield.cards.map((card) => card.label))
      .toEqual(['《炎樹族の使者》', '《裏向きのカード》']);
    expect(JSON.stringify(first)).not.toContain('hidden-card');

    const reversed = mutableFixture();
    reversed.game.zones.battlefield.entries.reverse();
    const reordered = buildTableDisplayViewV1(reversed);
    expect(reordered.zones.battlefield.cards.map((card) => card.label))
      .toEqual(['《裏向きのカード》', '《炎樹族の使者》']);
  });

  it('renders four public Players and every shared zone with Japanese status labels', () => {
    const mounted = mount();
    const { container, root } = mounted;

    expect(required(container, '[data-testid="table-display"]')).not.toBeNull();
    expect(required(container, '[data-testid="table-display-status"]').textContent)
      .toMatch(/テーブル表示.*接続中.*ターン 8/s);
    const players = container.querySelectorAll('[data-testid="table-display-player-summary"]');
    expect(players).toHaveLength(4);
    expect(players[0]?.textContent).toMatch(/P1.*手番.*接続中/s);
    expect(players[2]?.textContent).toMatch(/P3.*切断中/s);
    expect(players[3]?.textContent).toMatch(/P4.*退席済み/s);
    expect(container.textContent).not.toMatch(/状態 active|状態 exited|presence disconnected/i);
    expect(required(container, '[data-testid="table-display-zone-battlefield"]').textContent)
      .toContain('《炎樹族の使者》');
    expect(required(container, '[data-testid="table-display-zone-exile"]').textContent)
      .toContain('《裏向きのカード》');
    expect(required(container, '[data-testid="table-display-zone-command"]').textContent)
      .toContain('《潮流の統率者》');
    act(() => root.unmount());
  });

  it('renders every synthetic stack kind through a closed generic view', () => {
    const view = buildTableDisplayViewV1(fixture);
    expect(view.zones.stack.cards).toEqual([
      {
        kind: 'stack-object', objectId: '@spell-copy:table-copy',
        objectKind: 'spell-copy', label: '呪文のコピー', controllerPlayerId: 'P1',
      },
      {
        kind: 'stack-object', objectId: '@activated-ability:table-activation',
        objectKind: 'activated-ability', label: '起動型能力', controllerPlayerId: 'P2',
      },
      {
        kind: 'stack-object', objectId: '@triggered-ability:table-trigger',
        objectKind: 'triggered-ability', label: '誘発型能力', controllerPlayerId: 'P3',
      },
    ]);
    expect(JSON.stringify(view.zones.stack.cards)).not.toMatch(/definition|runtime|source|target|choice|legal|oracle/i);

    const mounted = mount();
    const stack = required(mounted.container, '[data-testid="table-display-zone-stack"]');
    expect(stack.querySelectorAll('[data-testid="table-display-stack-object"]')).toHaveLength(3);
    expect(stack.textContent).toContain('呪文のコピー');
    expect(stack.textContent).toContain('起動型能力');
    expect(stack.textContent).toContain('誘発型能力');
    expect(stack.textContent).not.toContain('複製された呪文');
    act(() => mounted.root.unmount());
  });

  it('omits private-zone entries and exposes only public concealed facts', () => {
    const view = buildTableDisplayViewV1(fixture);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('hidden-card');
    expect(JSON.stringify(view.players)).not.toMatch(/"cards"|hidden-card/);
    expect(view.players.every((player) =>
      !Object.hasOwn(player, 'hand') &&
      !Object.hasOwn(player, 'library') &&
      !Object.hasOwn(player, 'graveyard'),
    )).toBe(true);

    const mounted = mount();
    expect(mounted.container.querySelector('[data-testid="table-display-hidden-card"]')).toBeNull();
    const concealed = required(mounted.container, '[data-testid="table-display-concealed-card"]');
    expect(concealed.textContent).toContain('《裏向きのカード》');
    expect(concealed.textContent).toContain('ダメージ 3');
    expect(concealed.textContent).toContain('shield 1');
    expect(concealed.innerHTML).not.toMatch(/PC102|owner|controller|definition|oracle|faceIndex/i);
    act(() => mounted.root.unmount());
  });

  it('states the priority-information boundary and never infers a holder', () => {
    const mounted = mount();
    const status = required(mounted.container, '[data-testid="table-display-priority-status"]');
    expect(required(mounted.container, '[data-testid="table-display-status"]').textContent)
      .toContain('手番 P1');
    expect(status.textContent).toContain('優先権保持者は投影されていません');
    expect(status.textContent).not.toMatch(/P[1-4]/);
    expect(mounted.container.textContent)
      .not.toMatch(/P[1-4](?:が|は)優先権|優先権(?:保持者)?[:： ]*P[1-4]/);
    act(() => mounted.root.unmount());
  });

  it('is strictly read-only with no control, editable surface, or pointer-only action', () => {
    const mounted = mount();
    expect(mounted.container.querySelector('button, form, input, select, textarea, [contenteditable="true"]'))
      .toBeNull();
    expect(mounted.container.innerHTML).not.toMatch(/draggable=|ondblclick|onDoubleClick/i);
    act(() => mounted.root.unmount());
  });

  it('revalidates a same-reference projection on every render without retaining a previous view', () => {
    const projection = mutableFixture();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<TableDisplay projection={projection} />));
    expect(required(container, '[data-testid="table-display"]')).not.toBeNull();

    projection.role = 'spectator';
    act(() => root.render(<TableDisplay projection={projection} />));
    expect(required(container, '[data-testid="table-display-unavailable"]').textContent)
      .toBe('表示できません');
    expect(container.querySelector('[data-testid="table-display"]')).toBeNull();
    act(() => root.unmount());
  });

  it('fails closed for non-Table roles, audience drift, hidden shared cards, and misplaced stack objects', () => {
    const candidates: unknown[] = [];

    const player = mutableFixture();
    player.role = 'player';
    player.corePlayerId = 'P3';
    candidates.push(player);

    const spectator = mutableFixture();
    spectator.role = 'spectator';
    candidates.push(spectator);

    const audienceDrift = mutableFixture();
    audienceDrift.participantId = 'table-other';
    candidates.push(audienceDrift);

    const hiddenShared = mutableFixture();
    hiddenShared.game.zones.exile.entries = [{ kind: 'hidden-card' }];
    candidates.push(hiddenShared);

    const misplaced = mutableFixture();
    const ability = misplaced.game.zones.stack.entries.splice(1, 1)[0];
    if (ability === undefined) throw new Error('Judge stack fixture is missing');
    misplaced.game.zones.stack.count -= 1;
    misplaced.game.zones.battlefield.entries.push(ability);
    misplaced.game.zones.battlefield.count += 1;
    candidates.push(misplaced);

    for (const projection of candidates) {
      expect(() => buildTableDisplayViewV1(projection)).toThrow();
      const mounted = mount(projection);
      expect(required(mounted.container, '[data-testid="table-display-unavailable"]').textContent)
        .toBe('表示できません');
      expect(mounted.container.innerHTML).not.toMatch(/room-o4p|table-other|INVALID_|\/game|Error|stack|PC10/i);
      act(() => mounted.root.unmount());
    }
  });

  it('fails trap-safe and does not reflect hidden caller values or raw diagnostics', () => {
    const hiddenField = mutableFixture();
    const hidden = hiddenField.game.zones.byPlayer[0]?.zones.hand.entries[0];
    if (hidden === undefined) throw new Error('Judge hidden fixture is missing');
    hidden.definition = { name: 'LEAK_PRIVATE_TABLE_CARD' };

    const getterTrap = mutableFixture() as unknown as Record<string, unknown>;
    Object.defineProperty(getterTrap, 'role', {
      configurable: true,
      enumerable: true,
      get: () => { throw new Error('LEAK_GETTER_SECRET'); },
    });

    const descriptorTrap = mutableFixture() as unknown as Record<string, unknown>;
    Object.defineProperty(descriptorTrap, 'corePlayerId', {
      configurable: true,
      enumerable: false,
      value: 'LEAK_DESCRIPTOR_SECRET',
      writable: true,
    });

    const proxyTrap = new Proxy(mutableFixture(), {
      ownKeys: () => { throw new Error('LEAK_PROXY_SECRET'); },
    });

    const prototypeTrap = mutableFixture() as unknown as Record<string, unknown>;
    Object.setPrototypeOf(prototypeTrap, { inheritedSecret: 'LEAK_PROTOTYPE_SECRET' });

    for (const projection of [hiddenField, getterTrap, descriptorTrap, proxyTrap, prototypeTrap]) {
      const mounted = mount(projection);
      expect(required(mounted.container, '[data-testid="table-display-unavailable"]').textContent)
        .toBe('表示できません');
      expect(mounted.container.innerHTML).not.toMatch(/LEAK_|descriptor|getter|proxy|prototype|stack|error/i);
      act(() => mounted.root.unmount());
    }
  });

  it('rejects a descriptor-switching projection instead of consuming the validator copy race', () => {
    const canonical = mutableFixture();
    const altered = mutableFixture();
    const visible = altered.game.zones.battlefield.entries[0];
    const definition = visible?.definition;
    if (typeof definition !== 'object' || definition === null) {
      throw new Error('Judge visible definition fixture is missing');
    }
    Reflect.set(definition, 'name', ' LEAK_TOC_TOU_PRIVATE_NAME ');
    let gameReads = 0;
    const switching = new Proxy(canonical, {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key !== 'game' || descriptor === undefined || !('value' in descriptor)) return descriptor;
        gameReads += 1;
        return { ...descriptor, value: gameReads === 1 ? canonical.game : altered.game };
      },
    });

    const mounted = mount(switching);
    expect(gameReads).toBeGreaterThanOrEqual(2);
    expect(required(mounted.container, '[data-testid="table-display-unavailable"]').textContent)
      .toBe('表示できません');
    expect(mounted.container.innerHTML).not.toContain('LEAK_TOC_TOU_PRIVATE_NAME');
    act(() => mounted.root.unmount());
  });
});
