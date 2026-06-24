import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState } from '../../engine/types';
import type { CardDef } from '../../types/card';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) {
    throw new Error('game state is not available');
  }
  return state;
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [
      ...defs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(Math.max(0, 20 - defs.length)),
    ],
    1,
  );
  store().keepOpeningHand();
}

function moveToHand(cardId: string): void {
  const card = snap().cards[cardId];
  if (!card) {
    throw new Error(`card instance not found for ${cardId}`);
  }
  if (card.zone !== 'hand') {
    store().moveCard(cardId, 'hand');
  }
}

describe('trigger candidates', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('shows an ETB candidate without changing the GameState shape', () => {
    const etb = makeDef({
      scryfallId: 'candidate-etb',
      printedName: '入場する熊',
      faces: [
        {
          name: 'Candidate Bear',
          printedName: '入場する熊',
          typeLine: 'Creature',
          oracleText: 'When Candidate Bear enters, draw a card.',
        },
      ],
    });
    startGameWith([etb]);
    const sourceId = findInstanceId(etb.scryfallId);

    store().moveCard(sourceId, 'battlefield');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId,
        triggerId: 'trigger.etb',
        label: '戦場に出たとき: 《入場する熊》',
      },
    ]);
    expect(Object.prototype.hasOwnProperty.call(snap(), 'triggerCandidates')).toBe(false);
  });

  it('clears candidates on undo and redo instead of re-detecting them', () => {
    const etb = makeDef({
      scryfallId: 'candidate-undo-etb',
      faces: [
        {
          name: 'Candidate Undo',
          typeLine: 'Creature',
          oracleText: 'When Candidate Undo enters, draw a card.',
        },
      ],
    });
    startGameWith([etb]);
    const sourceId = findInstanceId(etb.scryfallId);

    store().moveCard(sourceId, 'battlefield');
    expect(store().triggerCandidates).toHaveLength(1);

    store().undo();
    expect(store().triggerCandidates).toEqual([]);

    store().redo();
    expect(store().triggerCandidates).toEqual([]);
    expect(snap().zones.battlefield).toContain(sourceId);
  });

  it('removes that source candidate when a triggered ability is added to the stack', () => {
    const etb = makeDef({
      scryfallId: 'candidate-stack-etb',
      faces: [
        {
          name: 'Candidate Stack',
          typeLine: 'Creature',
          oracleText: 'When Candidate Stack enters, draw a card.',
        },
      ],
    });
    startGameWith([etb]);
    const sourceId = findInstanceId(etb.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().addAbilityToStack(sourceId, 'triggered');

    expect(store().triggerCandidates).toEqual([]);
    expect(snap().zones.stack).toHaveLength(1);
    const abilityId = snap().zones.stack[0];
    expect(snap().cards[abilityId]?.sourceId).toBe(sourceId);
    expect(snap().cards[abilityId]?.abilityKind).toBe('triggered');
  });

  it('dismisses candidates without changing the board state', () => {
    const etb = makeDef({
      scryfallId: 'candidate-dismiss-etb',
      faces: [
        {
          name: 'Candidate Dismiss',
          typeLine: 'Creature',
          oracleText: 'When Candidate Dismiss enters, draw a card.',
        },
      ],
    });
    startGameWith([etb]);
    const sourceId = findInstanceId(etb.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    const beforeDismiss = snap();

    store().dismissTriggerCandidates();

    expect(store().triggerCandidates).toEqual([]);
    expect(snap()).toBe(beforeDismiss);
  });

  it('shows landfall candidates for battlefield permanents after a land play', () => {
    const landfall = makeDef({
      scryfallId: 'candidate-landfall',
      faces: [
        {
          name: 'Candidate Landfall',
          typeLine: 'Creature',
          oracleText: 'Landfall — Whenever a land enters under your control, proliferate.',
        },
      ],
    });
    const land = makeDef({
      scryfallId: 'candidate-land',
      typeLine: 'Basic Land',
      faces: [{ name: 'Candidate Land', typeLine: 'Basic Land' }],
    });
    startGameWith([landfall, land]);
    const landfallId = findInstanceId(landfall.scryfallId);
    const landId = findInstanceId(land.scryfallId);
    store().moveCard(landfallId, 'battlefield');
    moveToHand(landId);

    const result = store().playLand(landId);

    expect(result).toBe('ok');
    expect(store().triggerCandidates).toEqual([
      {
        sourceId: landfallId,
        triggerId: 'trigger.landfall',
        label: '上陸: 《Candidate Landfall》',
      },
    ]);
  });

  it('shows death candidates for cards moved from battlefield to graveyard', () => {
    const death = makeDef({
      scryfallId: 'candidate-death',
      printedName: '死亡する熊',
      faces: [
        {
          name: 'Candidate Death',
          printedName: '死亡する熊',
          typeLine: 'Creature',
          oracleText: 'When Candidate Death dies, draw a card.',
        },
      ],
    });
    startGameWith([death]);
    const sourceId = findInstanceId(death.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().moveCard(sourceId, 'graveyard');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId,
        triggerId: 'trigger.death',
        label: '死亡したとき: 《死亡する熊》',
      },
    ]);
  });

  it('shows leaves candidates for noncreatures moved from battlefield to graveyard', () => {
    const leaves = makeDef({
      scryfallId: 'candidate-leaves',
      printedName: '墓地へ落ちる星',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'Candidate Star',
          printedName: '墓地へ落ちる星',
          typeLine: 'Artifact',
          oracleText:
            'When Candidate Star is put into a graveyard from the battlefield, draw a card.',
        },
      ],
    });
    startGameWith([leaves]);
    const sourceId = findInstanceId(leaves.scryfallId);
    store().moveCard(sourceId, 'battlefield');

    store().moveCard(sourceId, 'graveyard');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId,
        triggerId: 'trigger.leaves',
        label: '戦場を離れたとき: 《墓地へ落ちる星》',
      },
    ]);
  });

  it('shows attack candidates for declared attackers and battlefield watchers', () => {
    const attacker = makeDef({
      scryfallId: 'candidate-attack',
      faces: [
        {
          name: 'Attack Candidate',
          typeLine: 'Creature',
          oracleText: 'Whenever Attack Candidate attacks, draw a card.',
          power: '2',
          toughness: '2',
        },
      ],
    });
    const watcher = makeDef({
      scryfallId: 'candidate-attack-watcher',
      faces: [
        {
          name: 'Attack Watcher',
          typeLine: 'Creature',
          oracleText: 'Whenever another creature attacks, draw a card.',
        },
      ],
    });
    startGameWith([attacker, watcher]);
    const attackerId = findInstanceId(attacker.scryfallId);
    const watcherId = findInstanceId(watcher.scryfallId);
    store().moveCard(attackerId, 'battlefield');
    store().moveCard(watcherId, 'battlefield');

    store().declareAttack([attackerId], '対戦相手A');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId: attackerId,
        triggerId: 'trigger.attack',
        label: '攻撃したとき: 《Attack Candidate》',
      },
      {
        sourceId: watcherId,
        triggerId: 'trigger.attack-watcher',
        label: 'クリーチャー攻撃時: 《Attack Watcher》',
      },
    ]);

    store().undo();
    expect(store().triggerCandidates).toEqual([]);

    store().redo();
    expect(store().triggerCandidates).toEqual([]);
  });

  it('shows ETB watcher candidates for permanents already on the battlefield', () => {
    const watcher = makeDef({
      scryfallId: 'candidate-etb-watcher',
      faces: [
        {
          name: 'Soul Warden',
          typeLine: 'Creature',
          oracleText: 'Whenever another creature enters the battlefield, you gain 1 life.',
        },
      ],
    });
    const creature = makeDef({
      scryfallId: 'candidate-etb-victim',
      faces: [{ name: 'Entering Creature', typeLine: 'Creature' }],
    });
    startGameWith([watcher, creature]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const creatureId = findInstanceId(creature.scryfallId);
    store().moveCard(watcherId, 'battlefield');

    store().moveCard(creatureId, 'battlefield');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId: watcherId,
        triggerId: 'trigger.etb-other',
        label: '他が戦場に出たとき: 《Soul Warden》',
      },
    ]);
  });

  it('shows death watcher candidates for battlefield permanents', () => {
    const watcher = makeDef({
      scryfallId: 'candidate-death-watcher',
      faces: [
        {
          name: 'Blood Artist',
          typeLine: 'Creature',
          oracleText:
            'Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.',
        },
      ],
    });
    const creature = makeDef({
      scryfallId: 'candidate-death-victim',
      faces: [{ name: 'Dying Creature', typeLine: 'Creature' }],
    });
    startGameWith([watcher, creature]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const creatureId = findInstanceId(creature.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(creatureId, 'battlefield');

    store().moveCard(creatureId, 'graveyard');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId: watcherId,
        triggerId: 'trigger.death-other',
        label: '他の死亡時: 《Blood Artist》',
      },
    ]);
  });

  it('shows leaves watcher candidates for battlefield permanents', () => {
    const watcher = makeDef({
      scryfallId: 'candidate-leaves-watcher',
      faces: [
        {
          name: 'Artifact Watcher',
          typeLine: 'Creature',
          oracleText:
            'Whenever an artifact you control is put into a graveyard from the battlefield, draw a card.',
        },
      ],
    });
    const artifact = makeDef({
      scryfallId: 'candidate-leaves-victim',
      typeLine: 'Artifact',
      faces: [{ name: 'Departing Artifact', typeLine: 'Artifact' }],
    });
    startGameWith([watcher, artifact]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const artifactId = findInstanceId(artifact.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    store().moveCard(artifactId, 'battlefield');

    store().moveCard(artifactId, 'graveyard');

    expect(store().triggerCandidates).toEqual([
      {
        sourceId: watcherId,
        triggerId: 'trigger.leaves-other',
        label: '他が戦場を離れたとき: 《Artifact Watcher》',
      },
    ]);
  });

  it('shows cast watcher candidates for battlefield permanents', () => {
    const watcher = makeDef({
      scryfallId: 'candidate-cast-watcher',
      faces: [
        {
          name: 'Niv-Mizzet Watcher',
          typeLine: 'Creature',
          oracleText: 'Whenever a player casts a spell, Niv-Mizzet Watcher deals 1 damage.',
        },
      ],
    });
    const spell = makeDef({
      scryfallId: 'candidate-cast-spell',
      typeLine: 'Instant',
      faces: [{ name: 'Watched Spell', typeLine: 'Instant' }],
    });
    startGameWith([watcher, spell]);
    const watcherId = findInstanceId(watcher.scryfallId);
    const spellId = findInstanceId(spell.scryfallId);
    store().moveCard(watcherId, 'battlefield');
    moveToHand(spellId);

    const result = store().castToStack(spellId);

    expect(result).toBe('ok');
    expect(store().triggerCandidates).toEqual([
      {
        sourceId: watcherId,
        triggerId: 'trigger.cast-watcher',
        label: '呪文を唱えるたび: 《Niv-Mizzet Watcher》',
      },
    ]);
  });
});
