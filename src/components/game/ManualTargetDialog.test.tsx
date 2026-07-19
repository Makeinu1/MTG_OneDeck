import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { ManualTargetDialog } from './ManualTargetDialog';
import { applyCommand } from '../../engine/commands';
import { requestInteractionHistory } from './historyUiEvents';

afterEach(() => document.body.replaceChildren());

describe('ManualTargetDialog', () => {
  it('lists activated and triggered abilities on the stack as manual targets', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourcePermanentId = initial.zones.battlefield.find((id) => !initial.cards[id].isAbility)!;
    const withActivated = applyCommand(initial, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'activated',
    }).state;
    const activatedId = withActivated.zones.stack.at(-1)!;
    const withTriggered = applyCommand(withActivated, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'triggered',
    }).state;
    const triggeredId = withTriggered.zones.stack.at(-1)!;
    const sourceId = withTriggered.zones.stack.find((id) =>
      id !== activatedId && id !== triggeredId && !withTriggered.cards[id].isAbility,
    )!;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <ManualTargetDialog state={withTriggered} sourceId={sourceId} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    ));

    expect(document.querySelector(`[data-testid="manual-target-${activatedId}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-testid="manual-target-${triggeredId}"]`)).not.toBeNull();
    expect(document.body.textContent).toContain('スタック上の起動型能力');
    expect(document.body.textContent).toContain('スタック上の誘発型能力');
    act(() => root.unmount());
  });

  it('offers self and opponent even when the card rules are not modeled', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const sourceId = state.zones.stack.find((id) => !state.cards[id].isAbility)!;
    const onConfirm = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <ManualTargetDialog state={state} sourceId={sourceId} onConfirm={onConfirm} onCancel={vi.fn()} />,
    ));

    const self = document.querySelector<HTMLInputElement>('[data-testid="manual-target-player-P1"]')!;
    const opponent = document.querySelector<HTMLInputElement>('[data-testid="manual-target-player-OPPONENT_A"]')!;
    act(() => self.click());
    act(() => opponent.click());
    act(() => document.querySelector<HTMLButtonElement>('[data-testid="manual-target-confirm"]')?.click());

    expect(onConfirm).toHaveBeenCalledWith([], ['P1', 'OPPONENT_A']);
    act(() => root.unmount());
  });

  it('groups manual candidates from every public zone plus the local hand', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const handId = initial.zones.hand[0];
    const movable = initial.zones.battlefield.slice(0, 3);
    const [graveyardId, exileId, commandId] = movable;
    if (!graveyardId || !exileId || !commandId) throw new Error('fixture targets missing');
    const withGraveyard = applyCommand(initial, {
      type: 'moveCard', cardId: graveyardId, to: 'graveyard', position: 'bottom',
    }).state;
    const withExile = applyCommand(withGraveyard, {
      type: 'moveCard', cardId: exileId, to: 'exile', position: 'bottom',
    }).state;
    const state = applyCommand(withExile, {
      type: 'moveCard', cardId: commandId, to: 'command', position: 'bottom',
    }).state;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <ManualTargetDialog state={state} sourceId={sourceId} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    ));

    for (const cardId of [handId, graveyardId, exileId, commandId]) {
      expect(document.querySelector(`[data-testid="manual-target-${cardId}"]`)).not.toBeNull();
    }
    expect(document.body.textContent).toContain('手札');
    expect(document.body.textContent).toContain('墓地');
    expect(document.body.textContent).toContain('追放');
    expect(document.body.textContent).toContain('統率領域');
    expect(document.body.textContent).toContain('/ あなた');
    act(() => root.unmount());
  });

  it('undoes checkbox choices one at a time and closes only at the interaction boundary', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const sourceId = state.zones.stack.find((id) => !state.cards[id].isAbility)!;
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <ManualTargetDialog state={state} sourceId={sourceId} onConfirm={onConfirm} onCancel={onCancel} />,
    ));
    const self = document.querySelector<HTMLInputElement>('[data-testid="manual-target-player-P1"]')!;
    const opponent = document.querySelector<HTMLInputElement>('[data-testid="manual-target-player-OPPONENT_A"]')!;
    act(() => self.click());
    act(() => opponent.click());

    act(() => { requestInteractionHistory('undo'); });
    act(() => document.querySelector<HTMLButtonElement>('[data-testid="manual-target-confirm"]')?.click());
    expect(onConfirm).toHaveBeenLastCalledWith([], ['P1']);
    expect(onCancel).not.toHaveBeenCalled();

    act(() => { requestInteractionHistory('undo'); });
    act(() => { requestInteractionHistory('undo'); });
    expect(onCancel).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
