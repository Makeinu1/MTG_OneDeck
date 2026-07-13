import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { ManualTargetDialog } from './ManualTargetDialog';

afterEach(() => document.body.replaceChildren());

describe('ManualTargetDialog', () => {
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
});
