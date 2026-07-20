/**
 * Reviewer-owned CR 603.1/603.2/603.2b condition/effect boundary pins.
 * Implementers must not edit this file; fix source/ordinary tests when it fails.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function instanceId(defId: string): string {
  const id = Object.values(snap().cards).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function startGame(defs: CardDef[]): Record<string, string> {
  store().newGame([
    ...defs.map((def) => ({ def, isCommander: false })),
    ...makeDeck(Math.max(0, 30 - defs.length)),
  ], 7401);
  store().keepOpeningHand();
  const ids = Object.fromEntries(defs.map((def) => [def.scryfallId, instanceId(def.scryfallId)]));
  for (const id of Object.values(ids)) store().moveCard(id, 'battlefield');
  const state = snap();
  useGameStore.setState({
    state: { ...state, pendingTriggers: [] },
    triggerCandidates: [],
  });
  return ids;
}

function pendingFor(sourceId: string) {
  return snap().pendingTriggers.filter((pending) => pending.sourceId === sourceId);
}

beforeEach(() => {
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
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
});

describe('CR 603 trigger condition is not the ability effect', () => {
  it('The One Ring does not subscribe its upkeep effect to arbitrary life loss', () => {
    const ring = makeDef({
      scryfallId: 'msth-ring-trigger-boundary',
      typeLine: 'Legendary Artifact',
      faces: [{
        name: 'The One Ring',
        typeLine: 'Legendary Artifact',
        oracleText:
          'Indestructible\nWhen The One Ring enters, if you cast it, you gain protection from everything until your next turn.\nAt the beginning of your upkeep, you lose 1 life for each burden counter on The One Ring.\n{T}: Put a burden counter on The One Ring, then draw a card for each burden counter on The One Ring.',
      }],
    });
    const ids = startGame([ring]);
    const ringId = ids[ring.scryfallId];

    store().dispatch({ type: 'adjustLife', delta: -1 });
    expect(pendingFor(ringId)).toEqual([]);

    store().nextTurn();
    expect(snap().phase).toBe('untap');
    store().nextPhase();
    expect(snap().phase).toBe('upkeep');
    expect(pendingFor(ringId)).toMatchObject([
      { triggerId: 'trigger.upkeep', abilityLineIndex: 2 },
    ]);
  });

  it('does not promote MyDeck At-effects into draw/life/damage subscriptions', () => {
    const doomsday = makeDef({
      scryfallId: 'msth-doomsday', typeLine: 'Creature',
      faces: [{
        name: 'Doomsday Excruciator', typeLine: 'Creature',
        oracleText: 'At the beginning of your upkeep, draw a card.',
      }],
    });
    const scrawling = makeDef({
      scryfallId: 'msth-scrawling', typeLine: 'Creature',
      faces: [{
        name: 'Scrawling Crawler', typeLine: 'Creature',
        oracleText: 'At the beginning of your upkeep, each player draws a card.',
      }],
    });
    const vault = makeDef({
      scryfallId: 'msth-mana-vault', typeLine: 'Artifact',
      faces: [{
        name: 'Mana Vault', typeLine: 'Artifact',
        oracleText:
          "Mana Vault doesn't untap during your untap step.\nAt the beginning of your draw step, if Mana Vault is tapped, it deals 1 damage to you.",
      }],
    });
    const gau = makeDef({
      scryfallId: 'msth-gau', typeLine: 'Creature',
      faces: [{
        name: 'Gau, Feral Youth', typeLine: 'Creature',
        oracleText:
          'At the beginning of each end step, if a card left your graveyard this turn, Gau deals damage equal to its power to each opponent.',
      }],
    });
    const kefka = makeDef({
      scryfallId: 'msth-kefka', typeLine: 'Creature',
      faces: [{
        name: 'Kefka, Dancing Mad', typeLine: 'Creature',
        oracleText:
          'At the beginning of your end step, exile a card at random from each opponent\'s graveyard. You may cast any number of spells from among cards exiled this way without paying their mana costs. Then each player who owns a spell you cast this way loses life equal to its mana value.',
      }],
    });
    const ids = startGame([doomsday, scrawling, vault, gau, kefka]);

    store().draw(1);
    store().dispatch({
      type: 'dealDamage', sourceId: ids[vault.scryfallId], amount: 1,
      combatDamage: false, targetPlayerId: 'P1',
    });
    store().dispatch({
      type: 'dealDamage', sourceId: ids[gau.scryfallId], amount: 1,
      combatDamage: false, targetPlayerId: 'OPPONENT_A',
    });
    store().dispatch({ type: 'adjustLife', playerId: 'OPPONENT_A', delta: -3 });

    for (const sourceId of Object.values(ids)) {
      expect(pendingFor(sourceId)).toEqual([]);
    }
  });

  it('does not recursively subscribe At-effects that discard, draw, or put counters', () => {
    const bloodchief = makeDef({
      scryfallId: 'msth-bloodchief', typeLine: 'Enchantment',
      faces: [{
        name: 'Bloodchief Ascension', typeLine: 'Enchantment',
        oracleText:
          'At the beginning of each end step, if an opponent lost 2 or more life this turn, you may put a quest counter on this enchantment.',
      }],
    });
    const mog = makeDef({
      scryfallId: 'msth-mog', typeLine: 'Creature',
      faces: [{
        name: 'Mog, Moogle Warrior', typeLine: 'Creature',
        oracleText:
          'At the beginning of your end step, each player may discard a card. Each player who discarded a card this way draws a card. If a creature card was discarded this way, you create a 1/2 white Moogle creature token with lifelink. Then if a noncreature card was discarded this way, put a +1/+1 counter on each Moogle you control.',
      }],
    });
    const filler = makeDef({
      scryfallId: 'msth-discard-filler', typeLine: 'Creature',
      faces: [{ name: 'Discard Filler', typeLine: 'Creature' }],
    });
    const ids = startGame([bloodchief, mog, filler]);
    store().moveCard(ids[filler.scryfallId], 'hand');

    store().dispatch({ type: 'adjustLife', playerId: 'OPPONENT_A', delta: -2 });
    store().dispatch({
      type: 'addCounters', cardId: ids[bloodchief.scryfallId], counterType: 'quest', delta: 1,
    });
    store().discard([ids[filler.scryfallId]]);
    store().draw(1);
    store().dispatch({
      type: 'addCounters', cardId: ids[mog.scryfallId], counterType: '+1/+1', delta: 1,
    });

    expect(pendingFor(ids[bloodchief.scryfallId])).toEqual([]);
    expect(pendingFor(ids[mog.scryfallId])).toEqual([]);
  });

  it('preserves a genuine leading Whenever subscription and ignores its effect verbs', () => {
    const watcher = makeDef({
      scryfallId: 'msth-genuine-whenever', typeLine: 'Enchantment',
      faces: [{
        name: 'Life Watcher', typeLine: 'Enchantment',
        oracleText: 'Whenever you lose life, draw a card and put a charge counter on Life Watcher.',
      }],
    });
    const ids = startGame([watcher]);
    const watcherId = ids[watcher.scryfallId];

    store().draw(1);
    store().dispatch({
      type: 'addCounters', cardId: watcherId, counterType: 'charge', delta: 1,
    });
    expect(pendingFor(watcherId)).toEqual([]);

    store().dispatch({ type: 'adjustLife', delta: -1 });
    expect(pendingFor(watcherId)).toMatchObject([{ triggerId: 'trigger.life-loss' }]);
  });

  it('keeps a leading ETB subscription when only its effect schedules a delayed return', () => {
    const oath = makeDef({
      scryfallId: 'msth-oath-of-teferi', typeLine: 'Legendary Enchantment',
      faces: [{
        name: 'Oath of Teferi',
        typeLine: 'Legendary Enchantment',
        oracleText:
          'When Oath of Teferi enters, exile another target permanent you control. Return that card to the battlefield under its owner\'s control at the beginning of the next end step.',
      }],
    });
    const ids = startGame([oath]);
    const oathId = ids[oath.scryfallId];

    store().moveCard(oathId, 'hand');
    const state = snap();
    useGameStore.setState({
      state: { ...state, pendingTriggers: [] },
      triggerCandidates: [],
    });
    store().moveCard(oathId, 'battlefield');

    expect(pendingFor(oathId)).toMatchObject([
      { triggerId: 'trigger.etb', abilityLineIndex: 0 },
    ]);
  });

  it('does not treat quoted or reflexive inner triggers as always-active subscriptions', () => {
    const quoted = makeDef({
      scryfallId: 'msth-quoted-inner', typeLine: 'Enchantment',
      faces: [{
        name: 'Quoted Host', typeLine: 'Enchantment',
        oracleText:
          'At the beginning of your upkeep, create a token with "Whenever you draw a card, you gain 1 life."',
      }],
    });
    const reflexive = makeDef({
      scryfallId: 'msth-reflexive-inner', typeLine: 'Enchantment',
      faces: [{
        name: 'Reflexive Host', typeLine: 'Enchantment',
        oracleText:
          'At the beginning of your end step, you may discard a card. When you do, draw a card.',
      }],
    });
    const ids = startGame([quoted, reflexive]);

    store().draw(1);
    expect(pendingFor(ids[quoted.scryfallId])).toEqual([]);
    expect(pendingFor(ids[reflexive.scryfallId])).toEqual([]);
  });
});
