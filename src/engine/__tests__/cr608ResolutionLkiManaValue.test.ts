import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, guidedPlanForStackTop, objectSnapshotForCard } from '../commands';
import { buildGuidedCommands, compileAbilityIR, type EffectPrompt } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState, TargetSelection, ZoneId } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, cmc: number, oracleText?: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    cmc,
    faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }],
  });
}

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function compile(line: string, typeLine = 'Sorcery') {
  const source = cardDef('cr608-lki-compile-source', typeLine, 2, line);
  return compileAbilityIR(parseAbilityIR(line, typeLine), { sourceId: 'source-1', def: source });
}

function objectTargetSelection(
  state: GameState,
  prompt: EffectPrompt,
  cardId: string,
): TargetSelection {
  const snapshot = objectSnapshotForCard(state, cardId);
  if (!snapshot) {
    throw new Error(`missing snapshot for ${cardId}`);
  }
  return {
    slotId: 'target-0',
    raw: prompt.raw,
    kind: prompt.targetKind ?? 'object',
    selection: {
      kind: 'object',
      physicalCardId: snapshot.physicalCardId,
      objectId: snapshot.objectId,
      snapshot,
    },
    legalityMode: 'checked',
  };
}

function stateWithDefCmc(state: GameState, defId: string, cmc: number): GameState {
  const def = state.defs[defId];
  if (!def) {
    throw new Error(`missing def ${defId}`);
  }
  return {
    ...state,
    defs: {
      ...state.defs,
      [defId]: { ...def, cmc },
    },
  };
}

describe('CR 608.2h resolution-time LKI for target mana value', () => {
  it('compiles the Feed the Swarm shape as one guided destroy prompt', () => {
    const result = compile(
      'Destroy target creature or planeswalker. You lose life equal to its mana value.',
    );

    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [
        {
          atom: 'effect.destroy',
          kind: 'target',
          filter: { types: ['creature', 'planeswalker'] },
        },
      ],
    });
    expect(result.prompts[0].raw).toBe(
      'Destroy target creature or planeswalker. You lose life equal to its mana value.',
    );
  });

  it('destroys the saved target and loses life from the target selection snapshot mana value', () => {
    const abilityText =
      'When this creature enters, destroy target creature or planeswalker. You lose life equal to its mana value.';
    const source = cardDef('cr608-lki-source', 'Creature — Cleric', 2, abilityText);
    const victim = cardDef('cr608-lki-victim', 'Creature — Zombie', 4);
    let state = initGame(
      [
        { def: source, isCommander: false },
        { def: victim, isCommander: false },
      ],
      1,
    );
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'battlefield');

    const prompt = compile(abilityText, 'Creature — Cleric').prompts[0];
    const selection = objectTargetSelection(state, prompt, 'c2');
    expect(selection.selection.kind).toBe('object');
    if (selection.selection.kind !== 'object') {
      throw new Error('expected object target selection');
    }
    expect(selection.selection.snapshot.manaValue).toBe(4);

    state = stateWithDefCmc(state, 'cr608-lki-victim', 9);
    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
      sourceSnapshot: sourceSnapshot ?? undefined,
      targetSelections: [selection],
    }).state;

    expect(guidedPlanForStackTop(state)).toBeNull();
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;

    expect(resolved.cards.c2.zone).toBe('graveyard');
    expect(resolved.life).toBe(36);
  });

  it('uses mana value 0 for a saved land target', () => {
    const abilityText =
      'When this creature enters, destroy target permanent. You lose life equal to its mana value.';
    const source = cardDef('cr608-lki-land-source', 'Creature — Cleric', 2, abilityText);
    const land = cardDef('cr608-lki-land', 'Land', 0);
    let state = initGame(
      [
        { def: source, isCommander: false },
        { def: land, isCommander: false },
      ],
      1,
    );
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'battlefield');

    const prompt = compile(abilityText, 'Creature — Cleric').prompts[0];
    const selection = objectTargetSelection(state, prompt, 'c2');
    const commands = buildGuidedCommands(
      prompt,
      {
        kind: 'target',
        cardIds: ['c2'],
        targetSnapshots:
          selection.selection.kind === 'object' ? [selection.selection.snapshot] : [],
      },
      { sourceId: 'c1', def: source },
    );
    expect(commands).toEqual([
      { type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['c2'] } },
      { type: 'adjustLife', delta: -0 },
    ]);
    expect(buildGuidedCommands(
      prompt,
      {
        kind: 'target',
        cardIds: ['c2'],
        targetSnapshots:
          selection.selection.kind === 'object' ? [selection.selection.snapshot] : [],
      },
      { sourceId: 'c1', controllerId: 'OPPONENT_A', def: source },
    )).toEqual([
      { type: 'destroyPermanents', selector: { kind: 'cards', cardIds: ['c2'] } },
      { type: 'adjustLife', delta: -0, playerId: 'OPPONENT_A' },
    ]);

    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
      sourceSnapshot: sourceSnapshot ?? undefined,
      targetSelections: [selection],
    }).state;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;

    expect(resolved.cards.c2.zone).toBe('graveyard');
    expect(resolved.life).toBe(40);
  });
});
