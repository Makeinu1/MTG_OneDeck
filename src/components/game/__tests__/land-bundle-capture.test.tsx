import { act, createRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../../store/gameStore';
import { useGameController, type GameController } from '../gameController';

const controllerRef = createRef<GameController>();
let root: Root;
let container: HTMLElement;
let unsafeBundleIds: string[];

const Harness = forwardRef<GameController>(function Harness(_props, ref) {
  const controller = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  useImperativeHandle(ref, () => controller, [controller]);
  return null;
});

describe('land bundle capture routing', () => {
  beforeEach(() => {
    const fixture = buildVisualFixture('lands').snapshot.state;
    unsafeBundleIds = fixture.zones.battlefield
      .filter((cardId) => {
        const card = fixture.cards[cardId];
        return card ? /\bBasic\b/i.test(fixture.defs[card.defId]?.typeLine ?? '') : false;
      })
      .slice(0, 2);
    const defs = { ...fixture.defs };
    for (const cardId of unsafeBundleIds) {
      const card = fixture.cards[cardId];
      if (!card) continue;
      const def = defs[card.defId];
      if (!def) continue;
      defs[card.defId] = {
        ...def,
        faces: def.faces.map((face) => ({
          ...face,
          oracleText: '{T}, Sacrifice this land: Add {G}.',
        })),
      };
    }
    useGameStore.setState({
      state: { ...fixture, defs },
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      pendingCast: null,
      resolutionSession: null,
      pendingCommanderResolution: null,
      pendingForceActivation: null,
      canUndo: false,
      canRedo: false,
      canUndoInteraction: false,
      canRedoInteraction: false,
      mulliganDecisionPending: false,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness ref={controllerRef} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    useGameStore.setState({ state: null });
  });

  it('returns false and leaves unsafe basic-land bundles for the normal card route', () => {
    const before = useGameStore.getState().state;
    if (!before) throw new Error('state unavailable');
    const tappedBefore = unsafeBundleIds.map((id) => before.cards[id]?.tapped);
    const manaBefore = before.manaPool;
    let handled = true;
    act(() => {
      handled = controllerRef.current?.requestToggleTapMany?.(unsafeBundleIds) ?? false;
    });

    expect(handled).toBe(false);
    expect(unsafeBundleIds.map((id) => useGameStore.getState().state?.cards[id]?.tapped))
      .toEqual(tappedBefore);
    expect(useGameStore.getState().state?.manaPool).toEqual(manaBefore);
  });
});
