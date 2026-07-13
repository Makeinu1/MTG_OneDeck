import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../visualFixtures/fixtureBuilder';
import {
  createResearchCheckpoint,
  createResearchSession,
  createResearchTransient,
  inferResearchDeckId,
  researchInteractionFromEvent,
} from './researchModel';

describe('UX research model', () => {
  it('creates a JSON-round-trippable session and checkpoint without a restart deck', () => {
    const fixture = buildVisualFixture('stack');
    const session = createResearchSession({
      deckId: 'Gogo',
      phase: 'owner-discovery',
      startedAt: new Date('2026-07-12T00:00:00.000Z'),
      viewport: { width: 1440, height: 900 },
    });
    const checkpoint = createResearchCheckpoint({
      elapsedMs: 1234,
      reason: 'stack-opened',
      state: fixture.snapshot.state,
      autoAdvanceToMain: false,
      transient: createResearchTransient({
        mulliganDecisionPending: false,
        warnings: ['確認'],
        pendingGuided: null,
        feedOpen: false,
        shortcutsBlocked: true,
      }),
      note: ' コピー対象を選ぶ ',
      captureCriterion: 'prototype-difference',
      evidence: {
        observation: ' 3回カードを探した ',
        userStatement: '「見つからない」',
        interpretation: '墓地が小さすぎる',
        hypothesis: '墓地を一時展開する',
      },
    });

    const saved = { ...session, checkpoints: [checkpoint] };
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
    expect(checkpoint.snapshot.deck).toEqual([]);
    expect(checkpoint.note).toBe('コピー対象を選ぶ');
    expect(checkpoint.captureCriterion).toBe('prototype-difference');
    expect(checkpoint.evidence).toEqual({
      observation: '3回カードを探した',
      userStatement: '「見つからない」',
      interpretation: '墓地が小さすぎる',
      hypothesis: '墓地を一時展開する',
    });
  });

  it('infers a known deck from the commander name', () => {
    const state = buildVisualFixture('hand').snapshot.state;
    const commanderId = state.zones.command[0];
    const commander = state.cards[commanderId];
    const nextState = {
      ...state,
      defs: {
        ...state.defs,
        [commander.defId]: {
          ...state.defs[commander.defId],
          name: 'Muldrotha, the Gravetide',
        },
      },
    };
    expect(inferResearchDeckId(nextState)).toBe('Muldrotha');
  });

  it('records the nearest card target but ignores recorder controls and editable key input', () => {
    const state = buildVisualFixture('hand').snapshot.state;
    const cardId = state.zones.hand[0];
    const card = document.createElement('button');
    card.dataset.testid = `card-${cardId}`;
    document.body.append(card);
    const click = new MouseEvent('click', { clientX: 30, clientY: 40 });
    card.dispatchEvent(click);

    expect(researchInteractionFromEvent({ event: click, elapsedMs: 50, state })).toMatchObject({
      kind: 'click',
      elapsedMs: 50,
      x: 30,
      y: 40,
      testId: `card-${cardId}`,
      cardId,
      zone: 'hand',
    });

    const recorder = document.createElement('aside');
    recorder.dataset.uxResearchRecorder = '';
    const recorderButton = document.createElement('button');
    recorder.append(recorderButton);
    document.body.append(recorder);
    const recorderClick = new MouseEvent('click');
    recorderButton.dispatchEvent(recorderClick);
    expect(researchInteractionFromEvent({ event: recorderClick, elapsedMs: 60, state })).toBeNull();

    const input = document.createElement('input');
    document.body.append(input);
    const keydown = new KeyboardEvent('keydown', { key: 'a' });
    input.dispatchEvent(keydown);
    expect(researchInteractionFromEvent({ event: keydown, elapsedMs: 70, state })).toBeNull();

    card.remove();
    recorder.remove();
    input.remove();
  });
});
