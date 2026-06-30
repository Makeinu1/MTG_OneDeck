// REVIEWER-OWNED acceptance contract for S-COMBAT first slice
// (CR 506.1 / 508.x / 509.x / 510.1–510.2 combat structure + damage).
// Implementation agents must NOT edit this file. If it fails, fix the engine.
//
// Independent adversarial pins, distinct from the implementer's golden cases:
//   1. CR 510.2 atomicity: 2/2 vs 2/2 both die; both 704.5g destructions share ONE
//      simultaneousGroupId (would break under serial markDamage application).
//   2. Single-block sublethal: both combatants survive with the assigned marks.
//   3. Unblocked attacker produces NO creature markDamage (player damage out of slice).
//   4. Deathtouch in combat routes to 704.5h: 1-damage deathtouch kills a high-toughness
//      blocker while the attacker survives (isolates 704.5h from 704.5g).
//   5. Multi-blocker damage is DEFERRED (no fabricated CR 510.1c division): warning +
//      zero creature marks. No silent auto-assignment.
//   6. enterCombat establishes a combat context consistent with the turn (invariant).

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

describe('review.combat: CR 506-510 combat structure first slice', () => {
  beforeEach(() => {
    resetStore();
  });

  it('510.2: reciprocal lethal damage is atomic — both die in one SBA group', () => {
    const attacker = combatCreature('rev-combat-atk', '2', '2');
    const blocker = combatCreature('rev-combat-blk', '2', '2');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    expect(state?.cards[attackerId]?.zone).toBe('graveyard');
    expect(state?.cards[blockerId]?.zone).toBe('graveyard');
    const sbaEvents = (state?.eventLog ?? []).filter(
      (e) =>
        (e.physicalCardId === attackerId || e.physicalCardId === blockerId) &&
        e.reason === 'sba' &&
        e.sbaApplied === '704.5g',
    );
    expect(sbaEvents).toHaveLength(2);
    // Atomicity proof: both deaths occur in the same SBA pass (one group id).
    expect(new Set(sbaEvents.map((e) => e.simultaneousGroupId)).size).toBe(1);
  });

  it('510.1c/d: single-block sublethal leaves both combatants alive', () => {
    const attacker = combatCreature('rev-sub-atk', '2', '2');
    const blocker = combatCreature('rev-sub-blk', '1', '3');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    expect(state?.cards[attackerId]?.zone).toBe('battlefield'); // took 1, toughness 2
    expect(state?.cards[blockerId]?.zone).toBe('battlefield'); // took 2, toughness 3
    expect(state?.cards[attackerId]?.damageMarked).toBe(1);
    expect(state?.cards[blockerId]?.damageMarked).toBe(2);
  });

  it('510.1b: unblocked attacker damages the defending player, marks no creature damage', () => {
    const attacker = combatCreature('rev-unblocked', '3', '3');
    startCombat([attacker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const lifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // No creature damage marked on an unblocked attacker...
    expect(state?.cards[attackerId]?.zone).toBe('battlefield');
    expect(state?.cards[attackerId]?.damageMarked).toBe(0);
    // ...but the defending player loses life equal to the attacker's power (CR 510.1b).
    expect(state?.opponentLife['対戦相手A']).toBe(lifeBefore - 3);
  });

  it('510.1a/b: multiple unblocked attackers aggregate damage to the defending player', () => {
    const a = combatCreature('rev-agg-a', '2', '2');
    const b = combatCreature('rev-agg-b', '4', '4');
    startCombat([a, b]);
    const aId = findInstanceId(a.scryfallId);
    const bId = findInstanceId(b.scryfallId);
    const lifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({
      type: 'declareAttackers',
      attackers: [{ cardId: aId }, { cardId: bId }],
    });
    store().dispatch({ type: 'resolveCombatDamage' });

    expect(store().state?.opponentLife['対戦相手A']).toBe(lifeBefore - 6);
  });

  it('510.1c: a blocked attacker deals no damage to the defending player', () => {
    const attacker = combatCreature('rev-blk-noplayer', '3', '3');
    const blocker = combatCreature('rev-blk-noplayer-b', '1', '4');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);
    const lifeBefore = store().state?.opponentLife['対戦相手A'] ?? 40;

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    // Blocked: player takes no damage; creatures take reciprocal combat damage.
    expect(store().state?.opponentLife['対戦相手A']).toBe(lifeBefore);
    expect(store().state?.cards[blockerId]?.damageMarked).toBe(3);
  });

  it('704.5h: deathtouch combat damage kills a high-toughness blocker; attacker survives', () => {
    const attacker = combatCreature('rev-dt-atk', '1', '4', 'Deathtouch');
    const blocker = combatCreature('rev-dt-blk', '2', '2');
    startCombat([attacker, blocker]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerId = findInstanceId(blocker.scryfallId);

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({ type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // Blocker took only 1 damage but from a deathtouch source -> 704.5h destroys it.
    expect(state?.cards[blockerId]?.zone).toBe('graveyard');
    // Attacker took 2 with toughness 4 -> survives.
    expect(state?.cards[attackerId]?.zone).toBe('battlefield');
    const dt = (state?.eventLog ?? []).filter(
      (e) => e.physicalCardId === blockerId && e.sbaApplied === '704.5h',
    );
    expect(dt).toHaveLength(1);
  });

  it('510.1c: multi-blocker damage is deferred (no fabricated division), not auto-assigned', () => {
    const attacker = combatCreature('rev-multi-atk', '3', '3');
    const blockerA = combatCreature('rev-multi-blkA', '1', '1');
    const blockerB = combatCreature('rev-multi-blkB', '1', '1');
    startCombat([attacker, blockerA, blockerB]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const blockerAId = findInstanceId(blockerA.scryfallId);
    const blockerBId = findInstanceId(blockerB.scryfallId);

    store().dispatch({ type: 'enterCombat' });
    store().dispatch({ type: 'declareAttackers', attackers: [{ cardId: attackerId }] });
    store().dispatch({
      type: 'declareBlockers',
      blockers: [
        { cardId: blockerAId, attackerId },
        { cardId: blockerBId, attackerId },
      ],
    });
    store().dispatch({ type: 'resolveCombatDamage' });

    const state = store().state;
    // Recognized as blocked by two...
    expect(state?.combat?.attackers[0]?.blockedBy).toEqual(
      expect.arrayContaining([blockerAId, blockerBId]),
    );
    // ...but NO creature damage is auto-assigned, and the deferral is surfaced.
    for (const id of [attackerId, blockerAId, blockerBId]) {
      expect(state?.cards[id]?.damageMarked).toBe(0);
      expect(state?.cards[id]?.zone).toBe('battlefield');
    }
    expect(store().warnings.some((w) => w.includes('manual-combat-damage'))).toBe(true);
  });

  it('506.1: enterCombat establishes a combat context tied to the current turn', () => {
    const attacker = combatCreature('rev-ctx-atk', '1', '1');
    startCombat([attacker]);
    store().dispatch({ type: 'enterCombat' });
    const state = store().state;
    expect(state?.combat).not.toBeNull();
    expect(state?.combat?.turn).toBe(state?.turn);
    expect(state?.phase).toBe('combat');
  });
});
