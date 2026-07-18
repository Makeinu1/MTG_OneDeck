import type { PlayerId } from '../../engine/types';
import { Modal } from '../Modal';
import { BattlefieldShelf } from './Board';
import { GameCard } from './GameCard';
import type { GameController } from './gameController';
import { projectBattlefield } from './battlefieldProjection';

function ProjectedBoard({
  controller,
  playerId,
}: {
  controller: GameController;
  playerId: PlayerId;
}) {
  const state = controller.state;
  if (!state) return null;
  const projection = projectBattlefield(state, playerId);
  const permanentCount = projection.creatures.flatMap((bundle) => bundle.cardIds).length
    + projection.lands.length
    + projection.support.flatMap((bundle) => bundle.cardIds).length;
  const player = state.players[playerId];
  return (
    <section className="opponent-board" data-testid={'opponent-board-' + playerId}>
      <header className="opponent-board__header">
        <strong>{player?.label ?? playerId}</strong>
        <span>ライフ {player?.life ?? '?'} / 毒 {player?.poison ?? 0}</span>
      </header>
      {permanentCount === 0 ? (
        // permanent が0枚なら空レーン3本(各82px)を描かない。既定の対戦相手は常に
        // turnOrder に居るため、これが無いと何も無い相手が縦250px(mobile)を占める。
        <p className="opponent-board__empty">盤面なし</p>
      ) : (
      <div className="opponent-board__rows">
        <BattlefieldShelf
          controller={controller}
          bundles={projection.creatures}
          attachmentsByHost={projection.attachmentsByHost}
          testId={'opponent-creatures-' + playerId}
          emptyLabel="クリーチャー"
          role="creature"
        />
        <div className="opponent-board__support">
          <div className="opponent-board__lands" data-testid={'opponent-lands-' + playerId}>
            {projection.lands.length === 0 && <span className="board-shelf__empty">土地</span>}
            {projection.lands.map((cardId) => (
              <GameCard key={cardId} controller={controller} cardId={cardId} size="board" />
            ))}
          </div>
          <BattlefieldShelf
            controller={controller}
            bundles={projection.support}
            attachmentsByHost={projection.attachmentsByHost}
            testId={'opponent-others-' + playerId}
            emptyLabel="その他"
          />
        </div>
      </div>
      )}
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

/**
 * 相手盤面は常設しない(docs/design-vision.md:80 原則7「常設の…相手ライフ行…は廃止し
 * 『タップで出す』へ降格」)。原則7の要は「シート」という形ではなく「常設」の禁止であり、
 * 「タップで出す」が処方。兄弟の「墓地/追放/ライブラリを見る」と同じ Modal を使う=新語彙ゼロ。
 */
export function OpponentBoardDialog({
  controller,
  onClose,
}: {
  controller: GameController;
  onClose: () => void;
}) {
  return (
    <Modal title="相手の盤面" width="xl" onClose={onClose} testId="opponent-board-dialog">
      <OpponentBoards controller={controller} />
    </Modal>
  );
}
