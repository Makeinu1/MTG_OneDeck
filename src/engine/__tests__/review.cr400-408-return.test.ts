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

// batch6 (2026-07-14): mana-value-ceiling sub-leaf — generalizes the exact-match
// graveyard reanimation to "Return target <creature|permanent> card with mana value N
// or less from your graveyard to the battlefield." 実装エージェントは本ファイルを変更しない。
//
// CR grounding:
// - CR 109.2a: 「creature/permanent card」+「from your graveyard」= そのゾーン内のカード集合。
// - CR 202.3 / 202.3b: mana value は整数。「with mana value N or less」= manaValue<=N の絞り込み。
// - CR 701.14a: return = そのカードを指定ゾーンへ移動。601/608.2b の対象規律は exact-match と同じ。
// 契約境界(auto 詐称なし): 固定整数 N の「creature card」/「permanent card」単一 target のみ guided。
// 追加フィルタは既存 TargetFilter への additive な maxManaValue?: number のみ(新 GameCommand/state なし)。
// DEFER(manual 維持): up to one/all(可変・mass)・可変 X・自己参照 this card・opponent's graveyard・
// 「you may」optionality wrapper(Sun Titan)。tapped/under-your-control 等の追加修飾も範囲外。
describe('cr-400-408 reanimation MV-ceiling sub-leaf (batch6)', () => {
  function graveCreature(id: string, cmc: number) {
    return makeDef({ scryfallId: id, name: id, typeLine: 'Creature', cmc, faces: [{ name: id, typeLine: 'Creature' }] });
  }

  it('creature-card mana-value ceiling compiles to guided with an additive maxManaValue filter', () => {
    const c = compile('Return target creature card with mana value 2 or less from your graveyard to the battlefield.');
    expect(c.decision).toBe('guided');
    expect(c.prompts[0]).toMatchObject({
      atom: 'effect.return',
      kind: 'target',
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you', maxManaValue: 2 },
    });
  });

  it('permanent-card mana-value ceiling compiles to guided with the permanent pseudo-type', () => {
    const c = compile('Return target permanent card with mana value 3 or less from your graveyard to the battlefield.');
    expect(c.decision).toBe('guided');
    expect(c.prompts[0]).toMatchObject({
      atom: 'effect.return',
      kind: 'target',
      filter: { types: ['permanent'], zone: 'graveyard', owner: 'you', maxManaValue: 3 },
    });
  });

  it('eligibility honors the ceiling (MV=N eligible, MV=N+1 excluded) and resolves the chosen card to battlefield', () => {
    const text =
      'When this creature enters, return target creature card with mana value 2 or less from your graveyard to the battlefield.';
    const source = makeDef({
      scryfallId: 'r-extraction',
      name: 'r-extraction',
      typeLine: 'Creature',
      faces: [{ name: 'r-extraction', typeLine: 'Creature', oracleText: text }],
    });
    const cheap = graveCreature('r-cmc2', 2);
    const expensive = graveCreature('r-cmc3', 3);

    let state = initGame(
      [
        { def: source, isCommander: false },
        { def: cheap, isCommander: false },
        { def: expensive, isCommander: false },
      ],
      1,
    );
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'graveyard');
    state = move(state, 'c3', 'graveyard');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
    }).state;

    const plan = guidedPlanForStackTop(state);
    expect(plan?.prompts[0]).toMatchObject({
      atom: 'effect.return',
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you', maxManaValue: 2 },
    });
    // Only the MV<=2 graveyard creature is a legal target; the MV=3 one is excluded by the ceiling.
    expect(eligibleTargets(state, plan!.prompts[0].filter ?? {}, { sourceId: 'c1' })).toEqual(['c2']);

    const commands = buildGuidedCommands(
      plan!.prompts[0],
      { kind: 'target', cardIds: ['c2'] },
      { sourceId: 'c1', def: source, sourceObjectId: objectIdOf(state.cards.c1) },
    );
    expect(commands).toEqual([{ type: 'moveCard', cardId: 'c2', to: 'battlefield', position: 'bottom' }]);
    const resolved = applyCommands(state, [...commands, { type: 'resolveStackTop' }]);
    expect(resolved.state.cards.c2.zone).toBe('battlefield');
    expect(resolved.state.cards.c3.zone).toBe('graveyard');
  });

  it('defers every out-of-scope MV variant to manual (up-to/all/variable-X/self-ref/opponent/optional-may)', () => {
    expect(
      compile('Return up to one target creature card with mana value 3 or less from your graveyard to the battlefield.')
        .decision,
    ).toBe('manual');
    expect(
      compile('Return all creature cards with mana value 3 or less from your graveyard to the battlefield.').decision,
    ).toBe('manual');
    expect(
      compile('Return target creature card with mana value X or less from your graveyard to the battlefield.').decision,
    ).toBe('manual');
    expect(compile('Return this card from your graveyard to the battlefield.').decision).toBe('manual');
    expect(
      compile("Return target creature card with mana value 2 or less from an opponent's graveyard to the battlefield.")
        .decision,
    ).toBe('manual');
    // Sun Titan-style optionality wrapper stays out of scope (the existing full-line manual pin above still holds).
    expect(
      compile(
        'Whenever this creature enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
      ).decision,
    ).toBe('manual');
  });

  it('non-regression: the unfiltered exact-match creature return stays guided with no ceiling leaking in', () => {
    const c = compile('Return target creature card from your graveyard to the battlefield.');
    expect(c.decision).toBe('guided');
    expect(c.prompts[0]).toMatchObject({ filter: { types: ['creature'], zone: 'graveyard', owner: 'you' } });
    expect((c.prompts[0].filter as { maxManaValue?: number }).maxManaValue).toBeUndefined();
  });

  // CR 602.2b: an ACTIVATED-ability MV-ceiling reanimation must offer its target at activation
  // time (like the existing exact-match activated path — Priest of Fell Rites), not silently
  // commit with an empty target set and shift target choice to resolve. Guards the compile.ts /
  // commands.ts recognizer desync (Order of Whiteclay: "{1}{W}{W}, {Q}: Return target creature
  // card with mana value 3 or less from your graveyard to the battlefield.").
  it('activated-ability MV-ceiling reanimation offers its ceiling-filtered target at activation time', () => {
    const activatedReanim = makeDef({
      scryfallId: 'r-order-of-whiteclay',
      name: 'r-order-of-whiteclay',
      typeLine: 'Creature',
      faces: [
        {
          name: 'r-order-of-whiteclay',
          typeLine: 'Creature',
          oracleText:
            '{1}, {T}: Return target creature card with mana value 2 or less from your graveyard to the battlefield.',
        },
      ],
    });
    const cheap = graveCreature('r-cmc2', 2);
    const expensive = graveCreature('r-cmc3', 3);

    let state = initGame(
      [
        { def: activatedReanim, isCommander: false },
        { def: cheap, isCommander: false },
        { def: expensive, isCommander: false },
      ],
      1,
    );
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'graveyard');
    state = move(state, 'c3', 'graveyard');

    const prompts = activationTargetPromptsForSource(state, 'c1', 0);
    // A target prompt must exist at activation time (empty list = silent no-target commit bug).
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]).toMatchObject({
      atom: 'effect.return',
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you', maxManaValue: 2 },
    });
    // Ceiling enforced at activation selection: only the MV<=2 graveyard creature is eligible.
    expect(eligibleTargets(state, prompts[0].filter ?? {}, { sourceId: 'c1' })).toEqual(['c2']);
  });
});
