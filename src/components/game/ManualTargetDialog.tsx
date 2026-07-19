import { CardView } from '../CardView';
import { Modal } from '../Modal';
import type { GameState, PlayerId } from '../../engine/types';
import { activatedAbilityLines } from '../../engine/grammar';
import { activatedAbilityDisplayText } from './abilityDisplay';
import { useInteractionHistory } from '../../hooks/useInteractionHistory';
import { ZONE_LABELS_JA } from '../../data/zoneLabels';

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
  const candidateGroups = [
    { zone: 'stack', ids: state.zones.stack.filter((id) => id !== sourceId) },
    { zone: 'battlefield', ids: state.zones.battlefield.filter((id) => !state.cards[id]?.isAbility) },
    { zone: 'hand', ids: state.zonesByPlayer[state.localPlayerId]?.hand ?? [] },
    {
      zone: 'graveyard',
      ids: state.turnOrder.flatMap((playerId) => state.zonesByPlayer[playerId]?.graveyard ?? []),
    },
    { zone: 'exile', ids: state.zones.exile },
    { zone: 'command', ids: state.zones.command },
  ] as const;
  const candidates = candidateGroups.flatMap((group) => group.ids);
  const current = new Set(
    (state.cards[sourceId]?.targetSelections ?? []).flatMap((target) =>
      target.slotId.startsWith('manual-target-')
      && target.selection.kind === 'object'
      && candidates.includes(target.selection.physicalCardId)
        ? [target.selection.physicalCardId]
        : []),
  );
  const currentPlayers = new Set(
    (state.cards[sourceId]?.targetSelections ?? []).flatMap((target) =>
      target.slotId.startsWith('manual-target-') && target.selection.kind === 'player'
        ? [target.selection.playerId]
        : []),
  );
  const [selection, setSelection] = useInteractionHistory(
    { cards: [...current], players: [...currentPlayers] },
    onCancel,
  );
  const selected = selection.cards;
  const selectedPlayers = selection.players;
  const playerTargets = state.turnOrder.flatMap((playerId) => {
    const player = state.players[playerId];
    return player
      ? [{ playerId, label: playerId === state.localPlayerId ? '自分（プレイヤー）' : player.label }]
      : [];
  });

  function setChecked(cardId: string, checked: boolean): void {
    setSelection((currentSelection) => ({
      ...currentSelection,
      cards: checked
        ? (currentSelection.cards.includes(cardId)
          ? currentSelection.cards
          : [...currentSelection.cards, cardId])
        : currentSelection.cards.filter((id) => id !== cardId),
    }));
  }

  function setPlayerChecked(playerId: PlayerId, checked: boolean): void {
    setSelection((currentSelection) => ({
      ...currentSelection,
      players: checked
        ? (currentSelection.players.includes(playerId)
          ? currentSelection.players
          : [...currentSelection.players, playerId])
        : currentSelection.players.filter((id) => id !== playerId),
    }));
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
        <p className="zone-viewer__empty">選べる呪文・能力・パーマネントはありません。</p>
      ) : (
        <div className="manual-target-dialog__groups">
          {candidateGroups.filter((group) => group.ids.length > 0).map((group) => (
            <section key={group.zone} className="manual-target-dialog__group" data-zone={group.zone}>
              <h3>{ZONE_LABELS_JA[group.zone]}</h3>
              <ul className="manual-target-dialog__list">
          {group.ids.map((cardId) => {
            const card = state.cards[cardId];
            const def = card ? state.defs[card.defId] : undefined;
            if (!card || !def) return null;
            const face = def.faces[card.faceIndex] ?? def.faces[0];
            const name = face?.printedName ?? face?.name ?? def.printedName ?? def.name;
            const checked = selected.includes(cardId);
            const abilityLine = card.isAbility && card.abilityLineIndex !== undefined
              ? activatedAbilityLines(def).find((line) => line.index === card.abilityLineIndex)
              : undefined;
            const abilityText = abilityLine ? activatedAbilityDisplayText(def, abilityLine) : undefined;
            const controllerLabel = state.players[card.controllerId]?.label ?? card.controllerId;
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
                    <small>{card.zone === 'stack'
                      ? card.isAbility
                        ? `スタック上の${card.abilityKind === 'triggered' ? '誘発型能力' : '起動型能力'}`
                        : 'スタック上の呪文'
                      : `${ZONE_LABELS_JA[card.zone]} / ${controllerLabel}`}</small>
                    {abilityText && <small>{abilityText}</small>}
                  </span>
                </label>
              </li>
            );
          })}
              </ul>
            </section>
          ))}
        </div>
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
