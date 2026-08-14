import type { PersonalWorkbenchActionV1 } from '../../online/workbench/index';
import {
  buildOnlineDisplayPairingViewV1,
  createOnlineOpponentFocusActionV1,
  type OnlineOpponentFocusActionV1,
} from '../../online/displayPairing/index';
import { PersonalWorkbench } from './PersonalWorkbench';
import { TableDisplay } from './TableDisplay';
import './onlineDisplayPairing.css';

export type OnlineDisplayPairingProps = Readonly<{
  readonly personalProjection: unknown;
  readonly tableProjection: unknown;
  readonly interactionState: 'ready' | 'updating' | 'offline';
  readonly focusedPlayerId: string | null;
  readonly onFocus: (action: OnlineOpponentFocusActionV1) => void;
  readonly onAction: (action: PersonalWorkbenchActionV1) => void;
}>;

function interactionLabel(state: OnlineDisplayPairingProps['interactionState']): string {
  if (state === 'updating') return '表示を更新しています';
  if (state === 'offline') return '表示同期は保留中';
  return '表示を同期しました';
}

function unavailable() {
  return (
    <main className="online-display-pairing__unavailable" data-testid="online-display-pairing-unavailable">
      表示を同期できません
    </main>
  );
}

export function OnlineDisplayPairing({
  personalProjection,
  tableProjection,
  interactionState,
  focusedPlayerId,
  onFocus,
  onAction,
}: OnlineDisplayPairingProps) {
  let view;
  try {
    view = buildOnlineDisplayPairingViewV1({ personalProjection, tableProjection, focusedPlayerId });
  } catch {
    view = null;
  }
  if (view === null) return unavailable();

  return (
    <main className="online-display-pairing" data-testid="online-display-pairing">
      <header className="online-display-pairing__status" data-testid="online-display-pairing-status">
        <p>{interactionLabel(interactionState)} / リビジョン {view.revision}</p>
        <p>自分の席 {view.ownSeatIndex + 1} / 対戦相手の席情報を表示しています</p>
        <p>優先権保持者の情報は含まれていません</p>
      </header>

      <section className="online-display-pairing__opponents" aria-label="対戦相手の席">
        {view.opponents.map((opponent) => {
          const exited = opponent.status === 'exited';
          return (
            <button
              type="button"
              className="online-display-pairing__focus"
              data-testid="online-opponent-focus"
              key={opponent.playerId}
              aria-pressed={opponent.isFocused}
              disabled={exited}
              onClick={() => onFocus(createOnlineOpponentFocusActionV1(opponent.playerId, view.revision))}
            >
              <strong>プレイヤー {opponent.playerId}</strong>
              <span>席 {opponent.seatIndex + 1}{opponent.isActive ? '（手番）' : ''}</span>
              <span>{exited ? '退席済み' : 'フォーカスを選択'}</span>
            </button>
          );
        })}
      </section>

      {view.focusedOpponent !== null && (
        <section className="online-display-pairing__focused" data-testid="online-focused-opponent" aria-label="フォーカス中の公開情報">
          <h2>フォーカス中の公開情報</h2>
          <p>プレイヤー {view.focusedOpponent.playerId} / 席 {view.focusedOpponent.seatIndex + 1}</p>
          <p>ライフ {view.focusedOpponent.life} / 毒 {view.focusedOpponent.poison}</p>
          <p>接続状態 {view.focusedOpponent.presence === 'connected' ? '接続中' : '切断中'} / 状態 {view.focusedOpponent.status === 'active' ? 'プレイ中' : '退席済み'}</p>
        </section>
      )}

      <div className="online-display-pairing__surfaces">
        <section className="online-display-pairing__surface" aria-label="自分の操作画面">
          <PersonalWorkbench
            key={`personal-${JSON.stringify(view)}`}
            projection={personalProjection}
            interactionState={interactionState}
            onAction={onAction}
          />
        </section>
        <section className="online-display-pairing__surface" aria-label="テーブル公開画面">
          <TableDisplay key={`table-${JSON.stringify(view)}`} projection={tableProjection} />
        </section>
      </div>
    </main>
  );
}
