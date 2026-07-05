import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommands } from '../batch';
import {
  activationPlanForSource,
  activationTargetPromptsForSource,
  applyCommand,
  eligibleTargets,
  guidedPlanForStackTop,
  objectSnapshotForCard,
} from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState, PlayerId, TargetSelection, ZoneId } from '../types';
import { objectIdOf } from '../types';
import { makeDef } from './helpers';

function cardDef(scryfallId: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({
    scryfallId,
    name: scryfallId,
    typeLine,
    faces: [{ name: scryfallId, typeLine, ...(oracleText ? { oracleText } : {}) }],
  });
}

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function withOwner(state: GameState, cardId: string, ownerId: PlayerId): GameState {
  return {
    ...state,
    cards: {
      ...state.cards,
      [cardId]: {
        ...state.cards[cardId],
        ownerId,
        controllerId: ownerId,
      },
    },
  };
}

function objectTargetSelection(
  state: GameState,
  prompt: NonNullable<ReturnType<typeof activationTargetPromptsForSource>[number]>,
  cardId: string,
  legalityMode: TargetSelection['legalityMode'] = 'checked',
): TargetSelection {
  const snapshot = objectSnapshotForCard(state, cardId);
  if (!snapshot) {
    throw new Error(`missing snapshot for ${cardId}`);
  }
  return {
    slotId: prompt.slotId ?? 'target-0',
    raw: prompt.raw,
    kind: prompt.targetKind ?? 'object',
    selection: {
      kind: 'object',
      physicalCardId: snapshot.physicalCardId,
      objectId: snapshot.objectId,
      snapshot,
    },
    legalityMode,
  };
}

function compile(line: string) {
  const source = cardDef('compile-source', 'Sorcery', line);
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), {
    sourceId: 'source-1',
    def: source,
  });
}

describe('CR 400/404 reanimation guided return', () => {
  it('guides Karmic Guide style graveyard creature-card return to battlefield', () => {
    const text =
      'At the beginning of your end step, return target creature card from your graveyard to the battlefield.';
    const guide = cardDef('karmic-guide', 'Creature', text);
    const creature = cardDef('dead-creature', 'Creature');
    const artifact = cardDef('dead-artifact', 'Artifact');
    const opponentCreature = cardDef('opponent-creature', 'Creature');

    let state = initGame(
      [
        { def: guide, isCommander: false },
        { def: creature, isCommander: false },
        { def: artifact, isCommander: false },
        { def: opponentCreature, isCommander: false },
      ],
      1,
    );
    state = withOwner(state, 'c4', 'OPPONENT_A');
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'graveyard');
    state = move(state, 'c3', 'graveyard');
    state = move(state, 'c4', 'graveyard');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
    }).state;

    const plan = guidedPlanForStackTop(state);
    expect(plan?.prompts[0]).toMatchObject({
      atom: 'effect.return',
      kind: 'target',
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you' },
    });
    expect(eligibleTargets(state, plan!.prompts[0].filter ?? {}, { sourceId: 'c1' })).toEqual([
      'c2',
    ]);

    const commands = buildGuidedCommands(
      plan!.prompts[0],
      { kind: 'target', cardIds: ['c2'] },
      { sourceId: 'c1', def: guide, sourceObjectId: objectIdOf(state.cards.c1) },
    );
    expect(commands).toEqual([
      { type: 'moveCard', cardId: 'c2', to: 'battlefield', position: 'bottom' },
    ]);

    const resolved = applyCommands(state, [...commands, { type: 'resolveStackTop' }]);
    expect(resolved.state.cards.c2.zone).toBe('battlefield');
    expect(resolved.state.cards.c3.zone).toBe('graveyard');
    expect(resolved.state.cards.c4.zone).toBe('graveyard');
    expect(resolved.state.zones.stack).toHaveLength(0);
  });

  it('stores Priest of Fell Rites targets before sacrifice costs and resolves only that saved object', () => {
    const priestText =
      '{2}, {T}, Sacrifice Priest of Fell Rites: Return target creature card from your graveyard to the battlefield.';
    const priest = cardDef('Priest of Fell Rites', 'Creature', priestText);
    const creature = cardDef('dead-creature', 'Creature');
    const artifact = cardDef('dead-artifact', 'Artifact');

    let state = initGame(
      [
        { def: priest, isCommander: false },
        { def: creature, isCommander: false },
        { def: artifact, isCommander: false },
      ],
      1,
    );
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'graveyard');
    state = move(state, 'c3', 'graveyard');

    const prompt = activationTargetPromptsForSource(state, 'c1', 0)[0];
    expect(prompt).toMatchObject({
      atom: 'effect.return',
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you' },
    });
    expect(eligibleTargets(state, prompt.filter ?? {}, { sourceId: 'c1' })).toEqual(['c2']);

    const plan = activationPlanForSource(state, 'c1', 0);
    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    expect(plan?.decision).toBe('auto');
    expect(sourceSnapshot).not.toBeNull();
    const targetSelection = objectTargetSelection(state, prompt, 'c2');
    state = applyCommands(state, [
      ...(plan?.commands ?? []),
      {
        type: 'addAbilityToStack',
        sourceId: 'c1',
        kind: 'activated',
        abilityLineIndex: 0,
        sourceSnapshot: sourceSnapshot ?? undefined,
        targetSelections: [targetSelection],
      },
    ]).state;

    expect(state.cards.c1.zone).toBe('graveyard');
    expect(state.cards.c2.zone).toBe('graveyard');
    expect(targetSelection.selection.kind).toBe('object');
    const targetObjectId =
      targetSelection.selection.kind === 'object' ? targetSelection.selection.objectId : '';
    expect(state.cards[state.zones.stack[0]].targetSelections?.[0]).toMatchObject({
      selection: { kind: 'object', physicalCardId: 'c2', objectId: targetObjectId },
      legalityMode: 'checked',
    });

    const resolved = applyCommand(state, { type: 'resolveStackTop' });
    expect(resolved.state.cards.c1.zone).toBe('graveyard');
    expect(resolved.state.cards.c2.zone).toBe('battlefield');
  });

  it('does not let Priest of Fell Rites become its own target after the sacrifice cost', () => {
    const priestText =
      '{2}, {T}, Sacrifice Priest of Fell Rites: Return target creature card from your graveyard to the battlefield.';
    const priest = cardDef('Priest of Fell Rites', 'Creature', priestText);
    let state = initGame([{ def: priest, isCommander: false }], 1);
    state = move(state, 'c1', 'battlefield');

    const prompt = activationTargetPromptsForSource(state, 'c1', 0)[0];
    expect(eligibleTargets(state, prompt.filter ?? {}, { sourceId: 'c1' })).toEqual([]);

    const plan = activationPlanForSource(state, 'c1', 0);
    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    const illegalSelfSelection = objectTargetSelection(state, prompt, 'c1', 'forced');
    state = applyCommands(state, [
      ...(plan?.commands ?? []),
      {
        type: 'addAbilityToStack',
        sourceId: 'c1',
        kind: 'activated',
        abilityLineIndex: 0,
        sourceSnapshot: sourceSnapshot ?? undefined,
        targetSelections: [illegalSelfSelection],
      },
    ]).state;

    expect(state.cards.c1.zone).toBe('graveyard');
    const resolved = applyCommand(state, { type: 'resolveStackTop' });
    expect(resolved.state.cards.c1.zone).toBe('graveyard');
    expect(resolved.warnings.at(-1)).toContain('保存済み対象は現在のオブジェクトではありません');
  });

  it('keeps approved manual boundaries and existing hand return behavior unchanged', () => {
    const exact = compile('Return target creature card from your graveyard to the battlefield.');
    expect(exact.decision).toBe('guided');
    expect(exact.prompts[0]).toMatchObject({
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you' },
    });

    const underYourControl = compile(
      'Return target creature card from your graveyard to the battlefield under your control.',
    );
    expect(underYourControl.decision).not.toBe('guided');

    const linkedExileHand = compile("Exile target creature, then return that card to its owner's hand.");
    expect(linkedExileHand.decision).toBe('manual');

    const bounce = compile("Return target creature to its owner's hand.");
    expect(bounce.decision).toBe('guided');
    expect(
      buildGuidedCommands(bounce.prompts[0], { kind: 'target', cardIds: ['target-1'] }, {
        sourceId: 'source-1',
        def: cardDef('bounce-source', 'Instant'),
      }),
    ).toEqual([{ type: 'moveCard', cardId: 'target-1', to: 'hand', position: 'bottom' }]);

    const sunTitan = compile(
      'Whenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
    );
    expect(sunTitan.decision).toBe('manual');

    const opponentGraveyard = compile(
      "Return target creature card from an opponent's graveyard to the battlefield.",
    );
    expect(opponentGraveyard.decision).toBe('manual');
  });
});
