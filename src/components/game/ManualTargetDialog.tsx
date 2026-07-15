import { useState } from 'react';
import { CardView } from '../CardView';
import { Modal } from '../Modal';
import type { GameState, PlayerId } from '../../engine/types';

export function ManualTargetDialog({
  state,
  sourceId,
  onConfirm,
  onCancel,
}: {
  state: GameState;
  sourceId: string;
  onConfirm: (targetIds: string[], targetPlayerIds: PlayerId[]) => void;
  onCancel: () => void;
}) {
  const candidates = [
    ...state.zones.stack.filter((id) => id !== sourceId && !state.cards[id]?.isAbility),
    ...state.zones.battlefield.filter((id) => !state.cards[id]?.isAbility),
  ];
  const current = new Set(
    (state.cards[sourceId]?.targetSelections ?? []).flatMap((target) =>
      target.slotId.startsWith('manual-target-')
      && target.selection.kind === 'object'
      && candidates.includes(target.selection.physicalCardId)
        ? [target.selection.physicalCardId]
        : []),
  );
  const [selected, setSelected] = useState<string[]>([...current]);
  const currentPlayers = new Set(
    (state.cards[sourceId]?.targetSelections ?? []).flatMap((target) =>
      target.slotId.startsWith('manual-target-') && target.selection.kind === 'player'
        ? [target.selection.playerId]
        : []),
  );
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerId[]>([...currentPlayers]);
  const playerTargets = state.turnOrder.flatMap((playerId) => {
    const player = state.players[playerId];
    return player
      ? [{ playerId, label: playerId === state.localPlayerId ? '自分（プレイヤー）' : player.label }]
      : [];
  });

  function setChecked(cardId: string, checked: boolean): void {
    setSelected((ids) => checked
      ? (ids.includes(cardId) ? ids : [...ids, cardId])
      : ids.filter((id) => id !== cardId));
  }

  function setPlayerChecked(playerId: PlayerId, checked: boolean): void {
    setSelectedPlayers((ids) => checked
      ? (ids.includes(playerId) ? ids : [...ids, playerId])
      : ids.filter((id) => id !== playerId));
  }

  const selectedCount = selected.length + selectedPlayers.length;

  return (
    <Modal title="対象を手動で記録" onClose={onCancel} width="lg" testId="manual-target-dialog">
      <p className="manual-target-dialog__note">
        ルール処理には使わず、盤面理解と対象線のために記録します。複数選択できます。
      </p>
      <fieldset className="manual-target-dialog__players">
        <legend>プレイヤー</legend>
        {playerTargets.map(({ playerId, label }) => {
          const checked = selectedPlayers.includes(playerId);
          return (
            <label key={playerId} className={`manual-target-dialog__player${checked ? ' is-selected' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setPlayerChecked(playerId, event.currentTarget.checked)}
                data-testid={`manual-target-player-${playerId}`}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </fieldset>
      {candidates.length === 0 ? (
        <p className="zone-viewer__empty">選べる呪文またはパーマネントはありません。</p>
      ) : (
        <ul className="manual-target-dialog__list">
          {candidates.map((cardId) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;
            const face = def.faces[card.faceIndex] ?? def.faces[0];
            const name = face?.printedName ?? face?.name ?? def.printedName ?? def.name;
            const checked = selected.includes(cardId);
            return (
              <li key={cardId}>
                <label className={`manual-target-dialog__item${checked ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(cardId, event.currentTarget.checked)}
                    data-testid={`manual-target-${cardId}`}
                  />
                  <span className="manual-target-dialog__thumb">
                    <CardView instance={card} def={def} size="small" />
                  </span>
                  <span>
                    <strong>《{name}》</strong>
                    <small>{card.zone === 'stack' ? 'スタック上の呪文' : '戦場のパーマネント'}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onCancel}>キャンセル</button>
        <button
          type="button"
          className="btn btn--accent"
          data-testid="manual-target-confirm"
          onClick={() => onConfirm(selected, selectedPlayers)}
        >
          {selectedCount === 0 ? '対象なしで記録' : `${selectedCount}件を記録`}
        </button>
      </div>
    </Modal>
  );
}
