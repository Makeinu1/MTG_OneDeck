import { objectIdOf, type GameState, type PlayerId, type TargetSelection } from '../../engine/types';
import { activatedAbilityLines } from '../../engine/grammar';
import { activatedAbilityDisplayText } from './abilityDisplay';

export interface StackItemPresentation {
  cardId: string;
  name: string;
  source: string | null;
  abilityText?: string;
  announcedX?: number;
  targets: {
    label: string;
    cardId?: string;
    playerId?: PlayerId;
    legalityMode: TargetSelection['legalityMode'];
  }[];
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
      legalityMode: target.legalityMode,
    };
  }
  const cardId = target.selection.physicalCardId;
  const current = state.cards[cardId];
  const isSameObject = current && objectIdOf(current) === target.selection.objectId;
  const snapshot = target.selection.snapshot;
  const snapshotDef = state.defs[snapshot.defId];
  const snapshotFace = snapshotDef?.faces[snapshot.faceIndex] ?? snapshotDef?.faces[0];
  const historicalName =
    snapshot.defId === 'cockpit-hidden'
      ? '非公開カード'
      : snapshotFace?.printedName ??
        snapshotFace?.name ??
        snapshotDef?.printedName ??
        snapshotDef?.name ??
        cardId;
  return {
    label: `《${isSameObject ? cardName(state, cardId) : historicalName}》${isSameObject ? '' : '（以前のオブジェクト）'}`,
    ...(isSameObject ? { cardId } : {}),
    legalityMode: target.legalityMode,
  };
}

export function stackItemPresentations(state: GameState): StackItemPresentation[] {
  return [...state.zones.stack].reverse().map((cardId) => {
    const card = state.cards[cardId];
    const sourceId = card?.sourceId ?? card?.sourceSnapshot?.physicalCardId;
    const def = card ? state.defs[card.defId] : undefined;
    const abilityLine = card?.isAbility && def && card.abilityLineIndex !== undefined
      ? activatedAbilityLines(def).find((line) => line.index === card.abilityLineIndex)
      : undefined;
    return {
      cardId,
      name: `《${cardName(state, cardId)}》`,
      source: sourceId ? `《${cardName(state, sourceId)}》` : null,
      ...(def && abilityLine
        ? { abilityText: activatedAbilityDisplayText(def, abilityLine) }
        : card?.isAbility && card.abilityResolutionText
          ? { abilityText: card.abilityResolutionText }
          : {}),
      announcedX: card?.announcedX,
      targets: (card?.targetSelections ?? []).map((target) => targetPresentation(state, target)),
    };
  });
}
