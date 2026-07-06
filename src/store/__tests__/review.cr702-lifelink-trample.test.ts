// REVIEWER-OWNED acceptance contract for cr-702-keyword-abilities-frequent Slice A
// (CR 702.15 lifelink / CR 702.19 trample, single-blocker combat only).
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// Independent adversarial pins, distinct from any implementer golden cases:
//   1. 702.15b: lifelink on an unblocked attacker gains its controller life equal to
//      the damage actually dealt to the defending player.
//   2. 702.15b: lifelink on both combatants in a single-block trade gains each
//      controller life independently (separate life-gain events, CR 702.15e-adjacent).
//   3. 702.19b: trample assigns only lethal damage to a single blocker, with the
//      excess going to the defending player.
//   4. 702.19b + 704.5h: trample lethal-damage threshold drops to 1 when the
//      attacker also has deathtouch.
//   5. Non-trample regression: a non-trample attacker in a single-block trade still
//      assigns its FULL power to the blocker (no accidental overflow leak).
//   6. Honest defer: if the blocker's toughness can't be determined ("*"), trample
//      assigns full power to the blocker and sends nothing to the player (no guess).
//   7. Trample without a player/planeswalker target for the attack (already blocked,
//      target still a player) still behaves per pin 3 — trample-over-planeswalker
//      (CR 702.19c/e/f) is out of scope for this slice and not asserted here.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

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
  localStorage.clear();
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function combatCreature(id: string, power: string, toughness: string, oracleText = '') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness, oracleText }],
  });
}

function startCombat(defs: ReturnType<typeof combatCreature>[]): void {
  store().newGame([...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(12)], 1);
  for (const def of defs) {
    store().moveCard(findInstanceId(def.scryfallId), 'battlefield');
  }
}

describe('review.cr702-lifelink-trample: keyword abilities Slice A (CR 702.15 / 702.19)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('702.15b: unblocked lifelink attacker gains its controller life equal to damage dealt', () => {
    const attacker = combatCreature('rev-ll-unblocked', '3', '3', 'Lifelink');
    startCombat([attacker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const lifeBefore = store().state?.life ?? 0;
    const opponentLifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    expect(state?.opponentLife['対戦相手A']).toBe(opponentLifeBefore - 3);
    expect(state?.life).toBe(lifeBefore + 3);
  });

  it('702.15b: single-block trade with lifelink on both sides gains each controller life independently', () => {
    const attacker = combatCreature('rev-ll-atk', '2', '4', 'Lifelink');
    const blocker = combatCreature('rev-ll-blk', '1', '4', 'Lifelink');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const lifeBefore = store().state?.life ?? 0;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    // Both attacker and blocker are controlled by P1 in this single-player harness, so
    // both lifelink triggers add to the same life total: +2 (attacker dealt) + +1 (blocker dealt).
    const state = store().state;
    expect(state?.cards[attackerId]?.damageMarked).toBe(1);
    expect(state?.cards[blockerId]?.damageMarked).toBe(2);
    expect(state?.life).toBe(lifeBefore + 2 + 1);
  });

  it('702.19b: trample assigns only lethal damage to a single blocker, rest to the defending player', () => {
    const attacker = combatCreature('rev-tr-atk', '5', '3', 'Trample');
    const blocker = combatCreature('rev-tr-blk', '1', '2');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const opponentLifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // Blocker (toughness 2) takes exactly lethal (2), then dies to SBA; overflow (3) to player.
    expect(state?.cards[blockerId]?.zone).toBe('graveyard');
    expect(state?.opponentLife['対戦相手A']).toBe(opponentLifeBefore - 3);
    // Attacker still takes the blocker's full power back (trample doesn't change the block-back side).
    expect(state?.cards[attackerId]?.damageMarked).toBe(1);
  });

  it('702.19b + 704.5h: trample + deathtouch lowers the lethal threshold to 1', () => {
    const attacker = combatCreature('rev-tr-dt-atk', '5', '3', 'Trample\nDeathtouch');
    const blocker = combatCreature('rev-tr-dt-blk', '1', '10');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const opponentLifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // Only 1 damage needed to be lethal (deathtouch), even though toughness is 10.
    expect(state?.cards[blockerId]?.zone).toBe('graveyard');
    // 5 power - 1 assigned to blocker = 4 overflow to the defending player.
    expect(state?.opponentLife['対戦相手A']).toBe(opponentLifeBefore - 4);
  });

  it('regression: a non-trample attacker in a single-block trade still assigns full power to the blocker', () => {
    const attacker = combatCreature('rev-notr-atk', '5', '3');
    const blocker = combatCreature('rev-notr-blk', '1', '2');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const opponentLifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // Toughness 2 took the full 5 (no trample), so it dies to SBA — proving the full
    // amount, not just lethal (2), was assigned (no overflow logic applied here).
    expect(state?.cards[blockerId]?.zone).toBe('graveyard');
    expect(state?.opponentLife['対戦相手A']).toBe(opponentLifeBefore);
  });

  it('honest defer: trample with an undetermined blocker toughness ("*") assigns full power, no overflow guess', () => {
    const attacker = combatCreature('rev-tr-star-atk', '5', '3', 'Trample');
    const blocker = combatCreature('rev-tr-star-blk', '1', '*');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const opponentLifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    expect(state?.cards[blockerId]?.damageMarked).toBe(5);
    expect(state?.opponentLife['対戦相手A']).toBe(opponentLifeBefore);
  });
});
