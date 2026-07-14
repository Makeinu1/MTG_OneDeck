/**
 * StackBand — 盤面中央に開く、移動可能な非modal Stack Workspace。
 * 表示位置はUIローカル状態であり、GameState/snapshotへは保存しない。
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import {
  clampWorkspaceOffset,
  stackItemPresentations,
  type StackItemPresentation,
} from './stackWorkspaceModel';
import type { GameController } from './gameController';
import { ManualTargetDialog } from './ManualTargetDialog';

interface TargetLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function StackTargetLines({ items, offset }: {
  items: StackItemPresentation[];
  offset: { x: number; y: number };
}) {
  const [lines, setLines] = useState<TargetLine[]>([]);

  useLayoutEffect(() => {
    function measure(): void {
      const next: TargetLine[] = [];
      for (const item of items) {
        const source = document.querySelector<HTMLElement>(`[data-stack-item-id="${item.cardId}"]`);
        if (!source) continue;
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
  }, [items, offset]);

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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [manualTargetSourceId, setManualTargetSourceId] = useState<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (stackLen < prevLen.current && stackLen > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      prevLen.current = stackLen;
      return () => clearTimeout(timer);
    }
    prevLen.current = stackLen;
  }, [stackLen]);

  useEffect(() => {
    const reclamp = () => setOffset((current) => clampWorkspaceOffset(current, {
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, []);

  const { state } = controller;
  if (!state || state.zones.stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  const items = stackItemPresentations(state);

  function beginDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(clampWorkspaceOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }, { width: window.innerWidth, height: window.innerHeight }));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  const style = {
    '--stack-workspace-x': `${offset.x}px`,
    '--stack-workspace-y': `${offset.y}px`,
  } as React.CSSProperties;

  return (
    <>
      <StackTargetLines items={items} offset={offset} />
      <section
        className={`stack-band stack-workspace${flash ? ' stack-band--flash' : ''}`}
        data-testid="stack-band"
        style={style}
        aria-label={`スタック ${items.length}件`}
      >
        <div
          className="stack-workspace__handle"
          data-testid="stack-workspace-handle"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div>
            <strong>スタック</strong>
            <span>{items.length}件 · 上から順に解決</span>
          </div>
          <button type="button" onClick={() => setOffset({ x: 0, y: 0 })}>位置を戻す</button>
        </div>
        <ol className="stack-workspace__items">
          {items.map((item, index) => (
            <li key={item.cardId} data-stack-item-id={item.cardId} data-testid={`stack-workspace-item-${item.cardId}`}>
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
              </div>
            </li>
          ))}
        </ol>
        <footer>
          <span>手札・盤面から応答を追加できます</span>
          <button
            type="button"
            className="stack-band__resolve"
            data-testid="stack-band-resolve"
            onClick={() => controller.requestResolveTop()}
          >
            最上段を解決
          </button>
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
