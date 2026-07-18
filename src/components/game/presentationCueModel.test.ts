import { describe, expect, it } from 'vitest';
import type { DrawEvent, GameEvent, GameState } from '../../engine/types';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { drawPresentationForAppend, drawPresentationText } from './presentationCueModel';

function drawEvent(state: GameState, id: string, sequence: number, cardId: string, commandType = 'draw'): DrawEvent {
  return {
    type: 'draw', eventId: id, sequence, playerId: state.localPlayerId,
    result: 'drawn', physicalCardId: cardId,
    cause: { type: 'command', commandType },
  };
}

function stateWithDraws(count: number, commandType = 'draw') {
  const base = buildVisualFixture('hand7').snapshot.state;
  const ids = base.zones.library.slice(0, count);
  const events: GameEvent[] = ids.map((id, index) => drawEvent(base, `draw-${index}`, index + 1, id, commandType));
  return {
    previousEvents: [] as GameEvent[],
    state: {
      ...base,
      eventLog: events,
      zones: {
        ...base.zones,
        library: base.zones.library.filter((id) => !ids.includes(id)),
        hand: [...base.zones.hand, ...ids],
      },
      cards: Object.fromEntries(Object.entries(base.cards).map(([id, card]) => [
        id,
        ids.includes(id) ? { ...card, zone: 'hand' as const } : card,
      ])),
    },
  };
}

describe('presentation cue model', () => {
  it('builds one central cue for a manual multi-draw and caps the beat below 900ms', () => {
    const input = stateWithDraws(8);
    const cue = drawPresentationForAppend({ ...input, transitionCue: null });
    expect(cue).toMatchObject({ extraCount: 7, delayMs: 0, durationMs: 890, phaseBound: false });
    expect(cue && drawPresentationText(cue)).toContain('ほか7枚');
  });

  it('binds a next-phase draw to the draw step of the existing turn timeline', () => {
    const input = stateWithDraws(1, 'nextPhase');
    const cue = drawPresentationForAppend({
      ...input,
      transitionCue: { id: 3, kind: 'turn', turn: 2, phases: ['untap', 'upkeep', 'draw', 'main1'], drawAtMs: 560, durationMs: 1050 },
    });
    expect(cue).toMatchObject({ phaseBound: true, delayMs: 560 });
  });

  it('does not replay initial, restored, or divergent event histories', () => {
    const input = stateWithDraws(1);
    expect(drawPresentationForAppend({ previousEvents: null, state: input.state, transitionCue: null })).toBeNull();
    expect(drawPresentationForAppend({ previousEvents: [drawEvent(input.state, 'other', 1, input.state.zones.hand[0])], state: input.state, transitionCue: null })).toBeNull();
  });
});
