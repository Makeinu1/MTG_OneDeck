import type { GameController } from './gameController';

export function DecisionBar({ controller }: { controller: GameController }) {
  const focus = controller.decisionFocus;
  const state = controller.state;
  if (!focus || !state) return null;
  return (
    <section className="decision-bar" data-testid="decision-bar" data-kind={focus.kind} role="region" aria-live="polite" aria-label={`${focus.title}。${focus.instruction}`}>
      <div className="decision-bar__copy">
        <strong>{focus.title}</strong>
      </div>
      {focus.playerIds && focus.playerIds.length > 0 && (
        <div className="decision-bar__players" role="group" aria-label="プレイヤーを選択">
          {focus.playerIds.map((playerId) => (
            <button type="button" key={playerId} onClick={() => controller.chooseDecisionPlayer?.(playerId)}>
              {state.players[playerId]?.label ?? playerId}
            </button>
          ))}
        </div>
      )}
      {(focus.requiredCount !== undefined || focus.candidateIds.length > 0) && (
        <span className="decision-bar__count">
          {focus.requiredCount !== undefined
            ? `${focus.selectedIds.length}/${focus.requiredCount}`
            : `候補 ${focus.candidateIds.length}`}
        </span>
      )}
      {focus.warning && <span className="decision-bar__warning">{focus.warning}</span>}
      <button type="button" className="decision-bar__cancel" onClick={controller.cancelDecision}>キャンセル</button>
    </section>
  );
}
