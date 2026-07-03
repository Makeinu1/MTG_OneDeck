// REVIEWER-OWNED acceptance contract for the S-ACTIVATED-ABILITY envelope
// (engine-spec §34.19). Implementation agents must NOT edit this file; fix the engine.
//
// CR grounding (verified against rule/ 2026-06-19):
//   - 602.1: activated abilities are "[Cost]: [Effect]"; cost is before the colon.
//   - 602.2 / 602.2a: activation = put ability on the stack + pay costs; if a player can't
//     comply with a step, the activation is illegal and the game returns to before it.
//   - 602.2b: the 601.2b-i casting procedure applies to activation; targets are chosen then.
//   - 115.1c: an activated ability's targets are chosen AS THE ABILITY IS ACTIVATED.
//   - 118.3 / 601.2h: a cost can't be paid without full resources; no partial payment
//     (an already-tapped permanent can't be tapped to pay {T}).
//   - 605.1a: an activated ability with NO target that could add mana and isn't loyalty is a
//     mana ability -> resolves immediately, uses no stack (605.3b/405.6c).
//   - 605.5a: an ability WITH a target is NOT a mana ability even if it could add mana.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { objectIdOf } from '../../engine/types';
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

function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}
function toBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}
function stackObjects() {
  const s = store().state!;
  return s.zones.stack.map((id) => s.cards[id]);
}

describe('review.activated-envelope: CR 602/115/118/605 activation envelope (§34.19)', () => {
  beforeEach(() => {
    resetStore();
  });

  // 1. CR 115.1c/602.2b: a targeted activated ability chooses its target AT ACTIVATION,
  //    stores it on the stack object, and does not commit the stack object until chosen.
  it('115.1c: activation-time target is stored on the stack ability, committed only on confirm', () => {
    const src = makeDef({
      scryfallId: 'rv-pinger',
      typeLine: 'Artifact',
      faces: [{ name: 'rv-pinger', typeLine: 'Artifact', oracleText: '{T}: Tap target creature.' }],
    });
    const tgt = makeDef({
      scryfallId: 'rv-goat',
      typeLine: 'Creature',
      faces: [{ name: 'rv-goat', typeLine: 'Creature' }],
    });
    store().newGame([{ def: src, isCommander: false }, { def: tgt, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-pinger');
    const tgtId = instanceId('rv-goat');
    toBattlefield(srcId);
    toBattlefield(tgtId);
    store().clearWarnings();
    const tgtObjectId = objectIdOf(store().state!.cards[tgtId]);
    const snapshotBefore = JSON.stringify(store().state);

    store().activateAbility(srcId, 0);
    // Before target confirmation: no stack object, no committed mutation (CR 602.2 atomicity).
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(JSON.stringify(store().state)).toBe(snapshotBefore);
    expect(store().pendingGuided?.mode).toBe('activation');

    store().confirmGuidedTarget(tgtId);
    const stack = stackObjects();
    expect(stack).toHaveLength(1);
    const sel = stack[0].targetSelections;
    expect(sel).toHaveLength(1);
    expect(sel?.[0]).toMatchObject({
      kind: 'object',
      selection: { physicalCardId: tgtId, objectId: tgtObjectId },
      legalityMode: 'checked',
    });
    // Source paid its {T} cost as part of the same activation.
    expect(store().state!.cards[srcId].tapped).toBe(true);
  });

  // 2. CR 118.3/602.2: rules-legal activation of an unpayable {T} cost commits nothing.
  it('118.3: activating {T} on an already-tapped source commits no stack object and no mutation', () => {
    const src = makeDef({
      scryfallId: 'rv-tapped',
      typeLine: 'Artifact',
      faces: [{ name: 'rv-tapped', typeLine: 'Artifact', oracleText: '{T}: Draw a card.' }],
    });
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-tapped');
    toBattlefield(srcId);
    store().dispatch({ type: 'setTapped', cardId: srcId, tapped: true });
    store().clearWarnings();
    const before = JSON.stringify(store().state);

    store().activateAbility(srcId, 0);

    expect(JSON.stringify(store().state)).toBe(before);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().warnings.length).toBeGreaterThanOrEqual(1);
  });

  // 3. Sandbox vs CR: forced mode may commit but must not present the activation as CR-legal.
  it('forced: force-activating an unpayable cost commits a stack object with a non-CR-legal warning', () => {
    const src = makeDef({
      scryfallId: 'rv-force',
      typeLine: 'Artifact',
      faces: [{ name: 'rv-force', typeLine: 'Artifact', oracleText: '{T}: Draw a card.' }],
    });
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-force');
    toBattlefield(srcId);
    store().dispatch({ type: 'setTapped', cardId: srcId, tapped: true });
    store().clearWarnings();

    store().activateAbility(srcId, 0, { force: true });

    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().warnings.some((w) => w.includes('CR-legal'))).toBe(true);
  });

  // 4. CR 605.1a/605.3b: a targetless activated mana ability resolves with NO stack object.
  it('605.1a: a targetless "{T}: Add {G}." mana ability adds mana and creates no stack object', () => {
    const src = makeDef({
      scryfallId: 'rv-dork',
      typeLine: 'Creature — Elf Druid',
      faces: [{ name: 'rv-dork', typeLine: 'Creature — Elf Druid', oracleText: '{T}: Add {G}.' }],
    });
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-dork');
    toBattlefield(srcId);
    store().clearWarnings();

    store().activateAbility(srcId, 0);

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[srcId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);
  });

  // 5. CR 605.5a: an ability WITH a target is NOT a mana ability even if it could add mana;
  //    it must not resolve immediately as a mana ability.
  it('605.5a: a targeted "{T}: Target player adds {G}." does not immediately add mana with no stack', () => {
    const src = makeDef({
      scryfallId: 'rv-tgt-mana',
      typeLine: 'Artifact',
      faces: [{ name: 'rv-tgt-mana', typeLine: 'Artifact', oracleText: '{T}: Target player adds {G}.' }],
    });
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-tgt-mana');
    toBattlefield(srcId);
    store().clearWarnings();
    const manaBefore = store().state!.manaPool.G ?? 0;

    store().activateAbility(srcId, 0);

    // A targeted add-mana ability is NOT a mana ability: it must not immediately add mana with
    // no stack. It either requires target selection (guided) or lands on the stack — never the
    // 605.1a immediate-no-stack mana path.
    expect(store().state!.manaPool.G ?? 0).toBe(manaBefore);
    const wentToStack = store().state!.zones.stack.length >= 1;
    const needsTarget = store().pendingGuided?.mode === 'activation';
    expect(wentToStack || needsTarget).toBe(true);
  });

  // 6. CR 115.1c/602.2b: the forced sandbox escape bypasses unpayable COSTS, not TARGET
  //    selection. Force-activating a targeted ability must still require a target and must NOT
  //    commit a stack object with empty targetSelections.
  it('115.1c: forced mode still requires target selection for a targeted ability', () => {
    const src = makeDef({
      scryfallId: 'rv-forced-tgt',
      typeLine: 'Artifact',
      faces: [{ name: 'rv-forced-tgt', typeLine: 'Artifact', oracleText: '{T}: Tap target creature.' }],
    });
    const tgt = makeDef({
      scryfallId: 'rv-forced-goat',
      typeLine: 'Creature',
      faces: [{ name: 'rv-forced-goat', typeLine: 'Creature' }],
    });
    store().newGame([{ def: src, isCommander: false }, { def: tgt, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('rv-forced-tgt');
    toBattlefield(srcId);
    toBattlefield(instanceId('rv-forced-goat'));
    // Make the {T} cost unpayable so force is meaningful (forced bypasses the cost).
    store().dispatch({ type: 'setTapped', cardId: srcId, tapped: true });
    store().clearWarnings();

    store().activateAbility(srcId, 0, { force: true });

    // Forced bypasses the unpayable cost, but the target must still be chosen: no stack object
    // is committed yet and the target picker is pending.
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().pendingGuided?.mode).toBe('activation');
  });
});
