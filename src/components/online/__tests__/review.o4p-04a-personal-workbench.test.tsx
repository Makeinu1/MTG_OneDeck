import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { PersonalWorkbench } from '../PersonalWorkbench';
import {
  buildPersonalWorkbenchViewV1,
  type PersonalWorkbenchActionV1,
  type PersonalWorkbenchInteractionStateV1,
} from '../../../online/workbench/index';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type MutableProjectionFixture = {
  revision: number;
  participantId: string;
  corePlayerId: string | null;
  game: {
    zones: {
      byPlayer: Array<{ zones: { hand: { entries: Array<Record<string, unknown>> } } }>;
      battlefield: { count: number; entries: Array<Record<string, unknown>> };
      stack: { count: number; entries: Array<Record<string, unknown>> };
    };
  };
};

function mutableFixture(): MutableProjectionFixture {
  return clone(fixture);
}

function projectionWithSyntheticStack(): MutableProjectionFixture {
  const projection = mutableFixture();
  const handCard = projection.game.zones.byPlayer[0]?.zones.hand.entries[0];
  const definition = handCard?.definition;
  if (typeof definition !== 'object' || definition === null) {
    throw new Error('Judge fixture requires one visible hand definition');
  }
  projection.game.zones.stack = {
    count: 3,
    entries: [
      {
        kind: 'visible-object', objectId: '@spell-copy:workbench-copy', objectKind: 'spell-copy',
        ownerPlayerId: null, controllerPlayerId: 'P1', commander: false,
        definition: clone(definition), runtime: null,
      },
      {
        kind: 'visible-object', objectId: '@activated-ability:workbench-activation',
        objectKind: 'activated-ability', ownerPlayerId: null, controllerPlayerId: 'P1',
        commander: false, definition: null, runtime: null,
      },
      {
        kind: 'visible-object', objectId: '@triggered-ability:workbench-trigger',
        objectKind: 'triggered-ability', ownerPlayerId: null, controllerPlayerId: 'P2',
        commander: false, definition: null, runtime: null,
      },
    ],
  };
  return projection;
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

function keyboardActivate(button: HTMLButtonElement, key: 'Enter' | ' '): void {
  button.focus();
  if (document.activeElement !== button) throw new Error('Native action button did not receive focus');
  const keydownAccepted = button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
  if (!keydownAccepted) throw new Error('Keyboard activation was unexpectedly canceled');
  // jsdom does not synthesize the native button click default action.
  button.click();
  button.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key }));
}

function mount(
  projection: unknown = fixture,
  interactionState: PersonalWorkbenchInteractionStateV1 = 'ready',
  actions: PersonalWorkbenchActionV1[] = [],
): Readonly<{
  container: HTMLDivElement;
  root: Root;
  rerender: (next: PersonalWorkbenchInteractionStateV1) => void;
  rerenderProjection: (nextProjection: unknown, nextState?: PersonalWorkbenchInteractionStateV1) => void;
}> {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = (nextProjection: unknown, next: PersonalWorkbenchInteractionStateV1): void => act(() => {
    root.render(
      <PersonalWorkbench
        projection={nextProjection}
        interactionState={next}
        onAction={(action) => actions.push(action)}
      />,
    );
  });
  render(projection, interactionState);
  return {
    container,
    root,
    rerender: (next) => render(projection, next),
    rerenderProjection: (nextProjection, nextState = interactionState) => render(nextProjection, nextState),
  };
}

describe('O4P-04A Personal Workbench judge acceptance', () => {
  it('builds a fresh frozen Player-only view without mutating or reordering the projection', () => {
    const input = clone(fixture);
    const before = JSON.stringify(input);
    const first = buildPersonalWorkbenchViewV1(input);
    const second = buildPersonalWorkbenchViewV1(input);

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(deeplyFrozen(first)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(first).toMatchObject({
      kind: 'personal-workbench-view-v1',
      schemaVersion: 1,
      revision: 12,
      corePlayerId: 'P1',
      seatIndex: 0,
      roomLifecycle: 'active',
      presence: 'connected',
      outcome: 'pending',
      turn: { activePlayerId: 'P1', turnNumber: 4, phase: 'precombat-main', step: null },
      authorityCounts: { visibilityGrants: 0, searchSessions: 0, playPermissions: 0 },
    });
    expect(first.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(first.zones.ownHand.cards.map((card) => card.kind === 'visible-card' ? card.label : card.kind))
      .toEqual(['《森の知恵》', '《稲妻》']);
    expect(first.zones.battlefield.cards.map((card) => card.kind === 'hidden-card' ? card.kind : card.label))
      .toEqual(['《森》', '《裏向きのカード》']);
  });

  it('accepts every synthetic stack kind through a closed generic view and Japanese rendering', () => {
    const projection = projectionWithSyntheticStack();
    const view = buildPersonalWorkbenchViewV1(projection);

    expect(view.zones.stack.count).toBe(3);
    expect(view.zones.stack.cards).toEqual([
      {
        kind: 'stack-object', objectId: '@spell-copy:workbench-copy',
        objectKind: 'spell-copy', label: '呪文のコピー', controllerPlayerId: 'P1',
      },
      {
        kind: 'stack-object', objectId: '@activated-ability:workbench-activation',
        objectKind: 'activated-ability', label: '起動型能力', controllerPlayerId: 'P1',
      },
      {
        kind: 'stack-object', objectId: '@triggered-ability:workbench-trigger',
        objectKind: 'triggered-ability', label: '誘発型能力', controllerPlayerId: 'P2',
      },
    ]);
    expect(deeplyFrozen(view)).toBe(true);
    expect(JSON.stringify(view.zones.stack.cards)).not.toMatch(/definition|runtime|source|target|choice|legal|oracle/i);

    const mounted = mount(projection);
    const stack = required(mounted.container, '[data-testid="workbench-zone-stack"]');
    expect(stack.querySelectorAll('[data-testid="workbench-stack-object"]')).toHaveLength(3);
    expect(stack.textContent).toContain('呪文のコピー');
    expect(stack.textContent).toContain('起動型能力');
    expect(stack.textContent).toContain('誘発型能力');
    act(() => mounted.root.unmount());

    const misplaced = projectionWithSyntheticStack();
    const activation = misplaced.game.zones.stack.entries.splice(1, 1)[0];
    if (activation === undefined) throw new Error('Judge stack activation is missing');
    misplaced.game.zones.stack.count -= 1;
    misplaced.game.zones.battlefield.entries.push(activation);
    misplaced.game.zones.battlefield.count += 1;
    expect(() => buildPersonalWorkbenchViewV1(misplaced)).toThrow();
  });

  it('renders own information, public state, generic hidden/concealed cards, and stable action surfaces', () => {
    const mounted = mount();
    const { container, root } = mounted;

    expect(required(container, '[data-testid="personal-workbench"]')).not.toBeNull();
    expect(required(container, '[data-testid="workbench-status"]').textContent).toContain('ターン 4');
    expect(container.querySelectorAll('[data-testid="workbench-player-summary"]')).toHaveLength(4);
    expect(container.textContent).toContain('状態 プレイ中');
    expect(container.textContent).not.toMatch(/状態 active/);
    expect(required(container, '[data-testid="workbench-zone-own-hand"]').textContent).toContain('《森の知恵》');
    expect(required(container, '[data-testid="workbench-zone-own-hand"]').textContent).toContain('《稲妻》');
    expect(required(container, '[data-testid="workbench-zone-battlefield"]').textContent).toContain('《森》');
    expect(required(container, '[data-testid="workbench-zone-battlefield"]').textContent).toContain('《裏向きのカード》');
    expect(container.querySelectorAll('[data-testid="workbench-player-summary"]')[1]?.textContent)
      .toContain('手札 1');
    expect(required<HTMLButtonElement>(container, '[data-testid="workbench-refresh"]').textContent).toBe('盤面を更新');
    expect(required<HTMLButtonElement>(container, '[data-testid="workbench-priority-pass"]').textContent).toMatch(/優先権/);
    expect(required<HTMLButtonElement>(container, '[data-testid="workbench-concede"]').textContent).toMatch(/投了/);
    act(() => root.unmount());
  });

  it('renders nonzero concealed marked damage as a public Japanese fact', () => {
    const projection = mutableFixture();
    const concealed = projection.game.zones.battlefield.entries[1];
    const runtime = concealed?.runtime;
    if (typeof runtime !== 'object' || runtime === null) {
      throw new Error('Judge fixture requires one concealed battlefield runtime');
    }
    Reflect.set(runtime, 'markedDamage', 3);

    const mounted = mount(projection);
    expect(required(mounted.container, '[data-testid="workbench-concealed-card"]').textContent)
      .toContain('ダメージ 3');
    act(() => mounted.root.unmount());
  });

  it('fails closed for a non-Player or hostile hidden entry without reflecting secrets or raw diagnostics', () => {
    const table = clone(fixture) as Record<string, unknown>;
    table.role = 'table';
    table.corePlayerId = null;
    const first = mount(table);
    expect(required(first.container, '[data-testid="personal-workbench-unavailable"]').textContent)
      .toContain('表示できません');
    expect(first.container.textContent).not.toMatch(/room-o4p|player-p1|INVALID_|\/game|Error|stack/i);
    act(() => first.root.unmount());

    const hostile = clone(fixture);
    const opponentHand = hostile.game.zones.byPlayer[1].zones.hand.entries[0] as unknown as Record<string, unknown>;
    opponentHand.definition = { name: 'LEAK_ME_PRIVATE_CARD' };
    const second = mount(hostile);
    expect(required(second.container, '[data-testid="personal-workbench-unavailable"]')).not.toBeNull();
    expect(second.container.innerHTML).not.toContain('LEAK_ME_PRIVATE_CARD');
    expect(second.container.innerHTML).not.toContain('PC');
    act(() => second.root.unmount());
  });

  it('fails trap-safe for getter, descriptor, Proxy, and hostile-prototype inputs', () => {
    const getterTrap = clone(fixture) as unknown as Record<string, unknown>;
    Object.defineProperty(getterTrap, 'role', {
      configurable: true,
      enumerable: true,
      get: () => { throw new Error('LEAK_GETTER_SECRET'); },
    });

    const descriptorTrap = clone(fixture) as unknown as Record<string, unknown>;
    Object.defineProperty(descriptorTrap, 'corePlayerId', {
      configurable: true,
      enumerable: false,
      value: 'LEAK_DESCRIPTOR_SECRET',
      writable: true,
    });

    const proxyTrap = new Proxy(clone(fixture), {
      ownKeys: () => { throw new Error('LEAK_PROXY_SECRET'); },
    });

    const prototypeTrap = clone(fixture) as unknown as Record<string, unknown>;
    Object.setPrototypeOf(prototypeTrap, { inheritedSecret: 'LEAK_PROTOTYPE_SECRET' });

    for (const projection of [getterTrap, descriptorTrap, proxyTrap, prototypeTrap]) {
      const mounted = mount(projection);
      expect(required(mounted.container, '[data-testid="personal-workbench-unavailable"]').textContent)
        .toBe('表示できません');
      expect(mounted.container.innerHTML).not.toMatch(/LEAK_|descriptor|getter|proxy|prototype|stack|error/i);
      act(() => mounted.root.unmount());
    }
  });

  it('emits only exact frozen refresh/pass intents and disables server actions while unavailable', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const mounted = mount(fixture, 'ready', actions);
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-refresh"]').click());
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-priority-pass"]').click());
    expect(actions).toEqual([
      { kind: 'request-refresh', knownRevision: 12 },
      { kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 },
    ]);
    expect(actions.every((action) => deeplyFrozen(action))).toBe(true);
    expect(actions.flatMap((action) => Object.keys(action)).sort()).toEqual([
      'actorPlayerId', 'baseRevision', 'kind', 'kind', 'knownRevision',
    ]);
    expect(JSON.stringify(actions)).not.toMatch(/room|participant|capability|commandId|decision/i);

    mounted.rerender('updating');
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-refresh"]').disabled).toBe(false);
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-priority-pass"]').disabled).toBe(true);
    expect(required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]').disabled).toBe(true);
    act(() => mounted.root.unmount());
  });

  it('keeps every action and confirmation control native, focusable, and keyboard-activatable', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const mounted = mount(fixture, 'ready', actions);
    document.body.append(mounted.container);

    const refresh = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-refresh"]');
    const pass = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-priority-pass"]');
    const concede = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]');
    for (const button of [refresh, pass, concede]) {
      expect(button.type).toBe('button');
      expect(button.tabIndex).toBe(0);
      expect(button.textContent?.trim().length).toBeGreaterThan(0);
      expect(button.getAttribute('draggable')).not.toBe('true');
    }

    act(() => keyboardActivate(refresh, 'Enter'));
    act(() => keyboardActivate(pass, ' '));
    expect(actions).toEqual([
      { kind: 'request-refresh', knownRevision: 12 },
      { kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 },
    ]);

    act(() => keyboardActivate(concede, 'Enter'));
    const cancel = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede-cancel"]');
    expect(cancel.tabIndex).toBe(0);
    act(() => keyboardActivate(cancel, ' '));
    expect(mounted.container.querySelector('[data-testid="workbench-concede-confirmation"]')).toBeNull();

    act(() => keyboardActivate(concede, ' '));
    const confirm = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede-confirm"]');
    expect(confirm.tabIndex).toBe(0);
    act(() => keyboardActivate(confirm, 'Enter'));
    expect(actions.at(-1)).toEqual({ kind: 'concede', actorPlayerId: 'P1', baseRevision: 12 });

    act(() => mounted.root.unmount());
    mounted.container.remove();
  });

  it('does not mistake the active turn player for the omitted priority holder', () => {
    const nonActiveTurn = clone(fixture);
    nonActiveTurn.game.turn.activePlayerId = 'P2';
    const actions: PersonalWorkbenchActionV1[] = [];
    const mounted = mount(nonActiveTurn, 'ready', actions);
    const pass = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-priority-pass"]');

    expect(pass.disabled).toBe(false);
    act(() => pass.click());
    expect(actions).toEqual([{ kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 }]);
    act(() => mounted.root.unmount());
  });

  it('requires explicit concede confirmation, supports cancel, and emits exactly once', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const mounted = mount(fixture, 'ready', actions);

    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]').click());
    expect(actions).toEqual([]);
    expect(required(mounted.container, '[data-testid="workbench-concede-confirmation"]').getAttribute('role'))
      .toBe('dialog');
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede-cancel"]').click());
    expect(mounted.container.querySelector('[data-testid="workbench-concede-confirmation"]')).toBeNull();
    expect(actions).toEqual([]);

    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]').click());
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede-confirm"]').click());
    expect(actions).toEqual([{ kind: 'concede', actorPlayerId: 'P1', baseRevision: 12 }]);
    expect(deeplyFrozen(actions[0])).toBe(true);
    expect(mounted.container.querySelector('[data-testid="workbench-concede-confirmation"]')).toBeNull();

    const concede = required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]');
    expect(concede.disabled).toBe(true);
    act(() => concede.click());
    expect(actions).toHaveLength(1);
    act(() => mounted.root.unmount());
  });

  it('invalidates concede confirmation across Player or revision drift', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const mounted = mount(fixture, 'ready', actions);
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]').click());
    expect(required(mounted.container, '[data-testid="workbench-concede-confirmation"]')).not.toBeNull();

    const nextPlayer = clone(fixture);
    nextPlayer.participantId = 'player-p2';
    nextPlayer.corePlayerId = 'P2';
    nextPlayer.revision = 13;
    mounted.rerenderProjection(nextPlayer);
    expect(mounted.container.querySelector('[data-testid="workbench-concede-confirmation"]')).toBeNull();
    expect(actions).toEqual([]);

    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede"]').click());
    act(() => required<HTMLButtonElement>(mounted.container, '[data-testid="workbench-concede-confirm"]').click());
    expect(actions).toEqual([{ kind: 'concede', actorPlayerId: 'P2', baseRevision: 13 }]);
    act(() => mounted.root.unmount());
  });
});
