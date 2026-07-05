import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import {
  applyCommand,
  consumeLinkedExileForSource,
  returnLinkedExileToBattlefield,
} from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import { objectIdOf, type GameState } from '../types';
import { makeDef } from './helpers';

function spellDef(oracleText: string): CardDef {
  return makeDef({
    scryfallId: 'linked-exile-spell',
    typeLine: 'Sorcery',
    faces: [{ name: 'linked-exile-spell', typeLine: 'Sorcery', oracleText }],
  });
}

function baseState(): GameState {
  const source = makeDef({ scryfallId: 'test-exiler', typeLine: 'Creature' });
  const target = makeDef({ scryfallId: 'test-target', typeLine: 'Creature' });
  let state = initGame(
    [
      { def: source, isCommander: false },
      { def: target, isCommander: false },
    ],
    1,
  );
  state = applyCommand(state, {
    type: 'moveCard',
    cardId: 'c1',
    to: 'battlefield',
    position: 'bottom',
  }).state;
  state = applyCommand(state, {
    type: 'moveCard',
    cardId: 'c2',
    to: 'battlefield',
    position: 'bottom',
  }).state;
  return state;
}

describe('CR 400/406/607 linked exile substrate', () => {
  it('creates exiled-with-source records from the actual exile ZoneChangeEvent', () => {
    const state = baseState();
    const sourceObjectId = objectIdOf(state.cards.c1);
    const targetObjectId = objectIdOf(state.cards.c2);

    const result = applyCommand(state, {
      type: 'moveCard',
      cardId: 'c2',
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'test-link',
        purpose: 'exiled-with-source',
        sourceObjectId,
        sourcePhysicalId: 'c1',
      },
    });

    const record = result.state.linkedExiles['test-link'];
    const exileEvent = result.state.eventLog.at(-1);
    expect(exileEvent?.type).toBe('zoneChange');
    expect(record).toMatchObject({
      linkId: 'test-link',
      purpose: 'exiled-with-source',
      sourceObjectId,
      sourcePhysicalId: 'c1',
      exiledPhysicalIds: ['c2'],
      exiledObjectIds: [objectIdOf(result.state.cards.c2)],
      snapshot: { physicalCardId: 'c2', objectId: targetObjectId, zone: 'battlefield' },
      createdSequence: exileEvent?.sequence,
    });
  });

  it('consumes exiled-with-source records only for the same source object incarnation', () => {
    const state = baseState();
    const sourceObjectId = objectIdOf(state.cards.c1);
    const withRecord = applyCommand(state, {
      type: 'moveCard',
      cardId: 'c2',
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'test-link',
        purpose: 'exiled-with-source',
        sourceObjectId,
        sourcePhysicalId: 'c1',
      },
    }).state;

    const consumed = consumeLinkedExileForSource(withRecord, 'test-link', 'c1');
    expect(consumed.state.linkedExiles).toEqual({});

    const sourceMoved = applyCommand(withRecord, {
      type: 'moveCard',
      cardId: 'c1',
      to: 'graveyard',
      position: 'bottom',
    }).state;
    const rejected = consumeLinkedExileForSource(sourceMoved, 'test-link', 'c1');
    expect(rejected.state.linkedExiles['test-link']).toBeDefined();
    expect(rejected.warnings.at(-1)).toContain('source object');
  });

  it('returns temporary-return records only while the recorded exile object is current', () => {
    const state = baseState();
    const returned = applyCommand(state, {
      type: 'moveCard',
      cardId: 'c2',
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'blink-link',
        purpose: 'temporary-return',
        sourceObjectId: objectIdOf(state.cards.c1),
        sourcePhysicalId: 'c1',
      },
    });

    expect(returned.state.cards.c2.zone).toBe('battlefield');
    expect(returned.state.linkedExiles).toEqual({});
    expect(
      returned.state.eventLog
        .slice(-2)
        .map((event) => (event.type === 'zoneChange' ? event.toZone : null)),
    ).toEqual(['exile', 'battlefield']);

    const withRecord = applyCommand(state, {
      type: 'moveCard',
      cardId: 'c2',
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'stale-link',
        purpose: 'exiled-with-source',
        sourceObjectId: objectIdOf(state.cards.c1),
        sourcePhysicalId: 'c1',
      },
    }).state;
    const staleRecord = {
      ...withRecord.linkedExiles['stale-link'],
      purpose: 'temporary-return' as const,
    };
    const movedAway = applyCommand(
      { ...withRecord, linkedExiles: { 'stale-link': staleRecord } },
      { type: 'moveCard', cardId: 'c2', to: 'graveyard', position: 'bottom' },
    ).state;
    const noOp = returnLinkedExileToBattlefield(movedAway, 'stale-link');
    expect(noOp.state.cards.c2.zone).toBe('graveyard');
    expect(noOp.state.linkedExiles).toEqual({});
    expect(noOp.warnings.at(-1)).toContain('現在の追放オブジェクト');
  });

  it('keeps Path to Exile style simple target exile as a plain moveCard without a record', () => {
    const result = compileAbilityIR(parseAbilityIR('Exile target creature.', 'Instant'), {
      sourceId: 'source-1',
      def: spellDef('Exile target creature.'),
    });

    expect(result.decision).toBe('guided');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: ['target-1'] },
      {
        sourceId: 'source-1',
        def: spellDef('Exile target creature.'),
        sourceObjectId: 'source-1:0',
      },
    );
    expect(commands).toEqual([
      { type: 'moveCard', cardId: 'target-1', to: 'exile', position: 'bottom' },
    ]);
  });

  it('compiles same-resolution Thassa-style exile and return as a linked exile write', () => {
    const text =
      "At the beginning of your end step, exile up to one target creature you control, then return that card to the battlefield under its owner's control.";
    const result = compileAbilityIR(parseAbilityIR(text, 'Legendary Enchantment Creature'), {
      sourceId: 'source-1',
      def: spellDef(text),
    });

    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      minCount: 0,
      filter: { types: ['creature'], controller: 'you' },
      linkedExile: { purpose: 'temporary-return' },
    });
    expect(
      buildGuidedCommands(
        result.prompts[0],
        { kind: 'target', cardIds: ['target-1'] },
        { sourceId: 'source-1', def: spellDef(text), sourceObjectId: 'source-1:0' },
      )[0],
    ).toMatchObject({
      type: 'moveCard',
      cardId: 'target-1',
      to: 'exile',
      linkedExileWrite: {
        purpose: 'temporary-return',
        sourceObjectId: 'source-1:0',
        sourcePhysicalId: 'source-1',
      },
    });
  });
});
