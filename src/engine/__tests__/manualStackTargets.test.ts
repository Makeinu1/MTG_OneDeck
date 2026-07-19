import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { applyCommand, eligibleTargets, objectSnapshotForCard } from '../commands';

describe('manual stack target annotations', () => {
  it('records an activated ability targeting another activated or triggered ability', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourcePermanentId = initial.zones.battlefield.find((id) => !initial.cards[id].isAbility)!;
    const withActivated = applyCommand(initial, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'activated',
    }).state;
    const activatedId = withActivated.zones.stack.at(-1)!;
    const withTriggered = applyCommand(withActivated, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'triggered',
    }).state;
    const triggeredId = withTriggered.zones.stack.at(-1)!;

    const result = applyCommand(withTriggered, {
      type: 'setManualTargets', stackItemId: activatedId, targetIds: [triggeredId], allowStackAbilities: true,
    }).state;

    expect(result.cards[activatedId].isAbility).toBe(true);
    const recorded = result.cards[activatedId].targetSelections?.[0];
    expect(recorded?.legalityMode).toBe('unchecked-warning');
    expect(recorded?.selection.kind).toBe('object');
    if (recorded?.selection.kind !== 'object') throw new Error('expected object target');
    expect(recorded.selection.physicalCardId).toBe(triggeredId);
  });

  it('enumerates stack abilities only when their kinds are explicitly requested', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourcePermanentId = initial.zones.battlefield.find((id) => !initial.cards[id].isAbility)!;
    const withActivated = applyCommand(initial, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'activated',
    }).state;
    const activatedId = withActivated.zones.stack.at(-1)!;
    const withTriggered = applyCommand(withActivated, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'triggered',
    }).state;
    const triggeredId = withTriggered.zones.stack.at(-1)!;

    expect(eligibleTargets(withTriggered, { zone: 'stack' })).not.toContain(activatedId);
    expect(eligibleTargets(withTriggered, {
      zone: 'stack', stackKinds: ['activated-ability', 'triggered-ability'],
    })).toEqual(expect.arrayContaining([activatedId, triggeredId]));
  });

  it('rejects an ability annotating itself without partially changing the source', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourcePermanentId = initial.zones.battlefield.find((id) => !initial.cards[id].isAbility)!;
    const state = applyCommand(initial, {
      type: 'addAbilityToStack', sourceId: sourcePermanentId, kind: 'activated',
    }).state;
    const abilityId = state.zones.stack.at(-1)!;

    expect(() => applyCommand(state, {
      type: 'setManualTargets', stackItemId: abilityId, targetIds: [abilityId], allowStackAbilities: true,
    })).toThrow(/他のスタック/);
    expect(state.cards[abilityId].targetSelections).toEqual([]);
  });

  it('records stack spells and battlefield permanents without replacing checked targets', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const state = applyCommand(initial, { type: 'copyStackItem', cardId: sourceId }).state;
    const stackTargetId = state.zones.stack.find((id) => state.cards[id].isCopy)!;
    const permanentTargetId = state.zones.battlefield.find((id) => !state.cards[id].isAbility)!;
    const beforeSelections = state.cards[sourceId].targetSelections ?? [];

    const result = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: sourceId,
      targetIds: [stackTargetId, permanentTargetId],
    });

    expect(state.cards[sourceId].targetSelections).toEqual(beforeSelections);
    expect(result.state.cards[sourceId].targetSelections).toEqual(expect.arrayContaining(beforeSelections));
    expect(result.state.cards[sourceId].targetSelections?.filter((selection) =>
      selection.slotId.startsWith('manual-target-'))).toHaveLength(2);
    expect(result.state.cards[sourceId].targetSelections?.at(-1)).toMatchObject({
      legalityMode: 'unchecked-warning',
      selection: { physicalCardId: permanentTargetId },
    });
  });

  it('records self and opponent as explicit player targets', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const sourceId = state.zones.stack.find((id) => !state.cards[id].isAbility)!;
    const result = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: sourceId,
      targetIds: [],
      targetPlayerIds: ['P1', 'OPPONENT_A'],
    }).state;

    expect(result.cards[sourceId].targetSelections?.filter((selection) =>
      selection.slotId.startsWith('manual-target-player-')).map((selection) => selection.selection)).toEqual([
      { kind: 'player', playerId: 'P1' },
      { kind: 'player', playerId: 'OPPONENT_A' },
    ]);
  });

  it('keeps the legacy battlefield/stack boundary unless extra manual zones are explicit', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const handId = initial.zones.hand[0];

    expect(() => applyCommand(initial, {
      type: 'setManualTargets',
      stackItemId: sourceId,
      targetIds: [handId],
    })).toThrow(/指定できない領域/);

    const annotated = applyCommand(initial, {
      type: 'setManualTargets',
      stackItemId: sourceId,
      targetIds: [handId],
      allowedZones: ['hand'],
    }).state;
    expect(annotated.cards[sourceId].targetSelections?.at(-1)).toMatchObject({
      legalityMode: 'unchecked-warning',
      selection: { physicalCardId: handId },
    });
  });

  it('allows explicit manual annotations across own hand, graveyard, exile, and command', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const handId = initial.zones.hand[0];
    const movable = initial.zones.battlefield.filter((id) => id !== sourceId).slice(0, 3);
    const [graveyardId, exileId, commandId] = movable;
    if (!graveyardId || !exileId || !commandId) throw new Error('fixture targets missing');
    const withGraveyard = applyCommand(initial, {
      type: 'moveCard', cardId: graveyardId, to: 'graveyard', position: 'bottom',
    }).state;
    const withExile = applyCommand(withGraveyard, {
      type: 'moveCard', cardId: exileId, to: 'exile', position: 'bottom',
    }).state;
    const state = applyCommand(withExile, {
      type: 'moveCard', cardId: commandId, to: 'command', position: 'bottom',
    }).state;

    const result = applyCommand(state, {
      type: 'setManualTargets',
      stackItemId: sourceId,
      targetIds: [handId, graveyardId, exileId, commandId],
      allowedZones: ['hand', 'graveyard', 'exile', 'command'],
    }).state;

    const manualIds = result.cards[sourceId].targetSelections
      ?.filter((selection) => selection.slotId.startsWith('manual-target-'))
      .flatMap((selection) => selection.selection.kind === 'object'
        ? [selection.selection.physicalCardId]
        : []);
    expect(manualIds).toEqual([handId, graveyardId, exileId, commandId]);
  });

  it('keeps an announced X on the stack and copies it with the spell', () => {
    const initial = buildVisualFixture('hand7').snapshot.state;
    const cardId = initial.zones.hand[0];
    const cast = applyCommand(initial, {
      type: 'castToStack',
      cardId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: true,
      xValue: 3,
    }).state;
    const copied = applyCommand(cast, { type: 'copyStackItem', cardId }).state;
    const copyId = copied.zones.stack.find((id) => copied.cards[id].isCopy)!;

    expect(cast.cards[cardId].announcedX).toBe(3);
    expect(copied.cards[copyId].announcedX).toBe(3);
    const resolved = applyCommand(cast, { type: 'resolveStackTop' }).state;
    expect(resolved.cards[cardId].announcedX).toBeUndefined();
  });

  it('includes the announced X in stack mana value', () => {
    const fixture = buildVisualFixture('hand7').snapshot.state;
    const cardId = fixture.zones.hand[0];
    const card = fixture.cards[cardId];
    const def = fixture.defs[card.defId];
    const state = {
      ...fixture,
      defs: {
        ...fixture.defs,
        [card.defId]: {
          ...def,
          cmc: 1,
          faces: def.faces.map((face, index) => index === 0 ? { ...face, manaCost: '{X}{X}{1}' } : face),
        },
      },
    };
    const cast = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: true,
      xValue: 3,
    }).state;
    expect(objectSnapshotForCard(cast, cardId)?.manaValue).toBe(7);
  });

  it('replaces only earlier manual annotations and supports clearing them', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const state = applyCommand(initial, { type: 'copyStackItem', cardId: sourceId }).state;
    const stackTargetId = state.zones.stack.find((id) => state.cards[id].isCopy)!;
    const annotated = applyCommand(state, {
      type: 'setManualTargets', stackItemId: sourceId, targetIds: [stackTargetId],
    }).state;
    const cleared = applyCommand(annotated, {
      type: 'setManualTargets', stackItemId: sourceId, targetIds: [],
    }).state;

    expect(cleared.cards[sourceId].targetSelections?.some((selection) =>
      selection.slotId.startsWith('manual-target-'))).toBe(false);
    expect(cleared.cards[sourceId].targetSelections?.some((selection) =>
      selection.legalityMode === 'checked')).toBe(true);
  });

  it('forgets manual and checked targets after resolve and does not resurrect them on recast', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.at(-1)!;
    const permanentTargetId = initial.zones.battlefield[0];
    const annotated = applyCommand(initial, {
      type: 'setManualTargets', stackItemId: sourceId, targetIds: [permanentTargetId],
    }).state;

    const resolved = applyCommand(annotated, { type: 'resolveStackTop' }).state;
    expect(resolved.cards[sourceId].zone).not.toBe('stack');
    expect(resolved.cards[sourceId].targetSelections).toBeUndefined();

    const recast = applyCommand(resolved, {
      type: 'castToStack',
      cardId: sourceId,
      payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      forced: false,
    }).state;
    expect(recast.cards[sourceId].zone).toBe('stack');
    expect(recast.cards[sourceId].targetSelections).toBeUndefined();
  });

  it('preserves targets when reordering inside the same zone', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const permanentTargetId = initial.zones.battlefield[0];
    const annotated = applyCommand(initial, {
      type: 'setManualTargets', stackItemId: sourceId, targetIds: [permanentTargetId],
    }).state;
    const reordered = applyCommand(annotated, {
      type: 'moveCard', cardId: sourceId, to: 'stack', position: 'top',
    }).state;

    expect(reordered.cards[sourceId].targetSelections).toEqual(annotated.cards[sourceId].targetSelections);
  });

  it('copies checked and manual spell targets while keeping a distinct selection array', () => {
    const initial = buildVisualFixture('stack').snapshot.state;
    const sourceId = initial.zones.stack.find((id) => !initial.cards[id].isAbility)!;
    const permanentTargetId = initial.zones.battlefield[0];
    const annotated = applyCommand(initial, {
      type: 'setManualTargets', stackItemId: sourceId, targetIds: [permanentTargetId],
    }).state;
    const copied = applyCommand(annotated, { type: 'copyStackItem', cardId: sourceId }).state;
    const copyId = copied.zones.stack.find((id) => copied.cards[id].isCopy)!;

    expect(copied.cards[copyId].isCopy).toBe(true);
    expect(copied.cards[copyId].targetSelections).toEqual(annotated.cards[sourceId].targetSelections);
    expect(copied.cards[copyId].targetSelections).not.toBe(annotated.cards[sourceId].targetSelections);
  });
});
