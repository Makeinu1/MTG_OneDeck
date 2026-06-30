// REVIEWER-OWNED acceptance contract for S-SBA damage-marked substrate
// (CR 704.5g lethal damage, 704.5h deathtouch, 120.3 marked damage, 514.2 cleanup).
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// Independent adversarial pins, distinct from the implementer's golden cases:
//   1. Exactly-lethal (damageMarked === toughness) destroys (CR 120.6 >= boundary).
//   2. Sublethal (damageMarked < toughness) survives.
//   3. Deathtouch destroys on ANY nonzero amount (keys off the source flag, not magnitude).
//   4. Non-deathtouch sublethal does NOT destroy even with the deathtouch path present.
//   5. clearMarkedDamage (CR 514.2) zeroes damage AND the deathtouch flag -> no destroy.
//   6. markDamage clamps negative amounts -> damageMarked never goes below 0 (CR 120.3).
//   7. A 0-toughness damaged creature is destroyed exactly once (704.5f, no double with g/h).

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
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function creatureDef(id: string, power: string, toughness: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness, oracleText: '' }],
  });
}

function spawnCreatureOnBattlefield(id: string, power: string, toughness: string): string {
  const def = creatureDef(id, power, toughness);
  store().newGame([{ def, isCommander: false }, ...makeDeck(12)], 1);
  const cardId = findInstanceId(def.scryfallId);
  store().moveCard(cardId, 'battlefield');
  return cardId;
}

describe('review.damage-marked: CR 704.5g/h SBA + marked-damage state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('704.5g: exactly-lethal damage (== toughness) destroys', () => {
    const id = spawnCreatureOnBattlefield('rev-exact-lethal', '2', '2');
    store().dispatch({ type: 'markDamage', cardId: id, amount: 2 });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('graveyard');
    expect(state?.zones.graveyard).toContain(id);
  });

  it('704.5g: sublethal damage (< toughness) leaves the creature alive', () => {
    const id = spawnCreatureOnBattlefield('rev-sublethal', '3', '3');
    store().dispatch({ type: 'markDamage', cardId: id, amount: 2 });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('battlefield');
    expect(state?.cards[id]?.damageMarked).toBe(2);
    expect(state?.zones.graveyard).not.toContain(id);
  });

  it('704.5h: deathtouch destroys on any nonzero amount (flag, not magnitude)', () => {
    const id = spawnCreatureOnBattlefield('rev-deathtouch', '4', '4');
    store().dispatch({ type: 'markDamage', cardId: id, amount: 1, deathtouch: true });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('graveyard');
    expect(state?.zones.graveyard).toContain(id);
  });

  it('non-deathtouch sublethal damage does not destroy', () => {
    const id = spawnCreatureOnBattlefield('rev-nondeath-sublethal', '4', '4');
    store().dispatch({ type: 'markDamage', cardId: id, amount: 1, deathtouch: false });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('battlefield');
    expect(state?.cards[id]?.hasDeathtouchDamage).toBe(false);
    expect(state?.zones.graveyard).not.toContain(id);
  });

  it('514.2: clearMarkedDamage zeroes damage and the deathtouch flag, preventing destruction', () => {
    const id = spawnCreatureOnBattlefield('rev-cleanup', '3', '3');
    // Mark deathtouch damage but clear before any SBA would resolve it via a fresh mark.
    store().dispatch({ type: 'markDamage', cardId: id, amount: 2, deathtouch: false });
    store().dispatch({ type: 'clearMarkedDamage' });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('battlefield');
    expect(state?.cards[id]?.damageMarked).toBe(0);
    expect(state?.cards[id]?.hasDeathtouchDamage).toBe(false);
    expect(state?.zones.graveyard).not.toContain(id);
  });

  it('120.3: markDamage clamps negative amounts; damageMarked never goes below 0', () => {
    const id = spawnCreatureOnBattlefield('rev-negative-clamp', '3', '3');
    store().dispatch({ type: 'markDamage', cardId: id, amount: -5 });
    const state = store().state;
    expect(state?.cards[id]?.damageMarked).toBeGreaterThanOrEqual(0);
    expect(state?.cards[id]?.zone).toBe('battlefield');
    expect(state?.zones.graveyard).not.toContain(id);
  });

  it('no double-destroy: a 0-toughness damaged creature is destroyed exactly once (704.5f)', () => {
    const id = spawnCreatureOnBattlefield('rev-zero-toughness', '0', '0');
    store().dispatch({ type: 'markDamage', cardId: id, amount: 3, deathtouch: true });
    const state = store().state;
    expect(state?.cards[id]?.zone).toBe('graveyard');
    // Exactly one zone change into the graveyard for this card, tagged 704.5f
    // (toughness<=0 takes precedence; 704.5g/h must not also fire on the same card).
    const toGraveyard = (state?.eventLog ?? []).filter(
      (e) => e.physicalCardId === id && e.toZone === 'graveyard',
    );
    expect(toGraveyard.length).toBe(1);
    expect(toGraveyard[0]?.sbaApplied).toBe('704.5f');
  });
});
