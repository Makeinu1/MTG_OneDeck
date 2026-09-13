import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { presentationRuntime } from './presentation/presentationRuntime';
import { publishCockpitOperation } from './cockpitPresentation';

it('announces a draw during first-turn preparation once, without replaying it on undo', () => {
  const before = applyTableOperation(createCockpitTable(makeDeck(30), 42), { type: 'keep', seatId: 'P1', bottom: [] });
  const after = applyTableOperation(before, { type: 'turn.ready' });
  const events: string[] = [];
  const unsubscribe = presentationRuntime.subscribe((event) => events.push(event.kind));
  try {
    expect(after.seats[0].zones.hand).toHaveLength(before.seats[0].zones.hand.length + 1);
    publishCockpitOperation({ type: 'turn.ready' }, before, after);
    expect(events).toEqual(['draw-completed']);
    publishCockpitOperation({ type: 'undo' }, after, before);
    expect(events).toEqual(['draw-completed']);
  } finally {
    unsubscribe();
  }
});
