// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import personalFixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import {
  bindPersonalWorkbenchActionV1,
  buildOnlineDisplayPairingViewV1,
  type OnlineOpponentFocusActionV1,
} from '../../../online/displayPairing/index';
import {
  validateOnlineCommandEnvelopeV1,
} from '../../../online/protocol/index';
import { validateOnlineProjectionRequestV1 } from '../../../online/projection/index';
import { OnlineDisplayPairing } from '../OnlineDisplayPairing';
import type { PersonalWorkbenchActionV1 } from '../../../online/workbench/index';

type MutableRecord = Record<string, unknown>;
type MutableProjection = {
  protocolVersion: number;
  roomId: string;
  participantId: string;
  role: string;
  corePlayerId: string | null;
  revision: number;
  room: {
    lifecycle: string;
    participants: Array<{ participantId: string; role: string; presence: string; seatIndex: number | null }>;
    seats: Array<{ seatIndex: number; corePlayerId: string; participantId: string | null; ready: boolean; outcome: string }>;
  };
  game: {
    turn: { activePlayerId: string; turnNumber: number; positionSequence: number; position: { phase: string; step: string | null } };
    players: Array<{ playerId: string; life: number; poison: number; status: string }>;
    zones: {
      byPlayer: Array<{
        playerId: string;
        zones: Record<'library' | 'hand' | 'graveyard', { count: number; entries: unknown[] }>;
      }>;
      battlefield: { count: number; entries: unknown[] };
      stack: { count: number; entries: unknown[] };
      exile: { count: number; entries: unknown[] };
      command: { count: number; entries: unknown[] };
    };
  };
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pair(): { personal: MutableProjection; table: MutableProjection } {
  const personal = clone(personalFixture) as unknown as MutableProjection;
  personal.room.participants.push({
    participantId: 'table-display', role: 'table', presence: 'connected', seatIndex: null,
  });
  const table = clone(personal);
  table.participantId = 'table-display';
  table.role = 'table';
  table.corePlayerId = null;
  for (const group of table.game.zones.byPlayer) {
    for (const zoneName of ['library', 'hand'] as const) {
      const zone = group.zones[zoneName];
      zone.entries = Array.from({ length: zone.count }, () => ({ kind: 'hidden-card' }));
    }
  }
  return { personal, table };
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => deeplyFrozen(child, seen));
}

function required<T extends Element = Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing Judge test element: ${selector}`);
  return found;
}

function mount(
  projections = pair(),
  focusedPlayerId: string | null = null,
  focusActions: OnlineOpponentFocusActionV1[] = [],
  workbenchActions: PersonalWorkbenchActionV1[] = [],
): {
  container: HTMLDivElement;
  root: Root;
  rerender: (next: ReturnType<typeof pair>, focus?: string | null) => void;
} {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = (next: ReturnType<typeof pair>, focus: string | null): void => {
    act(() => root.render(
      <OnlineDisplayPairing
        personalProjection={next.personal}
        tableProjection={next.table}
        interactionState="ready"
        focusedPlayerId={focus}
        onFocus={(action) => focusActions.push(action)}
        onAction={(action) => workbenchActions.push(action)}
      />,
    ));
  };
  render(projections, focusedPlayerId);
  return { container, root, rerender: (next, focus = focusedPlayerId) => render(next, focus) };
}

function bindingInput(action: PersonalWorkbenchActionV1, commandId: string | null): MutableRecord {
  return {
    session: {
      protocolVersion: 1,
      roomId: 'room-o4p-04a-fixture',
      participantId: 'player-p1',
      participantCapability: 'seat_capability_AAAAAAAAAAAAAAAA',
      clientBuildId: 'o4p-04c-client-build',
      corePlayerId: 'P1',
    },
    action,
    commandId,
  };
}

function pairingInput(projections: ReturnType<typeof pair>, focusedPlayerId: string | null): MutableRecord {
  return {
    personalProjection: projections.personal,
    tableProjection: projections.table,
    focusedPlayerId,
  };
}

describe('O4P-04C Display Pairing review', () => {
  it('builds one fresh frozen seat-relative pair without retaining audience inputs', () => {
    const projections = pair();
    const before = JSON.stringify(projections);
    const first = buildOnlineDisplayPairingViewV1(pairingInput(projections, null));
    const second = buildOnlineDisplayPairingViewV1(pairingInput(projections, null));

    expect(first).toEqual({
      kind: 'online-display-pairing-view-v1',
      schemaVersion: 1,
      revision: 12,
      ownPlayerId: 'P1',
      ownSeatIndex: 0,
      opponents: [
        { playerId: 'P2', seatIndex: 1, isFocused: false, isActive: false, presence: 'connected', outcome: 'pending', status: 'active', life: 34, poison: 0 },
        { playerId: 'P3', seatIndex: 2, isFocused: false, isActive: false, presence: 'connected', outcome: 'pending', status: 'active', life: 40, poison: 1 },
        { playerId: 'P4', seatIndex: 3, isFocused: false, isActive: false, presence: 'connected', outcome: 'pending', status: 'active', life: 27, poison: 0 },
      ],
      focusedOpponent: null,
    });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.opponents).not.toBe(first.opponents);
    expect(deeplyFrozen(first)).toBe(true);
    expect(JSON.stringify(projections)).toBe(before);
    expect(JSON.stringify(first)).not.toMatch(/room-o4p|player-p|capability|hand|library|graveyard|definition|oracle/i);
  });

  it('uses only a valid live opponent focus and preserves projected turn order', () => {
    const projections = pair();
    const focused = buildOnlineDisplayPairingViewV1(pairingInput(projections, 'P3'));
    expect(focused.opponents.map((opponent) => opponent.playerId)).toEqual(['P2', 'P3', 'P4']);
    expect(focused.opponents.map((opponent) => opponent.isFocused)).toEqual([false, true, false]);
    expect(focused.focusedOpponent).toEqual(focused.opponents[1]);

    for (const focusedPlayerId of ['P1', 'P9']) {
      expect(() => buildOnlineDisplayPairingViewV1(pairingInput(projections, focusedPlayerId)))
        .toThrow('Display pairing is unavailable');
    }
    projections.personal.game.players[2].status = 'exited';
    projections.table.game.players[2].status = 'exited';
    projections.personal.room.seats[2].outcome = 'defeated';
    projections.table.room.seats[2].outcome = 'defeated';
    expect(() => buildOnlineDisplayPairingViewV1(pairingInput(projections, 'P3')))
      .toThrow('Display pairing is unavailable');
  });

  it('rejects legacy aliases, missing fields, and unknown fields at the exact input root', () => {
    const projections = pair();
    expect(() => buildOnlineDisplayPairingViewV1({
      personal: projections.personal,
      table: projections.table,
      focusedPlayerId: null,
    })).toThrow('Display pairing is unavailable');
    expect(() => buildOnlineDisplayPairingViewV1({
      ...pairingInput(projections, null),
      unexpected: true,
    })).toThrow('Display pairing is unavailable');
  });

  it('fails closed on cross-Room, revision, public-fact, shared-zone, and Table privacy drift', () => {
    const drifts: Array<(value: ReturnType<typeof pair>) => void> = [
      ({ table }) => { table.roomId = 'other-room'; },
      ({ table }) => { table.revision += 1; },
      ({ table }) => { table.game.players[1].life -= 1; },
      ({ table }) => { table.game.zones.battlefield.count += 1; },
      ({ table }) => { (table.game.zones.byPlayer[0].zones.hand.entries[0] as MutableRecord).definition = { name: 'LEAK_PRIVATE' }; },
    ];
    for (const mutate of drifts) {
      const projections = pair();
      mutate(projections);
      const mounted = mount(projections);
      expect(required(mounted.container, '[data-testid="online-display-pairing-unavailable"]').textContent)
        .toBe('表示を同期できません');
      expect(mounted.container.innerHTML).not.toMatch(/LEAK_PRIVATE|other-room|INVALID_|\/game|stack|error/i);
      act(() => mounted.root.unmount());
    }
  });

  it('revalidates same references and drops prior paired content after mutation', () => {
    const projections = pair();
    const mounted = mount(projections);
    expect(required(mounted.container, '[data-testid="online-display-pairing"]').textContent)
      .toContain('リビジョン 12');
    projections.table.revision = 13;
    mounted.rerender(projections);
    expect(required(mounted.container, '[data-testid="online-display-pairing-unavailable"]').textContent)
      .toBe('表示を同期できません');
    expect(mounted.container.querySelector('[data-testid="personal-workbench"]')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="table-display"]')).toBeNull();
    act(() => mounted.root.unmount());
  });

  it('is trap-safe and never reflects hostile diagnostics', () => {
    const getterPair = pair();
    Object.defineProperty(getterPair.table, 'revision', {
      enumerable: true, configurable: true, get: () => { throw new Error('LEAK_GETTER'); },
    });
    const proxyPair = pair();
    proxyPair.personal = new Proxy(proxyPair.personal, {
      ownKeys: () => { throw new Error('LEAK_PROXY'); },
    });
    for (const projections of [getterPair, proxyPair]) {
      const mounted = mount(projections);
      expect(required(mounted.container, '[data-testid="online-display-pairing-unavailable"]').textContent)
        .toBe('表示を同期できません');
      expect(mounted.container.innerHTML).not.toMatch(/LEAK_|getter|proxy|stack|error/i);
      act(() => mounted.root.unmount());
    }
  });

  it('binds refresh, priority pass, and concede to exact validator-accepted frozen frames', () => {
    const refreshInput = bindingInput({ kind: 'request-refresh', knownRevision: 12 }, null);
    const refresh = bindPersonalWorkbenchActionV1(refreshInput);
    expect(refresh).toEqual({
      kind: 'online-projection-request-v1', protocolVersion: 1,
      roomId: 'room-o4p-04a-fixture', participantId: 'player-p1',
      participantCapability: 'seat_capability_AAAAAAAAAAAAAAAA', knownRevision: 12,
      clientBuildId: 'o4p-04c-client-build', decisionContext: null,
    });
    expect(validateOnlineProjectionRequestV1(refresh).ok).toBe(true);

    const pass = bindPersonalWorkbenchActionV1(bindingInput(
      { kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 },
      'o4p-04c-pass-13',
    ));
    expect(pass).toMatchObject({
      kind: 'online-command-envelope-v1', baseRevision: 12, commandId: 'o4p-04c-pass-13',
      command: {
        kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 13,
        actorPlayerId: 'P1', decisionMakerPlayerId: 'P1',
        decisionContext: { kind: 'decision', decisionKey: 'o4p-04c-pass-13' },
        payload: { kind: 'priority-pass', playerId: 'P1' },
      },
    });
    expect(validateOnlineCommandEnvelopeV1(pass).ok).toBe(true);

    const concede = bindPersonalWorkbenchActionV1(bindingInput(
      { kind: 'concede', actorPlayerId: 'P1', baseRevision: 12 },
      'o4p-04c-concede-13',
    ));
    expect(concede).toMatchObject({
      kind: 'online-command-envelope-v1', baseRevision: 12,
      command: { sequence: 13, payload: { kind: 'player-exit', playerId: 'P1', cause: 'concession' } },
    });
    expect(validateOnlineCommandEnvelopeV1(concede).ok).toBe(true);
    expect([refresh, pass, concede].every((frame) => deeplyFrozen(frame))).toBe(true);
  });

  it('rejects action/session/command mismatches with one secret-free error', () => {
    const cases = [
      bindingInput({ kind: 'request-refresh', knownRevision: 12 }, 'unexpected-command'),
      bindingInput({ kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 }, null),
      bindingInput({ kind: 'concede', actorPlayerId: 'P2', baseRevision: 12 }, 'o4p-04c-concede-13'),
    ];
    (cases[2].session as MutableRecord).participantCapability = 'SECRET_CAPABILITY_VALUE_1234567890';
    for (const value of cases) {
      try {
        bindPersonalWorkbenchActionV1(value);
        throw new Error('Judge expected binding rejection');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Personal Workbench action binding is unavailable');
        expect(String(error)).not.toMatch(/SECRET_|participant|capability|P2|command/i);
      }
    }
  });

  it('composes the real audience surfaces and emits native frozen focus actions only for opponents', () => {
    const focusActions: OnlineOpponentFocusActionV1[] = [];
    const mounted = mount(pair(), null, focusActions);
    expect(required(mounted.container, '[data-testid="online-display-pairing-status"]').textContent)
      .toContain('リビジョン 12');
    expect(required(mounted.container, '[data-testid="personal-workbench"]')).not.toBeNull();
    expect(required(mounted.container, '[data-testid="table-display"]')).not.toBeNull();
    const buttons = [...mounted.container.querySelectorAll<HTMLButtonElement>('[data-testid="online-opponent-focus"]')];
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('P2'), expect.stringContaining('P3'), expect.stringContaining('P4'),
    ]));
    expect(buttons.every((button) => button.type === 'button' && button.tabIndex === 0)).toBe(true);
    act(() => buttons[1].click());
    expect(focusActions).toEqual([{ kind: 'focus-opponent', playerId: 'P3', revision: 12 }]);
    expect(deeplyFrozen(focusActions[0])).toBe(true);
    expect(JSON.stringify(focusActions)).not.toMatch(/room|participant|capability|hand|definition/i);
    expect(mounted.container.textContent).toMatch(/優先権保持者の情報は含まれていません/);
    expect(mounted.container.textContent).not.toMatch(/承認済み|成功|合法/);
    act(() => mounted.root.unmount());
  });
});
