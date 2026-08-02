// REVIEWER-OWNED acceptance contract for engine-spec §34.53 / acceptance G9.
// Implementers must not edit this file; fix implementation when it fails.
// CR grounding: 101.3, 101.4, 608.2e-f, 701.9a-b, 701.17a-b, 701.21a.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import {
  DEFAULT_OPPONENT_ID,
  syncDerivedViews,
  type GameState,
} from '../types';
import { makeDeck, makeDef } from './helpers';

interface GoldenCase {
  id: string;
  crRefs: string[];
}

const rawGoldenModules = import.meta.glob('../../../research/cr-grounding/golden-cases.json', {
  eager: true,
  import: 'default',
});
const goldenDoc = Object.values(rawGoldenModules)[0] as { cases: GoldenCase[] };

function expectGolden(id: string, refs: readonly string[]): void {
  const entry = goldenDoc.cases.find((candidate) => candidate.id === id);
  expect(entry, `${id} exists in the CR golden registry`).toBeDefined();
  expect(entry?.crRefs).toEqual(expect.arrayContaining([...refs]));
}

function sourceDef(name: string, oracleText: string, typeLine = 'Sorcery'): CardDef {
  return makeDef({
    scryfallId: `review-cr701-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
    name,
    typeLine,
    faces: [{ name, typeLine, oracleText }],
  });
}

function compile(oracleText: string, name = 'CR701 Review', typeLine = 'Sorcery') {
  const def = sourceDef(name, oracleText, typeLine);
  return compileAbilityIR(parseAbilityIR(oracleText, typeLine), {
    sourceId: 'review-cr701-source',
    controllerId: 'P1',
    def,
  });
}

function seedOpponentLibrary(state: GameState, count: number): GameState {
  const ids = state.zonesByPlayer.P1.library.slice(0, count);
  const moved = new Set(ids);
  const cards = { ...state.cards };
  for (const id of ids) {
    cards[id] = {
      ...cards[id],
      ownerId: DEFAULT_OPPONENT_ID,
      controllerId: DEFAULT_OPPONENT_ID,
      zone: 'library',
    };
  }
  return syncDerivedViews({
    ...state,
    cards,
    zonesByPlayer: {
      ...state.zonesByPlayer,
      P1: {
        ...state.zonesByPlayer.P1,
        library: state.zonesByPlayer.P1.library.filter((id) => !moved.has(id)),
      },
      [DEFAULT_OPPONENT_ID]: {
        ...state.zonesByPlayer[DEFAULT_OPPONENT_ID],
        library: ids,
      },
    },
  });
}

describe('review.cr701-cross-player-actions: exact compiler boundary', () => {
  it('compiles plain and exact Ruin Crab each-opponent mill to the same player effect', () => {
    expectGolden('cr-701-ruin-crab-each-opponent-mill', ['701.17a', '701.17b']);
    const expected = {
      decision: 'auto',
      prompts: [],
      commands: [{
        type: 'applyPlayerEffect',
        controllerId: 'P1',
        recipients: 'eachOpponent',
        effect: 'mill',
        amount: 3,
      }],
    };
    expect(compile('Each opponent mills three cards.')).toMatchObject(expected);
    expect(compile(
      'Landfall — Whenever a land enters the battlefield under your control, each opponent mills three cards.',
      'Ruin Crab',
      'Creature — Crab',
    )).toMatchObject(expected);
  });

  it('emits roster-independent recipient prompts for fixed cross-player discard', () => {
    expectGolden('cr-701-burglar-rat-each-opponent-discard', ['101.4', '701.9a', '701.9b']);
    expect(compile('Each player discards a card.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.discard', kind: 'discard', count: 1, recipients: 'eachPlayer',
      }],
    });
    expect(compile('Each opponent discards two cards.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.discard', kind: 'discard', count: 2, recipients: 'eachOpponent',
      }],
    });
    expect(compile('Each other player discards a card.')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.discard', kind: 'discard', count: 1, recipients: 'eachOpponent',
      }],
    });
  });

  it('covers the Accursed Marauder and Liliana simple sacrifice goldens', () => {
    expectGolden('cr-701-accursed-marauder-each-player-sacrifice', ['101.4', '701.21a']);
    expect(compile(
      'When this creature enters, each player sacrifices a nontoken creature of their choice.',
      'Accursed Marauder',
      'Creature — Human Berserker',
    )).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.sacrifice',
        kind: 'sacrifice',
        count: 1,
        recipients: 'eachPlayer',
        filter: { types: ['creature'], controller: 'you', excludeTokens: true },
      }],
    });
    expect(compile('−4: Each player sacrifices two creatures of their choice.', 'Liliana, Dreadhorde General', 'Planeswalker')).toMatchObject({
      decision: 'guided',
      commands: [],
      prompts: [{
        atom: 'effect.sacrifice',
        kind: 'sacrifice',
        count: 2,
        recipients: 'eachPlayer',
        filter: { types: ['creature'], controller: 'you' },
      }],
    });
  });

  it('fails closed for unresolved player binding, random/variable qualifiers, and same-clause composites', () => {
    for (const text of [
      'Target player discards a card.',
      'That player sacrifices a creature of their choice.',
      'Target player mills two cards. Draw a card.',
      'That player discards a card. Draw a card.',
      'Defending player sacrifices a creature of their choice. Draw a card.',
      'Draw three cards, then discard two cards. If this spell was kicked, target player discards two cards.',
      'Each player sacrifices a creature of their choice. Each opponent loses 1 life and you gain 1 life.',
      'Each opponent discards a card at random.',
      'Each player sacrifices half the creatures they control, rounded up.',
      'Each opponent sacrifices a creature with the greatest power among creatures they control.',
      'Each opponent sacrifices a creature of their choice, discards a card, and loses 4 life.',
      'Each player mills four cards. Then you may exile a creature or planeswalker card from each graveyard.',
    ]) {
      expect(compile(text)).toMatchObject({ decision: 'manual', commands: [], prompts: [] });
    }
  });

  it('preserves written mixed-action order when every separate action is modeled', () => {
    expect(compile('Each opponent mills two cards. Then you scry 2.', 'Overwhelmed Apprentice', 'Creature — Human Wizard')).toMatchObject({
      decision: 'guided',
      commands: [{
        type: 'applyPlayerEffect', controllerId: 'P1', recipients: 'eachOpponent',
        effect: 'mill', amount: 2,
      }],
      prompts: [{ atom: 'effect.scry', kind: 'scry-surveil', count: 2 }],
    });
  });
});

describe('review.cr701-cross-player-actions: mill state/event semantics', () => {
  it('mills only each opponent, as much as possible, in one semantic group without mutating input', () => {
    const state = seedOpponentLibrary(initGame(makeDeck(12), 17), 2);
    const inputJson = JSON.stringify(state);
    const p1Before = structuredClone(state.zonesByPlayer.P1);
    const result = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachOpponent',
      effect: 'mill',
      amount: 3,
    });
    const next = result.state;

    expect(JSON.stringify(state)).toBe(inputJson);
    expect(next.zonesByPlayer.P1).toEqual(p1Before);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].library).toEqual([]);
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toHaveLength(2);
    const events = next.eventLog.filter(
      (event) => event.type === 'zoneChange'
        && event.before.ownerId === DEFAULT_OPPONENT_ID
        && event.fromZone === 'library',
    );
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.reason === 'mill')).toBe(true);
    expect(events.every((event) => Boolean(event.simultaneousGroupId))).toBe(true);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
    expect(Object.values(next.defeat).flatMap((entry) => entry?.reasons ?? [])).not.toContain('emptyLibraryDraw');
  });
});
