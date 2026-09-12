import { useState } from 'react';
import type { CockpitSessionView, CockpitControl } from '../../online/browser/cockpitClient';

export function CockpitRoomControls({
  view,
  invitation,
  busy,
  send,
}: {
  view: CockpitSessionView;
  invitation: string | null;
  busy: boolean;
  send: (control: CockpitControl) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<{ type: 'kick' | 'eliminate'; seatId: string } | null>(
    null,
  );
  const multi = view.multiplayer;
  if (!multi) return null;
  const label = (id: string) => view.table.seats.find((seat) => seat.id === id)?.label ?? id;
  return (
    <section className="cockpit-session__bar" aria-label="対戦の操作権と参加">
      <strong>
        あなた: {label(multi.ownSeatId)} / 操作マスター: {label(multi.masterId)}
      </strong>
      <span>
        {!multi.started
          ? '全員の初手キープを待っています'
          : multi.paused
            ? '部屋主の接続待ち・操作停止中'
            : multi.canOperate
              ? 'あなたが卓を操作できます'
              : '盤面を閲覧中・操作にはHOLDを要求'}
      </span>
      {invitation && (
        <label>
          招待コード（参加者だけに共有）
          <input
            aria-label="招待コード"
            readOnly
            value={invitation}
            onFocus={(event) => event.target.select()}
            autoComplete="off"
          />
        </label>
      )}
      {multi.ownSeatId === 'P1' && !multi.started && (
        <button
          disabled={
            busy ||
            view.table.seats.some((seat) => !seat.kept) ||
            multi.members.length !== view.table.seats.length
          }
          onClick={() => void send({ type: 'start' })}
        >
          全員で対戦を開始
        </button>
      )}
      {multi.started && !view.table.ended && (
        <>
          <button
            disabled={busy || multi.paused}
            onClick={() =>
              void send({ type: 'hold', held: !multi.holds.includes(multi.ownSeatId) })
            }
          >
            {multi.holds.includes(multi.ownSeatId) ? '自分のHOLDを取り下げる' : 'HOLD・応答を要求'}
          </button>
          {multi.holds.map((id) => (
            <span key={id}>
              {label(id)} がHOLD中{' '}
              {multi.masterId === multi.ownSeatId &&
                id !== multi.ownSeatId &&
                !multi.borrowedFrom && (
                  <button disabled={busy} onClick={() => void send({ type: 'grant', seatId: id })}>
                    操作権を貸す
                  </button>
                )}
            </span>
          ))}
          {multi.borrowedFrom && multi.masterId === multi.ownSeatId && (
            <button disabled={busy} onClick={() => void send({ type: 'return' })}>
              操作権を返す
            </button>
          )}
          {multi.ownSeatId === 'P1' && (
            <button disabled={busy} onClick={() => void send({ type: 'reclaim' })}>
              部屋主が操作権を回収
            </button>
          )}
        </>
      )}
      <details>
        <summary>参加状態・脱落・退出</summary>
        {view.table.seats.map((seat) => (
          <p key={seat.id}>
            {seat.label}
            {!multi.started ? (seat.kept ? '・初手キープ済み' : '・初手確認中') : ''}:{' '}
            {seat.eliminated
              ? '脱落・閲覧のみ'
              : multi.members.find((member) => member.seatId === seat.id)?.connected
                ? '接続中'
                : '参加・再接続待ち'}{' '}
            {multi.canOperate && !seat.eliminated && (
              <button
                disabled={busy}
                onClick={() => setConfirm({ type: 'eliminate', seatId: seat.id })}
              >
                脱落を確認
              </button>
            )}{' '}
            {multi.ownSeatId === 'P1' &&
              seat.id !== 'P1' &&
              multi.members.some((member) => member.seatId === seat.id && !member.kicked) &&
              !view.table.ended && (
                <button
                  disabled={busy}
                  onClick={() => setConfirm({ type: 'kick', seatId: seat.id })}
                >
                  退出させる
                </button>
              )}
          </p>
        ))}
      </details>
      {confirm && (
        <div role="alert">
          <p>
            {label(confirm.seatId)}の{confirm.type === 'kick' ? '退出と脱落' : '脱落'}
            を確定します。この操作は取り消せません。他の人が所有するカードを制御している場合、効果に従って制御変更を終了し、なお制御している対象は手動で追放してください。
          </p>
          <button disabled={busy} onClick={() => void send(confirm).then(() => setConfirm(null))}>
            取消不可の確定
          </button>
          <button onClick={() => setConfirm(null)}>戻る</button>
        </div>
      )}
    </section>
  );
}
