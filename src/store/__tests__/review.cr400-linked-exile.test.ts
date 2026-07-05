// Reviewer-owned adversarial tests for cr-400-408 linked-exile / LKI substrate (store/engine).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding (docs/engine-spec.md §34.21 design-lock):
// - CR 400.7: zone move creates a new object; `exiled-with-source` link consumption requires
//   BOTH the source's physical id AND its current object id to match the record (a re-incarnated
//   source, e.g. after leaving and returning, must NOT be able to consume the old link).
// - CR 400.7j/608.2h: same-resolution temporary-return re-verifies the CURRENT card at the
//   recorded exile object id is still in exile immediately before moving it to battlefield; if
//   the card left exile by any other means first, the return is a warning/no-op, never a blind
//   move of whatever now occupies that physical id from its new zone.
// - CR 406.5/406.6/607.2a: a plain simple-target exile (no linked instruction) must not write a
//   linkedExiles record at all.
// - snapshot forward-compat: restoring a legacy snapshot without `linkedExiles` must not throw.
import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDef } from '../../engine/__tests__/helpers';
import { objectIdOf, type GameState } from '../../engine/types';
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
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

describe('cr-400-408 linked-exile substrate (CR 400.7/607.2a/608.2h)', () => {
  beforeEach(() => resetStore());

  it('Path to Exile style simple exile writes no linkedExiles record', () => {
    const spell = makeDef({
      scryfallId: 'r-cr400-path',
      typeLine: 'Instant',
      faces: [{ name: 'r-cr400-path', typeLine: 'Instant', oracleText: 'Exile target creature.' }],
    });
    const target = makeDef({ scryfallId: 'r-cr400-path-target', typeLine: 'Creature' });
    store().newGame(
      [{ def: spell, isCommander: false }, { def: target, isCommander: false }],
      1,
    );
    const spellId = findInstanceId('r-cr400-path');
    const targetId = findInstanceId('r-cr400-path-target');
    store().moveCard(spellId, 'stack', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().state!.cards[targetId].zone).toBe('exile');
    expect(store().state!.linkedExiles).toEqual({});
  });

  it('Thassa-style same-resolution temporary-return resolves and consumes the record', () => {
    const thassa = makeDef({
      scryfallId: 'r-cr400-thassa',
      typeLine: 'Legendary Enchantment Creature',
      faces: [
        {
          name: 'r-cr400-thassa',
          typeLine: 'Legendary Enchantment Creature',
          oracleText:
            "At the beginning of your end step, exile up to one target creature you control, then return that card to the battlefield under its owner's control.",
        },
      ],
    });
    const target = makeDef({ scryfallId: 'r-cr400-blink-target', typeLine: 'Creature' });
    store().newGame(
      [{ def: thassa, isCommander: false }, { def: target, isCommander: false }],
      1,
    );
    const sourceId = findInstanceId('r-cr400-thassa');
    const targetId = findInstanceId('r-cr400-blink-target');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');
    const beforeObjectId = objectIdOf(store().state!.cards[targetId]);

    store().addAbilityToStack(sourceId, 'triggered');
    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'target',
      linkedExile: { purpose: 'temporary-return' },
    });

    store().confirmGuidedTarget(targetId);

    const s = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(s.cards[targetId].zone).toBe('battlefield');
    // New object incarnation after the exile->battlefield round-trip (CR 400.7).
    expect(objectIdOf(s.cards[targetId])).not.toBe(beforeObjectId);
    // Record consumed after a successful same-resolution return.
    expect(s.linkedExiles).toEqual({});
  });

  it('exiled-with-source consume rejects a re-incarnated source (CR 400.7/607.2a)', () => {
    const source = makeDef({ scryfallId: 'r-cr400-exiler', typeLine: 'Creature' });
    const target = makeDef({ scryfallId: 'r-cr400-linked-target', typeLine: 'Creature' });
    store().newGame(
      [{ def: source, isCommander: false }, { def: target, isCommander: false }],
      2,
    );
    const sourceId = findInstanceId('r-cr400-exiler');
    const targetId = findInstanceId('r-cr400-linked-target');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');
    const sourceObjectId = objectIdOf(store().state!.cards[sourceId]);

    store().dispatch({
      type: 'moveCard',
      cardId: targetId,
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'r-cr400-link',
        purpose: 'exiled-with-source',
        sourceObjectId,
        sourcePhysicalId: sourceId,
      },
    });
    expect(store().state!.linkedExiles['r-cr400-link']).toBeDefined();

    // Source changes zone (and incarnation) before consumption is attempted.
    store().moveCard(sourceId, 'graveyard', 'bottom');
    store().consumeLinkedExileForSource('r-cr400-link', sourceId);

    // Rejected: record survives, warning references the source-object mismatch.
    expect(store().state!.linkedExiles['r-cr400-link']).toBeDefined();
    expect(store().warnings.at(-1)).toContain('source object');
  });

  it('temporary-return is a warn/no-op (not a blind move) once the object left exile', () => {
    const source = makeDef({ scryfallId: 'r-cr400-blinker', typeLine: 'Creature' });
    const target = makeDef({ scryfallId: 'r-cr400-early-leave', typeLine: 'Creature' });
    store().newGame(
      [{ def: source, isCommander: false }, { def: target, isCommander: false }],
      3,
    );
    const sourceId = findInstanceId('r-cr400-blinker');
    const targetId = findInstanceId('r-cr400-early-leave');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');
    const sourceObjectId = objectIdOf(store().state!.cards[sourceId]);

    // Manually construct a pending temporary-return record (bypassing same-resolution auto-return)
    // to simulate the adversarial window between exile-write and return-consume.
    store().dispatch({
      type: 'moveCard',
      cardId: targetId,
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'r-cr400-stale-link',
        purpose: 'exiled-with-source',
        sourceObjectId,
        sourcePhysicalId: sourceId,
      },
    });
    const state = store().state!;
    useGameStore.setState({
      state: {
        ...state,
        linkedExiles: {
          'r-cr400-stale-link': { ...state.linkedExiles['r-cr400-stale-link'], purpose: 'temporary-return' },
        },
      },
    });

    // The card leaves exile by another means before the return step executes.
    store().moveCard(targetId, 'graveyard', 'bottom');

    store().returnLinkedExile('r-cr400-stale-link');

    // No blind move: the card stays in graveyard (its current zone), record is dropped, warning fires.
    expect(store().state!.cards[targetId].zone).toBe('graveyard');
    expect(store().state!.linkedExiles['r-cr400-stale-link']).toBeUndefined();
    expect(store().warnings.at(-1)).toContain('現在の追放オブジェクト');
  });

  it('restoreGame backfills a legacy snapshot missing linkedExiles without throwing', () => {
    const card = makeDef({ scryfallId: 'r-cr400-legacy' });
    store().newGame([{ def: card, isCommander: false }], 1);
    const deck = [{ def: card, isCommander: false }];
    const legacyState = { ...store().state! } as Partial<GameState>;
    delete legacyState.linkedExiles;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck,
      autoAdvanceToMain: true,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(store().state!.linkedExiles).toEqual({});
  });
});
