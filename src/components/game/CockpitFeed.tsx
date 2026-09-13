import { projectFeed } from './feedProjection';
import { useState } from 'react';
import type { CockpitTable, TableOperation } from '../../engine/cockpitTable';
import { nextTriggerController } from '../../engine/cockpitTriggers';
import { CockpitWorkPanel } from './CockpitWorkPanel';
import { CockpitAbilityTools } from './CockpitAbilityTools';

export function CockpitFeed({
  table,
  open,
  onClose,
  selected,
  disabled,
  send,
}: {
  table: CockpitTable;
  open: boolean;
  onClose: () => void;
  selected: string[];
  disabled: boolean;
  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const records = table.triggers?.candidates ?? [];
  const timeline = projectFeed([], [], table.triggers?.feed ?? []);
  const candidate = records.find((c) => c.pendingTriggerId === editing && c.status === 'pending');
  const nextController = nextTriggerController(table);
  return (
    <div className="cockpit-feed">
      <CockpitWorkPanel title="Feed" open={open} onClose={onClose}>
        {candidate ? (
          <>
            <button onClick={() => setEditing(null)}>一覧へ</button>
            <CockpitAbilityTools
              key={candidate.pendingTriggerId}
              table={table}
              sourceId={candidate.sourceId}
              selected={selected}
              disabled={disabled || !!table.resolution || table.hold}
              send={send}
              expanded
              candidate={candidate}
            />
          </>
        ) : (
          <>
            <h3>未処理</h3>
            {!records.some((c) => c.status === 'pending') && <p>未処理の誘発はありません</p>}
            {records
              .filter((c) => c.status === 'pending')
              .map((c) => (
                <section key={c.pendingTriggerId} className="feed__item">
                  <strong>{c.label}</strong>
                  <p>
                    {table.seats.find((s) => s.id === c.controllerId)?.label} ·{' '}
                    {c.requiresManualRuling
                      ? '要確認'
                      : table.resolution
                        ? '解決後に登録'
                        : '登録待ち'}
                  </p>
                  <details>
                    <summary>本文・根拠</summary>
                    <p>{c.text}</p>
                    <small>
                      {c.triggerId} · {c.sourceSnapshot.zone}
                    </small>
                  </details>
                  <button
                    disabled={
                      disabled ||
                      !!table.resolution ||
                      table.hold ||
                      (!!nextController && nextController !== c.controllerId)
                    }
                    onClick={() => setEditing(c.pendingTriggerId)}
                  >
                    スタックへ
                  </button>
                  <details>
                    <summary>手動登録と対応</summary>
                    {table.stack
                      .filter(
                        (e) =>
                          e.kind === 'triggered' &&
                          e.source.id === c.sourceId &&
                          e.controllerId === c.controllerId &&
                          !records.some((r) => r.entryId === e.id),
                      )
                      .map((e) => (
                        <button
                          key={e.id}
                          disabled={disabled || !!table.resolution || table.hold}
                          onClick={() =>
                            void send({
                              type: 'trigger.link',
                              candidateId: c.pendingTriggerId,
                              entryId: e.id,
                            })
                          }
                        >
                          {e.text}
                        </button>
                      ))}
                  </details>
                  <details>
                    <summary>候補から外す</summary>
                    <input
                      aria-label="候補を外す理由"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                    />
                    <button
                      disabled={disabled || !reason.trim()}
                      onClick={() =>
                        void send({
                          type: 'trigger.dismiss',
                          candidateId: c.pendingTriggerId,
                          reason,
                        }).then((ok) => {
                          if (ok) setReason('');
                        })
                      }
                    >
                      理由を記録して外す
                    </button>
                  </details>
                </section>
              ))}
            <h3>記録</h3>
            {timeline.map((item) => (
              <p key={item.id}>{item.text}</p>
            ))}
            {records
              .filter((c) => c.status !== 'pending')
              .slice()
              .reverse()
              .map((c) => (
                <p key={c.pendingTriggerId}>
                  {c.label} ·{' '}
                  {c.status === 'dismissed'
                    ? `候補除外：${c.reason}`
                    : c.status === 'resolved'
                      ? '解決済み'
                      : c.status === 'removed'
                        ? 'スタックから除去'
                        : c.status === 'linked'
                          ? '手動登録と対応済み'
                          : 'スタックに登録済み'}
                </p>
              ))}
          </>
        )}
      </CockpitWorkPanel>
    </div>
  );
}
