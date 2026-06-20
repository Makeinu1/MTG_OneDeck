import { CardView } from '../CardView';
import { Modal } from '../Modal';
import type { GameState } from '../../engine/types';

export interface TargetPickerDialogProps {
  title: string;
  cardIds: string[];
  state: GameState;
  onPick: (targetId: string) => void;
  onCancel: () => void;
}

function displayNameFor(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '不明';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
}

export function TargetPickerDialog({
  title,
  cardIds,
  state,
  onPick,
  onCancel,
}: TargetPickerDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} width="lg" testId="target-picker">
      {cardIds.length === 0 ? (
        <p className="zone-viewer__empty">対象がありません。</p>
      ) : (
        <ul className="zone-viewer__list">
          {cardIds.map((cardId) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;

            return (
              <li key={cardId} className="zone-viewer__item">
                <div className="zone-viewer__thumb">
                  <CardView instance={card} def={def} size="small" />
                </div>
                <div className="zone-viewer__info">
                  <span className="zone-viewer__name">《{displayNameFor(state, cardId)}》</span>
                  <div className="zone-viewer__targets">
                    <button
                      type="button"
                      className="btn btn--accent btn--sm"
                      onClick={() => onPick(cardId)}
                      data-testid={`select-target-${cardId}`}
                    >
                      選択
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dialog__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          data-testid="target-picker-cancel"
        >
          キャンセル
        </button>
      </div>
    </Modal>
  );
}
