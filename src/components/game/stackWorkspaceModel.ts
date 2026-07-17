import { objectIdOf, type GameState, type PlayerId, type TargetSelection } from '../../engine/types';

export interface StackItemPresentation {
  cardId: string;
  name: string;
  source: string | null;
  announcedX?: number;
  targets: { label: string; cardId?: string; playerId?: PlayerId }[];
}

function cardName(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  const face = card ? (def?.faces[card.faceIndex] ?? def?.faces[0]) : undefined;
  return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? cardId;
}

function targetPresentation(state: GameState, target: TargetSelection) {
  if (target.selection.kind === 'player') {
    return {
      label: target.selection.playerId === state.localPlayerId
        ? '自分（プレイヤー）'
        : state.players[target.selection.playerId]?.label ?? target.selection.playerId,
      playerId: target.selection.playerId,
    };
  }
  const cardId = target.selection.physicalCardId;
  const current = state.cards[cardId];
  const isSameObject = current && objectIdOf(current) === target.selection.objectId;
  return {
    label: `《${cardName(state, cardId)}》${isSameObject ? '' : '（以前のオブジェクト）'}`,
    ...(isSameObject ? { cardId } : {}),
  };
}

export function stackItemPresentations(state: GameState): StackItemPresentation[] {
  return [...state.zones.stack].reverse().map((cardId) => {
    const card = state.cards[cardId];
    const sourceId = card?.sourceId ?? card?.sourceSnapshot?.physicalCardId;
    return {
      cardId,
      name: `《${cardName(state, cardId)}》`,
      source: sourceId ? `《${cardName(state, sourceId)}》` : null,
      announcedX: card?.announcedX,
      targets: (card?.targetSelections ?? []).map((target) => targetPresentation(state, target)),
    };
  });
}
