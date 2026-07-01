import { describe, expect, it } from 'vitest';

import { advanceToPriority, apnapPlayerOrder, orderPendingTriggersApnap } from '../priority';
import type {
  CardInstance,
  GameState,
  PendingRuleChoice,
  PendingTrigger,
  PlayerId,
  TriggerStackPlacementBucket,
  ZoneId,
} from '../types';
import { makeDef } from './helpers';

function pendingTrigger(
  pendingTriggerId: string,
  controllerId: PlayerId,
  stackPlacementBucket: TriggerStackPlacementBucket = 'ordinary',
): PendingTrigger {
  return {
    pendingTriggerId,
    eventId: `event-${pendingTriggerId}`,
    simultaneousGroupId: `event-${pendingTriggerId}`,
    triggerId: 'trigger.etb',
    sourceId: `source-${pendingTriggerId}`,
    sourceObjectId: `source-${pendingTriggerId}:0`,
    sourceSnapshot: {
      physicalCardId: `source-${pendingTriggerId}`,
      objectId: `source-${pendingTriggerId}:0`,
      defId: `def-${pendingTriggerId}`,
      zone: 'battlefield',
      ownerId: 'P1',
      controllerId,
      isToken: false,
      isCommander: false,
      faceIndex: 0,
      tapped: false,
      counters: {},
      typeLine: 'Creature',
    },
    controllerId,
    label: `trigger ${pendingTriggerId}`,
    stackPlacementBucket,
  };
}

function emptyZones(): Record<ZoneId, string[]> {
  return {
    library: [],
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    command: [],
    stack: [],
  };
}

function stateWithPendingTriggers(
  pendingTriggers: PendingTrigger[],
  pendingRuleChoices: PendingRuleChoice[] = [],
): GameState {
  const zones = emptyZones();
  const cards: Record<string, CardInstance> = {};
  const defs = Object.fromEntries(
    pendingTriggers.map((trigger) => [
      trigger.sourceSnapshot.defId,
      makeDef({
        scryfallId: trigger.sourceSnapshot.defId,
        typeLine: trigger.sourceSnapshot.typeLine,
      }),
    ]),
  );

  for (const trigger of pendingTriggers) {
    cards[trigger.sourceId] = {
      id: trigger.sourceId,
      defId: trigger.sourceSnapshot.defId,
      zone: 'battlefield',
      ownerId: trigger.sourceSnapshot.ownerId,
      controllerId: trigger.controllerId,
      zoneChangeCounter: 0,
      tapped: false,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      damageMarked: 0,
      hasDeathtouchDamage: false,
      isToken: false,
      isCommander: false,
      enteredTurn: 1,
    };
    zones.battlefield.push(trigger.sourceId);
  }

  return {
    defs,
    cards,
    zones,
    commanders: [],
    effectsAuto: true,
    activePlayerId: 'P1',
    turn: 1,
    phase: 'main1',
    combat: null,
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderDamage: {},
    opponentLife: {},
    defeat: {},
    emptyLibraryDrawAttemptedSinceLastSba: {},
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    mulliganCount: 0,
    landsPlayedThisTurn: 0,
    spellsCastThisTurn: 0,
    drawnThisTurn: 0,
    eventLog: [],
    pendingTriggers,
    pendingRuleChoices,
    pendingSbaChoices: [],
    log: [],
  };
}

describe('APNAP pending trigger ordering', () => {
  it('rotates turn order from the active player', () => {
    expect(apnapPlayerOrder('P1')).toEqual(['P1', 'OPPONENT_A']);
    expect(apnapPlayerOrder('OPPONENT_A')).toEqual(['OPPONENT_A', 'P1']);
  });

  it('orders controller groups by APNAP while preserving each controller choice order', () => {
    const p1a = pendingTrigger('p1-a', 'P1');
    const p1b = pendingTrigger('p1-b', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    const result = orderPendingTriggersApnap(
      [p1a, p1b, opponent],
      ['opponent', 'p1-b', 'p1-a'],
      'P1',
    );

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: ['p1-b', 'p1-a', 'opponent'],
    });
  });

  it('normalizes explicit choices to ordinary bucket before ability-triggered bucket', () => {
    const ordinary = pendingTrigger('ordinary', 'P1', 'ordinary');
    const abilityTriggered = pendingTrigger('ability-triggered', 'P1', 'ability-triggered');

    const result = orderPendingTriggersApnap(
      [ordinary, abilityTriggered],
      ['ability-triggered', 'ordinary'],
      'P1',
    );

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: ['ordinary', 'ability-triggered'],
    });
  });

  it('applies APNAP independently inside each 603.3b bucket', () => {
    const p1Ordinary = pendingTrigger('p1-ordinary', 'P1', 'ordinary');
    const opponentOrdinary = pendingTrigger('opponent-ordinary', 'OPPONENT_A', 'ordinary');
    const p1AbilityTriggered = pendingTrigger('p1-ability-triggered', 'P1', 'ability-triggered');
    const opponentAbilityTriggered = pendingTrigger(
      'opponent-ability-triggered',
      'OPPONENT_A',
      'ability-triggered',
    );

    const result = orderPendingTriggersApnap(
      [p1Ordinary, opponentOrdinary, p1AbilityTriggered, opponentAbilityTriggered],
      ['opponent-ability-triggered', 'p1-ability-triggered', 'opponent-ordinary', 'p1-ordinary'],
      'P1',
    );

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: [
        'p1-ordinary',
        'opponent-ordinary',
        'p1-ability-triggered',
        'opponent-ability-triggered',
      ],
    });
  });

  it('uses the current active player as the first APNAP group', () => {
    const p1 = pendingTrigger('p1', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    const result = orderPendingTriggersApnap([p1, opponent], ['p1', 'opponent'], 'OPPONENT_A');

    expect(result).toEqual({
      status: 'ordered',
      orderedIds: ['opponent', 'p1'],
    });
  });

  it('rejects incomplete, duplicate, or unknown explicit choices', () => {
    const p1 = pendingTrigger('p1', 'P1');
    const opponent = pendingTrigger('opponent', 'OPPONENT_A');

    expect(orderPendingTriggersApnap([p1, opponent], ['p1'], 'P1')).toMatchObject({
      status: 'incomplete',
      missingIds: ['opponent'],
    });
    expect(orderPendingTriggersApnap([p1, opponent], ['p1', 'p1', 'opponent'], 'P1')).toMatchObject(
      {
        status: 'incomplete',
        duplicateIds: ['p1'],
      },
    );
    expect(orderPendingTriggersApnap([p1, opponent], ['p1', 'unknown'], 'P1')).toMatchObject({
      status: 'incomplete',
      missingIds: ['opponent'],
      unknownIds: ['unknown'],
    });
  });
});

describe('priority fixed-point loop', () => {
  it('stops before priority when a rule choice is pending', () => {
    const pending = pendingTrigger('p1', 'P1');
    const choice: PendingRuleChoice = {
      choiceId: 'choice-1',
      kind: 'legend-rule',
      ruleRef: '704.5j',
      controllerId: 'P1',
      name: 'Shared Legend',
      cardIds: [pending.sourceId],
    };

    const result = advanceToPriority(stateWithPendingTriggers([pending], [choice]));

    expect(result.status).toBe('choice-required');
    expect(result.state.pendingTriggers).toHaveLength(1);
    expect(result.state.zones.stack).toEqual([]);
  });

  it('stops for trigger order when a controller has multiple choices in the same bucket', () => {
    const first = pendingTrigger('first', 'P1');
    const second = pendingTrigger('second', 'P1');

    const result = advanceToPriority(stateWithPendingTriggers([first, second]));

    expect(result.status).toBe('trigger-order-required');
    expect(result.state.pendingTriggers.map((trigger) => trigger.pendingTriggerId)).toEqual([
      'first',
      'second',
    ]);
    expect(result.state.zones.stack).toEqual([]);
  });

  it('places deterministic pending triggers and reaches priority-ready', () => {
    const pending = pendingTrigger('ready', 'P1');

    const result = advanceToPriority(stateWithPendingTriggers([pending]));

    expect(result.status).toBe('priority-ready');
    expect(result.state.pendingTriggers).toEqual([]);
    expect(result.state.zones.stack).toHaveLength(1);
    const abilityId = result.state.zones.stack[0];
    expect(result.state.cards[abilityId]).toMatchObject({
      isAbility: true,
      sourceId: pending.sourceId,
      abilityKind: 'triggered',
    });
  });
});
