import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';
import type { GameState } from '../../engine/types';

const store = () => useGameStore.getState();
function snap(): GameState {
  return store().state!;
}
function instanceByDef(defId: string): string {
  const card = Object.values(snap().cards).find((c) => c.defId === defId);
  if (!card) throw new Error(`instance not found for ${defId}`);
  return card.id;
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function setupTeamworkGame(): { spellId: string; bear1: string; bear2: string } {
  const teamworkSpell = makeDef({
    scryfallId: 'teamwork-spell',
    typeLine: 'Instant',
    cmc: 1,
    faces: [
      {
        name: 'teamwork-spell',
        typeLine: 'Instant',
        manaCost: '{U}',
        oracleText:
          'Teamwork 4 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 4 or more.)\nDraw two cards. If this spell was cast using teamwork, draw three cards instead.',
      },
    ],
  });
  const bear1 = makeDef({
    scryfallId: 'bear-1',
    typeLine: 'Creature — Bear',
    faces: [{ name: 'bear-1', typeLine: 'Creature — Bear', power: '2', toughness: '2' }],
  });
  const bear2 = makeDef({
    scryfallId: 'bear-2',
    typeLine: 'Creature — Bear',
    faces: [{ name: 'bear-2', typeLine: 'Creature — Bear', power: '3', toughness: '3' }],
  });

  store().newGame(
    [
      { def: teamworkSpell, isCommander: false },
      { def: bear1, isCommander: false },
      { def: bear2, isCommander: false },
      ...makeDeck(12),
    ],
    42,
  );

  const spellId = instanceByDef('teamwork-spell');
  const b1 = instanceByDef('bear-1');
  const b2 = instanceByDef('bear-2');

  // Move spell to hand, bears to battlefield.
  store().moveCard(spellId, 'hand');
  store().moveCard(b1, 'battlefield');
  store().moveCard(b2, 'battlefield');

  // Add mana to pay the {U} cost.
  store().dispatch({ type: 'addMana', color: 'U', amount: 1 });

  return { spellId, bear1: b1, bear2: b2 };
}

describe('teamwork cast integration (CR 702.194)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('A3: castToStack sets pendingCast with cost-tap prompt for teamwork card', () => {
    const { spellId } = setupTeamworkGame();
    const result = store().castToStack(spellId);
    expect(result).toBe('needs-choice');

    const pending = store().pendingCast;
    expect(pending).not.toBeNull();
    expect(pending!.cardId).toBe(spellId);
    expect(pending!.teamworkThreshold).toBe(4);
    expect(pending!.prompts[0]).toMatchObject({
      kind: 'cost-tap',
      atom: null,
      count: 0,
    });
    expect(pending!.prompts[0].raw).toContain('チームワーク');
  });

  it('A4: answerPendingCastTeamwork rejects insufficient power', () => {
    const { spellId, bear1 } = setupTeamworkGame();
    store().castToStack(spellId);

    // bear1 has power 2, threshold is 4 → reject
    store().answerPendingCastTeamwork([bear1]);
    // prompt should still be present (not consumed)
    expect(store().pendingCast!.prompts[0]?.kind).toBe('cost-tap');
    expect(store().warnings.length).toBeGreaterThan(0);
    expect(store().warnings[store().warnings.length - 1]).toContain('閾値');
  });

  it('A5: confirmPendingCast with teamworkTappedIds taps creatures and sets usingTeamwork', () => {
    const { spellId, bear1, bear2 } = setupTeamworkGame();
    store().castToStack(spellId);

    // bear1(2) + bear2(3) = 5 >= 4 → accept
    store().answerPendingCastTeamwork([bear1, bear2]);
    expect(store().pendingCast!.teamworkTappedIds).toEqual([bear1, bear2]);
    // cost-tap prompt consumed
    expect(store().pendingCast!.prompts.length).toBe(0);

    store().confirmPendingCast();
    expect(store().pendingCast).toBeNull();

    // Creatures should be tapped
    expect(snap().cards[bear1].tapped).toBe(true);
    expect(snap().cards[bear2].tapped).toBe(true);

    // Spell on stack with usingTeamwork
    const stackSpell = snap().cards[spellId];
    expect(stackSpell.zone).toBe('stack');
    expect(stackSpell.usingTeamwork).toBe(true);
  });

  it('A6: declining teamwork (0 creatures) still casts successfully without usingTeamwork', () => {
    const { spellId } = setupTeamworkGame();
    store().castToStack(spellId);

    store().answerPendingCastTeamwork([]);
    expect(store().pendingCast!.teamworkTappedIds).toEqual([]);
    expect(store().pendingCast!.prompts.length).toBe(0);

    store().confirmPendingCast();
    expect(store().pendingCast).toBeNull();

    const stackSpell = snap().cards[spellId];
    expect(stackSpell.zone).toBe('stack');
    expect(stackSpell.usingTeamwork).toBeUndefined();
  });

  it('A7: undo reverses both tap and cast atomically', () => {
    const { spellId, bear1, bear2 } = setupTeamworkGame();
    store().castToStack(spellId);
    store().answerPendingCastTeamwork([bear1, bear2]);
    store().confirmPendingCast();

    // Verify state before undo
    expect(snap().cards[bear1].tapped).toBe(true);
    expect(snap().cards[spellId].zone).toBe('stack');

    store().undo();

    // After undo: bears untapped, spell back in hand
    expect(snap().cards[bear1].tapped).toBe(false);
    expect(snap().cards[bear2].tapped).toBe(false);
    expect(snap().cards[spellId].zone).toBe('hand');
  });

  it('A8: non-teamwork card cast flow is unaffected', () => {
    const plainSpell = makeDef({
      scryfallId: 'plain-spell',
      typeLine: 'Instant',
      cmc: 0,
      faces: [
        {
          name: 'plain-spell',
          typeLine: 'Instant',
          oracleText: 'Draw a card.',
        },
      ],
    });

    store().newGame(
      [{ def: plainSpell, isCommander: false }, ...makeDeck(14)],
      99,
    );
    const spellId = instanceByDef('plain-spell');
    store().moveCard(spellId, 'hand');

    const result = store().castToStack(spellId);
    // No pendingCast needed for a free non-teamwork spell
    expect(result).toBe('ok');
    expect(store().pendingCast).toBeNull();
    expect(snap().cards[spellId].zone).toBe('stack');
    expect(snap().cards[spellId].usingTeamwork).toBeUndefined();
  });
});
