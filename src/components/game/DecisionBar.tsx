import type { GameController } from './gameController';

export function DecisionBar({ controller }: { controller: GameController }) {
  const focus = controller.decisionFocus;
  const state = controller.state;
  if (!focus || !state) return null;
  const teamwork = controller.teamworkInfo;
  return (
    <section className="decision-bar" data-testid="decision-bar" data-kind={focus.kind} role="region" aria-live="polite" aria-label={`${focus.title}。${focus.instruction}`}>
      <div className="decision-bar__copy">
        <strong>{focus.title}</strong>
      </div>
      {teamwork && (
        <span className="decision-bar__count" data-testid="teamwork-power">
          {`パワー ${teamwork.totalPower}/${teamwork.threshold}`}
        </span>
      )}
      {focus.playerIds && focus.playerIds.length > 0 && (
        <div className="decision-bar__players" role="group" aria-label="プレイヤーを選択">
          {focus.playerIds.map((playerId) => (
            <button type="button" key={playerId} onClick={() => controller.chooseDecisionPlayer?.(playerId)}>
              {state.players[playerId]?.label ?? playerId}
            </button>
          ))}
        </div>
      )}
      {!teamwork && (focus.requiredCount !== undefined || focus.candidateIds.length > 0) && (
        <span className="decision-bar__count">
          {focus.requiredCount !== undefined
            ? `${focus.selectedIds.length}/${focus.requiredCount}`
            : `候補 ${focus.candidateIds.length}`}
        </span>
      )}
      {!teamwork && focus.zeroChoice && (
        <button
          type="button"
          className="decision-bar__zero"
          data-testid="guided-zero-confirm"
          onClick={controller.confirmGuidedZeroChoice}
        >
          {focus.zeroChoice.label}
        </button>
      )}
      {focus.warning && <span className="decision-bar__warning">{focus.warning}</span>}
      {teamwork && (
        <div className="decision-bar__teamwork" role="group" aria-label="チームワーク">
          <button
            type="button"
            data-testid="teamwork-confirm"
            disabled={!teamwork.canConfirm}
            onClick={controller.confirmTeamwork}
          >
            チームワークする
          </button>
          <button type="button" data-testid="teamwork-decline" onClick={controller.declineTeamwork}>
            チームワークしない
          </button>
        </div>
      )}
      <button type="button" className="decision-bar__cancel" onClick={controller.cancelDecision}>キャンセル</button>
    </section>
  );
}
