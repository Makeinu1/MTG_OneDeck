/** StackBand — board-stable centered overlay with a compact closed-state trigger. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import { stackItemPresentations, type StackItemPresentation } from './stackWorkspaceModel';
import type { GameController } from './gameController';
import { ManualTargetDialog } from './ManualTargetDialog';
import { Icon } from '../../ui/icons';
import { objectIdOf } from '../../engine/types';

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
  const previousStackLenRef = useRef(stackLen);
  const [flash, setFlash] = useState(false);
  const bottomStackId = controller.state?.zones.stack[0];
  const bottomStackCard = bottomStackId ? controller.state?.cards[bottomStackId] : undefined;
  const sessionId = bottomStackCard
    ? `${bottomStackCard.id}:${objectIdOf(bottomStackCard)}`
    : 'empty';
  const [closedSessionId, setClosedSessionId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [manualTargetSourceId, setManualTargetSourceId] = useState<string | null>(null);

  useEffect(() => {
    const previous = previousStackLenRef.current;
    previousStackLenRef.current = stackLen;
    if (stackLen >= previous || stackLen === 0) return;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 720);
    return () => window.clearTimeout(timer);
  }, [stackLen]);

  const hasStackCandidate = controller.decisionFocus?.candidateIds.some(
    (cardId) => controller.state?.cards[cardId]?.zone === 'stack',
  ) ?? false;
  const effectiveOpen = (stackLen > 0 && closedSessionId !== sessionId) || hasStackCandidate;

  useEffect(() => {
    if (!effectiveOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hasStackCandidate) setClosedSessionId(sessionId);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [effectiveOpen, hasStackCandidate, sessionId]);

  const { state } = controller;
  if (!state || state.zones.stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  const items = stackItemPresentations(state);
  const selectedItem = items.find((item) => item.cardId === selectedCardId) ?? items[0];
  return (
    <>
      {effectiveOpen && <StackTargetLines item={selectedItem} />}
      <button
        type="button"
        className="stack-compact-trigger"
        data-testid="stack-compact-trigger"
        data-mobile-open={effectiveOpen || undefined}
        aria-expanded={effectiveOpen}
        aria-controls="stack-workspace"
        onClick={() => setClosedSessionId(null)}
      >
        <span>次に解決</span>
        <strong>{items[0]?.name}</strong>
        <small>{items.length}件</small>
      </button>
      {effectiveOpen && (
        <div
          className="stack-workspace__backdrop"
          data-testid="stack-workspace-scrim"
          aria-hidden="true"
        />
      )}
      <section
        id="stack-workspace"
        className={`stack-band stack-workspace${flash ? ' stack-band--flash' : ''}${
          controller.store.resolutionSession ? ' stack-workspace--manual' : ''
        }`}
        data-testid="stack-band"
        data-mobile-open={effectiveOpen || undefined}
        aria-label={`スタック ${items.length}件`}
      >
        <div className="stack-workspace__handle" data-testid="stack-workspace-handle">
          <div>
            <strong>スタック</strong>
            <span>{items.length}件 · 上から順に解決</span>
          </div>
          <button
            type="button"
            className="stack-workspace__close"
            onClick={() => {
              if (!hasStackCandidate) setClosedSessionId(sessionId);
            }}
          >閉じる</button>
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
                {item.abilityText && <span>{item.abilityText}</span>}
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
                            data-legality={target.legalityMode}
                          >
                            {target.label}{target.legalityMode === 'checked' ? '' : '（未検証）'}
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
                      {item.targets.length > 0 ? '対象を設定・変更' : '対象を手動設定'}
                    </button>
                    <button
                      type="button"
                      className="stack-workspace__manual-target"
                      data-testid={`stack-manual-remove-${item.cardId}`}
                      onClick={() => controller.store.removeStackItem(item.cardId)}
                    >
                      {state.cards[item.cardId]?.isAbility
                        ? 'スタックから取り除く'
                        : '手動で打ち消す'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
        {controller.store.resolutionSession?.stage === 'manual-required' && (
          <div className="stack-workspace__manual-task" data-testid="stack-manual-task">
            <strong>手動処理が必要です</strong>
            <span>{controller.store.resolutionSession.tasks[0]?.message}</span>
            <button type="button" onClick={() => controller.store.completeManualResolution()}>
              手動処理済み
            </button>
          </div>
        )}
        <footer title="手札・盤面を操作しながら、スタックへ対応または解決できます。">
          <button
            type="button"
            data-testid="stack-band-respond"
            onClick={() => setClosedSessionId(sessionId)}
            disabled={controller.store.resolutionSession !== null}
          >
            対応を追加
          </button>
          <button
            type="button"
            data-testid="stack-band-resolve-top"
            onClick={controller.requestResolveTop}
            disabled={selectedItem?.cardId !== items[0]?.cardId || controller.store.resolutionSession !== null}
          >
            <Icon name="phase-next" /> 上から解決
          </button>
          <button
            type="button"
            data-testid="stack-band-resolve-all"
            onClick={controller.requestResolveAll}
            disabled={controller.store.resolutionSession !== null}
          >
            全解決
          </button>
        </footer>
      </section>
      {manualTargetSourceId && state.cards[manualTargetSourceId]?.zone === 'stack' && (
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
