// Reviewer-owned adversarial tests for MP-STATE: N-player canonical player state
// (`players` / `turnOrder` / `localPlayerId`). engine-spec §34.42 design-lock.
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// これらの pin は Codex 発注**前**に判定者が spec-first で執筆した(実装者は自分の
// 受け入れ基準を書けない=CLAUDE.md 検証プロトコルの要石)。発注時点では red。
//
// CR grounding:
// - CR 102.1: active/nonactive player は一級参加者。
// - CR 103.1: turn order は順序付き関係であって2値トグルではない。
// - CR 103.4c: 統率者戦の開始 life = 40。
// - CR 400.1: library/hand/graveyard は player 私有・battlefield/stack/exile/command は共有。
// - CR 800.1: 3人以上=多人数。
//
// 契約の要石(§34.42 fork決定):
// - fork決定3: 極性を反転させない。レガシー scalar は draft 内の書き込み面のまま、
//   `players` は「観測境界の正準」としてチョークポイントで丸ごと再構築される。
//   ゆえに single-writer は構造的に保証される(I25 がその pin)。
// - fork決定4: 「3 scheme の統一」= 正準 identity と全単射の確立であって storage の
//   再キーではない。`opponentLife` は互換ビューとして残る(I26 がその pin)。
// - fork決定5: `commanderDamage` は本スライス範囲外(キーは相手*統率者*のラベルで
//   あり対戦相手ではない=`PlayerId` への全域写像が存在しない)。本ファイルは
//   `commanderDamage` を player 化した形で pin しない。
// - fork決定6: SNAPSHOT_VERSION を上げない。legacy snapshot は normalize で backfill。
import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { applyCommand, performStateBasedActions } from '../../engine/commands';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { initGame } from '../../engine/init';
import { DEFAULT_TURN_ORDER, orderPendingTriggersApnap } from '../../engine/priority';
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPPONENT_LIFE_LABEL,
  LOCAL_PLAYER_ID,
  playerIdForLifeLabel,
  requirePlayer,
  type GameState,
  type PendingTrigger,
} from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

/**
 * Minimal ready PendingTrigger for APNAP ordering (I27). Only the fields
 * `orderPendingTriggersApnap` reads are meaningful: pendingTriggerId,
 * controllerId, stackPlacementBucket, and the absence of a `schedule`
 * (which is what makes it ready).
 */
function makePendingTrigger(pendingTriggerId: string, controllerId: string): PendingTrigger {
  return {
    pendingTriggerId,
    eventId: `e-${pendingTriggerId}`,
    simultaneousGroupId: `g-${pendingTriggerId}`,
    triggerId: `tr-${pendingTriggerId}`,
    sourceId: `src-${pendingTriggerId}`,
    sourceObjectId: `src-${pendingTriggerId}:0`,
    controllerId,
    stackPlacementBucket: 'ordinary',
  } as unknown as PendingTrigger;
}

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

/** I24: player roster / turnOrder well-formedness (CR 102.1 / 103.1). */
function expectI24(state: GameState): void {
  const ids = Object.keys(state.players);

  // localPlayerId must resolve to a real player.
  expect(ids).toContain(state.localPlayerId);

  // Every entry is self-consistent and defined (Partial<Record<>> => must check).
  for (const id of ids) {
    const player = state.players[id];
    expect(player).toBeDefined();
    expect(player!.id).toBe(id);
  }

  // turnOrder has no duplicates.
  expect(new Set(state.turnOrder).size).toBe(state.turnOrder.length);

  // keys(players) === set(turnOrder) — no orphan players, no phantom order entries.
  expect([...state.turnOrder].sort()).toEqual([...ids].sort());
}

/**
 * I25: the local player's canonical projection deep-equals the legacy scalars.
 * This is THE single-writer pin: under fork決定3 the legacy scalars are the
 * draft-private write surface and `players` is rebuilt wholesale at the
 * chokepoint, so any divergence means a write escaped the chokepoint.
 */
function expectI25(state: GameState): void {
  const local = requirePlayer(state, state.localPlayerId);
  expect(local.life).toBe(state.life);
  expect(local.poison).toBe(state.poison);
  expect(local.energy).toBe(state.energy);
  expect(local.experience).toBe(state.experience);
  expect(local.manaPool).toEqual(state.manaPool);
  expect(local.landsPlayedThisTurn).toBe(state.landsPlayedThisTurn);
  expect(local.spellsCastThisTurn).toBe(state.spellsCastThisTurn);
  expect(local.drawnThisTurn).toBe(state.drawnThisTurn);
  expect(local.mulliganCount).toBe(state.mulliganCount);
}

/** I26: opponentLife <-> players bijection (fork決定4: compat view, not re-keyed). */
function expectI26(state: GameState): void {
  const seen = new Set<string>();
  for (const [label, life] of Object.entries(state.opponentLife)) {
    const id = playerIdForLifeLabel(label);
    const player = state.players[id];
    expect(player).toBeDefined();
    expect(player!.life).toBe(life);
    expect(player!.label).toBe(label);
    // Injectivity: two distinct labels must never collapse onto one PlayerId.
    expect(seen.has(id)).toBe(false);
    seen.add(id);
  }
  // No orphans: every non-local player must be backed by an opponentLife label.
  for (const id of Object.keys(state.players)) {
    if (id === state.localPlayerId) continue;
    expect(seen.has(id)).toBe(true);
  }
}

function expectAllInvariants(state: GameState): void {
  expectI24(state);
  expectI25(state);
  expectI26(state);
}

describe('MP-STATE: N-player canonical player state (I24-I28)', () => {
  beforeEach(() => resetStore());

  describe('I24: roster / turnOrder well-formedness (CR 102.1/103.1)', () => {
    it('initGame produces a well-formed roster with P1 + the default opponent', () => {
      const state = initGame(makeDeck(6), 1);
      expectI24(state);
      expect(state.localPlayerId).toBe(LOCAL_PLAYER_ID);
      expect(Object.keys(state.players).sort()).toEqual(
        [LOCAL_PLAYER_ID, DEFAULT_OPPONENT_ID].sort(),
      );
    });

    it('CR 103.4c: both Commander players start at 40 life', () => {
      const state = initGame(makeDeck(6), 1);
      expect(requirePlayer(state, LOCAL_PLAYER_ID).life).toBe(40);
      expect(requirePlayer(state, DEFAULT_OPPONENT_ID).life).toBe(40);
    });

    it('CR 103.1: turnOrder is an ordered relation seeded as [local, defaultOpponent], not a toggle', () => {
      const state = initGame(makeDeck(6), 1);
      expect(state.turnOrder).toEqual([LOCAL_PLAYER_ID, DEFAULT_OPPONENT_ID]);
    });

    it('CR 800.1: adding opponents extends the roster to 3 and 4 players, staying well-formed', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Bob', delta: 0 }).state;
      expectI24(state);
      expect(state.turnOrder).toHaveLength(3);

      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Carol', delta: 0 }).state;
      expectI24(state);
      expect(state.turnOrder).toHaveLength(4);
      // Derivation rule: extras sort AFTER the default opponent (this is what keeps I27 true).
      expect(state.turnOrder.slice(0, 2)).toEqual([LOCAL_PLAYER_ID, DEFAULT_OPPONENT_ID]);
    });

    it('invariants hold across a run of ordinary commands', () => {
      let state = initGame(makeDeck(12), 1);
      state = applyCommand(state, { type: 'draw', count: 3 }).state;
      expectAllInvariants(state);
      state = applyCommand(state, { type: 'adjustLife', delta: -5 }).state;
      expectAllInvariants(state);
      state = applyCommand(state, { type: 'mill', count: 2 }).state;
      expectAllInvariants(state);
      state = applyCommand(state, { type: 'adjustPlayerCounter', kind: 'poison', delta: 3 }).state;
      expectAllInvariants(state);
      state = applyCommand(state, { type: 'addMana', color: 'G', amount: 2 }).state;
      expectAllInvariants(state);
    });
  });

  describe('I25: local projection == legacy scalars (single-writer pin, fork決定3)', () => {
    it('adjustLife keeps players[local].life and state.life in lockstep', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'adjustLife', delta: -7 }).state;
      expect(state.life).toBe(33);
      expect(requirePlayer(state, LOCAL_PLAYER_ID).life).toBe(33);
      expectI25(state);
    });

    it('mana added mid-command is reflected in the local projection at the observation boundary', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'addMana', color: 'U', amount: 1 }).state;
      expectI25(state);
      state = applyCommand(state, { type: 'addMana', color: 'B', amount: 2 }).state;
      expectI25(state);
      state = applyCommand(state, { type: 'clearManaPool' }).state;
      expectI25(state);
    });

    it('the local projection is a copy, not an alias, of the legacy manaPool (structural sharing must not leak a mutable handle)', () => {
      const state = initGame(makeDeck(6), 1);
      expect(requirePlayer(state, LOCAL_PLAYER_ID).manaPool).not.toBe(state.manaPool);
    });

    it('performStateBasedActions (the standalone engine entry point) re-derives players, not just zonesByPlayer', () => {
      // §34.17's HIGH-1 was exactly this path forgetting one of two mirrors. fork決定
      // (syncDerivedViews = composition) exists so that cannot recur; this pin proves it.
      const creature = makeDef({
        scryfallId: 'r-mp-state-sba',
        typeLine: 'Creature',
        faces: [{ name: 'r-mp-state-sba', typeLine: 'Creature', power: '2', toughness: '2' }],
      });
      let state = initGame([{ def: creature, isCommander: false }, ...makeDeck(8)], 1);
      const creatureId = Object.values(state.cards).find(
        (c) => c.defId === creature.scryfallId,
      )!.id;
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: creatureId,
        to: 'battlefield',
        position: 'bottom',
      }).state;

      // Drive a lethal-damage state directly (bypassing applyCommand), then call the
      // standalone exported entry point, mimicking the §34.17 HIGH-1 shape.
      const lethalDraftState: GameState = {
        ...state,
        life: 12,
        cards: {
          ...state.cards,
          [creatureId]: { ...state.cards[creatureId], damageMarked: 5 },
        },
      };

      const result = performStateBasedActions(lethalDraftState);
      expect(result.state.zones.graveyard).toContain(creatureId);
      // The pin: players must have been re-derived through the same chokepoint.
      expect(requirePlayer(result.state, LOCAL_PLAYER_ID).life).toBe(12);
      expectAllInvariants(result.state);
    });

    it('undo/redo restore a consistent projection (history holds whole states past the chokepoint)', () => {
      const deck = makeDeck(10);
      store().newGame(deck, 5);
      store().dispatch({ type: 'adjustLife', delta: -9 });
      expectAllInvariants(store().state!);

      store().undo();
      const afterUndo = store().state!;
      expect(afterUndo.life).toBe(40);
      expect(requirePlayer(afterUndo, LOCAL_PLAYER_ID).life).toBe(40);
      expectAllInvariants(afterUndo);

      store().redo();
      const afterRedo = store().state!;
      expect(afterRedo.life).toBe(31);
      expect(requirePlayer(afterRedo, LOCAL_PLAYER_ID).life).toBe(31);
      expectAllInvariants(afterRedo);
    });
  });

  describe('I26: opponentLife <-> players bijection (fork決定4)', () => {
    it('the default opponent label maps to DEFAULT_OPPONENT_ID, not to a minted opponent:* id', () => {
      // This is what makes the mapping injective: `opponent:対戦相手A` is never minted.
      expect(playerIdForLifeLabel(DEFAULT_OPPONENT_LIFE_LABEL)).toBe(DEFAULT_OPPONENT_ID);
    });

    it('a non-default label mints a distinct player and never collides with P1 or the default opponent', () => {
      const minted = playerIdForLifeLabel('Bob');
      expect(minted).not.toBe(LOCAL_PLAYER_ID);
      expect(minted).not.toBe(DEFAULT_OPPONENT_ID);
    });

    it('adversarial labels that look like reserved ids do not collide with real player ids', () => {
      // A user can type anything into the life sheet. The bijection must survive labels
      // that impersonate the reserved identity spellings.
      for (const hostile of ['P1', 'OPPONENT_A', 'opponent:P1', DEFAULT_OPPONENT_ID]) {
        const minted = playerIdForLifeLabel(hostile);
        expect(minted).not.toBe(LOCAL_PLAYER_ID);
        if (hostile !== DEFAULT_OPPONENT_LIFE_LABEL) {
          expect(minted).not.toBe(DEFAULT_OPPONENT_ID);
        }
      }
    });

    it('adjusting an opponent life through the command path keeps the bijection intact', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, {
        type: 'adjustOpponentLife',
        label: DEFAULT_OPPONENT_LIFE_LABEL,
        delta: -13,
      }).state;
      expect(state.opponentLife[DEFAULT_OPPONENT_LIFE_LABEL]).toBe(27);
      expect(requirePlayer(state, DEFAULT_OPPONENT_ID).life).toBe(27);
      expectI26(state);
    });

    it('store.addOpponent mints exactly one player and extends turnOrder by one, with no store-side changes required', () => {
      const deck = makeDeck(8);
      store().newGame(deck, 5);
      const before = store().state!.turnOrder.length;

      store().addOpponent('Dave');
      const state = store().state!;
      expect(state.turnOrder).toHaveLength(before + 1);
      expect(requirePlayer(state, playerIdForLifeLabel('Dave')).label).toBe('Dave');
      expectAllInvariants(state);
    });

    it('a label that disappears from opponentLife leaves no orphan player behind', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Ghost', delta: 0 }).state;
      expect(state.players[playerIdForLifeLabel('Ghost')]).toBeDefined();

      // Simulate the label being removed at the boundary, then pass through the chokepoint.
      const withoutGhost: GameState = {
        ...state,
        opponentLife: { [DEFAULT_OPPONENT_LIFE_LABEL]: state.opponentLife[DEFAULT_OPPONENT_LIFE_LABEL] },
      };
      const next = applyCommand(withoutGhost, { type: 'adjustLife', delta: 0 }).state;
      expect(next.players[playerIdForLifeLabel('Ghost')]).toBeUndefined();
      expectAllInvariants(next);
    });

    it('fork決定5: commanderDamage is NOT projected onto players (its key is a commander label, not an opponent)', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, {
        type: 'adjustCommanderDamage',
        label: 'Opp Commander A',
        delta: 21,
      }).state;
      // The commander label must not mint a player: it is damage dealt TO P1.
      expect(state.players[playerIdForLifeLabel('Opp Commander A')]).toBeUndefined();
      expectAllInvariants(state);
    });
  });

  describe('I27: APNAP freeze (no behavior change, CR 103.1)', () => {
    it('a default game turnOrder is identical to the legacy DEFAULT_TURN_ORDER constant', () => {
      const state = initGame(makeDeck(6), 1);
      expect(state.turnOrder).toEqual([...DEFAULT_TURN_ORDER]);
    });

    it('ordering pending triggers via state.turnOrder matches the legacy DEFAULT_TURN_ORDER result, even with extra players in the roster', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Zed', delta: 0 }).state;
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Amy', delta: 0 }).state;

      // Guard against a false green: `orderPendingTriggersApnap` defaults its
      // `turnOrder` parameter to DEFAULT_TURN_ORDER, so passing `undefined` would
      // silently compare the legacy constant against itself and always pass.
      expect(Array.isArray(state.turnOrder)).toBe(true);
      expect(state.turnOrder.length).toBe(4);

      // Non-vacuous ordering input: two triggers supplied in reverse APNAP order, so a
      // correct implementation MUST reorder them (active player's trigger first).
      const triggers = [
        makePendingTrigger('t-opp', DEFAULT_OPPONENT_ID),
        makePendingTrigger('t-p1', LOCAL_PLAYER_ID),
      ];
      const explicitIds = ['t-opp', 't-p1'];

      const viaState = orderPendingTriggersApnap(
        triggers,
        explicitIds,
        state.activePlayerId,
        state.turnOrder,
      );
      const viaLegacy = orderPendingTriggersApnap(
        triggers,
        explicitIds,
        state.activePlayerId,
        DEFAULT_TURN_ORDER,
      );
      expect(viaState).toEqual(viaLegacy);
      // Prove the ordering actually did something (guards against both sides being empty).
      expect(viaState.status).toBe('ordered');
      expect(viaState.orderedIds).toEqual(['t-p1', 't-opp']);
    });

    it('extra players contribute zero entries: a trigger controlled by a minted id is never produced, and extras append empty buckets', () => {
      let state = initGame(makeDeck(6), 1);
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Amy', delta: 0 }).state;
      const mintedId = playerIdForLifeLabel('Amy');

      // The safety argument for I27, stated as an executable claim rather than a vacuous
      // loop: even if a minted player sits in turnOrder, it contributes no ordered entry.
      const triggers = [makePendingTrigger('t-p1', LOCAL_PLAYER_ID)];
      const result = orderPendingTriggersApnap(
        triggers,
        ['t-p1'],
        state.activePlayerId,
        state.turnOrder,
      );
      expect(state.turnOrder).toContain(mintedId);
      expect(result.orderedIds).toEqual(['t-p1']);
    });
  });

  describe('I28: snapshot backfill / idempotence (fork決定6, forward compat)', () => {
    function snapshotOf(state: GameState, deck: ReturnType<typeof makeDeck>): GameSnapshot {
      return { version: SNAPSHOT_VERSION, state, deck, autoAdvanceToMain: false };
    }

    it('SNAPSHOT_VERSION is not bumped (a bump would discard every existing local game)', () => {
      expect(SNAPSHOT_VERSION).toBe(1);
    });

    it('a legacy snapshot with no players/turnOrder/localPlayerId restores and satisfies I24-I26', () => {
      const deck = makeDeck(12);
      let state = initGame(deck, 7);
      state = applyCommand(state, { type: 'draw', count: 3 }).state;
      state = applyCommand(state, { type: 'adjustLife', delta: -11 }).state;
      const legacyLibrary = state.zones.library.slice();

      const legacyState: Partial<GameState> = { ...state };
      delete legacyState.players;
      delete legacyState.turnOrder;
      delete legacyState.localPlayerId;

      expect(() =>
        store().restoreGame(snapshotOf(legacyState as GameState, deck)),
      ).not.toThrow();
      const restored = store().state!;
      expectAllInvariants(restored);
      expect(restored.life).toBe(29);
      expect(requirePlayer(restored, LOCAL_PLAYER_ID).life).toBe(29);
      // Legacy P1 card order is unchanged (§34.42 acceptance).
      expect(restored.zones.library).toEqual(legacyLibrary);
    });

    it('a snapshot carrying a CORRUPT players/turnOrder is re-derived, not trusted', () => {
      const deck = makeDeck(8);
      const base = initGame(deck, 5);
      const corrupt = {
        ...base,
        life: 34,
        players: { P1: { id: 'WRONG', label: null, life: 999 } },
        turnOrder: ['P1', 'P1', 'GHOST'],
        localPlayerId: 'NOT_A_PLAYER',
      } as unknown as GameState;

      expect(() => store().restoreGame(snapshotOf(corrupt, deck))).not.toThrow();
      const restored = store().state!;
      expectAllInvariants(restored);
      expect(requirePlayer(restored, restored.localPlayerId).life).toBe(34);
    });

    it('a legacy snapshot with missing scalars restores to CR 103.4c defaults without throwing', () => {
      const deck = makeDeck(8);
      const base = initGame(deck, 5);
      const legacy: Partial<GameState> = { ...base };
      delete legacy.players;
      delete legacy.turnOrder;
      delete legacy.localPlayerId;
      delete legacy.life;
      delete legacy.poison;
      delete legacy.opponentLife;

      expect(() => store().restoreGame(snapshotOf(legacy as GameState, deck))).not.toThrow();
      const restored = store().state!;
      expectAllInvariants(restored);
      expect(restored.life).toBe(40);
      expect(requirePlayer(restored, LOCAL_PLAYER_ID).life).toBe(40);
    });

    it('normalization is idempotent: restoring an already-normalized snapshot is a fixed point', () => {
      const deck = makeDeck(10);
      let state = initGame(deck, 5);
      state = applyCommand(state, { type: 'draw', count: 2 }).state;
      state = applyCommand(state, { type: 'adjustOpponentLife', label: 'Eve', delta: -4 }).state;

      store().restoreGame(snapshotOf(state, deck));
      const once = store().state!;
      store().restoreGame(snapshotOf(once, deck));
      const twice = store().state!;

      expect(twice.players).toEqual(once.players);
      expect(twice.turnOrder).toEqual(once.turnOrder);
      expect(twice.localPlayerId).toEqual(once.localPlayerId);
      expectAllInvariants(twice);
    });
  });
});
