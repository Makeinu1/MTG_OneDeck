import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { GameState, PendingSbaChoice } from '../../engine/types';
import { useGameStore } from '../gameStore';

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

describe('rule choices', () => {
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
    localStorage.clear();
  });

  it('cr-commander-9039a-rule-choice: restores legacy SBA choices into pending rule choices and resolves to command', () => {
    const commander = makeDef({
      scryfallId: 'rule-choice-commander',
      printedName: '選択統率者',
      typeLine: 'Legendary Creature',
      faces: [
        {
          name: 'Rule Choice Commander',
          printedName: '選択統率者',
          typeLine: 'Legendary Creature',
          oracleText: 'When Rule Choice Commander dies, draw a card.',
        },
      ],
    });
    const deck = makeDeck(12, [commander]);
    store().newGame(deck, 1);
    const commanderId = snap().commanders[0].cardId;
    store().moveCard(commanderId, 'battlefield');
    store().moveCard(commanderId, 'graveyard');

    const graveyardEvent = snap().eventLog.find(
      (event) =>
        event.physicalCardId === commanderId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard',
    );
    expect(graveyardEvent).toBeDefined();

    const legacyChoice: PendingSbaChoice = {
      choiceId: `${graveyardEvent?.eventId}:903.9a:${commanderId}`,
      kind: 'commander-zone',
      ruleRef: '903.9a',
      cardId: commanderId,
      fromZone: 'graveyard',
      toZone: 'command',
      eventId: graveyardEvent?.eventId as string,
      sourceObjectId: (graveyardEvent?.after?.objectId ?? graveyardEvent?.oldObjectId) as string,
      controllerId: 'P1',
    };
    const legacyState = { ...snap(), pendingSbaChoices: [legacyChoice] } as Partial<GameState>;
    delete legacyState.pendingRuleChoices;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck,
      autoAdvanceToMain: store().autoAdvanceToMain,
    };

    store().restoreGame(snapshot);

    expect(snap().pendingSbaChoices).toEqual([]);
    expect(snap().pendingRuleChoices).toEqual([legacyChoice]);

    store().resolveRuleChoice(legacyChoice.choiceId, {
      kind: 'commander-zone',
      toCommandZone: true,
    });

    expect(snap().pendingRuleChoices).toEqual([]);
    expect(snap().cards[commanderId].zone).toBe('command');
    expect(snap().zones.command).toContain(commanderId);
    expect(snap().zones.graveyard).not.toContain(commanderId);
    expect(
      snap().eventLog.some(
        (event) =>
          event.physicalCardId === commanderId &&
          event.fromZone === 'graveyard' &&
          event.toZone === 'command' &&
          event.reason === 'sba' &&
          event.sbaApplied === '903.9a',
      ),
    ).toBe(true);
  });

  it('cr-legend-rule-choice: creates a pending choice and puts unchosen legends into the graveyard', () => {
    const firstLegend = makeDef({
      scryfallId: 'rule-choice-legend-a',
      name: 'Shared Legend',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'Shared Legend', typeLine: 'Legendary Creature' }],
    });
    const secondLegend = makeDef({
      scryfallId: 'rule-choice-legend-b',
      name: 'Shared Legend',
      typeLine: 'Legendary Creature',
      faces: [
        {
          name: 'Shared Legend',
          typeLine: 'Legendary Creature',
          oracleText: 'When Shared Legend dies, draw a card.',
        },
      ],
    });
    store().newGame(
      [
        { def: firstLegend, isCommander: false },
        { def: secondLegend, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const firstId = findInstanceId(firstLegend.scryfallId);
    const secondId = findInstanceId(secondLegend.scryfallId);

    store().moveCard(firstId, 'battlefield');
    store().moveCard(secondId, 'battlefield');

    const choice = snap().pendingRuleChoices[0];
    expect(choice).toMatchObject({
      kind: 'legend-rule',
      ruleRef: '704.5j',
      controllerId: 'P1',
      name: 'Shared Legend',
      cardIds: [firstId, secondId].sort(),
    });
    expect(snap().zones.battlefield).toEqual(expect.arrayContaining([firstId, secondId]));

    store().resolveRuleChoice(choice.choiceId, {
      kind: 'legend-rule',
      keepCardId: firstId,
    });

    expect(snap().pendingRuleChoices).toEqual([]);
    expect(snap().cards[firstId].zone).toBe('battlefield');
    expect(snap().cards[secondId].zone).toBe('graveyard');
    expect(
      snap().eventLog.some(
        (event) =>
          event.physicalCardId === secondId &&
          event.toZone === 'graveyard' &&
          event.reason === 'sba' &&
          event.sbaApplied === '704.5j',
      ),
    ).toBe(true);
    expect(snap().pendingTriggers).toMatchObject([
      {
        sourceId: secondId,
        triggerId: 'trigger.death',
        label: '死亡したとき: 《Shared Legend》',
      },
    ]);
  });

  it('keeps priority boundary blocked while a pending rule choice exists', () => {
    const keptLegend = makeDef({
      scryfallId: 'rule-choice-priority-a',
      name: 'Priority Legend',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'Priority Legend', typeLine: 'Legendary Creature' }],
    });
    const entrantLegend = makeDef({
      scryfallId: 'rule-choice-priority-b',
      name: 'Priority Legend',
      typeLine: 'Legendary Creature',
      faces: [
        {
          name: 'Priority Legend',
          typeLine: 'Legendary Creature',
          oracleText: 'When Priority Legend enters, draw a card.',
        },
      ],
    });
    store().newGame(
      [
        { def: keptLegend, isCommander: false },
        { def: entrantLegend, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const keptId = findInstanceId(keptLegend.scryfallId);
    const entrantId = findInstanceId(entrantLegend.scryfallId);

    store().moveCard(keptId, 'battlefield');
    store().moveCard(entrantId, 'battlefield');

    const pendingTriggerId = snap().pendingTriggers[0]?.pendingTriggerId;
    if (pendingTriggerId === undefined) {
      throw new Error('pending trigger was not created');
    }
    expect(snap().pendingRuleChoices).toHaveLength(1);

    store().placePendingTriggersForPriority([pendingTriggerId]);

    expect(snap().pendingTriggers).toHaveLength(1);
    expect(snap().zones.stack).toHaveLength(0);
    expect(store().warnings).toContain(
      '優先権前に解決するルール選択が残っています。先に pending rule choice を解決してください。',
    );
  });
});
