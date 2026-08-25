import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { GameScreen } from './GameScreen';
import type { GameScreenInteractionPort } from './gameScreenInteractionPort';

function injectedPort(): GameScreenInteractionPort {
  const state = buildVisualFixture('hand7').snapshot.state;
  return {
    state,
    warnings: [],
    triggerCandidates: [],
    resolutionSession: null,
    guidedDecisionActive: false,
    mulliganDecisionPending: false,
    autoAdvanceToMain: false,
    openCardMenu: vi.fn(),
    handleCardDoubleClick: vi.fn(),
    requestTapForMana: vi.fn(),
    requestActivateAbility: vi.fn(),
    requestDraw: vi.fn(),
    requestShuffleLibrary: vi.fn(),
    requestMulligan: vi.fn(),
    requestKeepHand: vi.fn(),
    requestToggleTap: vi.fn(),
    requestSetAllTapped: vi.fn(),
    requestResolveTop: vi.fn(),
    requestResolveAll: vi.fn(),
    advancePhase: vi.fn(),
    advanceTurn: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    setManualTargets: vi.fn(),
    confirmGuidedZeroChoice: vi.fn(),
    removeStackItem: vi.fn(),
    completeManualResolution: vi.fn(),
    placePendingTriggersForPriority: vi.fn(),
    putPendingTriggerOnStack: vi.fn(),
    addAbilityToStack: vi.fn(),
    adjustLife: vi.fn(),
    adjustMana: vi.fn(),
    clearManaPool: vi.fn(),
    adjustPlayerCounter: vi.fn(),
    setMaximumHandSizeOverride: vi.fn(),
    adjustOpponentLife: vi.fn(),
    adjustCommanderDamage: vi.fn(),
    proliferateAll: vi.fn(),
    rollDie: vi.fn(),
    flipCoin: vi.fn(),
    setAutoAdvance: vi.fn(),
    dismissTriggerCandidates: vi.fn(),
    clearWarnings: vi.fn(),
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
    triggerSheetOpen: false,
    processTriggers: vi.fn(),
    closeTriggerSheet: vi.fn(),
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
    decisionFocus: null,
    mulliganActive: false,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('GameScreen injected interaction port', () => {
  it('renders the shared player surface and forwards actions through named methods', () => {
    const interactionPort = injectedPort();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <GameScreen
          keybindings={DEFAULT_KEYBINDINGS}
          interactionPort={interactionPort}
        />,
      );
    });

    expect(container.querySelector('[data-testid="game-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="board"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hand-ribbon"]')).not.toBeNull();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="library-draw-one"]')?.click();
      container.querySelector<HTMLButtonElement>('[data-testid="life-minus"]')?.click();
    });
    expect(interactionPort.requestDraw).toHaveBeenCalledWith(1);
    expect(interactionPort.adjustLife).toHaveBeenCalledWith(-1);

    act(() => root.unmount());
  });
});
