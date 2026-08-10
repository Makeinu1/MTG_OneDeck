// Reviewer-owned pins for 3-4 player recipient resolution and APNAP ordering (I37-I39).
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
// (J0起草 2026-07-15 → 判定者がCR 101.4照合+実行トレースの上で再オーナー化 2026-07-16。)
// CR grounding: 101.4, 102.1, 103.1, 121.2c, 800.1.
import { describe, expect, it } from 'vitest';
import { activationPlanForSource, applyCommand, eligibleTargets } from '../../engine/commands';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { compileAbilityIR } from '../../engine/grammar/compile';
import { parseAbilityIR } from '../../engine/grammar/ir';
import { splitAbilityLines } from '../../engine/grammar';
import { initGame } from '../../engine/init';
import { apnapPlayerOrder } from '../../engine/priority';
import { collectPendingTriggerUpdate } from '../../engine/triggers';
import { playerIdForLifeLabel, requirePlayer } from '../../engine/types';

function fourPlayerState() {
  let state = initGame(makeDeck(8), 1);
  state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Amy', delta: 0 }).state;
  state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Bob', delta: 0 }).state;
  return state;
}

describe('MP four-player gate', () => {
  it('orders APNAP from any active player over the canonical turnOrder', () => {
    const state = fourPlayerState();
    const amy = playerIdForLifeLabel('Amy');
    const bob = playerIdForLifeLabel('Bob');
    expect(state.turnOrder).toEqual(['P1', 'OPPONENT_A', amy, bob]);
    expect(apnapPlayerOrder(amy, state.turnOrder)).toEqual([amy, bob, 'P1', 'OPPONENT_A']);
  });

  it('compiles each opponent relative to the ability controller and affects all other players', () => {
    let state = fourPlayerState();
    const amy = playerIdForLifeLabel('Amy');
    const bob = playerIdForLifeLabel('Bob');
    const def = makeDef({
      scryfallId: 'mp-each-opponent',
      typeLine: 'Sorcery',
      faces: [{
        name: 'mp-each-opponent',
        typeLine: 'Sorcery',
        oracleText: 'Each opponent loses 2 life.',
      }],
    });
    const ir = parseAbilityIR('Each opponent loses 2 life.', 'Sorcery');
    const compiled = compileAbilityIR(ir, {
      sourceId: 'source',
      controllerId: amy,
      def,
    });
    expect(compiled.decision).toBe('auto');
    expect(compiled.commands).toEqual([{
      type: 'applyPlayerEffect',
      controllerId: amy,
      recipients: 'eachOpponent',
      effect: 'life',
      amount: -2,
    }]);
    for (const command of compiled.commands) state = applyCommand(state, command).state;

    expect(requirePlayer(state, amy).life).toBe(40);
    expect(requirePlayer(state, 'P1').life).toBe(38);
    expect(requirePlayer(state, 'OPPONENT_A').life).toBe(38);
    expect(requirePlayer(state, bob).life).toBe(38);
    const affected = state.eventLog
      .filter((event) => event.type === 'lifeChange')
      .slice(-3)
      .map((event) => event.playerId);
    expect(affected).toEqual(['P1', 'OPPONENT_A', bob]);
  });

  it('resolves you/opponent target filters from source controller, not fixed P1', () => {
    let state = fourPlayerState();
    const amy = playerIdForLifeLabel('Amy');
    const bob = playerIdForLifeLabel('Bob');
    for (const [cardId, playerId] of [
      ['p1-permanent', 'P1'],
      ['amy-permanent', amy],
      ['bob-permanent', bob],
    ] as const) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId,
        name: cardId,
        typeLine: 'Artifact',
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    expect(eligibleTargets(
      state,
      { types: ['artifact'], controller: 'you' },
      { sourceId: 'amy-permanent' },
    )).toEqual(['amy-permanent']);
    expect(eligibleTargets(
      state,
      { types: ['artifact'], controller: 'opponent' },
      { sourceId: 'amy-permanent' },
    )).toEqual(['p1-permanent', 'bob-permanent']);
  });

  it('records empty-library draw defeat for every affected opponent deterministically', () => {
    let state = fourPlayerState();
    state = applyCommand(state, {
      type: 'applyPlayerEffect',
      controllerId: 'P1',
      recipients: 'eachOpponent',
      effect: 'draw',
      amount: 1,
    }).state;
    expect(state.defeat['opponent:対戦相手A']?.reasons).toContain('emptyLibraryDraw');
    expect(state.defeat['opponent:Amy']?.reasons).toContain('emptyLibraryDraw');
    expect(state.defeat['opponent:Bob']?.reasons).toContain('emptyLibraryDraw');
    expect(state.defeat.P1?.reasons ?? []).not.toContain('emptyLibraryDraw');
  });

  it('keeps mana and generated tokens on the acting opponent instead of P1', () => {
    let state = fourPlayerState();
    const amy = playerIdForLifeLabel('Amy');
    state = applyCommand(state, { type: 'addMana', color: 'G', amount: 3, playerId: amy }).state;
    state = applyCommand(state, {
      type: 'payMana',
      payment: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      playerId: amy,
    }).state;
    state = applyCommand(state, {
      type: 'createToken',
      name: 'Opponent Beast',
      typeLine: 'Token Creature — Beast',
      power: '3',
      toughness: '3',
      quantity: 1,
      createdBy: amy,
    }).state;

    expect(requirePlayer(state, amy).manaPool.G).toBe(2);
    expect(state.manaPool.G).toBe(0);
    const token = Object.values(state.cards).find((card) => card.defId.startsWith('token:'));
    expect(token).toMatchObject({ ownerId: amy, controllerId: amy, isToken: true });
  });

  it('compiles literal mana and predefined tokens for the ability controller', () => {
    const amy = playerIdForLifeLabel('Amy');
    const manaDef = makeDef({
      scryfallId: 'mp-controller-mana',
      typeLine: 'Land',
      faces: [{ name: 'mp-controller-mana', typeLine: 'Land', oracleText: 'Add {G}{G}.' }],
    });
    const mana = compileAbilityIR(parseAbilityIR('Add {G}{G}.', 'Land'), {
      sourceId: 'source',
      controllerId: amy,
      def: manaDef,
    });
    expect(mana.commands).toContainEqual({
      type: 'addMana',
      color: 'G',
      amount: 2,
      playerId: amy,
    });

    const tokenDef = makeDef({
      scryfallId: 'mp-controller-token',
      typeLine: 'Sorcery',
      faces: [{
        name: 'mp-controller-token',
        typeLine: 'Sorcery',
        oracleText: 'Create a Treasure token.',
      }],
    });
    const token = compileAbilityIR(parseAbilityIR('Create a Treasure token.', 'Sorcery'), {
      sourceId: 'source',
      controllerId: amy,
      def: tokenDef,
    });
    expect(token.commands).toContainEqual(expect.objectContaining({
      type: 'createToken',
      tokenKind: 'treasure',
      createdBy: amy,
    }));
  });

  it('advances turnOrder deterministically when explicitly requested', () => {
    let state = fourPlayerState();
    for (const [cardId, playerId] of [
      ['turn-p1', 'P1'],
      ['turn-opponent', 'OPPONENT_A'],
      ['opponent-draw', 'OPPONENT_A'],
    ] as const) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId,
        name: cardId,
        typeLine: cardId === 'opponent-draw' ? 'Artifact' : 'Creature',
        power: cardId === 'opponent-draw' ? undefined : '1',
        toughness: cardId === 'opponent-draw' ? undefined : '1',
        tapped: cardId !== 'opponent-draw',
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: 'opponent-draw',
      to: 'library',
      position: 'top',
    }).state;
    state = applyCommand(state, { type: 'addMana', color: 'U', amount: 1 }).state;
    state = applyCommand(state, {
      type: 'addMana',
      color: 'G',
      amount: 1,
      playerId: 'OPPONENT_A',
    }).state;

    state = applyCommand(state, { type: 'nextTurn', advanceTurnOrder: true }).state;
    expect(state.activePlayerId).toBe('OPPONENT_A');
    expect(state.manaPool.U).toBe(0);
    expect(requirePlayer(state, 'OPPONENT_A').manaPool.G).toBe(1);
    expect(state.cards['turn-p1'].tapped).toBe(true);
    expect(state.cards['turn-opponent'].tapped).toBe(false);

    state = applyCommand(state, { type: 'nextPhase' }).state;
    state = applyCommand(state, { type: 'nextPhase' }).state;
    expect(state.cards['opponent-draw'].zone).toBe('hand');
    expect(state.zonesByPlayer.OPPONENT_A?.hand).toEqual(['opponent-draw']);
    expect(requirePlayer(state, 'OPPONENT_A').drawnThisTurn).toBe(1);
  });

  it('rejects actor/card controller mismatch on both cast command paths', () => {
    let state = fourPlayerState();
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'opponent-spell',
      defId: 'opponent-spell-def',
      playerId: 'OPPONENT_A',
      name: '相手の呪文素材',
      typeLine: 'Artifact',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    const payment = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } as const;

    expect(() => applyCommand(state, {
      type: 'castSpell', cardId: 'opponent-spell', payment, forced: true, playerId: 'P1',
    })).toThrow(/コントロールしていません/);
    expect(() => applyCommand(state, {
      type: 'castToStack', cardId: 'opponent-spell', payment, forced: true, playerId: 'P1',
    })).toThrow(/コントロールしていません/);
  });

  it('rejects a combat target whose player id is not in the participant roster', () => {
    let state = fourPlayerState();
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'valid-attacker',
      defId: 'valid-attacker-def',
      playerId: 'P1',
      name: '攻撃役',
      typeLine: 'Creature',
      power: '2',
      toughness: '2',
      tapped: false,
      counters: {},
      keywords: ['haste'],
      isToken: false,
    }).state;
    state = applyCommand(state, {
      type: 'enterCombat', attackingPlayerId: 'P1', defendingPlayerId: 'OPPONENT_A',
    }).state;
    expect(() => applyCommand(state, {
      type: 'declareAttackers',
      attackers: [{ cardId: 'valid-attacker', target: { type: 'player', playerId: 'GHOST' } }],
    })).toThrow(/プレイヤーが存在しません/);
  });

  it('observes opponent draw, ETB, and death relative to the watcher controller', () => {
    const watcherDef = makeDef({
      scryfallId: 'mp-opponent-observer',
      typeLine: 'Enchantment',
      faces: [{
        name: '相手観測器',
        typeLine: 'Enchantment',
        oracleText: [
          'Whenever an opponent draws a card, you gain 1 life.',
          "Whenever a creature enters the battlefield under an opponent's control, you gain 1 life.",
          'Whenever a creature an opponent controls dies, you gain 1 life.',
        ].join('\n'),
      }],
    });
    let state = initGame([{ def: watcherDef, isCommander: false }, ...makeDeck(8)], 44);
    expect(splitAbilityLines(watcherDef).map((line) => line.shape)).toEqual([
      'triggered', 'triggered', 'triggered',
    ]);
    const watcherId = Object.values(state.cards).find((card) => card.defId === watcherDef.scryfallId)?.id;
    expect(watcherId).toBeDefined();
    state = applyCommand(state, {
      type: 'moveCard', cardId: watcherId!, to: 'battlefield', position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'opponent-library-card',
      defId: 'opponent-library-card-def',
      playerId: 'OPPONENT_A',
      name: '相手のドロー用カード',
      typeLine: 'Artifact',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'opponent-library-card', to: 'library', position: 'top',
    }).state;

    let before = state;
    state = applyCommand(state, { type: 'draw', count: 1, playerId: 'OPPONENT_A' }).state;
    expect(collectPendingTriggerUpdate(before, state).pendingTriggers).toContainEqual(
      expect.objectContaining({ sourceId: watcherId, controllerId: 'P1', triggerId: 'trigger.draw' }),
    );

    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'opponent-observed-creature',
      defId: 'opponent-observed-creature-def',
      playerId: 'OPPONENT_A',
      name: '観測される相手クリーチャー',
      typeLine: 'Creature',
      power: '1',
      toughness: '1',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'opponent-observed-creature', to: 'graveyard', position: 'bottom',
    }).state;
    before = state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'opponent-observed-creature', to: 'battlefield', position: 'bottom',
    }).state;
    expect(collectPendingTriggerUpdate(before, state).pendingTriggers).toContainEqual(
      expect.objectContaining({ sourceId: watcherId, controllerId: 'P1', triggerId: 'trigger.etb-other' }),
    );

    before = state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'opponent-observed-creature', to: 'graveyard', position: 'bottom',
    }).state;
    expect(collectPendingTriggerUpdate(before, state).pendingTriggers).toContainEqual(
      expect.objectContaining({ sourceId: watcherId, controllerId: 'P1', triggerId: 'trigger.death-other' }),
    );
  });

  it('compiles an opponent activation discard-your-hand cost from that opponent private zone', () => {
    const sourceDef = makeDef({
      scryfallId: 'mp-opponent-discard-hand',
      typeLine: 'Artifact',
      faces: [{
        name: '相手の手札破棄装置',
        typeLine: 'Artifact',
        oracleText: 'Discard your hand: Draw a card.',
      }],
    });
    let state = initGame([{ def: sourceDef, isCommander: false }, ...makeDeck(8)], 45);
    const sourceId = Object.values(state.cards).find((card) => card.defId === sourceDef.scryfallId)?.id;
    expect(sourceId).toBeDefined();
    state = applyCommand(state, {
      type: 'moveCard', cardId: sourceId!, to: 'battlefield', position: 'bottom',
    }).state;
    state = {
      ...state,
      cards: {
        ...state.cards,
        [sourceId!]: { ...state.cards[sourceId!], controllerId: 'OPPONENT_A' },
      },
    };
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'opponent-discard-cost-card',
      defId: 'opponent-discard-cost-card-def',
      playerId: 'OPPONENT_A',
      name: '捨てる相手カード',
      typeLine: 'Artifact',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'opponent-discard-cost-card', to: 'hand', position: 'bottom',
    }).state;

    expect(activationPlanForSource(state, sourceId!, 0)?.commands).toContainEqual({
      type: 'discard',
      cardIds: ['opponent-discard-cost-card'],
      playerId: 'OPPONENT_A',
    });
  });
});
// verifies: ENG-MP-003
