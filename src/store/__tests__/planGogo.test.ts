import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { eligibleTargets } from '../../engine/commands';
import type { GameState } from '../../engine/types';
import { PLAN_CARD_FIXTURES } from '../../test/fixtures/planCardFixtures';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function state(): GameState {
  const current = store().state;
  if (!current) throw new Error('game state unavailable');
  return current;
}

function idFor(defId: string): string {
  const id = Object.values(state().cards).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing ${defId}`);
  return id;
}

function setup(): { gogoId: string; targetAbilityId: string; manaAbilityId: string } {
  const targetDef = makeDef({
    scryfallId: 'gogo-target-ability',
    typeLine: 'Creature',
    faces: [{
      name: 'Target Technician',
      typeLine: 'Creature',
      oracleText: '{T}: Tap target creature.',
    }],
  });
  const manaDef = makeDef({
    scryfallId: 'gogo-mana-ability',
    typeLine: 'Creature',
    producedMana: ['G'],
    faces: [{ name: 'Mana Technician', typeLine: 'Creature', oracleText: '{T}: Add {G}.' }],
  });
  store().newGame([
    { def: PLAN_CARD_FIXTURES.gogo, isCommander: false },
    { def: targetDef, isCommander: false },
    { def: manaDef, isCommander: false },
    ...makeDeck(18),
  ], 11);
  const gogoId = idFor(PLAN_CARD_FIXTURES.gogo.scryfallId);
  const targetId = idFor(targetDef.scryfallId);
  const manaId = idFor(manaDef.scryfallId);
  store().moveCard(gogoId, 'battlefield');
  store().moveCard(targetId, 'battlefield');
  store().moveCard(manaId, 'battlefield');
  store().addAbilityToStack(targetId, 'activated', 0);
  const targetAbilityId = state().zones.stack.at(-1);
  store().addAbilityToStack(manaId, 'activated', 0);
  const manaAbilityId = state().zones.stack.at(-1);
  if (!targetAbilityId || !manaAbilityId) throw new Error('ability setup failed');
  return { gogoId, targetAbilityId, manaAbilityId };
}

describe('Gogo manual-complete substrate', () => {
  beforeEach(() => {
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
  });

  it('rejects X=0, pays 2X, filters mana abilities, copies X times, and preserves undo', () => {
    const { gogoId, targetAbilityId, manaAbilityId } = setup();
    store().adjustMana('C', 6);

    store().activateAbility(gogoId, 0, { xValue: 0 });
    expect(state().cards[gogoId].tapped).toBe(false);
    expect(store().warnings.at(-1)).toContain('1以上');

    store().activateAbility(gogoId, 0, { xValue: 3 });
    const prompt = store().pendingGuided?.prompts[0];
    expect(prompt).toMatchObject({
      kind: 'target',
      filter: {
        zone: 'stack',
        stackKinds: ['activated-ability', 'triggered-ability'],
        controller: 'you',
        excludeManaAbilities: true,
      },
    });
    if (prompt?.kind !== 'target') throw new Error('target prompt missing');
    const candidates = eligibleTargets(state(), prompt.filter ?? {}, { sourceId: gogoId });
    expect(candidates).toContain(targetAbilityId);
    expect(candidates).not.toContain(manaAbilityId);
    store().confirmGuidedTarget(targetAbilityId);

    const gogoAbilityId = state().zones.stack.at(-1);
    expect(gogoAbilityId && state().cards[gogoAbilityId]).toMatchObject({ announcedX: 3 });
    expect(state().cards[gogoId].tapped).toBe(true);
    expect(state().manaPool.C).toBe(0);

    const depthBeforeBlockedCopy = state().zones.stack.length;
    store().copyStackItem(gogoAbilityId ?? 'missing');
    expect(state().zones.stack).toHaveLength(depthBeforeBlockedCopy);
    expect(store().warnings.at(-1)).toContain('コピーできません');

    store().resolveTop();
    const copies = state().zones.stack.filter((id) => {
      const card = state().cards[id];
      return card?.isAbility && card.sourceId === state().cards[targetAbilityId].sourceId;
    });
    expect(copies).toHaveLength(4); // original + X copies
    expect(copies).toEqual([...copies].sort((left, right) => {
      const number = (id: string) => Number.parseInt(id.slice(1), 10);
      return number(left) - number(right);
    }));

    store().undo();
    expect(state().zones.stack).toContain(gogoAbilityId);
    store().undo();
    expect(state().cards[gogoId].tapped).toBe(false);
    expect(state().manaPool.C).toBe(6);
  });

  it('supports X=1 and lets each produced copy receive new manual targets', () => {
    const { gogoId, targetAbilityId } = setup();
    store().adjustMana('C', 2);
    store().activateAbility(gogoId, 0, { xValue: 1 });
    store().confirmGuidedTarget(targetAbilityId);
    store().resolveTop();

    const copiedAbilityId = state().zones.stack.at(-1);
    expect(copiedAbilityId).not.toBe(targetAbilityId);
    const battlefieldTargets = state().zones.battlefield.filter((id) => id !== gogoId).slice(0, 2);
    store().setManualTargets(copiedAbilityId ?? 'missing', battlefieldTargets);
    expect(state().cards[copiedAbilityId ?? 'missing'].targetSelections?.filter(
      (selection) => selection.slotId.startsWith('manual-target-'),
    )).toHaveLength(battlefieldTargets.length);
  });
});
