// REVIEWER-OWNED acceptance contract for the cr-701 sacrifice effect leaf compiler.
// Implementation agents must NOT edit this file; fix the engine.
//
// CR grounding (rule/ 2026-06-19, verified verbatim):
//   - 701.21a: to sacrifice a permanent, its CONTROLLER moves it from the battlefield
//     directly to its owner's graveyard. A player can't sacrifice something they don't
//     control. Sacrificing is NOT destruction.
//   - §32.8/§34.19 status discipline: unsupported shapes (multi-count, each-player,
//     qualified choices) fall to manual — no fake automation, no half-execution.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function sorcery(defId: string, oracleText: string) {
  return makeDef({
    scryfallId: defId,
    typeLine: 'Sorcery',
    faces: [{ name: defId, typeLine: 'Sorcery', oracleText }],
  });
}
function permanent(defId: string, typeLine: string) {
  return makeDef({ scryfallId: defId, typeLine, faces: [{ name: defId, typeLine }] });
}
function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}

describe('review.leaf-sacrifice: CR 701.21 sacrifice effect leaf', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 701.21a: the controller chooses — guided prompt, nothing applied before confirm;
  //    the confirmed own permanent goes battlefield -> graveyard and the spell resolves.
  it('701.21a: "Sacrifice a creature." guides the choice; confirm moves it to graveyard', () => {
    store().newGame(
      [
        { def: sorcery('rv-sac', 'Sacrifice a creature.'), isCommander: false },
        { def: permanent('rv-sac-own', 'Creature'), isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const spellId = instanceId('rv-sac');
    const ownId = instanceId('rv-sac-own');
    store().moveCard(ownId, 'battlefield', 'bottom');
    store().moveCard(spellId, 'stack', 'bottom');

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('sacrifice');
    expect(store().state!.cards[ownId].zone).toBe('battlefield'); // nothing before confirm

    store().confirmGuidedSacrifice(ownId);
    expect(store().state!.cards[ownId].zone).toBe('graveyard');
    expect(store().state!.zones.stack).not.toContain(spellId);
    expect(store().pendingGuided).toBeNull();
  });

  // 2. CR 701.21a: a permanent P1 does not control cannot be sacrificed by P1.
  it("701.21a: an opponent-controlled permanent can't be chosen for P1's sacrifice", () => {
    store().newGame(
      [
        { def: sorcery('rv-sac2', 'Sacrifice a permanent.'), isCommander: false },
        { def: permanent('rv-sac-opp', 'Creature'), isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const spellId = instanceId('rv-sac2');
    const oppId = instanceId('rv-sac-opp');
    store().moveCard(oppId, 'battlefield', 'bottom');
    useGameStore.setState({
      state: {
        ...store().state!,
        cards: {
          ...store().state!.cards,
          [oppId]: { ...store().state!.cards[oppId], controllerId: 'OPPONENT_A' },
        },
      },
    });
    store().moveCard(spellId, 'stack', 'bottom');
    store().resolveTop();

    store().confirmGuidedSacrifice(oppId);

    expect(store().state!.cards[oppId].zone).toBe('battlefield'); // refused
    expect(store().pendingGuided).toBeTruthy(); // still awaiting a legal choice
  });

  // 3. Type filter honesty: "Sacrifice an artifact." must not accept a creature.
  it('701.21a: "Sacrifice an artifact." rejects a non-artifact choice', () => {
    store().newGame(
      [
        { def: sorcery('rv-sac3', 'Sacrifice an artifact.'), isCommander: false },
        { def: permanent('rv-sac-cre', 'Creature'), isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const spellId = instanceId('rv-sac3');
    const creId = instanceId('rv-sac-cre');
    store().moveCard(creId, 'battlefield', 'bottom');
    store().moveCard(spellId, 'stack', 'bottom');
    store().resolveTop();

    store().confirmGuidedSacrifice(creId);

    expect(store().state!.cards[creId].zone).toBe('battlefield'); // creature refused for artifact
  });

  // 4. Honest defer: multi-count sacrifice must not half-execute anything.
  it('§32.8: "Sacrifice two creatures." sacrifices nothing automatically (manual fall)', () => {
    store().newGame(
      [
        { def: sorcery('rv-sac4', 'Sacrifice two creatures.'), isCommander: false },
        { def: permanent('rv-sac-c1', 'Creature'), isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const spellId = instanceId('rv-sac4');
    const c1 = instanceId('rv-sac-c1');
    store().moveCard(c1, 'battlefield', 'bottom');
    store().moveCard(spellId, 'stack', 'bottom');

    store().resolveTop();

    expect(store().state!.cards[c1].zone).toBe('battlefield');
  });
});
