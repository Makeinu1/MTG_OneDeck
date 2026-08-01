import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../store/gameStore';
import { CommanderAltar } from './CommanderAltar';
import type { GameController } from './gameController';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';


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
      requestDraw: vi.fn(),
      requestShuffleLibrary: vi.fn(),
      requestToggleTap: vi.fn(),
      requestSetAllTapped: vi.fn(),
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
      opponentBoardOpen: false,
      openOpponentBoard: vi.fn(),
      closeOpponentBoard: vi.fn(),
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

  it('conceals the temporary panel without removing its drag source geometry', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const { controller } = controllerForAway();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<CommanderAltar controller={controller} />));
    const altar = container.querySelector<HTMLElement>('[data-testid="commander-altar"]');
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="commander-altar-toggle"]');

    act(() => trigger?.click());
    expect(altar?.dataset.open).toBe('true');
    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
    });
    expect(altar?.dataset.open).toBe('true');
    expect(altar?.dataset.dragConcealed).toBe('true');
    expect(container.querySelector('[data-testid^="card-"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
    });
    expect(altar?.dataset.open).toBe('true');
    expect(altar?.dataset.dragConcealed).toBeUndefined();
    act(() => root.unmount());
    raf.mockRestore();
  });

  it('closes the temporary panel after a successful drop', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const { controller } = controllerForAway();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<CommanderAltar controller={controller} />));
    const altar = container.querySelector<HTMLElement>('[data-testid="commander-altar"]');
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="commander-altar-toggle"]');

    act(() => trigger?.click());
    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_START_EVENT));
    });
    act(() => {
      document.dispatchEvent(new Event(DRAG_UI_END_EVENT));
      document.dispatchEvent(new Event('onedeck-drop-complete'));
    });
    expect(altar?.dataset.open).toBeUndefined();
    expect(altar?.dataset.dragConcealed).toBeUndefined();
    act(() => root.unmount());
    raf.mockRestore();
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
