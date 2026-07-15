// Reviewer-owned UI pins for the independent opponent setup screen (I34/I40).
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
// (J0起草 2026-07-15 → 判定者が実機E2E(draft不変・単一undo・console 0)で再オーナー化 2026-07-16。)
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../../engine/commands';
import { makeDeck } from '../../engine/__tests__/helpers';
import { DEFAULT_OPPONENT_ID, playerIdForLifeLabel, requirePlayer } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import type { GameController } from './gameController';
import { OpponentBoards } from './OpponentBoards';
import { OpponentSetupScreen } from './OpponentSetupScreen';
import { AttackDialog } from '../playmat/dialogs';

function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.bind(input);
  setter?.(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function controllerFor(state: NonNullable<ReturnType<typeof useGameStore.getState>['state']>): GameController {
  return {
    state,
    store: useGameStore.getState(),
    openCardMenu: vi.fn(),
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
  };
}

describe('opponent setup independent screen', () => {
  beforeEach(() => {
    resetStore();
    useGameStore.getState().newGame(makeDeck(8), 1);
  });

  it('keeps canonical state untouched while editing and on cancel', () => {
    const state = useGameStore.getState().state!;
    const before = JSON.stringify(state);
    const cancel = vi.fn();
    const view = mount(<OpponentSetupScreen state={state} onCancel={cancel} onApplied={vi.fn()} />);
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    const name = view.container.querySelector<HTMLInputElement>('[data-testid="setup-name-0"]')!;
    act(() => {
      name.value = '編集だけの熊';
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-cancel"]')?.click());

    expect(cancel).toHaveBeenCalledOnce();
    expect(JSON.stringify(useGameStore.getState().state)).toBe(before);
    view.unmount();
  });

  it('applies once, reopens from canonical data, and undo removes the whole setup', () => {
    const state = useGameStore.getState().state!;
    const applied = vi.fn();
    let view = mount(<OpponentSetupScreen state={state} onCancel={vi.fn()} onApplied={applied} />);
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());
    expect(applied).toHaveBeenCalledOnce();
    const next = useGameStore.getState().state!;
    expect(next.zones.battlefield.some((id) => next.cards[id]?.isScenarioDummy)).toBe(true);
    view.unmount();

    view = mount(<OpponentSetupScreen state={next} onCancel={vi.fn()} onApplied={vi.fn()} />);
    expect(view.container.querySelectorAll('[data-testid^="setup-permanent-"]')).toHaveLength(1);
    view.unmount();

    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().state?.zones.battlefield.some(
      (id) => useGameStore.getState().state?.cards[id]?.isScenarioDummy,
    )).toBe(false);
  });

  it('keeps edits for multiple opponents and applies duplicate/reorder/delete as one history entry', () => {
    useGameStore.getState().addOpponent('Bob');
    const before = useGameStore.getState().state!;
    const bobId = playerIdForLifeLabel('Bob');
    const applied = vi.fn();
    const view = mount(
      <OpponentSetupScreen state={before} onCancel={vi.fn()} onApplied={applied} />,
    );
    const life = view.container.querySelector<HTMLInputElement>('[data-testid="setup-life"]')!;
    act(() => {
      setInputValue(life, '31');
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-duplicate-0"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-move-down-0"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-delete-0"]')?.click());
    const firstCounters = view.container.querySelector<HTMLInputElement>('[data-testid="setup-counters-0"]')!;
    act(() => {
      setInputValue(firstCounters, '+1/+1:2');
      firstCounters.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    const player = view.container.querySelector<HTMLSelectElement>('[data-testid="setup-player"]')!;
    act(() => {
      player.value = bobId;
      player.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    expect(view.container.querySelector<HTMLInputElement>('[data-testid="setup-counters-0"]')?.value)
      .toBe('');
    const bobLife = view.container.querySelector<HTMLInputElement>('[data-testid="setup-life"]')!;
    act(() => {
      setInputValue(bobLife, '22');
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());

    expect(applied).toHaveBeenCalledOnce();
    expect(requirePlayer(useGameStore.getState().state!, DEFAULT_OPPONENT_ID).life).toBe(31);
    expect(requirePlayer(useGameStore.getState().state!, bobId).life).toBe(22);
    expect(useGameStore.getState().state?.zones.battlefield.filter(
      (id) => useGameStore.getState().state?.cards[id]?.controllerId === DEFAULT_OPPONENT_ID,
    )).toHaveLength(1);

    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().state).toEqual(before);
    act(() => useGameStore.getState().redo());
    expect(requirePlayer(useGameStore.getState().state!, DEFAULT_OPPONENT_ID).life).toBe(31);
    expect(requirePlayer(useGameStore.getState().state!, bobId).life).toBe(22);
    view.unmount();
  });

  it('stays on the setup screen and exposes an error when the draft is invalid', () => {
    const state = useGameStore.getState().state!;
    const applied = vi.fn();
    const view = mount(
      <OpponentSetupScreen state={state} onCancel={vi.fn()} onApplied={applied} />,
    );
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    const typeCheckbox = view.container.querySelector<HTMLInputElement>(
      '[data-testid="setup-permanent-0"] fieldset input[type="checkbox"]',
    )!;
    act(() => typeCheckbox.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());

    expect(applied).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-testid="setup-error"]')?.textContent)
      .toContain('反映できませんでした');
    expect(useGameStore.getState().state?.zones.battlefield.some(
      (id) => useGameStore.getState().state?.cards[id]?.isScenarioDummy,
    )).toBe(false);
    view.unmount();
  });

  it('projects opponent permanents into creature/other/land lanes by controller', () => {
    let state = useGameStore.getState().state!;
    const specs = [
      ['scenario-creature', 'Creature'],
      ['scenario-artifact', 'Artifact'],
      ['scenario-land', 'Land'],
    ] as const;
    for (const [cardId, typeLine] of specs) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId: DEFAULT_OPPONENT_ID,
        name: cardId,
        typeLine,
        power: typeLine === 'Creature' ? '1' : undefined,
        toughness: typeLine === 'Creature' ? '1' : undefined,
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    useGameStore.setState({ state });
    const view = mount(<OpponentBoards controller={controllerFor(state)} />);
    expect(view.container.querySelector('[data-testid="opponent-creatures-OPPONENT_A"]')?.textContent)
      .toContain('scenario-creature');
    expect(view.container.querySelector('[data-testid="opponent-others-OPPONENT_A"]')?.textContent)
      .toContain('scenario-artifact');
    expect(view.container.querySelector('[data-testid="opponent-lands-OPPONENT_A"]')?.textContent)
      .toContain('scenario-land');
    view.unmount();
  });

  it('offers opponent dummy creatures as assignable blockers in the attack UI', () => {
    let state = useGameStore.getState().state!;
    for (const [cardId, playerId] of [
      ['ui-attacker', 'P1'],
      ['ui-blocker', DEFAULT_OPPONENT_ID],
    ] as const) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId,
        name: cardId,
        typeLine: 'Creature',
        power: '1',
        toughness: '1',
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    const confirm = vi.fn();
    const view = mount(
      <AttackDialog
        state={state}
        opponentLabels={['対戦相手A']}
        onConfirm={confirm}
        onCancel={vi.fn()}
      />,
    );
    act(() => view.container.querySelector<HTMLInputElement>('[data-testid="attack-select-ui-attacker"]')?.click());
    const blocker = view.container.querySelector<HTMLSelectElement>('[data-testid="blocker-select-ui-blocker"]')!;
    act(() => {
      blocker.value = 'ui-attacker';
      blocker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="attack-confirm"]')?.click());
    expect(confirm).toHaveBeenCalledWith(
      ['ui-attacker'],
      '対戦相手A',
      [{ cardId: 'ui-blocker', attackerId: 'ui-attacker' }],
    );
    view.unmount();
  });
});
