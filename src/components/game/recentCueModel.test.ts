import { describe, expect, it } from 'vitest';
import type { DrawEvent, GameEvent, LogEntry } from '../../engine/types';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { recentCueForAppend } from './recentCueModel';

function drawEvent(eventId: string, sequence: number, cardId: string, state = buildVisualFixture('hand7').snapshot.state): DrawEvent {
  const card = state.cards[cardId];
  return {
    type: 'draw', eventId, sequence, playerId: state.localPlayerId, result: 'drawn', physicalCardId: cardId,
    cause: { type: 'command', commandType: 'draw' },
    before: { physicalCardId: cardId, objectId: `${cardId}:0`, defId: card.defId, zone: 'library', ownerId: card.ownerId, controllerId: card.controllerId, isToken: false, isCommander: false, faceIndex: card.faceIndex, tapped: false, counters: {}, typeLine: '' },
    after: { physicalCardId: cardId, objectId: `${cardId}:1`, defId: card.defId, zone: 'hand', ownerId: card.ownerId, controllerId: card.controllerId, isToken: false, isCommander: false, faceIndex: card.faceIndex, tapped: false, counters: {}, typeLine: '' },
  };
}

describe('recent cue model', () => {
  it('does not replay initial, restored, shorter, or divergent history', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = state.zones.library[0];
    const event = drawEvent('e1', 1, cardId, state);
    expect(recentCueForAppend({ previousEvents: null, currentEvents: [event], previousLog: null, currentLog: [], state })).toBeNull();
    expect(recentCueForAppend({ previousEvents: [event], currentEvents: [], previousLog: [], currentLog: [], state })).toBeNull();
    expect(recentCueForAppend({ previousEvents: [event], currentEvents: [drawEvent('other', 1, cardId, state)], previousLog: [], currentLog: [], state })).toBeNull();
  });

  it('uses a successful local draw and compresses the rest of the batch', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const first = state.zones.library[0];
    const second = state.zones.library[1];
    const current: GameEvent[] = [drawEvent('e1', 1, first, state), drawEvent('e2', 2, second, state)];
    expect(recentCueForAppend({ previousEvents: [], currentEvents: current, previousLog: [], currentLog: [], state }))
      .toMatchObject({ id: 'e2', kind: 'draw', extraCount: 1 });
  });

  it('falls back to the newest meaningful log for operations without events', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const previousLog: LogEntry[] = [{ seq: 1, turn: 1, phase: 'main1', message: 'メイン1フェイズに移行しました。' }];
    const currentLog: LogEntry[] = [...previousLog, { seq: 2, turn: 1, phase: 'main1', message: 'トークン《苗木》を3個生成しました。' }];
    expect(recentCueForAppend({ previousEvents: [], currentEvents: [], previousLog, currentLog, state }))
      .toMatchObject({ id: 'log-2', kind: 'log', text: 'トークン《苗木》を3個生成しました。' });
  });

  it('honors explicit history-navigation suppression', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = state.zones.library[0];
    expect(recentCueForAppend({ previousEvents: [], currentEvents: [drawEvent('e1', 1, cardId, state)], previousLog: [], currentLog: [], state, suppress: true }))
      .toBeNull();
  });
});
