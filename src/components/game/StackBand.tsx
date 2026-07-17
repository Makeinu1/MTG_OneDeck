/** StackBand — desktop right rail / compact mobile sheet. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import { stackItemPresentations, type StackItemPresentation } from './stackWorkspaceModel';
import type { GameController } from './gameController';
import { ManualTargetDialog } from './ManualTargetDialog';

interface TargetLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function StackTargetLines({ item }: { item: StackItemPresentation | undefined }) {
  const [lines, setLines] = useState<TargetLine[]>([]);

  useLayoutEffect(() => {
    function measure(): void {
      const next: TargetLine[] = [];
      if (item) {
        const source = document.querySelector<HTMLElement>(`[data-stack-item-id="${item.cardId}"]`);
        if (!source || source.getClientRects().length === 0) {
          setLines([]);
          return;
        }
        const sourceRect = source.getBoundingClientRect();
        item.targets.forEach((target, index) => {
          const stackTarget = target.cardId
            ? document.querySelector<HTMLElement>(`[data-stack-item-id="${target.cardId}"]`)
            : null;
          const targetElements = target.cardId
            ? Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="card-${target.cardId}"]`))
            : target.playerId === 'P1'
              ? Array.from(document.querySelectorAll<HTMLElement>('[data-testid="life-value"]'))
              : target.playerId
                ? Array.from(document.querySelectorAll<HTMLElement>(
                  `[data-stack-item-id="${item.cardId}"] [data-target-player="${target.playerId}"]`,
                ))
                : [];
          const destination = stackTarget ?? targetElements.find((element) =>
            !element.closest('.stack-workspace') && !element.closest('.game-card-preview'));
          if (!destination) return;
          const targetRect = destination.getBoundingClientRect();
          next.push({
            key: `${item.cardId}:${index}`,
            x1: sourceRect.left + sourceRect.width / 2,
            y1: sourceRect.top + sourceRect.height / 2,
            x2: targetRect.left + targetRect.width / 2,
            y2: targetRect.top + targetRect.height / 2,
          });
        });
      }
      setLines(next);
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [item]);

  if (lines.length === 0) return null;
  return (
    <svg className="stack-target-lines" data-testid="stack-target-lines" aria-hidden>
      <defs>
        <marker id="stack-target-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {lines.map(({ key, x1, y1, x2, y2 }) => (
        <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#stack-target-arrow)" />
      ))}
    </svg>
  );
}

export interface StackBandProps {
  controller: GameController;
}

export function StackBand({ controller }: StackBandProps) {
  const stackLen = controller.state?.zones.stack.length ?? 0;
  const prevLen = useRef(stackLen);
  const [flash, setFlash] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [manualTargetSourceId, setManualTargetSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (stackLen < prevLen.current && stackLen > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      prevLen.current = stackLen;
      return () => clearTimeout(timer);
    }
    prevLen.current = stackLen;
  }, [stackLen]);

  const { state } = controller;
  if (!state || state.zones.stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  const items = stackItemPresentations(state);
  const selectedItem = items.find((item) => item.cardId === selectedCardId) ?? items[0];

  return (
    <>
      <StackTargetLines item={selectedItem} />
      <button
        type="button"
        className="stack-compact-trigger"
        data-testid="stack-compact-trigger"
        data-mobile-open={mobileOpen || undefined}
        aria-expanded={mobileOpen}
        aria-controls="stack-workspace"
        onClick={() => setMobileOpen(true)}
      >
        <span>次に解決</span>
        <strong>{items[0]?.name}</strong>
        <small>{items.length}件</small>
      </button>
      <section
        id="stack-workspace"
        className={`stack-band stack-workspace${flash ? ' stack-band--flash' : ''}`}
        data-testid="stack-band"
        data-mobile-open={mobileOpen || undefined}
        aria-label={`スタック ${items.length}件`}
      >
        <div className="stack-workspace__handle" data-testid="stack-workspace-handle">
          <div>
            <strong>スタック</strong>
            <span>{items.length}件 · 上から順に解決</span>
          </div>
          <button type="button" className="stack-workspace__close" onClick={() => setMobileOpen(false)}>閉じる</button>
        </div>
        <ol className="stack-workspace__items">
          {items.map((item, index) => (
            <li
              key={item.cardId}
              className={item.cardId === selectedItem?.cardId ? 'is-selected' : ''}
              data-stack-item-id={item.cardId}
              data-testid={`stack-workspace-item-${item.cardId}`}
              tabIndex={0}
              onMouseEnter={() => setSelectedCardId(item.cardId)}
              onFocus={() => setSelectedCardId(item.cardId)}
              onClick={() => setSelectedCardId(item.cardId)}
            >
              <div className="stack-workspace__card">
                {/* スタックからの移動は resolveTop/removeStackItem が解決時効果(CR608)を
                    適用する専用経路を通す必要がある。汎用の D&D move-zone はそれを迂回して
                    効果を無言で落とすため、ここではドラッグ自体を無効化する。 */}
                <GameCard controller={controller} cardId={item.cardId} size="board" draggable={false} />
              </div>
              <div className="stack-workspace__item-info">
                <strong>{index === 0 ? '次に解決' : `${index + 1}番目`}</strong>
                <span>{item.name}</span>
                {item.announcedX !== undefined && (
                  <span className="stack-workspace__x" data-testid={`stack-x-${item.cardId}`}>
                    X = {item.announcedX}
                  </span>
                )}
                {item.source && <span>発生源 {item.source}</span>}
                {item.cardId === selectedItem?.cardId && (
                  <>
                    <span className="stack-workspace__targets">
                      対象{' '}
                      {item.targets.length > 0
                        ? item.targets.map((target, targetIndex) => (
                          <span
                            key={`${target.label}-${targetIndex}`}
                            className="stack-workspace__target-chip"
                            data-target-player={target.playerId}
                          >
                            {target.label}
                          </span>
                        ))
                        : 'なし／未記録'}
                    </span>
                    <button
                      type="button"
                      className="stack-workspace__manual-target"
                      data-testid={`stack-manual-target-${item.cardId}`}
                      onClick={() => setManualTargetSourceId(item.cardId)}
                    >
                      対象を手動設定
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        <footer>
          <span>解決は画面下のプライマリアクションから。手札・盤面から応答を追加できます。</span>
        </footer>
      </section>
      {manualTargetSourceId && (
        <ManualTargetDialog
          state={state}
          sourceId={manualTargetSourceId}
          onConfirm={(targetIds, targetPlayerIds) => {
            controller.setManualTargets(manualTargetSourceId, targetIds, targetPlayerIds);
            setManualTargetSourceId(null);
          }}
          onCancel={() => setManualTargetSourceId(null)}
        />
      )}
    </>
  );
}
