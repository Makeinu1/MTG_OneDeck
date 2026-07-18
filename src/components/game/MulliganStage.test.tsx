import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { MulliganStage } from './MulliganStage';

function mount(node: ReactNode) {
  const screen = document.createElement('div');
  screen.className = 'game-screen';
  const background = document.createElement('button');
  background.textContent = '盤面操作';
  screen.appendChild(background);
  const host = document.createElement('div');
  screen.appendChild(host);
  document.body.appendChild(screen);
  const root = createRoot(host);
  act(() => root.render(node));
  return { screen, background, host, root };
}

afterEach(() => document.body.replaceChildren());

describe('MulliganStage', () => {
  it('spotlights the opening hand and makes the underlying board inert', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const view = mount(<MulliganStage state={state} mode="decision" onKeep={vi.fn()} onMulligan={vi.fn()} />);
    expect(view.host.querySelectorAll('[data-testid^="mulligan-stage-card-"]')).toHaveLength(7);
    expect(view.background.inert).toBe(true);
    expect(view.background.getAttribute('aria-hidden')).toBe('true');
    act(() => view.root.unmount());
    expect(view.background.inert).toBe(false);
  });

  it('only confirms the exact number of bottom cards', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const onBottomConfirm = vi.fn();
    const view = mount(<MulliganStage state={state} mode="bottom" bottomCount={2} onBottomConfirm={onBottomConfirm} />);
    const cards = view.host.querySelectorAll<HTMLButtonElement>('[data-testid^="mulligan-stage-card-"]');
    const confirm = view.host.querySelector<HTMLButtonElement>('[data-testid="mulligan-bottom-confirm"]')!;
    expect(confirm.disabled).toBe(true);
    act(() => cards[0].click());
    act(() => cards[1].click());
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onBottomConfirm).toHaveBeenCalledWith([state.zones.hand[0], state.zones.hand[1]]);
    act(() => view.root.unmount());
  });
});
