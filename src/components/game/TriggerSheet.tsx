import { useMemo, useState } from 'react';
import type { TriggerCandidate } from '../../engine/triggers';
import type { GameController } from './gameController';
import { Icon } from '../../ui/icons';

export interface TriggerSheetProps {
  controller: GameController;
  onClose: () => void;
}

function candidateKey(candidate: TriggerCandidate): string {
  return candidate.pendingTriggerId ?? `${candidate.sourceId}:${candidate.triggerId}`;
}

function reorder(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function TriggerSheet({ controller, onClose }: TriggerSheetProps) {
  const candidates = controller.store.triggerCandidates;
  const pendingIds = useMemo(
    () => candidates.flatMap((candidate) => candidate.pendingTriggerId ? [candidate.pendingTriggerId] : []),
    [candidates],
  );
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const orderedIds = useMemo(() => {
    const live = new Set(pendingIds);
    const preserved = manualOrder.filter((id) => live.has(id));
    const preservedSet = new Set(preserved);
    return [...preserved, ...pendingIds.filter((id) => !preservedSet.has(id))];
  }, [manualOrder, pendingIds]);
  const byPendingId = useMemo(
    () => new Map(candidates.flatMap((candidate) =>
      candidate.pendingTriggerId ? [[candidate.pendingTriggerId, candidate] as const] : [])),
    [candidates],
  );
  const canOrder = candidates.length > 1 && pendingIds.length === candidates.length;
  const displayed = canOrder
    ? orderedIds.flatMap((id) => {
        const candidate = byPendingId.get(id);
        return candidate ? [candidate] : [];
      })
    : candidates;

  function place(candidate: TriggerCandidate): void {
    if (candidate.pendingTriggerId) {
      controller.store.putPendingTriggerOnStack(candidate.pendingTriggerId);
    } else {
      controller.store.addAbilityToStack(
        candidate.sourceId,
        'triggered',
        candidate.abilityLineIndex,
      );
    }
    onClose();
  }

  if (candidates.length === 0) return null;

  return (
    <div className="game-sheet-overlay game-sheet-overlay--triggers" data-testid="trigger-sheet-overlay">
      <section className="trigger-sheet" data-testid="trigger-sheet" aria-label="誘発を処理">
        <div className="game-sheet__header">
          <span className="game-sheet__title"><Icon name="bell" />誘発</span>
          <button type="button" className="game-sheet__close" data-testid="trigger-sheet-close" onClick={onClose}>
            閉じる
          </button>
        </div>
        {canOrder && (
          <p
            className="trigger-sheet__hint"
            title="上から順に置き、最後の能力がスタックの一番上になります。"
            aria-label="上から順に置き、最後の能力がスタックの一番上になります。"
          >
            <Icon name="info" />
            <span>下から解決</span>
          </p>
        )}
        <ul className="trigger-sheet__list">
          {displayed.map((candidate, index) => (
            <li key={candidateKey(candidate)} className="trigger-sheet__item">
              {canOrder && candidate.pendingTriggerId && (
                <span className="trigger-sheet__order">
                  <button
                    type="button"
                    disabled={index === 0}
                    data-testid={`trigger-sheet-up-${candidate.pendingTriggerId}`}
                    aria-label={`${candidate.label}を上へ`}
                    onClick={() => setManualOrder(reorder(orderedIds, index, index - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === displayed.length - 1}
                    data-testid={`trigger-sheet-down-${candidate.pendingTriggerId}`}
                    aria-label={`${candidate.label}を下へ`}
                    onClick={() => setManualOrder(reorder(orderedIds, index, index + 1))}
                  >
                    ↓
                  </button>
                </span>
              )}
              <span className="trigger-sheet__label">{candidate.label}</span>
              {!canOrder && (
                <button
                  type="button"
                  className="trigger-sheet__place"
                  data-testid={`trigger-sheet-place-${candidate.sourceId}`}
                  onClick={() => place(candidate)}
                >
                  スタックへ
                </button>
              )}
            </li>
          ))}
        </ul>
        {canOrder && (
          <button
            type="button"
            className="trigger-sheet__place-all"
            data-testid="trigger-sheet-place-ordered"
            onClick={() => {
              controller.store.placePendingTriggersForPriority(orderedIds);
              onClose();
            }}
          >
            <Icon name="stack" />この順で積む
          </button>
        )}
      </section>
    </div>
  );
}
