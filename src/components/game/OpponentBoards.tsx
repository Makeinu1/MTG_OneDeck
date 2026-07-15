import type { GameState, PlayerId } from '../../engine/types';
import { BattlefieldShelf } from './Board';
import { GameCard } from './GameCard';
import type { GameController } from './gameController';

function typeLineOf(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
  return face?.typeLine ?? def?.typeLine ?? '';
}

function ProjectedBoard({
  controller,
  playerId,
}: {
  controller: GameController;
  playerId: PlayerId;
}) {
  const state = controller.state;
  if (!state) return null;
  const permanents = state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    return card?.controllerId === playerId && !card.isAbility && !card.attachedTo;
  });
  const creatures: string[] = [];
  const others: string[] = [];
  const lands: string[] = [];
  for (const cardId of permanents) {
    const typeLine = typeLineOf(state, cardId);
    if (typeLine.includes('Land')) lands.push(cardId);
    else if (typeLine.includes('Creature')) creatures.push(cardId);
    else others.push(cardId);
  }
  const player = state.players[playerId];
  return (
    <section className="opponent-board" data-testid={'opponent-board-' + playerId}>
      <header className="opponent-board__header">
        <strong>{player?.label ?? playerId}</strong>
        <span>ライフ {player?.life ?? '?'} / 毒 {player?.poison ?? 0}</span>
      </header>
      <div className="opponent-board__rows">
        <BattlefieldShelf
          controller={controller}
          cardIds={creatures}
          testId={'opponent-creatures-' + playerId}
          emptyLabel="クリーチャー"
        />
        <BattlefieldShelf
          controller={controller}
          cardIds={others}
          testId={'opponent-others-' + playerId}
          emptyLabel="その他"
        />
        <div className="opponent-board__lands" data-testid={'opponent-lands-' + playerId}>
          {lands.length === 0 && <span className="board-shelf__empty">土地</span>}
          {lands.map((cardId) => (
            <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function OpponentBoards({ controller }: { controller: GameController }) {
  const state = controller.state;
  if (!state) return null;
  const opponentIds = state.turnOrder.filter((playerId) => playerId !== state.localPlayerId);
  return (
    <div className="opponent-boards" data-testid="opponent-boards">
      {opponentIds.map((playerId) => (
        <ProjectedBoard key={playerId} controller={controller} playerId={playerId} />
      ))}
    </div>
  );
}
