import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { objectIdOf } from '../../engine/types';
import type { ZoneChangeEvent } from '../../engine/types';
import { useGameStore } from '../gameStore';

interface CrGoldenCase {
  id: string;
  crRefs: string[];
}

interface CrGoldenCasesDoc {
  crVersion: string;
  cases: CrGoldenCase[];
}

const rawGoldenModules = import.meta.glob('../../../research/cr-grounding/golden-cases.json', {
  eager: true,
  import: 'default',
});
const goldenDoc = Object.values(rawGoldenModules)[0] as CrGoldenCasesDoc;

function store() {
  return useGameStore.getState();
}

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
  localStorage.clear();
}

function goldenCase(id: string, requiredCrRefs: string[]): CrGoldenCase {
  const testCase = goldenDoc.cases.find((entry) => entry.id === id);
  expect(testCase, `${id} exists in research/cr-grounding/golden-cases.json`).toBeDefined();
  expect(testCase?.crRefs).toEqual(expect.arrayContaining(requiredCrRefs));
  return testCase as CrGoldenCase;
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

describe('CR grounding golden cases executable subset (Z5)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('cr-token-dies-before-ceases: token move event is recorded before CR 704.5d token-cease SBA', () => {
    goldenCase('cr-token-dies-before-ceases', ['111.7', '704.5d', '603.6c', '117.5']);

    const death = makeDef({
      scryfallId: 'gold-token-death',
      printedName: '黄金死亡トークン',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Token Death',
          printedName: '黄金死亡トークン',
          typeLine: 'Creature',
          oracleText: 'When Golden Token Death dies, draw a card.',
        },
      ],
    });
    store().newGame([{ def: death, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId(death.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().copyPermanent(sourceId, 1);
    const tokenId = Object.values(store().state?.cards ?? {}).find((card) => card.isToken)?.id;
    expect(tokenId).toBeDefined();
    const stackDepthBefore = store().state?.zones.stack.length;

    store().moveCard(tokenId as string, 'graveyard');

    const state = store().state;
    expect(state?.cards[tokenId as string]).toBeUndefined();
    expect(state?.zones.graveyard).not.toContain(tokenId);
    expect(state?.zones.stack.length).toBe(stackDepthBefore);

    const moveEvent = state?.eventLog.find(
      (event): event is ZoneChangeEvent =>
        event.type === 'zoneChange' &&
        event.physicalCardId === tokenId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard'
    );
    const ceaseEvent = state?.eventLog.find(
      (event): event is ZoneChangeEvent =>
        event.type === 'zoneChange' &&
        event.physicalCardId === tokenId &&
        event.reason === 'token-cease'
    );
    expect(moveEvent).toBeDefined();
    expect(ceaseEvent).toMatchObject({
      fromZone: 'graveyard',
      toZone: undefined,
      sbaApplied: '704.5d',
    });
    expect((moveEvent?.sequence ?? 0) < (ceaseEvent?.sequence ?? 0)).toBe(true);

    const pending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === tokenId && trigger.triggerId === 'trigger.death'
    );
    expect(pending).toMatchObject({
      eventId: moveEvent?.eventId,
      simultaneousGroupId: moveEvent?.eventId,
      controllerId: 'P1',
      sourceObjectId: moveEvent?.before.objectId,
      sourceSnapshot: {
        physicalCardId: tokenId,
        objectId: moveEvent?.before.objectId,
        zone: 'battlefield',
        isToken: true,
      },
    });

    const pendingTriggerId = pending?.pendingTriggerId;
    expect(pendingTriggerId).toBeDefined();
    store().putPendingTriggerOnStack(pendingTriggerId as string);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);
    expect(stacked?.zones.stack).toHaveLength(1);
    const abilityId = stacked?.zones.stack[0];
    expect(stacked?.cards[abilityId as string]).toMatchObject({
      isAbility: true,
      sourceId: tokenId,
      defId: death.scryfallId,
      abilityKind: 'triggered',
    });
    expect(stacked?.cards[tokenId as string]).toBeUndefined();
  });

  it('cr-sba-copy-ceases-outside-stack: CR 704.5e removes a copy left outside the stack', () => {
    goldenCase('cr-sba-copy-ceases-outside-stack', ['704.5e', '707.10a']);

    const spell = makeDef({
      scryfallId: 'gold-sba-copy-cease',
      printedName: '黄金コピー呪文',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'Golden Copy Spell',
          printedName: '黄金コピー呪文',
          typeLine: 'Sorcery',
          oracleText: 'Draw a card.',
        },
      ],
    });
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const spellId = findInstanceId(spell.scryfallId);
    store().moveCard(spellId, 'stack');
    store().copyStackItem(spellId);
    const copyId = Object.values(store().state?.cards ?? {}).find((card) => card.isCopy)?.id;
    expect(copyId).toBeDefined();

    const stateWithInvalidCopy = store().state!;
    useGameStore.setState({
      state: {
        ...stateWithInvalidCopy,
        cards: {
          ...stateWithInvalidCopy.cards,
          [copyId as string]: {
            ...stateWithInvalidCopy.cards[copyId as string],
            zone: 'hand',
          },
        },
        zones: {
          ...stateWithInvalidCopy.zones,
          stack: stateWithInvalidCopy.zones.stack.filter((id) => id !== copyId),
          hand: [...stateWithInvalidCopy.zones.hand, copyId as string],
        },
      },
    });

    store().dispatch({ type: 'adjustLife', delta: 0 });

    const state = store().state;
    expect(state?.cards[copyId as string]).toBeUndefined();
    expect(state?.zones.hand).not.toContain(copyId);
    expect(state?.zones.stack).not.toContain(copyId);
    expect(
      state?.eventLog.some((event) =>
        event.physicalCardId === copyId &&
        event.fromZone === 'hand' &&
        event.toZone === undefined &&
        event.reason === 'copy-cease' &&
        event.sbaApplied === '704.5e'
      ),
    ).toBe(true);
  });

  it('cr-trigger-sba-priority-loop: zone-change triggers become pending, not direct stack items', () => {
    goldenCase('cr-trigger-sba-priority-loop', ['117.5', '603.3', '603.3b', '704.3']);

    const etb = makeDef({
      scryfallId: 'gold-etb-pending',
      printedName: '黄金入場',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden ETB',
          printedName: '黄金入場',
          typeLine: 'Creature',
          oracleText: 'When Golden ETB enters, draw a card.',
        },
      ],
    });
    store().newGame([{ def: etb, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId(etb.scryfallId);
    const stackDepthBefore = store().state?.zones.stack.length;

    store().moveCard(sourceId, 'battlefield');

    const state = store().state;
    const entryEvent = state?.eventLog.find(
      (event) =>
        event.physicalCardId === sourceId &&
        event.fromZone !== 'battlefield' &&
        event.toZone === 'battlefield'
    );
    expect(entryEvent).toBeDefined();
    expect(state?.zones.stack.length).toBe(stackDepthBefore);
    expect(state?.pendingTriggers).toMatchObject([
      {
        eventId: entryEvent?.eventId,
        simultaneousGroupId: entryEvent?.eventId,
        controllerId: 'P1',
        sourceId,
        triggerId: 'trigger.etb',
        label: '戦場に出たとき: 《黄金入場》',
      },
    ]);
    expect(store().triggerCandidates).toEqual([
      {
        sourceId,
        triggerId: 'trigger.etb',
        label: '戦場に出たとき: 《黄金入場》',
      },
    ]);

    const pendingTriggerId = state?.pendingTriggers[0]?.pendingTriggerId;
    expect(pendingTriggerId).toBeDefined();
    store().putPendingTriggerOnStack(pendingTriggerId as string);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    expect(stacked?.zones.stack.length).toBe((stackDepthBefore ?? 0) + 1);
    expect(stacked?.cards[stacked.zones.stack[0]]).toMatchObject({
      isAbility: true,
      sourceId,
      defId: etb.scryfallId,
      abilityKind: 'triggered',
    });
  });

  it('cr-trigger-sba-priority-loop: explicitly ordered pending triggers are placed on stack as one priority-boundary batch', () => {
    goldenCase('cr-trigger-sba-priority-loop', ['117.5', '603.3', '603.3b', '704.3']);

    const watcher = makeDef({
      scryfallId: 'gold-etb-watcher',
      printedName: '黄金監視者',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Watcher',
          printedName: '黄金監視者',
          typeLine: 'Creature',
          oracleText: 'Whenever another creature enters the battlefield, you gain 1 life.',
        },
      ],
    });
    const entrant = makeDef({
      scryfallId: 'gold-etb-entrant',
      printedName: '黄金入場者',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Entrant',
          printedName: '黄金入場者',
          typeLine: 'Creature',
          oracleText: 'When Golden Entrant enters, draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: watcher, isCommander: false },
        { def: entrant, isCommander: false },
        ...makeDeck(12),
      ],
      1
    );
    const watcherId = findInstanceId(watcher.scryfallId);
    const entrantId = findInstanceId(entrant.scryfallId);

    store().moveCard(watcherId, 'battlefield');
    expect(store().state?.pendingTriggers).toEqual([]);

    store().moveCard(entrantId, 'battlefield');

    const state = store().state;
    expect(state?.zones.stack).toHaveLength(0);
    expect(state?.pendingTriggers).toHaveLength(2);
    const entrantPending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === entrantId && trigger.triggerId === 'trigger.etb'
    );
    const watcherPending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === watcherId && trigger.triggerId === 'trigger.etb-other'
    );
    expect(entrantPending).toBeDefined();
    expect(watcherPending).toBeDefined();
    expect(entrantPending?.eventId).toBe(watcherPending?.eventId);
    expect(entrantPending).toMatchObject({
      simultaneousGroupId: entrantPending?.eventId,
      controllerId: 'P1',
    });
    expect(watcherPending).toMatchObject({
      simultaneousGroupId: entrantPending?.eventId,
      controllerId: 'P1',
    });

    store().placePendingTriggersForPriority([
      watcherPending?.pendingTriggerId as string,
      entrantPending?.pendingTriggerId as string,
    ]);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    expect(store().triggerCandidates).toEqual([]);
    expect(stacked?.zones.stack).toHaveLength(2);
    const [lowerAbilityId, topAbilityId] = stacked?.zones.stack ?? [];
    expect(stacked?.cards[lowerAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: watcherId,
      defId: watcher.scryfallId,
      abilityKind: 'triggered',
    });
    expect(stacked?.cards[topAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: entrantId,
      defId: entrant.scryfallId,
      abilityKind: 'triggered',
    });
  });

  it('cr-trigger-sba-priority-loop: mixed-controller pending triggers are stacked in APNAP order', () => {
    goldenCase('cr-trigger-sba-priority-loop', ['117.5', '603.3', '603.3b', '704.3']);

    const p1Etb = makeDef({
      scryfallId: 'gold-apnap-p1',
      printedName: '黄金APNAP能動',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden APNAP Active',
          printedName: '黄金APNAP能動',
          typeLine: 'Creature',
          oracleText: 'When Golden APNAP Active enters, draw a card.',
        },
      ],
    });
    const opponentEtb = makeDef({
      scryfallId: 'gold-apnap-opponent',
      printedName: '黄金APNAP非能動',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden APNAP Nonactive',
          printedName: '黄金APNAP非能動',
          typeLine: 'Creature',
          oracleText: 'When Golden APNAP Nonactive enters, draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: p1Etb, isCommander: false },
        { def: opponentEtb, isCommander: false },
        ...makeDeck(12),
      ],
      1
    );
    const p1SourceId = findInstanceId(p1Etb.scryfallId);
    const opponentSourceId = findInstanceId(opponentEtb.scryfallId);

    store().moveCard(p1SourceId, 'battlefield');
    store().moveCard(opponentSourceId, 'battlefield');

    const state = store().state;
    const p1Pending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === p1SourceId
    );
    const opponentPending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === opponentSourceId
    );
    expect(p1Pending).toBeDefined();
    expect(opponentPending).toBeDefined();

    useGameStore.setState({
      state: {
        ...state!,
        activePlayerId: 'P1',
        pendingTriggers: state!.pendingTriggers.map((trigger) =>
          trigger.pendingTriggerId === opponentPending?.pendingTriggerId
            ? {
                ...trigger,
                controllerId: 'OPPONENT_A',
                sourceSnapshot: {
                  ...trigger.sourceSnapshot,
                  controllerId: 'OPPONENT_A',
                },
              }
            : trigger
        ),
      },
    });

    store().placePendingTriggersForPriority([
      opponentPending?.pendingTriggerId as string,
      p1Pending?.pendingTriggerId as string,
    ]);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    expect(stacked?.zones.stack).toHaveLength(2);
    const [lowerAbilityId, topAbilityId] = stacked?.zones.stack ?? [];
    expect(stacked?.cards[lowerAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: p1SourceId,
      controllerId: 'P1',
    });
    expect(stacked?.cards[topAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: opponentSourceId,
      controllerId: 'OPPONENT_A',
    });
  });

  it('cr-trigger-6033b-two-bucket-order: bucket boundary overrides explicit controller order', () => {
    goldenCase('cr-trigger-6033b-two-bucket-order', ['603.3b', '101.4']);

    const ordinaryDef = makeDef({
      scryfallId: 'gold-bucket-ordinary',
      printedName: '黄金通常誘発',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Ordinary Trigger',
          printedName: '黄金通常誘発',
          typeLine: 'Creature',
          oracleText: 'When Golden Ordinary Trigger enters, draw a card.',
        },
      ],
    });
    const abilityTriggeredDef = makeDef({
      scryfallId: 'gold-bucket-ability-triggered',
      printedName: '黄金能力誘発',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Ability-Triggered Trigger',
          printedName: '黄金能力誘発',
          typeLine: 'Creature',
          oracleText: 'When Golden Ability-Triggered Trigger enters, draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: ordinaryDef, isCommander: false },
        { def: abilityTriggeredDef, isCommander: false },
        ...makeDeck(12),
      ],
      1
    );
    const ordinaryId = findInstanceId(ordinaryDef.scryfallId);
    const abilityTriggeredId = findInstanceId(abilityTriggeredDef.scryfallId);

    store().moveCard(ordinaryId, 'battlefield');
    store().moveCard(abilityTriggeredId, 'battlefield');

    const state = store().state;
    const ordinaryPending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === ordinaryId
    );
    const abilityTriggeredPending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === abilityTriggeredId
    );
    expect(ordinaryPending).toBeDefined();
    expect(abilityTriggeredPending).toBeDefined();

    useGameStore.setState({
      state: {
        ...state!,
        pendingTriggers: state!.pendingTriggers.map((trigger) =>
          trigger.pendingTriggerId === abilityTriggeredPending?.pendingTriggerId
            ? { ...trigger, stackPlacementBucket: 'ability-triggered' }
            : { ...trigger, stackPlacementBucket: 'ordinary' }
        ),
      },
    });

    store().placePendingTriggersForPriority([
      abilityTriggeredPending?.pendingTriggerId as string,
      ordinaryPending?.pendingTriggerId as string,
    ]);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    const [ordinaryAbilityId, abilityTriggeredAbilityId] = stacked?.zones.stack ?? [];
    expect(stacked?.cards[ordinaryAbilityId]).toMatchObject({ sourceId: ordinaryId });
    expect(stacked?.cards[abilityTriggeredAbilityId]).toMatchObject({
      sourceId: abilityTriggeredId,
    });
  });

  it('cr-trigger-6033b-apnap-per-bucket: APNAP is applied independently inside each bucket', () => {
    goldenCase('cr-trigger-6033b-apnap-per-bucket', ['603.3b', '101.4']);

    const defs = [
      makeDef({
        scryfallId: 'gold-apnap-bucket-a',
        printedName: '黄金A',
        typeLine: 'Creature',
        faces: [
          {
            name: 'Golden Bucket Alpha',
            printedName: '黄金A',
            typeLine: 'Creature',
            oracleText: 'When Golden Bucket Alpha enters, draw a card.',
          },
        ],
      }),
      makeDef({
        scryfallId: 'gold-apnap-bucket-b',
        printedName: '黄金B',
        typeLine: 'Creature',
        faces: [
          {
            name: 'Golden Bucket B',
            printedName: '黄金B',
            typeLine: 'Creature',
            oracleText: 'When Golden Bucket B enters, draw a card.',
          },
        ],
      }),
      makeDef({
        scryfallId: 'gold-apnap-bucket-c',
        printedName: '黄金C',
        typeLine: 'Creature',
        faces: [
          {
            name: 'Golden Bucket C',
            printedName: '黄金C',
            typeLine: 'Creature',
            oracleText: 'When Golden Bucket C enters, draw a card.',
          },
        ],
      }),
      makeDef({
        scryfallId: 'gold-apnap-bucket-d',
        printedName: '黄金D',
        typeLine: 'Creature',
        faces: [
          {
            name: 'Golden Bucket D',
            printedName: '黄金D',
            typeLine: 'Creature',
            oracleText: 'When Golden Bucket D enters, draw a card.',
          },
        ],
      }),
    ];

    store().newGame(
      [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(12)],
      1
    );
    const [aId, bId, cId, dId] = defs.map((def) => findInstanceId(def.scryfallId));
    for (const id of [aId, bId, cId, dId]) {
      store().moveCard(id, 'battlefield');
    }

    const state = store().state!;
    const pendingBySource = new Map(
      state.pendingTriggers.map((trigger) => [trigger.sourceId, trigger])
    );
    const aPending = pendingBySource.get(aId);
    const bPending = pendingBySource.get(bId);
    const cPending = pendingBySource.get(cId);
    const dPending = pendingBySource.get(dId);
    expect(aPending).toBeDefined();
    expect(bPending).toBeDefined();
    expect(cPending).toBeDefined();
    expect(dPending).toBeDefined();

    useGameStore.setState({
      state: {
        ...state,
        activePlayerId: 'P1',
        pendingTriggers: state.pendingTriggers.map((trigger) => {
          const controllerId =
            trigger.sourceId === bId || trigger.sourceId === dId ? 'OPPONENT_A' : 'P1';
          const stackPlacementBucket =
            trigger.sourceId === cId || trigger.sourceId === dId
              ? 'ability-triggered'
              : 'ordinary';
          return {
            ...trigger,
            controllerId,
            stackPlacementBucket,
            sourceSnapshot: {
              ...trigger.sourceSnapshot,
              controllerId,
            },
          };
        }),
      },
    });

    store().placePendingTriggersForPriority([
      dPending?.pendingTriggerId as string,
      cPending?.pendingTriggerId as string,
      bPending?.pendingTriggerId as string,
      aPending?.pendingTriggerId as string,
    ]);

    const stacked = store().state;
    expect(stacked?.pendingTriggers).toEqual([]);
    const stackSourceIds = (stacked?.zones.stack ?? []).map(
      (abilityId) => stacked?.cards[abilityId]?.sourceId
    );
    expect(stackSourceIds).toEqual([aId, bId, cId, dId]);
  });

  it('cr-trigger-sba-priority-loop: priority boundary repeats SBA and deterministic trigger placement to a fixed point', () => {
    goldenCase('cr-trigger-sba-priority-loop', [
      '117.5',
      '603.3',
      '603.3b',
      '704.3',
      '704.5f',
    ]);
    goldenCase('cr-priority-loop-trigger-placement-rechecks-sba', [
      '117.5',
      '603.3',
      '603.3b',
      '704.3',
    ]);

    const initialTrigger = makeDef({
      scryfallId: 'gold-fixed-point-initial',
      printedName: '黄金固定点入場',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Fixed Point Initial',
          printedName: '黄金固定点入場',
          typeLine: 'Creature',
          oracleText: 'When Golden Fixed Point Initial enters, draw a card.',
        },
      ],
    });
    const fragile = makeDef({
      scryfallId: 'gold-fixed-point-fragile',
      printedName: '黄金固定点死亡',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Fixed Point Fragile',
          printedName: '黄金固定点死亡',
          typeLine: 'Creature',
          power: '1',
          toughness: '1',
          oracleText: 'When Golden Fixed Point Fragile dies, draw a card.',
        },
      ],
    });

    store().newGame(
      [
        { def: initialTrigger, isCommander: false },
        { def: fragile, isCommander: false },
        ...makeDeck(12),
      ],
      1
    );
    const initialId = findInstanceId(initialTrigger.scryfallId);
    const fragileId = findInstanceId(fragile.scryfallId);

    store().moveCard(initialId, 'battlefield');
    store().moveCard(fragileId, 'battlefield');
    const initialPending = store().state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === initialId
    );
    expect(initialPending).toBeDefined();

    useGameStore.setState({
      state: {
        ...store().state!,
        cards: {
          ...store().state!.cards,
          [fragileId]: {
            ...store().state!.cards[fragileId],
            counters: { '-1/-1': 1 },
          },
        },
      },
    });

    store().placePendingTriggersForPriority([initialPending?.pendingTriggerId as string]);

    const state = store().state;
    expect(state?.pendingTriggers).toEqual([]);
    expect(state?.zones.graveyard).toContain(fragileId);
    const sbaEvent = state?.eventLog.find(
      (event) =>
        event.physicalCardId === fragileId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard' &&
        event.sbaApplied === '704.5f'
    );
    expect(sbaEvent).toBeDefined();
    expect(state?.zones.stack).toHaveLength(2);
    const [initialAbilityId, deathAbilityId] = state?.zones.stack ?? [];
    expect(state?.cards[initialAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: initialId,
      abilityKind: 'triggered',
    });
    expect(state?.cards[deathAbilityId]).toMatchObject({
      isAbility: true,
      sourceId: fragileId,
      abilityKind: 'triggered',
    });
  });

  it('cr-sba-zero-loyalty-planeswalker: CR 704.5i puts loyalty 0 planeswalkers into the graveyard', () => {
    goldenCase('cr-sba-zero-loyalty-planeswalker', ['704.5i', '122.1e']);

    const walker = makeDef({
      scryfallId: 'gold-sba-zero-loyalty',
      printedName: '黄金忠誠者',
      typeLine: 'Legendary Planeswalker',
      faces: [
        {
          name: 'Golden Zero Loyalty',
          printedName: '黄金忠誠者',
          typeLine: 'Legendary Planeswalker',
          loyalty: '1',
          oracleText: '+1: Draw a card.',
        },
      ],
    });
    store().newGame([{ def: walker, isCommander: false }, ...makeDeck(12)], 1);
    const walkerId = findInstanceId(walker.scryfallId);
    store().moveCard(walkerId, 'battlefield');
    expect(store().state?.cards[walkerId]?.counters.loyalty).toBe(1);

    store().dispatch({
      type: 'addCounters',
      cardId: walkerId,
      counterType: 'loyalty',
      delta: -1,
    });

    const state = store().state;
    expect(state?.cards[walkerId]?.zone).toBe('graveyard');
    expect(state?.zones.battlefield).not.toContain(walkerId);
    expect(state?.zones.graveyard).toContain(walkerId);
    expect(
      state?.eventLog.some((event) =>
        event.physicalCardId === walkerId &&
        event.fromZone === 'battlefield' &&
        event.toZone === 'graveyard' &&
        event.reason === 'sba' &&
        event.sbaApplied === '704.5i'
      ),
    ).toBe(true);
    expect(state?.zones.stack).toEqual([]);
  });

  it('cr-sba-plus-minus-counter-annihilation: CR 704.5q removes paired +1/+1 and -1/-1 counters', () => {
    goldenCase('cr-sba-plus-minus-counter-annihilation', ['704.5q', '122.3']);

    const creature = makeDef({
      scryfallId: 'gold-sba-counter-pair',
      printedName: '黄金相殺体',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Counter Pair',
          printedName: '黄金相殺体',
          typeLine: 'Creature',
          power: '2',
          toughness: '2',
          oracleText: '',
        },
      ],
    });
    store().newGame([{ def: creature, isCommander: false }, ...makeDeck(12)], 1);
    const creatureId = findInstanceId(creature.scryfallId);
    store().moveCard(creatureId, 'battlefield');
    const eventCountBeforeCounters = store().state?.eventLog.length ?? 0;

    store().dispatch({
      type: 'addCounters',
      cardId: creatureId,
      counterType: '+1/+1',
      delta: 2,
    });
    store().dispatch({
      type: 'addCounters',
      cardId: creatureId,
      counterType: '-1/-1',
      delta: 1,
    });

    const state = store().state;
    expect(state?.cards[creatureId]?.zone).toBe('battlefield');
    expect(state?.cards[creatureId]?.counters).toEqual({ '+1/+1': 1 });
    expect(state?.eventLog).toHaveLength(eventCountBeforeCounters);
  });

  it('cr-zone-change-new-object-lki: LTB pending trigger uses before snapshot and old object id', () => {
    goldenCase('cr-zone-change-new-object-lki', ['400.7', '603.10a']);

    const leaves = makeDef({
      scryfallId: 'gold-lki-leaves',
      printedName: '黄金離場',
      typeLine: 'Creature',
      faces: [
        {
          name: 'Golden Leaves',
          printedName: '黄金離場',
          typeLine: 'Creature',
          power: '2',
          toughness: '2',
          oracleText: 'When Golden Leaves leaves the battlefield, draw a card.',
        },
      ],
    });
    store().newGame([{ def: leaves, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId(leaves.scryfallId);
    store().moveCard(sourceId, 'battlefield');
    store().toggleTap(sourceId);
    store().dispatch({
      type: 'addCounters',
      cardId: sourceId,
      counterType: '+1/+1',
      delta: 2,
    });
    const beforeCard = store().state?.cards[sourceId];
    expect(beforeCard).toBeDefined();
    const oldObjectId = objectIdOf(beforeCard!);

    store().moveCard(sourceId, 'exile');

    const state = store().state;
    const afterCard = state?.cards[sourceId];
    expect(afterCard?.zone).toBe('exile');
    expect(objectIdOf(afterCard!)).not.toBe(oldObjectId);

    const event = state?.eventLog.find(
      (entry) =>
        entry.physicalCardId === sourceId &&
        entry.fromZone === 'battlefield' &&
        entry.toZone === 'exile'
    );
    expect(event).toBeDefined();
    expect(event).toMatchObject({
      oldObjectId,
      newObjectId: objectIdOf(afterCard!),
      before: {
        objectId: oldObjectId,
        zone: 'battlefield',
        tapped: true,
        counters: { '+1/+1': 2 },
        typeLine: 'Creature',
      },
      after: {
        objectId: objectIdOf(afterCard!),
        zone: 'exile',
        tapped: false,
        counters: {},
      },
    });

    const pending = state?.pendingTriggers.find(
      (trigger) => trigger.sourceId === sourceId && trigger.triggerId === 'trigger.leaves'
    );
    expect(pending).toMatchObject({
      eventId: event?.eventId,
      simultaneousGroupId: event?.eventId,
      controllerId: 'P1',
      sourceObjectId: oldObjectId,
      sourceSnapshot: {
        objectId: oldObjectId,
        zone: 'battlefield',
        tapped: true,
        counters: { '+1/+1': 2 },
      },
    });
  });
});
