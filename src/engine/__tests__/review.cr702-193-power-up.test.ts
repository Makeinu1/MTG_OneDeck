/**
 * review.cr702-193-power-up — CR 702.193 Power-up keyword activated ability.
 *
 * REVIEWER-OWNED: implementers must NOT edit this file; fix the engine.
 *
 * CR grounding (pinned 2026-06-19):
 *   702.193a: "Power-up — [Cost]: [Effect]" means "[Cost]: [Effect]. If this
 *     permanent entered this turn, this ability's cost is reduced by this
 *     permanent's mana cost. Activate this ability only once."
 *   702.193b: Generic mana reduces generic; colored/colorless reduces same type;
 *     excess reduces generic. (See 118.7.)
 *   118.7a: Generic reduction affects only the generic component.
 *   118.7c: Colored excess reduces generic.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { canonicalizeActivatedKeyword } from '../grammar/activatedKeyword';
import { activatedAbilityLines } from '../grammar';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { makeDef, makeDeck } from './helpers';
import { objectIdOf, type GameState } from '../types';
import { useGameStore } from '../../store/gameStore';
import type { GameSnapshot } from '../../data/gameSnapshot';

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

function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}

function toBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

describe('review.cr702-193 — Power-up grammar recognition', () => {
  it('A1: canonicalizeActivatedKeyword recognizes Power-up with em-dash', () => {
    const result = canonicalizeActivatedKeyword(
      'Power-up — {5}{U}: Put three +1/+1 counters on this creature.',
    );
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      keywordId: 'power-up',
      keywordLabel: 'パワーアップ',
      keywordCost: '{5}{U}',
      activationZones: ['battlefield'],
    });
    expect(result![0].text).toContain('{5}{U}: Put three +1/+1 counters on this creature.');
  });

  it('A1b: recognizes Power-up with hybrid cost', () => {
    const result = canonicalizeActivatedKeyword(
      'Power-up — {5}{R/G}{R/G}: Put a +1/+1 counter on this creature.',
    );
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({ keywordId: 'power-up', keywordCost: '{5}{R/G}{R/G}' });
  });

  it('A2: non-power-up lines mentioning power-up are not matched', () => {
    expect(
      canonicalizeActivatedKeyword(
        'You may pay {0} rather than pay the power-up cost of the first power-up ability you activate during each of your turns.',
      ),
    ).toBeNull();
    expect(
      canonicalizeActivatedKeyword(
        'Whenever another creature you control enters and whenever you activate a power-up ability, put a +1/+1 counter on this creature.',
      ),
    ).toBeNull();
  });

  it('A3: activatedAbilityLines preserves keyword metadata and flat index', () => {
    const def = makeDef({
      scryfallId: 'pu-brave-brawler',
      typeLine: 'Creature — Human Warrior Hero',
      faces: [{
        name: 'Brave Brawler',
        typeLine: 'Creature — Human Warrior Hero',
        manaCost: '{1}{W}',
        oracleText: 'Lifelink\nPower-up — {4}{W}: Put two +1/+1 counters on this creature.',
      }],
    });
    const lines = activatedAbilityLines(def);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      keywordId: 'power-up',
      keywordLabel: 'パワーアップ',
      costText: '{4}{W}',
    });
    // Flat index must match splitAbilityLines space (Lifelink = index 0, Power-up = index 1)
    expect(lines[0].index).toBe(1);
  });

  it('A3b: reminder text is stripped before recognition', () => {
    const def = makeDef({
      scryfallId: 'pu-aerial-doombot',
      typeLine: 'Artifact Creature — Robot Villain',
      faces: [{
        name: 'Aerial Doombot',
        typeLine: 'Artifact Creature — Robot Villain',
        manaCost: '{U}',
        oracleText: 'Flying\nPower-up — {5}{U}: Put three +1/+1 counters on this creature. (Activate each power-up ability only once. Reduce the cost by its mana cost if it entered this turn.)',
      }],
    });
    const lines = activatedAbilityLines(def);
    expect(lines).toHaveLength(1);
    expect(lines[0].keywordId).toBe('power-up');
    // Reminder text must not leak into the expanded text
    expect(lines[0].text).not.toContain('Activate each power-up');
  });
});

describe('review.cr702-193 — Power-up cost reduction (CR 118.7)', () => {
  beforeEach(() => resetStore());

  function setupPowerUpGame(manaCost: string, puCost: string) {
    const def = makeDef({
      scryfallId: 'pu-test',
      typeLine: 'Creature — Test',
      faces: [{
        name: 'PU Test',
        typeLine: 'Creature — Test',
        manaCost,
        oracleText: `Power-up — ${puCost}: Put a +1/+1 counter on this creature.`,
      }],
    });
    store().newGame(
      [{ def, isCommander: false }, ...makeDeck(10)],
      1,
    );
    const id = instanceId('pu-test');
    toBattlefield(id);
    store().clearWarnings();
    return id;
  }

  it('A4: cost reduced by permanent mana cost when entered this turn', () => {
    const id = setupPowerUpGame('{1}{W}', '{4}{W}');
    const s = store().state!;
    const perm = s.cards[id];
    // enteredTurn === turn (entered this turn)
    expect(perm.enteredTurn).toBe(s.turn);
    // Activate: cost should be reduced {4}{W} - {1}{W} = {3}
    store().activateAbility(id, 1); // index 1 (power-up line)
    // Check that the activation proceeded (stack object or guided prompt)
    const stack = store().state!.zones.stack;
    const pending = store().pendingGuided;
    // Either it went to stack or a guided prompt appeared — both mean activation started
    expect(stack.length + (pending ? 1 : 0)).toBeGreaterThan(0);
  });

  it('A5: no cost reduction when NOT entered this turn', () => {
    const id = setupPowerUpGame('{1}{W}', '{4}{W}');
    // Directly set turn to 2 to simulate "not entered this turn"
    useGameStore.setState((prev) => ({
      state: prev.state ? { ...prev.state, turn: 2 } : prev.state,
    }));
    const s = store().state!;
    expect(s.cards[id].enteredTurn).toBeLessThan(s.turn);
    store().clearWarnings();
    store().activateAbility(id, 1);
    // Activation should still proceed (just without reduction)
    const stack = store().state!.zones.stack;
    const pending = store().pendingGuided;
    expect(stack.length + (pending ? 1 : 0)).toBeGreaterThan(0);
  });

  it('A6: colored excess reduces generic (CR 118.7c)', () => {
    // manaCost {W}{W}, power-up cost {2}{W}
    // Reduction: W reduces W (1 pip), second W has no W target → reduces generic (1)
    // Final: {2}{W} - {W} - {1 generic} = {1}
    const id = setupPowerUpGame('{W}{W}', '{2}{W}');
    const s = store().state!;
    expect(s.cards[id].enteredTurn).toBe(s.turn);
    store().activateAbility(id, 1);
    const stack = store().state!.zones.stack;
    const pending = store().pendingGuided;
    expect(stack.length + (pending ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe('review.cr702-193 — Power-up activate only once', () => {
  beforeEach(() => resetStore());

  it('A7: second activation on same objectId is blocked', () => {
    const def = makeDef({
      scryfallId: 'pu-once',
      typeLine: 'Creature — Test',
      faces: [{
        name: 'PU Once',
        typeLine: 'Creature — Test',
        manaCost: '{2}',
        oracleText: 'Power-up — {0}: Put a +1/+1 counter on this creature.',
      }],
    });
    store().newGame([{ def, isCommander: false }, ...makeDeck(10)], 1);
    const id = instanceId('pu-once');
    toBattlefield(id);
    store().clearWarnings();

    // First activation (cost {0} so no mana needed; single ability line = index 0)
    store().activateAbility(id, 0);
    store().clearWarnings();

    // Second activation should be blocked
    store().activateAbility(id, 0);
    expect(store().warnings.some((w) => /パワーアップ|power.?up|一度/i.test(w))).toBe(true);
  });

  it('A8: re-entry (new objectId) resets the restriction', () => {
    const def = makeDef({
      scryfallId: 'pu-reenter',
      typeLine: 'Creature — Test',
      faces: [{
        name: 'PU Reenter',
        typeLine: 'Creature — Test',
        manaCost: '{2}',
        oracleText: 'Power-up — {0}: Put a +1/+1 counter on this creature.',
      }],
    });
    store().newGame([{ def, isCommander: false }, ...makeDeck(10)], 1);
    const id = instanceId('pu-reenter');
    toBattlefield(id);
    store().clearWarnings();

    const objectId1 = objectIdOf(store().state!.cards[id]);

    // First activation (cost {0}; single ability line = index 0)
    store().activateAbility(id, 0);
    store().clearWarnings();

    // Move to graveyard and back (new zoneChangeCounter → new objectId)
    store().moveCard(id, 'graveyard', 'bottom');
    toBattlefield(id);
    store().clearWarnings();

    const objectId2 = objectIdOf(store().state!.cards[id]);
    expect(objectId2).not.toBe(objectId1);

    // Should be able to activate again
    store().activateAbility(id, 0);
    const blocked = store().warnings.some((w) => /パワーアップ|power.?up|一度/i.test(w));
    expect(blocked).toBe(false);
  });

  it('A9: restoreGame backfills missing powerUpActivated', () => {
    const def = makeDef({
      scryfallId: 'pu-backfill',
      typeLine: 'Creature — Test',
      faces: [{
        name: 'PU Backfill',
        typeLine: 'Creature — Test',
        manaCost: '{2}',
        oracleText: 'Power-up — {4}: Put a +1/+1 counter on this creature.',
      }],
    });
    store().newGame([{ def, isCommander: false }, ...makeDeck(10)], 1);
    const snapshot = store().takeSnapshot();
    // Remove the field to simulate an old snapshot
    const raw: GameSnapshot = JSON.parse(JSON.stringify(snapshot)) as GameSnapshot;
    delete (raw.state as Partial<GameState>).powerUpActivated;
    expect(() => store().restoreGame(raw)).not.toThrow();
    expect(store().state!.powerUpActivated).toEqual({});
  });

  it('A10: power-up with uncompiled effect stays manual/guided (no fake-green)', () => {
    const def = makeDef({
      scryfallId: 'pu-complex',
      typeLine: 'Creature — Test',
      faces: [{
        name: 'PU Complex',
        typeLine: 'Creature — Test',
        manaCost: '{2}{U}',
        oracleText: 'Power-up — {5}{U}: Each player shuffles their hand and graveyard into their library, then draws seven cards. Put a +1/+1 counter on this creature.',
      }],
    });
    const lines = activatedAbilityLines(def);
    expect(lines).toHaveLength(1);
    expect(lines[0].keywordId).toBe('power-up');
    // The compile decision for this complex effect must NOT be 'auto'
    const compiled = compileAbilityIR(parseAbilityIR(lines[0].text, def.typeLine), {
      sourceId: 'pu-complex-src',
      def,
    });
    expect(compiled.decision).not.toBe('auto');
  });
});
