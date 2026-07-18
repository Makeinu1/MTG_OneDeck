/**
 * review.act3-activated-keyword — CR 702 の起動型キーワード正規化契約。
 *
 * State②暫定レビュー: 判定者復帰後に CR 702.6a/.49a/.67a/.84a/.87a/
 * .107a/.122a/.128a/.129a/.151a へ独立再照合すること。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { buildCardActionCatalog, type ActionCatalogContext } from '../../components/game/actionCatalog';
import type { CardInstance, ZoneId } from '../types';
import type { CardDef } from '../../types/card';
import { activatedAbilityLines } from '../grammar';
import { canonicalizeActivatedKeyword } from '../grammar/activatedKeyword';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { makeDef } from './helpers';
import { makeDeck } from './helpers';
import { useGameStore } from '../../store/gameStore';

describe('review.act3 — CR 702 canonical activated line', () => {
  it.each([
    ['Equip {1}', 'equip', 'battlefield', '{1}: Attach this permanent to target creature you control.'],
    ['Equip legendary creature {2}', 'equip', 'battlefield', '{2}: Attach this permanent to target legendary creature you control.'],
    ['Equip—Pay 3 life', 'equip', 'battlefield', 'Pay 3 life: Attach this permanent to target creature you control.'],
    ['Fortify {3}', 'fortify', 'battlefield', '{3}: Attach this Fortification to target land you control.'],
    ['Level up {1}', 'level-up', 'battlefield', '{1}: Put a level counter on this permanent.'],
    ['Outlast {W}', 'outlast', 'battlefield', '{W}, {T}: Put a +1/+1 counter on this creature.'],
    ['Unearth {3}{W}{B}', 'unearth', 'graveyard', '{3}{W}{B}: Return this card from your graveyard to the battlefield.'],
    ['Embalm {2}{W}', 'embalm', 'graveyard', '{2}{W}, Exile this card from your graveyard: Create a token'],
    ['Eternalize {4}{U}', 'eternalize', 'graveyard', '{4}{U}, Exile this card from your graveyard: Create a token'],
    ['Ninjutsu {1}{U}', 'ninjutsu', 'hand', '{1}{U}, Reveal this card from your hand, Return an unblocked attacking creature'],
    ['Commander ninjutsu {2}{U}{B}', 'commander-ninjutsu', 'hand', '{2}{U}{B}, Reveal this card from your hand'],
    ['Crew 3', 'crew', 'battlefield', 'Tap any number of other untapped creatures you control with total power 3 or greater:'],
  ] as const)('%s を起動型行へ展開する', (oracle, keywordId, activationZone, fragment) => {
    const result = canonicalizeActivatedKeyword(oracle);
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({ keywordId });
    expect(result?.[0]?.activationZones).toContain(activationZone);
    expect(result?.[0]?.text).toContain(fragment);
  });

  it('CR 702.151a: Reconfigure は attach/unattach の2起動型能力へ展開する', () => {
    const result = canonicalizeActivatedKeyword('Reconfigure {2}');
    expect(result?.map((line) => line.keywordId)).toEqual([
      'reconfigure-attach',
      'reconfigure-unattach',
    ]);
    expect(result?.every((line) => line.activationZones.includes('battlefield'))).toBe(true);
  });

  it('flat index と keyword metadata を activatedAbilityLines まで保存する', () => {
    const def = keywordDef('Unearth {U}');
    expect(activatedAbilityLines(def)).toEqual([
      expect.objectContaining({
        index: 0,
        keywordId: 'unearth',
        keywordLabel: '蘇生',
        activationZones: ['graveyard'],
        costText: '{U}',
      }),
    ]);
  });

  it.each([
    'Crew 3',
    'Unearth {U}',
    'Embalm {2}{W}',
    'Eternalize {4}{U}',
    'Ninjutsu {1}{U}',
    'Reconfigure {2}',
  ])('%s の未モデル化複合処理を auto と詐称しない', (oracle) => {
    const def = keywordDef(oracle);
    for (const line of activatedAbilityLines(def)) {
      const compiled = compileAbilityIR(parseAbilityIR(line.text, def.typeLine), {
        sourceId: 'act3-source',
        def,
      });
      expect(compiled.decision).not.toBe('auto');
    }
  });
});

function keywordDef(oracleText: string): CardDef {
  return makeDef({
    scryfallId: `act3-${oracleText}`,
    typeLine: 'Creature',
    faces: [{ name: oracleText, typeLine: 'Creature', oracleText }],
  });
}

function card(zone: ZoneId, defId: string): CardInstance {
  return {
    id: 'act3-card',
    defId,
    zone,
    ownerId: 'P1',
    controllerId: 'P1',
    zoneChangeCounter: 0,
    tapped: false,
    faceIndex: 0,
    faceDown: false,
    counters: {},
    damageMarked: 0,
    hasDeathtouchDamage: false,
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
  };
}

function context(def: CardDef, zone: ZoneId): ActionCatalogContext {
  return {
    card: card(zone, def.scryfallId),
    def,
    typeLine: def.typeLine,
    displayName: def.name,
    isCommanderCard: false,
    canAffordCast: true,
    landDropAvailable: true,
    commanderTax: 0,
  };
}

describe('review.act3 — 定義ゾーン別のUI到達性', () => {
  it('Unearth は墓地だけに明示行として出し、戦場には誤提示しない', () => {
    const def = keywordDef('Unearth {U}');
    const graveyard = buildCardActionCatalog(context(def, 'graveyard')).specs;
    expect(graveyard).toContainEqual(expect.objectContaining({
      id: 'ability-activate-0',
      label: '蘇生 ({U})',
    }));

    const battlefield = buildCardActionCatalog(context(def, 'battlefield')).specs;
    expect(battlefield.some((spec) => spec.id === 'ability-activate-0')).toBe(false);
  });

  it('Ninjutsu は手札だけ、Equip は戦場だけに出す', () => {
    const ninjutsu = keywordDef('Ninjutsu {1}{U}');
    expect(buildCardActionCatalog(context(ninjutsu, 'hand')).specs)
      .toContainEqual(expect.objectContaining({ id: 'ability-activate-0', label: '忍術 ({1}{U})' }));
    expect(buildCardActionCatalog(context(ninjutsu, 'battlefield')).specs
      .some((spec) => spec.id === 'ability-activate-0')).toBe(false);

    const equip = keywordDef('Equip {1}');
    expect(buildCardActionCatalog(context(equip, 'battlefield')).specs)
      .toContainEqual(expect.objectContaining({ id: 'ability-activate-0', label: '装備 ({1})' }));
    expect(buildCardActionCatalog(context(equip, 'hand')).specs
      .some((spec) => spec.id === 'ability-activate-0')).toBe(false);
  });

  it('CR 702.49d: Commander ninjutsu は手札と統率領域の両方に出す', () => {
    const def = keywordDef('Commander ninjutsu {2}{U}{B}');
    expect(buildCardActionCatalog(context(def, 'hand')).specs
      .some((spec) => spec.id === 'ability-activate-0')).toBe(true);
    expect(buildCardActionCatalog(context(def, 'command')).specs)
      .toContainEqual(expect.objectContaining({
        id: 'ability-activate-0',
        label: '統率忍術 ({2}{U}{B})',
      }));
  });

  it('同じカードの通常能力と墓地能力を現在ゾーンで分離する', () => {
    const def = makeDef({
      scryfallId: 'act3-priest-shape',
      typeLine: 'Creature',
      faces: [{
        name: 'Priest shape',
        typeLine: 'Creature',
        oracleText: '{T}, Pay 3 life, Sacrifice Priest shape: Return target creature card from your graveyard to the battlefield.\nUnearth {3}{W}{B}',
      }],
    });
    const battlefieldIds = buildCardActionCatalog(context(def, 'battlefield')).specs.map((spec) => spec.id);
    const graveyardIds = buildCardActionCatalog(context(def, 'graveyard')).specs.map((spec) => spec.id);
    expect(battlefieldIds).toContain('ability-activate');
    expect(battlefieldIds).not.toContain('ability-activate-1');
    expect(graveyardIds).toContain('ability-activate-1');
    expect(graveyardIds).not.toContain('ability-activate');
  });
});

describe('review.act3 — 墓地キーワードの起動経路', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      pendingForceActivation: null,
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
      mulliganDecisionPending: false,
    });
  });

  it('Unearth は墓地の発生源スナップショットを保ってコストを払いスタックへ積む', () => {
    const def = keywordDef('Unearth {3}{W}{B}');
    useGameStore.getState().newGame(
      [{ def, isCommander: false }, ...makeDeck(10)],
      1,
    );
    const source = Object.values(useGameStore.getState().state!.cards)
      .find((instance) => instance.defId === def.scryfallId);
    if (!source) throw new Error('ACT-3 source missing');

    const store = useGameStore.getState();
    store.moveCard(source.id, 'graveyard', 'bottom');
    store.dispatch({ type: 'addMana', color: 'C', amount: 3 });
    store.dispatch({ type: 'addMana', color: 'W', amount: 1 });
    store.dispatch({ type: 'addMana', color: 'B', amount: 1 });
    store.clearWarnings();

    useGameStore.getState().activateAbility(source.id, 0);

    const state = useGameStore.getState().state!;
    expect(state.cards[source.id].zone).toBe('graveyard');
    expect(
      state.manaPool.W
      + state.manaPool.U
      + state.manaPool.B
      + state.manaPool.R
      + state.manaPool.G
      + state.manaPool.C,
    ).toBe(0);
    expect(state.zones.stack).toHaveLength(1);
    const stackItemId = state.zones.stack[0];
    if (!stackItemId) throw new Error('ACT-3 stack item missing');
    const ability = state.cards[stackItemId];
    expect(ability.isAbility).toBe(true);
    expect(ability.abilityLineIndex).toBe(0);
    expect(ability.sourceSnapshot?.physicalCardId).toBe(source.id);
  });
});
