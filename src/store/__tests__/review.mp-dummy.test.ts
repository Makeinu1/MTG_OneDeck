// Reviewer-owned pins for engine-spec §34.44 (MP-DUMMY / MP-SETUP substrate).
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
// (J0起草 2026-07-15 → 判定者がCR照合の上で再オーナー化 2026-07-16。)
// CR grounding: 110.2, 111.1, 400.1, 400.3, 400.7, 704.5d.
import { beforeEach, describe, expect, it } from 'vitest';

import { applyCommand, eligibleTargets, performStateBasedActions } from '../../engine/commands';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { initGame } from '../../engine/init';
import { detectTriggerCandidates } from '../../engine/triggers';
import {
  compileOpponentSetupCommands,
  emptyScenarioPermanent,
  opponentSetupDraftFromState,
} from '../../engine/scenario';
import { DEFAULT_OPPONENT_ID, playerIdForLifeLabel, requirePlayer } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

describe('MP-DUMMY / setup command substrate', () => {
  beforeEach(resetStore);

  it('creates a typed synthetic non-token permanent that normal target filters can see', () => {
    let state = initGame(makeDeck(6), 1);
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'scenario-1',
      defId: 'scenario-def-1',
      playerId: DEFAULT_OPPONENT_ID,
      name: '訓練用ゴーレム',
      typeLine: 'Artifact Creature',
      power: '1',
      toughness: '1',
      tapped: false,
      counters: { charge: 2 },
      keywords: ['flying'],
      isToken: false,
    }).state;

    const card = state.cards['scenario-1'];
    const def = state.defs['scenario-def-1'];
    expect(card).toMatchObject({
      ownerId: DEFAULT_OPPONENT_ID,
      controllerId: DEFAULT_OPPONENT_ID,
      isScenarioDummy: true,
      isToken: false,
      zone: 'battlefield',
    });
    expect(def.faces[0]).not.toHaveProperty('oracleText');
    expect(def.faces[0]).not.toHaveProperty('imageUrl');
    expect(eligibleTargets(state, { types: ['creature'], controller: 'opponent' }))
      .toContain(card.id);
    expect(eligibleTargets(state, { types: ['artifact'], controller: 'opponent' }))
      .toContain(card.id);
  });

  it('routes a non-token dummy to its owner graveyard while a token dummy ceases to exist', () => {
    let state = initGame(makeDeck(6), 1);
    for (const [cardId, isToken] of [['scenario-1', false], ['scenario-2', true]] as const) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: `${cardId}-def`,
        playerId: DEFAULT_OPPONENT_ID,
        name: cardId,
        typeLine: 'Creature',
        power: '1',
        toughness: '1',
        tapped: false,
        counters: {},
        keywords: [],
        isToken,
      }).state;
    }
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'scenario-1', to: 'graveyard', position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'scenario-2', to: 'graveyard', position: 'bottom',
    }).state;

    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toContain('scenario-1');
    expect(state.cards['scenario-1']).toBeDefined();
    expect(state.cards['scenario-2']).toBeUndefined();
  });

  it('builds a detached draft and applies the whole setup as one undo entry', () => {
    store().newGame(makeDeck(8), 3);
    const canonicalBefore = store().state!;
    const serializedBefore = JSON.stringify(canonicalBefore);
    const draft = opponentSetupDraftFromState(canonicalBefore, DEFAULT_OPPONENT_ID);
    draft.life = 27;
    draft.poison = 3;
    draft.permanents.push({
      ...emptyScenarioPermanent('draft-1'),
      name: '相手の熊',
      counters: { '+1/+1': 1 },
    });

    expect(JSON.stringify(store().state)).toBe(serializedBefore);
    store().applyOpponentSetup(draft);
    expect(store().state?.players[DEFAULT_OPPONENT_ID]).toMatchObject({ life: 27, poison: 3 });
    expect(store().state?.zones.battlefield.some((id) => store().state?.cards[id]?.isScenarioDummy))
      .toBe(true);

    store().undo();
    expect(store().state).toEqual(canonicalBefore);
  });

  it('applies every edited opponent draft atomically and one undo restores all players', () => {
    store().newGame(makeDeck(8), 31);
    store().addOpponent('Bob');
    const beforeSetup = store().state!;
    const bobId = playerIdForLifeLabel('Bob');
    const first = opponentSetupDraftFromState(beforeSetup, DEFAULT_OPPONENT_ID);
    const second = opponentSetupDraftFromState(beforeSetup, bobId);
    first.life = 26;
    second.life = 19;
    second.poison = 4;

    expect(store().applyOpponentSetups([second, first])).toBe(true);
    expect(requirePlayer(store().state!, DEFAULT_OPPONENT_ID).life).toBe(26);
    expect(requirePlayer(store().state!, bobId)).toMatchObject({ life: 19, poison: 4 });

    store().undo();
    expect(store().state).toEqual(beforeSetup);
  });

  it('rejects a stale setup draft without overwriting canonical changes', () => {
    const opened = initGame(makeDeck(8), 32);
    const draft = opponentSetupDraftFromState(opened, DEFAULT_OPPONENT_ID);
    draft.life = 12;
    const changed = applyCommand(opened, {
      type: 'adjustLife', playerId: DEFAULT_OPPONENT_ID, delta: -3,
    }).state;

    expect(() => compileOpponentSetupCommands(changed, draft)).toThrow(/開き直して再編集/);
    expect(requirePlayer(changed, DEFAULT_OPPONENT_ID).life).toBe(37);
  });

  it('does not reuse a synthetic definition id after its token object ceased to exist', () => {
    let state = initGame(makeDeck(8), 33);
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'scenario-1',
      defId: 'scenario-def-1',
      playerId: DEFAULT_OPPONENT_ID,
      name: '消えるトークン',
      typeLine: 'Creature',
      power: '1',
      toughness: '1',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: true,
    }).state;
    state = applyCommand(state, {
      type: 'moveCard', cardId: 'scenario-1', to: 'graveyard', position: 'bottom',
    }).state;
    const draft = opponentSetupDraftFromState(state, DEFAULT_OPPONENT_ID);
    draft.permanents.push(emptyScenarioPermanent('replacement'));

    expect(compileOpponentSetupCommands(state, draft)).toContainEqual(
      expect.objectContaining({ type: 'createScenarioDummy', cardId: 'scenario-2', defId: 'scenario-def-2' }),
    );
  });

  it('cannot exile another player scenario dummy through a forged sourceCardId', () => {
    let state = initGame(makeDeck(8), 34);
    state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Bob', delta: 0 }).state;
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'opponent-a-dummy',
      defId: 'opponent-a-dummy-def',
      playerId: DEFAULT_OPPONENT_ID,
      name: '相手Aのダミー',
      typeLine: 'Artifact',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    const bobId = playerIdForLifeLabel('Bob');
    const draft = opponentSetupDraftFromState(state, bobId);
    draft.permanents.push({
      ...emptyScenarioPermanent('forged'),
      sourceCardId: 'opponent-a-dummy',
      name: '偽装編集',
    });

    const commands = compileOpponentSetupCommands(state, draft);
    expect(commands).not.toContainEqual(expect.objectContaining({
      type: 'moveCard', cardId: 'opponent-a-dummy', to: 'exile',
    }));
    expect(commands).toContainEqual(expect.objectContaining({
      type: 'createScenarioDummy', playerId: bobId,
    }));
  });

  it('reconciles only scenario dummies and leaves ordinary/control-changed cards untouched', () => {
    let state = initGame(makeDeck(8), 4);
    const ordinaryId = state.zones.library[0];
    state = applyCommand(state, {
      type: 'moveCard', cardId: ordinaryId, to: 'battlefield', position: 'bottom',
    }).state;
    state = {
      ...state,
      cards: {
        ...state.cards,
        [ordinaryId]: { ...state.cards[ordinaryId], controllerId: DEFAULT_OPPONENT_ID },
      },
    };
    const draft = opponentSetupDraftFromState(state, DEFAULT_OPPONENT_ID);
    const commands = compileOpponentSetupCommands(state, draft);
    for (const command of commands) state = applyCommand(state, command).state;

    expect(state.cards[ordinaryId]).toMatchObject({
      ownerId: 'P1', controllerId: DEFAULT_OPPONENT_ID, zone: 'battlefield',
    });
  });

  it('reopens from applied state and compiles typed edits without mutating the source state', () => {
    let state = initGame(makeDeck(8), 5);
    let draft = opponentSetupDraftFromState(state, DEFAULT_OPPONENT_ID);
    draft.permanents.push(emptyScenarioPermanent('draft-1'));
    for (const command of compileOpponentSetupCommands(state, draft)) {
      state = applyCommand(state, command).state;
    }
    const applied = state;
    draft = opponentSetupDraftFromState(applied, DEFAULT_OPPONENT_ID);
    draft.permanents[0].tapped = true;
    draft.permanents[0].keywords = ['deathtouch'];
    draft.permanents[0].counters = { loyalty: 4 };
    const commands = compileOpponentSetupCommands(applied, draft);

    expect(applied.cards[draft.permanents[0].sourceCardId!].tapped).toBe(false);
    for (const command of commands) state = applyCommand(state, command).state;
    const card = state.cards[draft.permanents[0].sourceCardId!];
    expect(card).toMatchObject({ tapped: true, counters: { loyalty: 4 } });
    expect(card.manualKeywords).toContain('deathtouch');
  });

  it('moves the same object to the new controller projection after a control change', () => {
    let state = initGame(makeDeck(6), 6);
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'scenario-control',
      defId: 'scenario-control-def',
      playerId: DEFAULT_OPPONENT_ID,
      name: '支配変更対象',
      typeLine: 'Artifact',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    const objectCounter = state.cards['scenario-control'].zoneChangeCounter;
    state = applyCommand(state, {
      type: 'setController', cardId: 'scenario-control', controllerId: 'P1',
    }).state;
    expect(state.cards['scenario-control']).toMatchObject({
      ownerId: DEFAULT_OPPONENT_ID,
      controllerId: 'P1',
      zoneChangeCounter: objectCounter,
    });
  });

  it('lets opponent dummies block, deal damage, and die through normal combat/SBA paths', () => {
    let state = initGame(makeDeck(6), 7);
    for (const spec of [
      { cardId: 'scenario-attacker', playerId: 'P1', power: '2', toughness: '2' },
      { cardId: 'scenario-blocker', playerId: DEFAULT_OPPONENT_ID, power: '1', toughness: '1' },
    ]) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId: spec.cardId,
        defId: spec.cardId + '-def',
        playerId: spec.playerId,
        name: spec.cardId,
        typeLine: 'Creature',
        power: spec.power,
        toughness: spec.toughness,
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    state = applyCommand(state, {
      type: 'enterCombat', attackingPlayerId: 'P1', defendingPlayerId: DEFAULT_OPPONENT_ID,
    }).state;
    state = applyCommand(state, {
      type: 'declareAttackers',
      attackers: [{ cardId: 'scenario-attacker', target: { type: 'player', playerId: DEFAULT_OPPONENT_ID } }],
    }).state;
    state = applyCommand(state, {
      type: 'declareBlockers',
      blockers: [{ cardId: 'scenario-blocker', attackerId: 'scenario-attacker' }],
    }).state;
    state = applyCommand(state, { type: 'resolveCombatDamage' }).state;

    expect(state.cards['scenario-attacker']?.damageMarked).toBe(1);
    expect(state.cards['scenario-blocker']?.zone).toBe('graveyard');
    expect(state.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toContain('scenario-blocker');
  });

  it('judge regression pin (Tier-1 MEDIUM fix): detectTriggerCandidates sees a death routed to an OPPONENT graveyard, not just the local flat mirror (CR 400.3)', () => {
    // Broken instrument shape this pins against: `detectTriggerCandidates` read only the
    // flat `next.zones.graveyard` (the local-player mirror). Under §34.43 owner routing an
    // opponent-owned permanent dies into `zonesByPlayer[owner].graveyard`, so opponent
    // deaths were invisible to the golden-replay measurement instrument (live gameplay
    // uses the event-log path and was unaffected). 壊れた計器の数値を優先度に使わない。
    const observer = makeDef({
      scryfallId: 'r-mp-death-observer',
      typeLine: 'Creature',
      faces: [{
        name: 'r-mp-death-observer',
        typeLine: 'Creature',
        power: '1',
        toughness: '1',
        oracleText: 'Whenever another creature dies, you gain 1 life.',
      }],
    });
    let state = initGame([{ def: observer, isCommander: false }, ...makeDeck(6)], 7);
    const observerId = Object.values(state.cards).find((c) => c.defId === observer.scryfallId)!.id;
    state = applyCommand(state, {
      type: 'moveCard', cardId: observerId, to: 'battlefield', position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'scenario-victim',
      defId: 'scenario-victim-def',
      playerId: DEFAULT_OPPONENT_ID,
      name: '犠牲ダミー',
      typeLine: 'Creature',
      power: '1',
      toughness: '1',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;

    const prev = state;
    const lethal = {
      ...state,
      cards: {
        ...state.cards,
        'scenario-victim': { ...state.cards['scenario-victim'], damageMarked: 5 },
      },
    };
    const next = performStateBasedActions(lethal).state;

    // CR 400.3: the death routes to the owner's graveyard and must NOT appear in the
    // local flat mirror.
    expect(next.zonesByPlayer[DEFAULT_OPPONENT_ID].graveyard).toContain('scenario-victim');
    expect(next.zones.graveyard).not.toContain('scenario-victim');

    // The pin: the instrument still sees the death (death-other candidate on the observer).
    const candidates = detectTriggerCandidates(prev, next);
    expect(candidates).not.toBeNull();
    expect(
      candidates!.some(
        (c) => c.sourceId === observerId && c.triggerId === 'trigger.death-other',
      ),
    ).toBe(true);
  });
});
