import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { isCommander } from '../../engine/commander';
import { isLandCard, resolveDropIntent } from './dragIntent';

function handCardByType(state: ReturnType<typeof buildVisualFixture>['snapshot']['state'], land: boolean) {
  const cardId = state.zones.hand.find((id) => isLandCard(state, id) === land);
  if (!cardId) throw new Error(`fixture is missing a hand ${land ? 'land' : 'spell'}`);
  return cardId;
}

describe('semantic drag intents', () => {
  it('plays a hand land only on the land target', () => {
    const fixtureState = buildVisualFixture('lands').snapshot.state;
    const cardId = fixtureState.zones.battlefield.find((id) => isLandCard(fixtureState, id));
    if (!cardId) throw new Error('fixture is missing a battlefield land');
    const state = {
      ...fixtureState,
      cards: { ...fixtureState.cards, [cardId]: { ...fixtureState.cards[cardId], zone: 'hand' as const } },
      zones: {
        ...fixtureState.zones,
        hand: [...fixtureState.zones.hand, cardId],
        battlefield: fixtureState.zones.battlefield.filter((id) => id !== cardId),
      },
    };
    expect(resolveDropIntent(state, cardId, { kind: 'play-land' })).toEqual({
      kind: 'play-land',
      cardId,
    });
    expect(resolveDropIntent(state, cardId, { kind: 'cast' })).toEqual({ kind: 'none' });
  });

  it('casts a hand spell instead of treating it as a raw battlefield move', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = handCardByType(state, false);
    expect(resolveDropIntent(state, cardId, { kind: 'cast' })).toEqual({ kind: 'cast', cardId });
    expect(resolveDropIntent(state, cardId, { kind: 'play-land' })).toEqual({ kind: 'none' });
  });

  it('casts a commander from the command zone', () => {
    const state = buildVisualFixture('hand7').snapshot.state;
    const cardId = state.commanders[0].cardId;
    expect(resolveDropIntent(state, cardId, { kind: 'cast' })).toEqual({ kind: 'cast', cardId });
  });

  it('refuses to drop a non-commander into the command zone', () => {
    // 統率者領域は統率者しか描画しないため、受け入れるとカードが盤上から消える。
    const state = buildVisualFixture('hand7').snapshot.state;
    const spellId = handCardByType(state, false);
    expect(isCommander(state, spellId)).toBe(false);
    expect(resolveDropIntent(state, spellId, { kind: 'move-zone', zone: 'command' }))
      .toEqual({ kind: 'none' });
  });

  it('still lets a commander return to the command zone', () => {
    const fixtureState = buildVisualFixture('hand7').snapshot.state;
    const commanderId = fixtureState.commanders[0].cardId;
    const state = {
      ...fixtureState,
      cards: {
        ...fixtureState.cards,
        [commanderId]: { ...fixtureState.cards[commanderId], zone: 'battlefield' as const },
      },
    };
    expect(resolveDropIntent(state, commanderId, { kind: 'move-zone', zone: 'command' }))
      .toEqual({ kind: 'move-zone', cardId: commanderId, zone: 'command' });
  });

  it('refuses to drag a stack item into a generic zone move', () => {
    // 汎用 move-zone は applyMoveCardCommand を叩き、解決時コンパイル効果(CR608)を
    // 適用する applyResolveStackTop を迂回してしまう。
    const state = buildVisualFixture('stack').snapshot.state;
    const topId = state.zones.stack[state.zones.stack.length - 1];
    expect(topId).toBeDefined();
    expect(resolveDropIntent(state, topId, { kind: 'move-zone', zone: 'battlefield' }))
      .toEqual({ kind: 'none' });
    expect(resolveDropIntent(state, topId, { kind: 'move-zone', zone: 'graveyard' }))
      .toEqual({ kind: 'none' });
    expect(resolveDropIntent(state, topId, { kind: 'cast' })).toEqual({ kind: 'none' });
  });

  it('keeps invalid, cancelled, and same-zone drops inert', () => {
    const state = buildVisualFixture('battlefield').snapshot.state;
    const cardId = state.zones.battlefield[0];
    expect(resolveDropIntent(state, cardId, null)).toEqual({ kind: 'none' });
    expect(resolveDropIntent(state, cardId, { kind: 'cast' })).toEqual({ kind: 'none' });
    expect(resolveDropIntent(state, cardId, { kind: 'move-zone', zone: 'battlefield' })).toEqual({ kind: 'none' });
  });
});
