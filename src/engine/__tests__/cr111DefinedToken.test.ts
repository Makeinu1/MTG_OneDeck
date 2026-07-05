import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, type GameCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { CardInstance, GameState } from '../types';
import { makeDeck } from './helpers';

function sourceDef(typeLine = 'Sorcery'): CardDef {
  return {
    scryfallId: 'cr111-defined-token-source',
    oracleId: 'cr111-defined-token-source',
    name: 'cr111-defined-token-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: 'cr111-defined-token-source', typeLine }],
  };
}

function compile(line: string, typeLine = 'Sorcery') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: 'source-1',
    def: sourceDef(typeLine),
  });
}

function applySingle(command: GameCommand): GameState {
  return applyCommand(initGame(makeDeck(5), 1), command).state;
}

function battlefieldTokens(state: GameState): CardInstance[] {
  const tokens: CardInstance[] = [];
  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (card?.isToken) {
      tokens.push(card);
    }
  }
  return tokens;
}

function cardDef(state: GameState, card: CardInstance): CardDef {
  const def = state.defs[card.defId];
  if (!def) {
    throw new Error(`missing def for ${card.defId}`);
  }
  return def;
}

describe('CR 111 defined creature token compiler leaf', () => {
  it('auto-compiles and creates the Liliana 2/2 Zombie token untapped', () => {
    const result = compile('Create a 2/2 black Zombie creature token.');

    expect(result.decision).toBe('auto');
    expect(result.prompts).toEqual([]);
    expect(result.reasons).toEqual([]);
    expect(result.commands).toEqual([
      {
        type: 'createDefinedToken',
        name: 'Zombie Token',
        typeLine: 'Token Creature — Zombie',
        power: '2',
        toughness: '2',
        quantity: 1,
        initialTapped: false,
      },
    ]);

    const state = applySingle(result.commands[0]);
    const tokens = battlefieldTokens(state);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tapped).toBe(false);
    expect(tokens[0].ownerId).toBe('P1');
    expect(tokens[0].controllerId).toBe('P1');
    expect(cardDef(state, tokens[0]).faces[0]).toMatchObject({
      name: 'Zombie Token',
      typeLine: 'Token Creature — Zombie',
      power: '2',
      toughness: '2',
    });
  });

  it('auto-compiles and creates the Tormod tapped Zombie token tapped', () => {
    const result = compile('Create a tapped 2/2 black Zombie creature token.');

    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([
      {
        type: 'createDefinedToken',
        name: 'Zombie Token',
        typeLine: 'Token Creature — Zombie',
        power: '2',
        toughness: '2',
        quantity: 1,
        initialTapped: true,
      },
    ]);

    const state = applySingle(result.commands[0]);
    const tokens = battlefieldTokens(state);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tapped).toBe(true);
  });

  it('supports fixed multiple defined creature tokens', () => {
    const result = compile('Create two 1/1 white Soldier creature tokens.');

    expect(result).toMatchObject({
      decision: 'auto',
      commands: [
        {
          type: 'createDefinedToken',
          name: 'Soldier Token',
          typeLine: 'Token Creature — Soldier',
          power: '1',
          toughness: '1',
          quantity: 2,
          initialTapped: false,
        },
      ],
    });

    const state = applySingle(result.commands[0]);
    expect(battlefieldTokens(state)).toHaveLength(2);
  });

  it('uses createdBy as the owner and controller for direct commands', () => {
    const state = applySingle({
      type: 'createDefinedToken',
      name: 'Soldier Token',
      typeLine: 'Token Creature — Soldier',
      power: '1',
      toughness: '1',
      quantity: 1,
      createdBy: 'OPPONENT_A',
    });

    const tokens = battlefieldTokens(state);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].ownerId).toBe('OPPONENT_A');
    expect(tokens[0].controllerId).toBe('OPPONENT_A');
    expect(tokens[0].tapped).toBe(false);
  });

  it('leaves the Ragavan Treasure path on the existing createToken command', () => {
    const result = compile(
      "Whenever Ragavan, Nimble Pilferer deals combat damage to a player, create a Treasure token and exile the top card of that player's library.",
      'Creature',
    );

    expect(result.decision).toBe('manual');
    expect(result.commands).toContainEqual({
      type: 'createToken',
      name: '宝物',
      typeLine: 'Token Artifact — Treasure',
      quantity: 1,
      producedMana: ['W', 'U', 'B', 'R', 'G'],
      tokenKind: 'treasure',
    });
    expect(result.commands.some((command) => command.type === 'createDefinedToken')).toBe(false);
  });

  it('keeps ability-text defined tokens manual', () => {
    const result = compile(
      'Create a 1/1 white Soldier creature token with "This creature can\'t block."',
    );

    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('keeps variable count custom tokens manual', () => {
    const result = compile('Create X 1/1 white Soldier creature tokens.');

    expect(result.decision).toBe('manual');
    expect(result.reasons).toContain('variable-count');
    expect(result.commands).toEqual([]);
  });

  it('keeps copy token creation manual and does not emit copyPermanent', () => {
    const result = compile("Create a token that's a copy of target creature.");

    expect(result.decision).toBe('manual');
    expect(result.commands.some((command) => command.type === 'copyPermanent')).toBe(false);
    expect(result.commands.some((command) => command.type === 'createDefinedToken')).toBe(false);
  });
});
