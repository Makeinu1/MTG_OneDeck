// REVIEWER-OWNED store integration pins for CR609 mass/target destroy.
// Implementers must not edit this file; fix implementation when it fails.
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
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
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
  localStorage.clear();
}

function cardId(defId: string): string {
  const id = Object.values(store().state?.cards ?? {}).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('missing state');
  return state;
}

describe('CR609 store integration', () => {
  beforeEach(resetStore);

  it('mass destroy exposes a live CR903.9a commander choice and the direct bridge leaves no stale choice', () => {
    const commander = makeDef({
      scryfallId: 'cr609-store-commander',
      name: 'CR609 Commander',
      typeLine: 'Legendary Creature',
      faces: [{
        name: 'CR609 Commander', typeLine: 'Legendary Creature', power: '2', toughness: '2',
      }],
    });
    store().newGame([{ def: commander, isCommander: true }], 1);
    const id = cardId(commander.scryfallId);
    store().moveCard(id, 'battlefield', 'bottom');
    store().dispatch({
      type: 'destroyPermanents', selector: { kind: 'cards', cardIds: [id] },
    });
    const choice = snap().pendingRuleChoices.find(
      (candidate) => candidate.kind === 'commander-zone' && candidate.cardId === id,
    );
    expect(snap().cards[id].zone).toBe('graveyard');
    expect(choice).toBeTruthy();
    if (!choice) throw new Error('missing commander choice');
    store().resolveRuleChoice(choice.choiceId, { kind: 'commander-zone', toCommandZone: true });
    expect(snap().cards[id].zone).toBe('command');
    expect(snap().pendingRuleChoices).toEqual([]);

    store().moveCard(id, 'battlefield', 'bottom');
    store().moveCommanderWithZoneChoice(id, 'graveyard', true);
    expect(snap().cards[id].zone).toBe('command');
    expect(snap().pendingRuleChoices).toEqual([]);
  });

  it('guided target destroy completes before SBA, and the whole resolution is one undo/redo step', () => {
    const spell = makeDef({
      scryfallId: 'cr609-store-feed',
      name: 'Feed Shape',
      typeLine: 'Sorcery',
      faces: [{
        name: 'Feed Shape', typeLine: 'Sorcery',
        oracleText: 'Destroy target creature. You lose life equal to its mana value.',
      }],
    });
    const victim = makeDef({
      scryfallId: 'cr609-store-victim', typeLine: 'Creature', cmc: 4,
      faces: [{ name: 'Victim', typeLine: 'Creature', power: '4', toughness: '4' }],
    });
    const pendingZero = makeDef({
      scryfallId: 'cr609-store-pending-zero', typeLine: 'Creature',
      faces: [{ name: 'Pending Zero', typeLine: 'Creature', power: '1', toughness: '1' }],
    });
    store().newGame([
      { def: spell, isCommander: false },
      { def: victim, isCommander: false },
      { def: pendingZero, isCommander: false },
    ], 2);
    const spellId = cardId(spell.scryfallId);
    const victimId = cardId(victim.scryfallId);
    const zeroId = cardId(pendingZero.scryfallId);
    store().moveCard(spellId, 'stack', 'bottom');
    store().moveCard(victimId, 'battlefield', 'bottom');
    store().moveCard(zeroId, 'battlefield', 'bottom');

    const beforeMutation = snap();
    const zeroDef = beforeMutation.defs[pendingZero.scryfallId];
    if (!zeroDef) throw new Error('missing pending zero def');
    useGameStore.setState({
      state: {
        ...beforeMutation,
        defs: {
          ...beforeMutation.defs,
          [pendingZero.scryfallId]: {
            ...zeroDef,
            faces: zeroDef.faces.map((face, index) => index === 0 ? { ...face, toughness: '0' } : face),
          },
        },
      },
    });
    const baseline = snap();

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ atom: 'effect.destroy' });
    store().confirmGuidedTarget(victimId);

    const final = snap();
    expect(store().pendingGuided).toBeNull();
    expect(final.cards[victimId].zone).toBe('graveyard');
    expect(final.cards[spellId].zone).toBe('graveyard');
    expect(final.cards[zeroId].zone).toBe('graveyard');
    expect(final.life).toBe(36);
    const lifeEvent = final.eventLog.find((event) => event.type === 'lifeChange' && event.delta === -4);
    const zeroSba = final.eventLog.find(
      (event) => event.type === 'zoneChange'
        && event.physicalCardId === zeroId
        && event.sbaApplied === '704.5f',
    );
    expect(lifeEvent?.sequence).toBeLessThan(zeroSba?.sequence ?? -1);

    store().undo();
    expect(snap()).toEqual(baseline);
    store().redo();
    expect(snap()).toEqual(final);
  });
});
