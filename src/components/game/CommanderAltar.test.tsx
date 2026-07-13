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
    },
  };
}

afterEach(() => {
  useGameStore.setState({ state: null });
  document.body.replaceChildren();
});

describe('CommanderAltar', () => {
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
