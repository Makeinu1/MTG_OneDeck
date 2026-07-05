// Reviewer-owned adversarial tests for cr-400-408-zones-lki batch2-8: reanimation
// (return-from-graveyard-to-battlefield) leaf. 実装エージェント(Codex)は本ファイルを
// 変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 109.2a: 「card」+ゾーン名の記述=そのゾーン内のカードを指す(「creature card ...
//   from your graveyard」の根拠)。
// - CR 404.1/404.2: graveyard はプレイヤーの捨て札置き場・owner に紐付き・examinable。
// - CR 601.2c/602.2b/603.3d: 対象は cast/activate/trigger配置時に選ぶ。
// - CR 608.2b: 解決時に対象を再チェック。元のゾーンから外れていれば非合法。
// - CR 400.7: zone 移動=新オブジェクト(過去の記憶なし)=自己の生け贄コストで移動した
//   直後の自分自身を、同じ activation の対象として遡って選べてはならない根拠。
// 契約の要石 = 厳密一致「Return target creature card from your graveyard to the
// battlefield.」(修飾語なし)のみ guided。既存 pinned moveCard は無変更。既存の
// return-to-hand(bounce)経路・linked-exile(blink)サブスコープは無関係のまま無変更。
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
      [cardId]: { ...state.cards[cardId], ownerId, controllerId: ownerId },
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
  if (!snapshot) throw new Error(`missing snapshot for ${cardId}`);
  return {
    slotId: prompt.slotId ?? 'target-0',
    raw: prompt.raw,
    kind: prompt.targetKind ?? 'object',
    selection: { kind: 'object', physicalCardId: snapshot.physicalCardId, objectId: snapshot.objectId, snapshot },
    legalityMode,
  };
}

function compile(line: string) {
  const source = cardDef('r-cr400-return-source', 'Sorcery', line);
  return compileAbilityIR(parseAbilityIR(line, 'Sorcery'), { sourceId: 'source-1', def: source });
}

describe('cr-400-408 reanimation leaf: return target creature card from graveyard to battlefield', () => {
  it('Karmic Guide golden: guided trigger returns the P1-owned graveyard creature only', () => {
    const text =
      'At the beginning of your end step, return target creature card from your graveyard to the battlefield.';
    const source = cardDef('r-karmic-guide', 'Creature', text);
    const creature = cardDef('r-dead-creature', 'Creature');
    const artifact = cardDef('r-dead-artifact', 'Artifact');
    const opponentCreature = cardDef('r-opponent-creature', 'Creature');

    let state = initGame(
      [
        { def: source, isCommander: false },
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
    // owner boundary (CR 404.1): only the P1-owned graveyard creature is eligible.
    expect(eligibleTargets(state, plan!.prompts[0].filter ?? {}, { sourceId: 'c1' })).toEqual(['c2']);

    const commands = buildGuidedCommands(
      plan!.prompts[0],
      { kind: 'target', cardIds: ['c2'] },
      { sourceId: 'c1', def: source, sourceObjectId: objectIdOf(state.cards.c1) },
    );
    const resolved = applyCommands(state, [...commands, { type: 'resolveStackTop' }]);
    expect(resolved.state.cards.c2.zone).toBe('battlefield');
  });

  it("Priest of Fell Rites cannot become its own target after its sacrifice cost (CR 400.7/602.2b atomicity)", () => {
    const priestText =
      '{2}, {T}, Sacrifice Priest of Fell Rites: Return target creature card from your graveyard to the battlefield.';
    const priest = cardDef('Priest of Fell Rites', 'Creature', priestText);
    let state = initGame([{ def: priest, isCommander: false }], 1);
    state = move(state, 'c1', 'battlefield');

    const prompt = activationTargetPromptsForSource(state, 'c1', 0)[0];
    // Structurally absent from candidates while still on the battlefield (pre-cost state).
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
    // Defense in depth: even a force-constructed illegal self-selection is rejected at resolution
    // because Priest's own zone change (battlefield->graveyard) changed its objectId (CR 400.7).
    const resolved = applyCommand(state, { type: 'resolveStackTop' });
    expect(resolved.state.cards.c1.zone).toBe('graveyard');
  });

  it('CR 608.2b: a graveyard target removed by an unrelated effect before resolution is rejected (not just the self-sacrifice case)', () => {
    const priestText =
      '{2}, {T}, Sacrifice Priest of Fell Rites: Return target creature card from your graveyard to the battlefield.';
    const priest = cardDef('Priest of Fell Rites', 'Creature', priestText);
    const target = cardDef('r-recheck-target', 'Creature');
    let state = initGame([{ def: priest, isCommander: false }, { def: target, isCommander: false }], 1);
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'graveyard');

    const prompt = activationTargetPromptsForSource(state, 'c1', 0)[0];
    const plan = activationPlanForSource(state, 'c1', 0);
    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
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

    // An unrelated intervening effect exiles the stored target before resolution.
    state = move(state, 'c2', 'exile');

    const resolved = applyCommand(state, { type: 'resolveStackTop' });
    // The target left its expected zone (graveyard); resolution must not move it to battlefield.
    expect(resolved.state.cards.c2.zone).toBe('exile');
  });

  it('rejects every modifier/scope-boundary variant (exact-phrase gate)', () => {
    const exact = compile('Return target creature card from your graveyard to the battlefield.');
    expect(exact.decision).toBe('guided');

    expect(
      compile(
        'Return target creature card from your graveyard to the battlefield under your control.',
      ).decision,
    ).not.toBe('guided');
    expect(compile("Return target creature card from an opponent's graveyard to the battlefield.").decision).toBe(
      'manual',
    );
    expect(
      compile(
        'Whenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
      ).decision,
    ).toBe('manual');
  });

  it('non-regression: ordinary return-to-hand (bounce) is unaffected by the graveyard leaf', () => {
    const bounce = compile("Return target creature to its owner's hand.");
    expect(bounce.decision).toBe('guided');
    expect(
      buildGuidedCommands(
        bounce.prompts[0],
        { kind: 'target', cardIds: ['target-1'] },
        { sourceId: 'source-1', def: cardDef('r-bounce-source', 'Instant') },
      ),
    ).toEqual([{ type: 'moveCard', cardId: 'target-1', to: 'hand', position: 'bottom' }]);

    const linkedExileHand = compile("Exile target creature, then return that card to its owner's hand.");
    expect(linkedExileHand.decision).toBe('manual');
  });
});
