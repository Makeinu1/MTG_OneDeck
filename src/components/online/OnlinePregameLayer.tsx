import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
type PregamePhase = 'commander-reveal' | 'mulligan-declaration' | 'mulligan-bottom' | 'pregame-actions' | 'ready' | 'complete';
type PregamePlayer = Readonly<{
  readonly playerId: string;
  readonly commanderConfirmed: boolean;
  readonly mulliganDecision: 'pending' | 'mulligan' | 'keep';
  readonly mulligansTaken: number;
  readonly bottomCountRequired: number;
  readonly pendingBottomCount: number;
  readonly manualActionCount: number;
  readonly manualActionsComplete: boolean;
  readonly ready: boolean;
}>;
type PregameProjection = Readonly<{
  readonly revision: number;
  readonly phase: PregamePhase;
  readonly currentPlayerId: string | null;
  readonly startingPlayerId: string;
  readonly turnOrder: readonly string[];
  readonly players: readonly PregamePlayer[];
  readonly protocol: Readonly<{
    readonly corePlayerId: string | null;
    readonly game: Readonly<{ readonly zones: unknown }>;
  }>;
}>;

export type OnlinePregamePresentationPort = Readonly<{
  readonly projection: PregameProjection;
  readonly busy: boolean;
  readonly connection: 'online' | 'reconnecting' | 'failed' | 'connecting';
  readonly error: string | null;
  readonly onConfirmCommanders: () => void;
  readonly onMulliganDecision: (decision: 'mulligan' | 'keep') => void;
  readonly onSubmitMulliganBottom: (objectIds: readonly string[]) => void;
  readonly onRecordPregameAction: () => void;
  readonly onCompletePregameActions: () => void;
  readonly onSetReady: () => void;
}>;

type VisibleEntry = Readonly<{
  readonly objectId: string;
  readonly label: string;
  readonly commander: boolean;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function visibleEntries(zoneInput: unknown): readonly VisibleEntry[] {
  const zone = record(zoneInput);
  if (zone === null || !Array.isArray(zone.entries)) return [];
  return zone.entries.flatMap((entryInput) => {
    const entry = record(entryInput);
    if (entry?.kind !== 'visible-object' || typeof entry.objectId !== 'string') return [];
    const definition = record(entry.definition);
    const printedName = definition?.printedName;
    const name = definition?.name;
    const label = typeof printedName === 'string' && printedName !== ''
      ? printedName
      : typeof name === 'string' && name !== ''
        ? name
        : 'カード';
    return [{ objectId: entry.objectId, label: `《${label}》`, commander: entry.commander === true }];
  });
}

function ownHand(projection: PregameProjection): readonly VisibleEntry[] {
  const zones = record(projection.protocol.game.zones);
  if (zones === null || !Array.isArray(zones.byPlayer) || projection.protocol.corePlayerId === null) return [];
  const own = zones.byPlayer.map(record).find((group) => group?.playerId === projection.protocol.corePlayerId);
  return visibleEntries(record(own?.zones)?.hand);
}

function commanders(projection: PregameProjection): readonly VisibleEntry[] {
  return visibleEntries(record(projection.protocol.game.zones)?.command).filter((entry) => entry.commander);
}

const phaseLabels: Readonly<Record<PregamePhase, string>> = Object.freeze({
  'commander-reveal': '統率者の公開確認',
  'mulligan-declaration': 'マリガン',
  'mulligan-bottom': '手札から戻すカードの選択',
  'pregame-actions': 'ゲーム開始前の手動処理',
  ready: '開始準備',
  complete: '対戦開始',
});

export function PregameLayer({ port }: Readonly<{ readonly port: OnlinePregamePresentationPort }>) {
  const { projection } = port;
  const ownPlayerId = projection.protocol.corePlayerId;
  const ownPlayer = projection.players.find((player) => player.playerId === ownPlayerId);
  const isActor = ownPlayerId !== null && projection.currentPlayerId === ownPlayerId;
  const disabled = port.busy || port.connection !== 'online';
  const hand = useMemo(() => ownHand(projection), [projection]);
  const publicCommanders = useMemo(() => commanders(projection), [projection]);
  const [bottomSelection, setBottomSelection] = useState<readonly string[]>([]);

  const activateWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, action: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
  const bottomRequired = ownPlayer?.bottomCountRequired ?? 0;
  const transportLabel = port.connection === 'reconnecting'
    ? '再接続中です。表示が更新されるまで操作を待ってください。'
    : port.connection === 'failed'
      ? '接続を確認できません。ページを更新して対戦に戻ってください。'
      : port.busy
        ? 'サーバーで対戦準備を更新しています。'
        : null;

  return (
    <section className="pregame-layer" data-pregame-layer="true" data-pregame-phase={projection.phase} data-pregame-connection={port.connection} data-pregame-layout="adaptive" aria-labelledby="pregame-title">
        <header className="pregame-layer__header">
          <div>
            <p className="pregame-layer__eyebrow">COMMANDER PREGAME</p>
            <h1 id="pregame-title">{phaseLabels[projection.phase]}</h1>
          </div>
          <span aria-live="polite" data-testid="online-pregame-revision" data-projection-revision={projection.revision}>更新 {projection.revision}</span>
        </header>

        <section className="pregame-layer__order" aria-label="開始プレイヤーとターン順">
          <strong>開始プレイヤー: {projection.startingPlayerId}</strong>
          <ol>
            {projection.turnOrder.map((playerId) => <li key={playerId}>{playerId}</li>)}
          </ol>
        </section>

        <section className="pregame-layer__commanders" aria-label="公開された統率者">
          <h2>統率者</h2>
          {publicCommanders.length === 0
            ? <p>統率者の公開情報を確認しています。</p>
            : <ul>{publicCommanders.map((entry) => <li key={entry.objectId}>{entry.label}</li>)}</ul>}
        </section>

        <section className="pregame-layer__players" aria-label="対戦準備の状況">
          {projection.players.map((player) => (
            <article key={player.playerId} data-current-actor={projection.currentPlayerId === player.playerId || undefined}>
              <strong>{player.playerId === ownPlayerId ? 'あなた' : player.playerId}</strong>
              <span>統率者: {player.commanderConfirmed ? '確認済み' : '未確認'}</span>
              <span>マリガン: {player.mulligansTaken}回</span>
              <span>手動処理: {player.manualActionsComplete ? '完了' : `${player.manualActionCount}件`}</span>
              <span>準備: {player.ready ? '完了' : '待機中'}</span>
            </article>
          ))}
        </section>

        <section className="pregame-layer__action" aria-label="現在の操作">
          {projection.phase === 'commander-reveal' && (
            <>
              <p>{isActor ? '公開された統率者を確認してください。' : `${projection.currentPlayerId ?? '次のプレイヤー'}の確認を待っています。`}</p>
              <button type="button" className="btn btn--primary" data-testid="pregame-confirm-commanders" disabled={disabled || !isActor} onClick={port.onConfirmCommanders} onKeyDown={(event) => activateWithKeyboard(event, port.onConfirmCommanders)}>統率者を確認した</button>
            </>
          )}
          {projection.phase === 'mulligan-declaration' && (
            <>
              <p>あなたの手札: {hand.length}枚。現在の手札をキープするか、マリガンします。</p>
              <div className="pregame-layer__actions">
                <button type="button" className="btn btn--primary" data-testid="pregame-keep" disabled={disabled || !isActor} onClick={() => port.onMulliganDecision('keep')} onKeyDown={(event) => activateWithKeyboard(event, () => port.onMulliganDecision('keep'))}>キープ</button>
                <button type="button" className="btn btn--ghost" data-testid="pregame-mulligan" disabled={disabled || !isActor} onClick={() => port.onMulliganDecision('mulligan')} onKeyDown={(event) => activateWithKeyboard(event, () => port.onMulliganDecision('mulligan'))}>マリガン</button>
              </div>
            </>
          )}
          {projection.phase === 'mulligan-bottom' && (
            <>
              <p>手札からちょうど{bottomRequired}枚を選んでライブラリーの一番下へ置きます。</p>
              <fieldset className="pregame-layer__hand" disabled={disabled || !isActor}>
                <legend>戻すカード（{bottomSelection.length}/{bottomRequired}枚）</legend>
                {hand.map((entry) => {
                  const selected = bottomSelection.includes(entry.objectId);
                  return (
                    <label key={entry.objectId}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setBottomSelection((current) => selected ? current.filter((id) => id !== entry.objectId) : [...current, entry.objectId])}
                      />
                      <span>{entry.label}</span>
                    </label>
                  );
                })}
              </fieldset>
              <button type="button" className="btn btn--primary" data-testid="pregame-submit-bottom" disabled={disabled || !isActor || bottomSelection.length !== bottomRequired} onClick={() => port.onSubmitMulliganBottom(bottomSelection)} onKeyDown={(event) => activateWithKeyboard(event, () => port.onSubmitMulliganBottom(bottomSelection))}>選んだカードを下へ置く</button>
            </>
          )}
          {projection.phase === 'pregame-actions' && (
            <>
              <p>これはOracle効果の自動処理ではありません。ゲーム開始前の処理を盤面で行い、手動記録してください。</p>
              <div className="pregame-layer__actions">
                <button type="button" className="btn btn--ghost" data-testid="pregame-record-action" disabled={disabled || !isActor || (ownPlayer?.manualActionCount ?? 0) >= 16} onClick={port.onRecordPregameAction} onKeyDown={(event) => activateWithKeyboard(event, port.onRecordPregameAction)}>手動処理を1件記録</button>
                <button type="button" className="btn btn--primary" data-testid="pregame-complete-actions" disabled={disabled || !isActor} onClick={port.onCompletePregameActions} onKeyDown={(event) => activateWithKeyboard(event, port.onCompletePregameActions)}>手動処理を完了</button>
              </div>
            </>
          )}
          {projection.phase === 'ready' && (
            <>
              <p>全員の準備完了後、開始プレイヤーの第1ターンへ進みます。</p>
              <button type="button" className="btn btn--primary" data-testid="pregame-ready" disabled={disabled || ownPlayer === undefined || ownPlayer.ready} onClick={port.onSetReady} onKeyDown={(event) => activateWithKeyboard(event, port.onSetReady)}>{ownPlayer?.ready ? '準備完了済み' : '準備完了'}</button>
            </>
          )}
        </section>

        {(transportLabel !== null || port.error !== null) && (
          <div className="pregame-layer__notice" role="status" aria-live="polite">
            {transportLabel && <p>{transportLabel}</p>}
            {port.error && <p>{port.error}</p>}
          </div>
        )}
    </section>
  );
}
