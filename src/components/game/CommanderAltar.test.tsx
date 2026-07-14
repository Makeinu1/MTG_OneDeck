import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../store/gameStore';
import { CommanderAltar } from './CommanderAltar';
import type { GameController } from './gameController';

vi.mock('./sound', () => ({ celebrate: vi.fn() }));

function controllerForAway(): { controller: GameController; openCardMenu: ReturnType<typeof vi.fn> } {
  const state = buildVisualFixture('partner-away').snapshot.state;
  useGameStore.setState({ state });
  const store = useGameStore.getState();
  const openCardMenu = vi.fn();
  return {
    openCardMenu,
    controller: {
      state,
      store,
      openCardMenu,
      handleCardDoubleClick: vi.fn(),
      requestResolveTop: vi.fn(),
      requestResolveAll: vi.fn(),
      advancePhase: vi.fn(),
      advanceTurn: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      setManualTargets: vi.fn(),
      openLibraryActions: vi.fn(),
      libraryActionsOpen: false,
      openZoneViewer: vi.fn(),
      openTokenDialog: vi.fn(),
      openAttackDialog: vi.fn(),
      openArrangeTop: vi.fn(),
      openCountDialog: vi.fn(),
      requestConfirm: vi.fn(),
      triggerCandidateCount: 0,
      motionArmed: false,
      feedOpen: false,
      openFeed: vi.fn(),
      closeFeed: vi.fn(),
      overlays: null,
      shortcutsBlocked: false,
      transitionCue: null,
      dismissTransitionCue: vi.fn(),
      performDrop: vi.fn(),
      closeTransientUi: vi.fn(),
    },
  };
}

afterEach(() => {
  useGameStore.setState({ state: null });
  document.body.replaceChildren();
});

describe('CommanderAltar', () => {
  it('opens and closes the temporary commander panel without removing its trigger', () => {
    const { controller } = controllerForAway();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<CommanderAltar controller={controller} />));
    const altar = container.querySelector<HTMLElement>('[data-testid="commander-altar"]');
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="commander-altar-toggle"]');

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger?.click());
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(altar?.dataset.open).toBe('true');

    const panel = container.querySelector<HTMLElement>('#commander-altar-panel');
    act(() => {
      panel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(altar?.dataset.open).toBeUndefined();
    act(() => root.unmount());
  });

  it('keeps a commander outside the command zone keyboard- and pointer-operable', () => {
    const { controller, openCardMenu } = controllerForAway();
    const awayId = controller.state?.commanders.find(({ castCount }) => castCount === 2)?.cardId;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<CommanderAltar controller={controller} />));
    const proxy = container.querySelector<HTMLButtonElement>(`[data-testid="commander-away-${awayId}"]`);

    expect(proxy?.tagName).toBe('BUTTON');
    expect(proxy?.getAttribute('aria-label')).toContain('現在墓地、統率者税4');
    act(() => proxy?.click());
    act(() => {
      proxy?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    });
    expect(openCardMenu).toHaveBeenCalledTimes(2);
    expect(openCardMenu.mock.calls.every(([cardId]) => cardId === awayId)).toBe(true);
    act(() => root.unmount());
  });
});
