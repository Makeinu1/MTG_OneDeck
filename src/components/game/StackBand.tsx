/** StackBand — board-stable centered overlay with a compact closed-state trigger. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameCard } from './GameCard';
import { stackItemPresentations, type StackItemPresentation } from './stackWorkspaceModel';
import type { GameController } from './gameController';
import { ManualTargetDialog } from './ManualTargetDialog';
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
            !element.closest('.stack-pile') && !element.closest('.game-card-preview'));
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

interface StackOverflowMenuProps {
  item: StackItemPresentation;
  controller: GameController;
  open: boolean;
  onToggle: () => void;
  onManualTarget: (cardId: string) => void;
}

/**
 * スタック項目の非常口(サンドボックス手動操作)を⋯へ格納。通常は表示しない。
 * メニューは position:absolute でカード基準に配置される(カード側が position:relative)。
 * transform を祖先に持つが absolute は transform 基準で正しく機能する。
 */
function StackOverflowMenu({ item, controller, open, onToggle, onManualTarget }: StackOverflowMenuProps) {
  const isAbility = controller.state?.cards[item.cardId]?.isAbility;
  return (
    <div className="stack-pile__overflow">
      <button
        type="button"
        className="stack-pile__overflow-trigger"
        data-testid={`stack-overflow-${item.cardId}`}
        aria-label={`その他の操作 ${item.name}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="stack-pile__overflow-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="stack-pile__overflow-item"
            data-testid={`stack-manual-target-${item.cardId}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
              onManualTarget(item.cardId);
            }}
          >
            {item.targets.length > 0 ? '対象を変更' : '対象を手動設定'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="stack-pile__overflow-item"
            data-testid={`stack-manual-remove-${item.cardId}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
              controller.store.removeStackItem(item.cardId);
            }}
          >
            {isAbility ? 'スタックから取り除く' : '手動で打ち消す'}
          </button>
        </div>
      )}
    </div>
  );
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
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [manualTargetSourceId, setManualTargetSourceId] = useState<string | null>(null);
  const [openOverflowId, setOpenOverflowId] = useState<string | null>(null);

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
  const expanded = expandedSessionId === sessionId || hasStackCandidate;

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hasStackCandidate) setExpandedSessionId(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [expanded, hasStackCandidate, sessionId]);

  const { state } = controller;
  if (!state || state.zones.stack.length === 0) {
    return <div className="stack-band stack-band--empty" data-testid="stack-band" aria-hidden />;
  }

  const items = stackItemPresentations(state);
  const selectedItem = items.find((item) => item.cardId === selectedCardId) ?? items[0];
  const toggleExpanded = () => {
    if (hasStackCandidate) return;
    setExpandedSessionId(expanded ? null : sessionId);
  };
  return (
    <>
      {expanded && <StackTargetLines item={selectedItem} />}
      <section
        id="stack-pile"
        className={`stack-band stack-pile${flash ? ' stack-band--flash' : ''}${
          controller.store.resolutionSession ? ' stack-pile--manual' : ''
        }`}
        data-testid="stack-band"
        data-expanded={expanded || undefined}
        aria-label={`スタック ${items.length}件`}
      >
        <button
          type="button"
          className="stack-pile__trigger"
          data-testid="stack-compact-trigger"
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          <strong>{items[0]?.name}</strong>
          <span className="stack-pile__count">{items.length}</span>
        </button>

        {!expanded ? (
          <div
            className="stack-pile__cards"
            role="button"
            tabIndex={0}
            aria-label={`スタック ${items.length}件。展開する`}
            onClick={toggleExpanded}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleExpanded();
              }
            }}
          >
            {items.map((item, index) => (
              <div
                key={item.cardId}
                className={`stack-pile__card${index === 0 ? ' stack-pile__card--front' : ''}`}
                data-stack-item-id={item.cardId}
                data-testid={`stack-workspace-item-${item.cardId}`}
                style={{
                  zIndex: items.length - index,
                  transform: index === 0
                    ? undefined
                    : `translate(${index * 18}px, ${index * 18}px) scale(${Math.pow(0.92, index)})`,
                  opacity: index === 0 ? undefined : Math.max(0.4, 1 - index * 0.2),
                }}
              >
                {/* スタックからの移動は resolveTop/removeStackItem が解決時効果(CR608)を
                    適用する専用経路を通す必要がある。汎用の D&D move-zone はそれを迂回して
                    効果を無言で落とすため、ここではドラッグ自体を無効化する。 */}
                <GameCard controller={controller} cardId={item.cardId} size="board" draggable={false} />
                {index === 0 && (
                  <StackOverflowMenu
                    item={item}
                    controller={controller}
                    open={openOverflowId === item.cardId}
                    onToggle={() => setOpenOverflowId(openOverflowId === item.cardId ? null : item.cardId)}
                    onManualTarget={setManualTargetSourceId}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <ol className="stack-pile__list">
            {items.map((item) => (
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
                <div className="stack-pile__card">
                  <GameCard controller={controller} cardId={item.cardId} size="board" draggable={false} />
                </div>
                <div className="stack-pile__item-info">
                  <span>{item.name}</span>
                  {item.announcedX !== undefined && (
                    <span className="stack-pile__x" data-testid={`stack-x-${item.cardId}`}>
                      X = {item.announcedX}
                    </span>
                  )}
                  {item.source && <span>発生源 {item.source}</span>}
                  {item.abilityText && <span>{item.abilityText}</span>}
                  {item.cardId === selectedItem?.cardId && (
                    <span className="stack-pile__targets">
                      対象{' '}
                      {item.targets.length > 0
                        ? item.targets.map((target, targetIndex) => (
                          <span
                            key={`${target.label}-${targetIndex}`}
                            className="stack-pile__target-chip"
                            data-target-player={target.playerId}
                            data-legality={target.legalityMode}
                          >
                            {target.label}{target.legalityMode === 'checked' ? '' : '（未検証）'}
                          </span>
                        ))
                        : 'なし／未記録'}
                    </span>
                  )}
                </div>
                <StackOverflowMenu
                  item={item}
                  controller={controller}
                  open={openOverflowId === item.cardId}
                  onToggle={() => setOpenOverflowId(openOverflowId === item.cardId ? null : item.cardId)}
                  onManualTarget={setManualTargetSourceId}
                />
              </li>
            ))}
          </ol>
        )}

        {controller.store.resolutionSession?.stage === 'manual-required' && (
          <div className="stack-pile__manual-task" data-testid="stack-manual-task">
            <strong>手動処理が必要です</strong>
            <span>{controller.store.resolutionSession.tasks[0]?.message}</span>
            <button type="button" onClick={() => controller.store.completeManualResolution()}>
              完了
            </button>
          </div>
        )}
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
