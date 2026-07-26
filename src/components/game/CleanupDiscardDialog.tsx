import { useState } from 'react';
import type { CleanupDiscardRuleChoice, GameState } from '../../engine/types';
import { CardView } from '../CardView';
import { Modal } from '../Modal';

export function CleanupDiscardDialog({
  state,
  choice,
  onConfirm,
  onManualHandled,
  onUndo,
}: {
  state: GameState;
  choice: CleanupDiscardRuleChoice;
  onConfirm: (cardIds: string[]) => void;
  onManualHandled: () => void;
  onUndo: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const hand = state.zonesByPlayer[choice.playerId]?.hand ?? [];

  function toggle(cardId: string): void {
    setSelected((current) => current.includes(cardId)
      ? current.filter((id) => id !== cardId)
      : current.length >= choice.requiredCount
        ? current
        : [...current, cardId]);
  }

  return (
    <Modal title="クリーンナップ：手札調整" width="lg" testId="cleanup-discard-dialog">
      <p className="manual-target-dialog__note">
        手札上限まで、ちょうど{choice.requiredCount}枚を選んで捨ててください
        （{selected.length}/{choice.requiredCount}）。
      </p>
      <ul className="manual-target-dialog__list">
        {hand.map((cardId) => {
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
                  onChange={() => toggle(cardId)}
                  data-testid={`cleanup-discard-${cardId}`}
                />
                <span className="manual-target-dialog__thumb">
                  <CardView instance={card} def={def} size="small" />
                </span>
                <span><strong>《{name}》</strong><small>手札</small></span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onUndo} data-testid="cleanup-undo">
          戻る
        </button>
        <button type="button" className="btn" onClick={onManualHandled} data-testid="cleanup-manual-handled">
          手動処理済みとして続行
        </button>
        <button
          type="button"
          className="btn btn--accent"
          disabled={selected.length !== choice.requiredCount}
          onClick={() => onConfirm(selected)}
          data-testid="cleanup-discard-confirm"
        >
          {choice.requiredCount}枚捨てる
        </button>
      </div>
    </Modal>
  );
}
