import { useGameStore } from '../../store/gameStore';

export function TriggerCandidatePanel() {
  const store = useGameStore();
  const { triggerCandidates } = store;

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
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          data-testid="trigger-candidates-dismiss"
          onClick={() => store.dismissTriggerCandidates()}
        >
          無視
        </button>
      </div>

      <ul className="trigger-candidates__list">
        {triggerCandidates.map((candidate) => (
          <li
            key={`${candidate.sourceId}-${candidate.triggerId}`}
            className="trigger-candidates__item"
          >
            <span className="trigger-candidates__label">{candidate.label}</span>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              data-testid={`trigger-candidate-add-${candidate.sourceId}`}
              onClick={() => store.addAbilityToStack(candidate.sourceId, 'triggered')}
            >
              スタックへ
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
