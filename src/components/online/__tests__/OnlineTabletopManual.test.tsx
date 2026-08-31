// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnlineParticipantProjectionV1 } from '../../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../../online/tabletopManual';
import { OnlineTabletopManual } from '../OnlineTabletopManual';

const projection = {
  kind: 'online-participant-projection-v1',
  schemaVersion: 1,
  protocolVersion: 1,
  roomId: 'table-room',
  participantId: 'table-player',
  role: 'player',
  corePlayerId: 'P1',
  revision: 4,
  room: { lifecycle: 'active', hostParticipantId: 'table-player', participants: [], seats: [] },
  game: {
    turnOrder: ['P1', 'P2'],
    turn: { activePlayerId: 'P1', turnNumber: 1, positionSequence: 0, position: { phase: 'precombat-main', step: null } },
    players: [
      { playerId: 'P1', life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none', status: 'active', exitCause: null },
      { playerId: 'P2', life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none', status: 'active', exitCause: null },
    ],
    zones: {
      byPlayer: [{ playerId: 'P1', zones: { library: { count: 3, entries: [{ kind: 'hidden-card' }, { kind: 'hidden-card' }, { kind: 'hidden-card' }] }, hand: { count: 1, entries: [{ kind: 'visible-object', objectId: 'PC1:0', objectKind: 'card', ownerPlayerId: 'P1', controllerPlayerId: 'P1', commander: false, definition: { name: 'テストカード' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } }] }, graveyard: { count: 0, entries: [] } } }],
      battlefield: { count: 4, entries: [
        { kind: 'visible-object', objectId: 'PC2:0', objectKind: 'card', ownerPlayerId: 'P1', controllerPlayerId: 'P1', commander: false, definition: { name: '戦場カード' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
        { kind: 'visible-object', objectId: 'PC3:0', objectKind: 'card', ownerPlayerId: 'P2', controllerPlayerId: 'P2', commander: false, definition: { name: '相手のカード' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
        { kind: 'visible-object', objectId: 'TK1:0', objectKind: 'token', ownerPlayerId: 'P1', controllerPlayerId: 'P1', commander: false, definition: { name: 'トークン' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
        { kind: 'visible-object', objectId: 'TK2:0', objectKind: 'token', ownerPlayerId: 'P2', controllerPlayerId: 'P2', commander: false, definition: { name: '相手のトークン' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
      ] },
      stack: { count: 2, entries: [
        { kind: 'visible-object', objectId: 'ST1:0', objectKind: 'spell-copy', ownerPlayerId: 'P1', controllerPlayerId: 'P1', commander: false, definition: { name: '自分のスタック項目' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
        { kind: 'visible-object', objectId: 'ST2:0', objectKind: 'spell-copy', ownerPlayerId: 'P2', controllerPlayerId: 'P2', commander: false, definition: { name: '相手のスタック項目' }, runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } } },
      ] }, exile: { count: 0, entries: [] }, command: { count: 0, entries: [] },
    },
    visibilityGrants: [], searchSessions: [], playPermissions: [],
    notes: [
      { id: 'note-1', authorPlayerId: 'P1', text: '作成者メモ', creationRevision: 4 },
      { id: 'note-2', authorPlayerId: 'P2', text: '相手のメモ', creationRevision: 4 },
    ],
    manualStack: [
      { id: 'stack-top', label: '現在の最上段', provenance: 'structured', sourceObjectId: null, authorPlayerId: 'P1', creationRevision: 4 },
    ],
  },
} as unknown as OnlineParticipantProjectionV1;

function mount(props: Partial<React.ComponentProps<typeof OnlineTabletopManual>> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onSubmit = vi.fn<(envelope: OnlineTabletopIntentEnvelopeV1) => void>();
  act(() => root.render(<OnlineTabletopManual projection={projection} interactionState="ready" onSubmit={onSubmit} {...props} />));
  return { container, root, onSubmit };
}

function unmount(root: ReturnType<typeof createRoot>): void {
  act(() => root.unmount());
}

function change(container: HTMLElement, testId: string, value: string): void {
  const field = container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-testid="${testId}"]`);
  if (field === null) throw new Error(`Missing field ${testId}`);
  const prototype = field instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Reflect.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter === undefined) throw new Error(`Cannot set field ${testId}`);
  act(() => {
    Reflect.apply(setter, field, [value]);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function click(container: HTMLElement, testId: string): void {
  const button = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (button === null) throw new Error(`Missing button ${testId}`);
  act(() => button.click());
}

function optionValues(container: HTMLElement, testId: string): readonly string[] {
  const select = container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (select === null) throw new Error(`Missing select ${testId}`);
  return Array.from(select.options, (option) => option.value);
}

afterEach(() => document.body.replaceChildren());

describe('OnlineTabletopManual', () => {
  it('offers both manual modes and emits a versioned server intent', () => {
    const mounted = mount();
    const freeform = mounted.container.querySelector<HTMLInputElement>('[data-testid="online-tabletop-mode-freeform"]');
    expect(freeform).not.toBeNull();
    act(() => freeform?.click());
    expect(mounted.container.querySelector('[data-testid="online-tabletop-mode-label"]')?.textContent).toContain('Freeform Manual');
    act(() => mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-shuffle"]')?.click());
    expect(mounted.onSubmit).toHaveBeenCalledTimes(1);
    expect(mounted.onSubmit.mock.calls[0]?.[0]).toMatchObject({ kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1, baseRevision: 4, mode: 'freeform', primitive: { kind: 'shuffle' } });
    unmount(mounted.root);
  });

  it('emits every executable primitive family from bounded projection controls', () => {
    const mounted = mount();
    const submit = (testId: string): void => click(mounted.container, testId);
    change(mounted.container, 'online-tabletop-move-object', 'PC1:0'); submit('online-tabletop-submit-move');
    submit('online-tabletop-submit-draw');
    submit('online-tabletop-submit-shuffle');
    submit('online-tabletop-submit-reorder');
    change(mounted.container, 'online-tabletop-tap-object', 'PC2:0'); submit('online-tabletop-submit-tap');
    change(mounted.container, 'online-tabletop-counter-object', 'PC2:0');
    change(mounted.container, 'online-tabletop-counter-kind', 'charge'); submit('online-tabletop-submit-counter');
    change(mounted.container, 'online-tabletop-damage-object', 'PC2:0');
    change(mounted.container, 'online-tabletop-damage-amount', '-1'); submit('online-tabletop-submit-damage');
    submit('online-tabletop-submit-life');
    submit('online-tabletop-submit-mana');
    submit('online-tabletop-submit-token-create');
    expect(mounted.container.querySelector('[data-testid="online-tabletop-token-object"]')?.textContent).not.toContain('相手のトークン');
    change(mounted.container, 'online-tabletop-token-object', 'TK1:0'); submit('online-tabletop-submit-token-remove');
    change(mounted.container, 'online-tabletop-controller-object', 'PC2:0');
    change(mounted.container, 'online-tabletop-controller-player', 'P2'); submit('online-tabletop-submit-controller');
    change(mounted.container, 'online-tabletop-attach-object', 'PC2:0');
    change(mounted.container, 'online-tabletop-attach-target', 'PC3:0'); submit('online-tabletop-submit-attach');
    expect(mounted.container.querySelector('[data-testid="online-tabletop-stack-source"]')?.textContent).not.toContain('相手のスタック項目');
    change(mounted.container, 'online-tabletop-stack-source', 'ST1:0');
    change(mounted.container, 'online-tabletop-note-text', '公開メモ'); submit('online-tabletop-submit-note-set');
    expect(mounted.container.querySelector('[data-testid="online-tabletop-clear-note-id"]')?.textContent).not.toContain('相手のメモ');
    change(mounted.container, 'online-tabletop-clear-note-id', 'note-1'); submit('online-tabletop-submit-note-clear');
    submit('online-tabletop-submit-stack-entry');
    submit('online-tabletop-submit-manual-resolve');

    const kinds = mounted.onSubmit.mock.calls.map(([envelope]) => envelope.primitive.kind);
    expect(mounted.onSubmit).toHaveBeenCalledTimes(17);
    expect(kinds).toEqual([
      'move', 'draw', 'shuffle', 'reorder', 'tap', 'counter', 'damage', 'life', 'mana',
      'token-create', 'token-remove', 'controller', 'attach', 'note-set', 'note-clear',
      'stack-entry', 'manual-resolve',
    ]);
    const reorder = mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'reorder')?.[0];
    expect(reorder?.primitive.order).toEqual(['TK2:0', 'TK1:0', 'PC3:0', 'PC2:0']);
    expect(mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'counter')?.[0].primitive.counterKind).toBe('charge');
    expect(mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'damage')?.[0].primitive.amount).toBe(-1);
    expect(mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'stack-entry')?.[0].primitive.sourceObjectId).toBe('ST1:0');
    expect(mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'note-clear')?.[0].primitive.noteId).toBe('note-1');
    expect(mounted.onSubmit.mock.calls.find(([envelope]) => envelope.primitive.kind === 'manual-resolve')?.[0].primitive.entryId).toBe('stack-top');
    expect(mounted.container.querySelector('[data-testid="online-tabletop-counter-object"]')?.textContent).not.toContain('相手のカード');
    expect(mounted.container.querySelector('[data-testid="online-tabletop-attach-target"]')?.textContent).toContain('相手のカード');
    unmount(mounted.root);
  });

  it('blocks zero deltas, untrimmed/control text, and reuses no command ID after remount', () => {
    const first = mount();
    change(first.container, 'online-tabletop-counter-object', 'PC2:0');
    change(first.container, 'online-tabletop-counter-delta', '0');
    expect(first.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-counter"]')?.disabled).toBe(true);
    change(first.container, 'online-tabletop-note-text', ' メモ');
    expect(first.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-note-set"]')?.disabled).toBe(true);
    change(first.container, 'online-tabletop-note-text', 'メモ\n');
    expect(first.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-note-set"]')?.disabled).toBe(true);
    change(first.container, 'online-tabletop-note-text', 'メモ');
    click(first.container, 'online-tabletop-submit-draw');
    const firstCommandId = first.onSubmit.mock.calls[0]?.[0].commandId;
    unmount(first.root);
    const second = mount();
    click(second.container, 'online-tabletop-submit-draw');
    const secondCommandId = second.onSubmit.mock.calls[0]?.[0].commandId;
    expect(secondCommandId).not.toBe(firstCommandId);
    unmount(second.root);
  });

  it('gates actions while offline/busy and keeps successor vocabulary disabled', () => {
    const mounted = mount({ interactionState: 'offline', busy: true, error: 'private transport detail' });
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-shuffle"]')?.disabled).toBe(true);
    expect(mounted.container.querySelector<HTMLInputElement>('[data-testid="online-tabletop-mode-freeform"]')?.disabled).toBe(true);
    expect(mounted.container.querySelector('[data-testid="online-tabletop-disabled-look"]')).toHaveProperty('disabled', true);
    expect(mounted.container.querySelector('[data-testid="online-tabletop-disabled-reveal"]')).toHaveProperty('disabled', true);
    expect(mounted.container.querySelector('[data-testid="online-tabletop-disabled-choose"]')).toHaveProperty('disabled', true);
    expect(mounted.container.textContent).not.toContain('private transport detail');
    unmount(mounted.root);
  });

  it('only offers operable controlled targets and blocks another-author stack resolve', () => {
    const hostileProjection = {
      ...projection,
      game: {
        ...projection.game,
        zones: {
          ...projection.game.zones,
          battlefield: {
            ...projection.game.zones.battlefield,
            entries: [
              ...projection.game.zones.battlefield.entries,
              {
                kind: 'visible-object', objectId: 'PC4:0', objectKind: 'card', ownerPlayerId: 'P1', controllerPlayerId: 'P2', commander: false,
                definition: { name: '自分所有・相手操作のカード' },
                runtime: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false, counters: [], markedDamage: 0, attachment: { kind: 'none' } },
              },
            ],
          },
        },
        manualStack: [{ id: 'other-top', label: '相手が記録した最上段', provenance: 'freeform', sourceObjectId: null, authorPlayerId: 'P2', creationRevision: 4 }],
      },
    } as unknown as OnlineParticipantProjectionV1;
    const mounted = mount({ projection: hostileProjection });
    for (const testId of [
      'online-tabletop-tap-object',
      'online-tabletop-counter-object',
      'online-tabletop-damage-object',
      'online-tabletop-controller-object',
      'online-tabletop-attach-object',
      'online-tabletop-token-object',
    ]) expect(optionValues(mounted.container, testId)).not.toContain('PC4:0');
    expect(optionValues(mounted.container, 'online-tabletop-attach-target')).toContain('PC4:0');
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-manual-resolve"]')?.disabled).toBe(true);
    unmount(mounted.root);
  });

  it('blocks manual resolve while any player has an assisted HOLD', () => {
    const heldProjection = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: { holderPlayerId: 'P1', stewardPlayerId: 'P1', windowKind: 'resolution-ready', holds: ['P2'], responseWindow: null, topStackObjectId: null },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const mounted = mount({ projection: heldProjection });
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-manual-resolve"]')?.disabled).toBe(true);
    unmount(mounted.root);
  });

  it('does not expose generic Advance as the SBA confirmation route', () => {
    const sbaProjection = {
      ...projection,
      game: {
        ...projection.game,
        assistedPriority: { holderPlayerId: null, stewardPlayerId: 'P1', windowKind: 'sba-check-required', holds: [], responseWindow: null, topStackObjectId: null },
      },
    } as unknown as OnlineParticipantProjectionV1;
    const mounted = mount({ projection: sbaProjection });
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-priority-advance"]')?.disabled).toBe(true);
    expect(mounted.container.textContent).toContain('SBA確認は共有テーブル上部の専用ボタン');
    unmount(mounted.root);
  });

  it('requires an active empty-stack checkpoint for source-less manual stack entries', () => {
    const mounted = mount();
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-stack-entry"]')?.disabled).toBe(true);
    change(mounted.container, 'online-tabletop-stack-source', 'ST1:0');
    expect(mounted.container.querySelector<HTMLButtonElement>('[data-testid="online-tabletop-submit-stack-entry"]')?.disabled).toBe(false);
    unmount(mounted.root);
  });
});
