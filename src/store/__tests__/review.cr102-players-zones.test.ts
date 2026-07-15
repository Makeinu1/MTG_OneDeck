// Reviewer-owned adversarial tests for cr-102-players: S-ZONES player-specific
// library/hand/graveyard storage (`zonesByPlayer`, engine-spec §34.17 design-lock,
// implementation slice 2026-07-05). 実装エージェント(Codex)は本ファイルを変更しない
// こと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 400.1/400.3: library/hand/graveyard は各 player 私有。private zone への
//   移動先は object の owner の対応ゾーン。
// - CR 401.1: library の順序(top card)は意味を持つ=backfill は順序保存必須。
// - CR 108.3/111.2: owner の定義。
// 契約の要石(§34.17 + §34.43 J0更新): 保存形=zonesByPlayer 単一マップ、flat zones は
// P1 mirror。§34.43 で極性を反転し、zonesByPlayer が正・flat はそこから導出する。
// legacy snapshot の zonesByPlayer 不在時だけ lossless P1 preservation-first backfill。
import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { applyCommand, performStateBasedActions } from '../../engine/commands';
import { makeDef } from '../../engine/__tests__/helpers';
import { initGame } from '../../engine/init';
import { PLAYER_IDS, PRIVATE_ZONE_IDS, type GameState } from '../../engine/types';
import { makeDeck } from '../../engine/__tests__/helpers';
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

function expectOwnerPresence(state: GameState): void {
  for (const playerId of PLAYER_IDS) {
    expect(state.zonesByPlayer[playerId]).toBeDefined();
    for (const zone of PRIVATE_ZONE_IDS) {
      expect(Array.isArray(state.zonesByPlayer[playerId][zone])).toBe(true);
    }
  }
}

function expectP1Mirror(state: GameState): void {
  for (const zone of PRIVATE_ZONE_IDS) {
    expect(state.zonesByPlayer.P1[zone]).toEqual(state.zones[zone]);
  }
}

describe('cr-102-players: zonesByPlayer (I17-I21)', () => {
  beforeEach(() => resetStore());

  it('I17: every PlayerId key always has a defined {library,hand,graveyard} after initGame', () => {
    const state = initGame(makeDeck(6), 1);
    expectOwnerPresence(state);
  });

  it('I19: P1 and OPPONENT_A private-zone card-id sets never overlap after normal play', () => {
    let state = initGame(makeDeck(8), 1);
    state = applyCommand(state, { type: 'draw', count: 2 }).state;
    state = applyCommand(state, { type: 'mill', count: 1 }).state;
    for (const zone of PRIVATE_ZONE_IDS) {
      const p1 = new Set(state.zonesByPlayer.P1[zone]);
      for (const cardId of state.zonesByPlayer.OPPONENT_A[zone]) {
        expect(p1.has(cardId)).toBe(false);
      }
    }
  });

  it('I20: P1 mirror stays consistent with flat zones after ordinary command application', () => {
    let state = initGame(makeDeck(8), 1);
    state = applyCommand(state, { type: 'draw', count: 3 }).state;
    state = applyCommand(state, { type: 'mill', count: 1 }).state;
    expectP1Mirror(state);
  });

  it('I20/HIGH-1 fix: performStateBasedActions (the standalone engine entry point, not just applyCommand) re-syncs zonesByPlayer.P1 after an SBA-driven zone move', () => {
    const creature = makeDef({
      scryfallId: 'r-cr102-sba-death',
      typeLine: 'Creature',
      faces: [{ name: 'r-cr102-sba-death', typeLine: 'Creature', power: '2', toughness: '2' }],
    });
    let state = initGame([{ def: creature, isCommander: false }, ...makeDeck(8)], 1);
    const creatureId = Object.values(state.cards).find((c) => c.defId === creature.scryfallId)!.id;
    state = applyCommand(state, { type: 'moveCard', cardId: creatureId, to: 'battlefield', position: 'bottom' })
      .state;

    // Simulate a caller that drove marked damage to lethal WITHOUT going through the
    // already-synced applyCommand path (e.g. a future direct-draft mutation), then
    // calls the standalone exported `performStateBasedActions` directly.
    const lethalDraftState: GameState = {
      ...state,
      cards: { ...state.cards, [creatureId]: { ...state.cards[creatureId], damageMarked: 5 } },
    };

    const result = performStateBasedActions(lethalDraftState);

    // CR 704.5g: lethal damage destroys the creature -> flat graveyard gains it.
    expect(result.state.zones.graveyard).toContain(creatureId);
    expect(result.state.zones.battlefield).not.toContain(creatureId);
    // The fix under test: zonesByPlayer.P1 must reflect that same zone move, not stay stale.
    expect(result.state.zonesByPlayer.P1.graveyard).toContain(creatureId);
    expectP1Mirror(result.state);
  });

  it('restoreGame backfills a legacy snapshot (no zonesByPlayer field) losslessly, preserving order', () => {
    const deck = makeDeck(9);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'draw', count: 3 }).state;
    state = applyCommand(state, { type: 'mill', count: 2 }).state;

    const legacyState: Partial<GameState> = { ...state };
    delete legacyState.zonesByPlayer;
    const legacyLibrary = state.zones.library.slice();
    const legacyHand = state.zones.hand.slice();
    const legacyGraveyard = state.zones.graveyard.slice();

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    const restored = store().state!;
    expect(restored.zonesByPlayer.P1.library).toEqual(legacyLibrary);
    expect(restored.zonesByPlayer.P1.hand).toEqual(legacyHand);
    expect(restored.zonesByPlayer.P1.graveyard).toEqual(legacyGraveyard);
    expect(restored.zonesByPlayer.OPPONENT_A).toEqual({ library: [], hand: [], graveyard: [] });
    expectOwnerPresence(restored);
  });

  it('MEDIUM-2 fix: malformed zonesByPlayer.OPPONENT_A values (null/undefined/non-array) fall back to empty arrays without crashing', () => {
    // Note: P1 is always overwritten by the flat-zone derivation (fork decision #1),
    // so a malformed P1 value would be silently replaced by real flat data regardless
    // of the guard. OPPONENT_A has no flat mirror to overwrite it, so it is the field
    // that actually exercises the malformed-value fallback guard (isStringArray).
    const deck = makeDeck(4);
    const base = initGame(deck, 3);
    const malformedState = {
      ...base,
      zonesByPlayer: {
        P1: base.zonesByPlayer.P1,
        OPPONENT_A: { library: null, hand: undefined, graveyard: 'not-an-array' },
      },
    } as unknown as GameState;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: malformedState,
      deck,
      autoAdvanceToMain: false,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    const restored = store().state!;
    expect(restored.zonesByPlayer.OPPONENT_A.library).toEqual([]);
    expect(restored.zonesByPlayer.OPPONENT_A.hand).toEqual([]);
    expect(restored.zonesByPlayer.OPPONENT_A.graveyard).toEqual([]);
    expectOwnerPresence(restored);
  });

  it('HIGH-2 boundary repayment (§34.43): a mixed-owner card routes to its owner graveyard, never the P1 flat mirror', () => {
    // CR 400.3: private-zone destination is the object's owner's corresponding zone.
    // §34.17 intentionally deferred this; §34.43 repays that boundary and reverses the
    // old assertion rather than silently keeping the known-wrong P1 placement green.
    const opponentCard = makeDef({
      scryfallId: 'r-cr102-opponent-owned',
      typeLine: 'Creature',
      faces: [{ name: 'r-cr102-opponent-owned', typeLine: 'Creature' }],
    });
    let state = initGame([{ def: opponentCard, isCommander: false }, ...makeDeck(6)], 1);
    const cardId = Object.values(state.cards).find((c) => c.defId === opponentCard.scryfallId)!.id;
    state = {
      ...state,
      cards: { ...state.cards, [cardId]: { ...state.cards[cardId], ownerId: 'OPPONENT_A', controllerId: 'OPPONENT_A' } },
    };
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'graveyard', position: 'bottom' }).state;

    expect(state.zonesByPlayer.P1.graveyard).not.toContain(cardId);
    expect(state.zones.graveyard).not.toContain(cardId);
    expect(state.zonesByPlayer.OPPONENT_A.graveyard).toContain(cardId);
  });
});
