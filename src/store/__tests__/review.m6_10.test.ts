/**
 * Reviewer-owned adversarial tests for M6.10: trigger-candidate accuracy
 * (docs/engine-spec.md §25). Adds attack-trigger detection and watcher
 * triggers (cast/ETB/death/attack) for OTHER permanents, advisory only.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { classifyCardRules } from '../../data/ruleClassifier';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}
function creature(id: string, oracleText: string): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature — Test',
    faces: [{ name: id, typeLine: 'Creature — Test', oracleText }],
  });
}
function tagIds(def: CardDef): string[] {
  return classifyCardRules(def).map((t) => t.id);
}
function candidateTriggerIds(): string[] {
  return store().triggerCandidates.map((c) => c.triggerId);
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('M6.10 watcher classifier tags', () => {
  it('detects cast-watcher / etb-other / death-other / attack-watcher', () => {
    expect(tagIds(creature('niv', 'Whenever a player casts a spell, deal 1 damage.'))).toContain('trigger.cast-watcher');
    expect(tagIds(creature('mage', 'Magecraft — Whenever you cast or copy an instant or sorcery spell, scry 1.'))).toContain('trigger.cast-watcher');
    expect(tagIds(creature('soul', 'Whenever another creature enters, you gain 1 life.'))).toContain('trigger.etb-other');
    expect(tagIds(creature('blood', 'Whenever Blood Artist or another creature dies, you gain 1 life.'))).toContain('trigger.death-other');
    expect(tagIds(creature('chain', 'Whenever a nontoken creature you control attacks, exile it.'))).toContain('trigger.attack-watcher');
  });

  it('does NOT fire watcher tags on self-type triggers or vanilla', () => {
    const sunTitan = tagIds(creature('sun', 'Whenever Sun Titan enters or attacks, return a card from your graveyard.'));
    expect(sunTitan).not.toContain('trigger.etb-other');
    expect(sunTitan).not.toContain('trigger.attack-watcher');
    const selfDies = tagIds(creature('self', 'When this creature dies, draw a card.'));
    expect(selfDies).not.toContain('trigger.death-other');
    const vanilla = tagIds(creature('bear', 'Vanilla.'));
    expect(vanilla).not.toContain('trigger.cast-watcher');
  });
});

describe('M6.10 trigger-candidate detection', () => {
  it('attack declaration surfaces the attacker (trigger.attack)', () => {
    const atk = creature('atk', 'Whenever this creature attacks, draw a card.');
    store().newGame([{ def: atk, isCommander: false }, ...makeDeck(10)], 3);
    const id = instByDef('atk');
    store().moveCard(id, 'battlefield');
    store().declareAttack([id], '対戦相手');
    expect(candidateTriggerIds()).toContain('trigger.attack');
    expect(store().triggerCandidates.some((c) => c.sourceId === id && c.triggerId === 'trigger.attack')).toBe(true);
  });

  it('casting a spell surfaces a cast-watcher permanent', () => {
    const niv = creature('niv', 'Whenever a player casts a spell, deal 1 damage.');
    const spell = makeDef({
      scryfallId: 'bolt',
      typeLine: 'Instant',
      faces: [{ name: 'bolt', typeLine: 'Instant', oracleText: 'Deal 3 damage.' }],
    });
    store().newGame([{ def: niv, isCommander: false }, { def: spell, isCommander: false }, ...makeDeck(10)], 7);
    const nivId = instByDef('niv');
    store().moveCard(nivId, 'battlefield');
    const spellId = instByDef('bolt');
    store().moveCard(spellId, 'hand');
    store().castToStack(spellId, { force: true });
    expect(store().triggerCandidates.some((c) => c.sourceId === nivId && c.triggerId === 'trigger.cast-watcher')).toBe(true);
  });

  it('another creature entering surfaces an etb-other watcher', () => {
    const warden = creature('warden', 'Whenever another creature enters, you gain 1 life.');
    const vanilla = creature('vanilla', 'Vanilla.');
    store().newGame([{ def: warden, isCommander: false }, { def: vanilla, isCommander: false }, ...makeDeck(10)], 7);
    const wardenId = instByDef('warden');
    store().moveCard(wardenId, 'battlefield');
    const vanillaId = instByDef('vanilla');
    store().moveCard(vanillaId, 'battlefield');
    expect(store().triggerCandidates.some((c) => c.sourceId === wardenId && c.triggerId === 'trigger.etb-other')).toBe(true);
  });

  it('another creature dying surfaces a death-other watcher; undo clears candidates', () => {
    const artist = creature('artist', 'Whenever Artist or another creature dies, you gain 1 life.');
    const vanilla = creature('vanilla', 'Vanilla.');
    store().newGame([{ def: artist, isCommander: false }, { def: vanilla, isCommander: false }, ...makeDeck(10)], 7);
    const artistId = instByDef('artist');
    const vanillaId = instByDef('vanilla');
    store().moveCard(artistId, 'battlefield');
    store().moveCard(vanillaId, 'battlefield');
    store().moveCard(vanillaId, 'graveyard'); // dies
    expect(store().triggerCandidates.some((c) => c.sourceId === artistId && c.triggerId === 'trigger.death-other')).toBe(true);
    store().undo();
    expect(store().triggerCandidates).toEqual([]); // forward-only: undo clears
  });
});
