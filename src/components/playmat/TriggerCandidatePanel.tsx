import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { TriggerCandidate } from '../../engine/triggers';

function candidateKey(candidate: TriggerCandidate): string {
  return candidate.pendingTriggerId ?? `${candidate.sourceId}:${candidate.triggerId}`;
}

function reorder(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length ||
    fromIndex === toIndex
  ) {
    return [...ids];
  }

  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function TriggerCandidatePanel() {
  const store = useGameStore();
  const { triggerCandidates } = store;
  const pendingTriggerIds = useMemo(
    () =>
      triggerCandidates.flatMap((candidate) =>
        candidate.pendingTriggerId ? [candidate.pendingTriggerId] : [],
      ),
    [triggerCandidates],
  );
  const canPlaceOrdered =
    triggerCandidates.length > 1 && pendingTriggerIds.length === triggerCandidates.length;
  const [manualPendingOrder, setManualPendingOrder] = useState<string[]>([]);
  const orderedPendingIds = useMemo(() => {
      if (!canPlaceOrdered) return pendingTriggerIds;
      const currentSet = new Set(pendingTriggerIds);
      const preserved = manualPendingOrder.filter((id) => currentSet.has(id));
      const preservedSet = new Set(preserved);
      const appended = pendingTriggerIds.filter((id) => !preservedSet.has(id));
      return [...preserved, ...appended];
  }, [canPlaceOrdered, manualPendingOrder, pendingTriggerIds]);

  const candidateByPendingId = useMemo(
    () =>
      new Map(
        triggerCandidates.flatMap((candidate) =>
          candidate.pendingTriggerId ? [[candidate.pendingTriggerId, candidate] as const] : [],
        ),
      ),
    [triggerCandidates],
  );
  const displayedCandidates = canPlaceOrdered
    ? orderedPendingIds.flatMap((id) => {
        const candidate = candidateByPendingId.get(id);
        return candidate ? [candidate] : [];
      })
    : triggerCandidates;

  function moveOrderedCandidate(pendingTriggerId: string, direction: -1 | 1): void {
    const fromIndex = orderedPendingIds.indexOf(pendingTriggerId);
    setManualPendingOrder(reorder(orderedPendingIds, fromIndex, fromIndex + direction));
  }

  if (triggerCandidates.length === 0) {
    return null;
  }

  return (
    <section
      className="trigger-candidates"
      data-testid="trigger-candidates"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="trigger-candidates__header">
        <h2>誘発候補</h2>
        <div className="trigger-candidates__actions">
          {canPlaceOrdered && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              data-testid="trigger-candidates-place-ordered"
              onClick={() => store.placePendingTriggersForPriority(orderedPendingIds)}
            >
              この順でスタックへ
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            data-testid="trigger-candidates-dismiss"
            onClick={() => store.dismissTriggerCandidates()}
          >
            無視
          </button>
        </div>
      </div>

      {canPlaceOrdered && (
        <p className="trigger-candidates__hint">
          上から順にスタックへ置きます。上の能力ほど下側に置かれ、最後の能力が一番上になります。
        </p>
      )}

      <ul className="trigger-candidates__list">
        {displayedCandidates.map((candidate, index) => (
          <li
            key={candidateKey(candidate)}
            className="trigger-candidates__item"
          >
            {canPlaceOrdered && candidate.pendingTriggerId && (
              <div className="trigger-candidates__order-controls">
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  data-testid={`trigger-order-up-${candidate.pendingTriggerId}`}
                  disabled={index === 0}
                  onClick={() => moveOrderedCandidate(candidate.pendingTriggerId as string, -1)}
                  aria-label={`${candidate.label}を上へ`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  data-testid={`trigger-order-down-${candidate.pendingTriggerId}`}
                  disabled={index === displayedCandidates.length - 1}
                  onClick={() => moveOrderedCandidate(candidate.pendingTriggerId as string, 1)}
                  aria-label={`${candidate.label}を下へ`}
                >
                  ↓
                </button>
              </div>
            )}
            <span className="trigger-candidates__label">{candidate.label}</span>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              data-testid={`trigger-candidate-add-${candidate.sourceId}`}
              onClick={() => {
                if (candidate.pendingTriggerId) {
                  store.putPendingTriggerOnStack(candidate.pendingTriggerId);
                  return;
                }
                store.addAbilityToStack(
                  candidate.sourceId,
                  'triggered',
                  candidate.abilityLineIndex,
                );
              }}
            >
              スタックへ
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
