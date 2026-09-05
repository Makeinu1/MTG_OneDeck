import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../store/gameStore';
import { useGameController, type GameController } from './gameController';
import { DecisionBar } from './DecisionBar';

let controller: GameController;
function Harness() {
  const game = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  useLayoutEffect(() => { controller = game; });
  return <><button data-testid="open-library" onClick={(e) => game.openLibraryActions(e)}>ライブラリー</button><DecisionBar controller={game} />{game.overlays}</>;
}
let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  useGameStore.setState({ state: null });
});
function mount() {
  const state = buildVisualFixture('hand7').snapshot.state;
  const source = state.zones.hand[0];
  const def = state.defs[state.cards[source].defId];
  def.faces[0].oracleText = 'Target player discards a card.';
  useGameStore.setState({ state, pendingGuided: null, pendingCast: null, resolutionSession: null,
    pendingCommanderResolution: null, mulliganDecisionPending: false, warnings: [], triggerCandidates: [] });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return { state, source };
}
function click(selector: string) {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  act(() => button!.click());
}
function openDiscard(source: string) {
  act(() => controller.openCardMenuAt!(source, 100, 100));
  click('[data-testid="card-sheet-other-toggle"]');
  click('[data-testid="candidate-discard"]');
}

it('manual discard selects before committing, and zone browsing shares one action area', () => {
  const { state, source } = mount();
  const random = vi.spyOn(useGameStore.getState(), 'discardRandom');
  openDiscard(source);
  expect(useGameStore.getState().state).toBe(state);
  expect(controller.decisionFocus?.kind).toBe('discard');
  const chosen = state.zones.hand[1];
  act(() => controller.chooseDecisionCard!(chosen));
  act(() => controller.chooseDecisionCard!(source));
  expect(useGameStore.getState().state).toBe(state);
  expect(document.querySelector('[data-testid="manual-discard-confirm"]')?.textContent).toContain('2枚捨てる');
  act(() => controller.chooseDecisionCard!(source));
  click('[data-testid="manual-discard-confirm"]');
  expect(useGameStore.getState().state!.zones.graveyard).toContain(chosen);
  expect(useGameStore.getState().state!.zones.hand).toContain(source);
  expect(random).not.toHaveBeenCalled();
  click('[data-testid="open-library"]');
  click('[data-testid="surveil"]');
  expect(document.querySelector('[data-testid="arrange-top-dialog"]')?.textContent).toContain('諜報1を行う');
  expect(document.querySelector('[data-testid="arrange-top-dialog"]')?.textContent).not.toContain('下に置く');
  act(() => controller.closeTransientUi());
  click('[data-testid="open-library"]');
  click('[data-testid="library-view"]');
  const beforeSearch = useGameStore.getState().state!;
  const libraryCard = beforeSearch.zones.library[0];
  expect(document.querySelector('[data-testid="zone-move-confirm"]')).toBeNull();
  click(`[data-testid="zone-select-${libraryCard}"]`);
  expect(useGameStore.getState().state).toBe(beforeSearch);
  expect(document.querySelectorAll('[data-testid="zone-move-confirm"]')).toHaveLength(1);
  click('[data-testid="zone-move-confirm"]');
  expect(useGameStore.getState().state!.zones.hand).toContain(libraryCard);
  expect(document.body.textContent).toContain('まだ切り直していません');
  click('[data-testid="zone-shuffle"]');
  expect(document.body.textContent).toContain('切り直しました');
});

it('cancelled discard and counter bulk confirmation do not change state', () => {
  const { state, source } = mount();
  openDiscard(source);
  act(() => controller.chooseDecisionCard!(state.zones.hand[1]));
  act(() => controller.cancelDecision!());
  expect(useGameStore.getState().state).toBe(state);
  openDiscard(source);
  const stale = state.zones.hand[1];
  act(() => controller.chooseDecisionCard!(stale));
  act(() => useGameStore.getState().moveCard(stale, 'exile'));
  const changed = useGameStore.getState().state;
  click('[data-testid="manual-discard-confirm"]');
  expect(useGameStore.getState().state).toBe(changed);
  expect(controller.decisionFocus?.warning).toContain('選び直して');
  act(() => controller.cancelDecision!());
  act(() => controller.proliferateAll());
  expect(useGameStore.getState().state).toBe(changed);
  expect(document.querySelector('[data-testid="counters-all-confirm-dialog"]')?.textContent).toContain('増殖とは異なります');
  click('[data-testid="counters-all-confirm-dialog-cancel"]');
  expect(useGameStore.getState().state).toBe(changed);
});
