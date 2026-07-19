/**
 * GameCard — 新レイアウトのカード1枚。CardView(共有レンダラ)を controller に配線する薄いラッパ。
 * モバイルはタップ→プレビュー／ダブルタップ→操作、デスクトップは右クリック→操作。
 * 幅は親(棚/手札)が制御。
 */

import { useEffect, useRef, useState } from 'react';
import { CardView } from '../CardView';
import { isCommander } from '../../engine/commander';
import { isSummoningSick } from '../../engine/status';
import type { GameController } from './gameController';
import { CardPreview } from './CardPreview';
import type { CardPreviewAnchor } from './cardPreviewPosition';
import { DRAG_UI_END_EVENT, DRAG_UI_START_EVENT } from './dragUiEvents';
import { decisionCardRole } from './decisionFocus';
import { quickAbilityAction, quickAbilityLabel } from './quickAbilityAction';
import { activatedManaAbilityPlanForSource } from '../../engine/commands';
import { Icon } from '../../ui/icons';

const PREVIEW_DELAY_MS = 150;
const DOUBLE_TAP_WINDOW_MS = 280;
const DOUBLE_TAP_RADIUS_PX = 24;

export interface GameCardProps {
  controller: GameController;
  cardId: string;
  /** 手札=大きめ / 盤面=棚幅。CSS class 側で幅を割り当てる。 */
  size?: 'board' | 'hand';
  /** プレイ可能ハイライト(金縁発光・D3)。 */
  playable?: boolean;
  /** 統率者専用領域など、周囲の見出しで識別済みならカード内バッジを省略する。 */
  showCommanderBadge?: boolean;
  /** プレビュー等の複製カードでは無効化する。GameScreen上の実カードは既定で有効。 */
  draggable?: boolean;
  /** DrawFlight が同じカードを運んでいる間、手札側の実体を隠す。 */
  arriving?: boolean;
}

export function GameCard({
  controller,
  cardId,
  size = 'board',
  playable = false,
  showCommanderBadge = true,
  draggable = true,
  arriving = false,
}: GameCardProps) {
  const { state } = controller;
  // マウント時点の motionArmed を捕捉(以降 arm が変わっても再演出しない・D5 Tier-1 #1)。
  // 初期マウント/再開のカードは armed=false → 演出せず。以降に入るカードだけ celebrate クラス付与。
  const [celebrateOnMount] = useState(() => controller.motionArmed);
  const [previewAnchor, setPreviewAnchor] = useState<CardPreviewAnchor | null>(null);
  const [previewPinned, setPreviewPinned] = useState(false);
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragActiveRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchTapRef = useRef<{ at: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const handleDragStart = () => {
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
      dragActiveRef.current = true;
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
      setPreviewPinned(false);
      setPreviewAnchor(null);
      setQuickPickerOpen(false);
      lastTouchTapRef.current = null;
    };
    const handleDragEnd = () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
      setPreviewPinned(false);
      setPreviewAnchor(null);
      // dnd-kit can emit the release click after onDragEnd. Keep the guard
      // through that click so dropping a card cannot immediately pin details.
      dragEndTimerRef.current = setTimeout(() => {
        dragActiveRef.current = false;
        dragEndTimerRef.current = null;
      }, 0);
    };
    document.addEventListener(DRAG_UI_START_EVENT, handleDragStart);
    document.addEventListener(DRAG_UI_END_EVENT, handleDragEnd);
    return () => {
      document.removeEventListener(DRAG_UI_START_EVENT, handleDragStart);
      document.removeEventListener(DRAG_UI_END_EVENT, handleDragEnd);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
    };
  }, []);
  // 固定中だけ購読する。カードBを押すとAのこの listener が発火してAが解けるため、
  // カード間で固定状態を同期しなくても「固定は常に1枚」が保たれる。
  useEffect(() => {
    if (!previewPinned) return;
    const unpin = () => {
      setPreviewPinned(false);
      setPreviewAnchor(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.game-card-preview')) return;
      unpin();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') unpin();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewPinned]);
  useEffect(() => {
    if (!quickPickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setQuickPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickPickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [quickPickerOpen]);
  if (!state) return null;
  const instance = state.cards[cardId];
  if (!instance) return null;
  const def = state.defs[instance.defId];
  const commander = isCommander(state, cardId);
  const decisionRole = decisionCardRole(controller.decisionFocus, cardId);
  const combatAttacker = state.combat?.attackers.find((entry) => entry.cardId === cardId);
  const combatBlocker = state.combat?.blockers.find((entry) => entry.cardId === cardId);
  const quickAction = quickAbilityAction(instance, def);
  const immediateQuickLineIndexes = new Set(
    quickAction.lines
      .filter((line) => activatedManaAbilityPlanForSource(state, cardId, line.index) !== null)
      .map((line) => line.index),
  );

  const cls = `game-card game-card--${size}${playable ? ' game-card--playable' : ''}${
    celebrateOnMount && instance.zone === 'battlefield' ? ' game-card--celebrate' : ''
  }${
    arriving ? ' game-card--draw-arriving' : ''
  }${decisionRole ? ` game-card--decision-${decisionRole}` : ''
  }${combatAttacker ? ' game-card--combat-attacker' : ''
  }${combatBlocker ? ' game-card--combat-blocker' : ''
  }`;

  function schedulePreview(anchor: CardPreviewAnchor): void {
    if (dragActiveRef.current) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => setPreviewAnchor(anchor), PREVIEW_DELAY_MS);
  }

  function closePreview(): void {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    setPreviewAnchor(null);
  }

  function closeTransientPreview(): void {
    if (!previewPinned) closePreview();
  }

  function runQuickAction(): void {
    setPreviewPinned(false);
    closePreview();
    if (quickAction.kind === 'activate') {
      if (controller.requestActivateAbility) {
        controller.requestActivateAbility(cardId, quickAction.lines[0].index);
      } else {
        controller.store.activateAbility(cardId, quickAction.lines[0].index, { assistRestrictedMana: true });
      }
      return;
    }
    if (quickAction.kind === 'choose') {
      setQuickPickerOpen(true);
      return;
    }
    if (quickAction.kind === 'tap-for-mana') {
      if (controller.requestTapForMana) {
        controller.requestTapForMana(cardId);
      } else {
        controller.store.tapForMana(
          cardId,
          quickAction.colors.length === 1 ? quickAction.colors[0] : undefined,
        );
      }
      return;
    }
    controller.store.toggleTap(cardId);
  }

  function handleDoubleClick(event: React.MouseEvent): void {
    if (controller.decisionFocus) return;
    if (instance.zone === 'battlefield') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setPreviewPinned(false);
    closePreview();
    event.preventDefault();
    controller.handleCardDoubleClick(cardId, event);
  }

  function handleTouchTap(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragActiveRef.current) return;
    if (decisionRole === 'candidate') {
      event.preventDefault();
      controller.chooseDecisionCard?.(cardId);
      return;
    }
    const now = performance.now();
    const previous = lastTouchTapRef.current;
    const doubleTap = previous !== null
      && now - previous.at <= DOUBLE_TAP_WINDOW_MS
      && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= DOUBLE_TAP_RADIUS_PX;
    if (doubleTap) {
      lastTouchTapRef.current = null;
      setPreviewPinned(false);
      closePreview();
      controller.openCardMenu(cardId, event);
      return;
    }
    lastTouchTapRef.current = { at: now, x: event.clientX, y: event.clientY };
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPreviewPinned(true);
    setPreviewAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
  }

  return (
    <div
      ref={rootRef}
      className={cls}
      data-layout-card-id={cardId}
      data-decision-role={decisionRole ?? undefined}
      onMouseEnter={(event) => schedulePreview({ x: event.clientX, y: event.clientY })}
      onMouseLeave={closeTransientPreview}
      onClick={(event) => {
        if (dragActiveRef.current || event.detail !== 1) return;
        if (decisionRole === 'candidate') {
          event.preventDefault();
          controller.chooseDecisionCard?.(cardId);
          return;
        }
        if (instance.zone === 'battlefield') {
          event.preventDefault();
          runQuickAction();
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        setPreviewPinned(true);
        setPreviewAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
      }}
      onFocus={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        schedulePreview({ x: rect.right, y: rect.top + rect.height / 2 });
      }}
      onBlur={closeTransientPreview}
      onKeyDown={(event) => {
        if (event.repeat) return;
        if (decisionRole === 'candidate' && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          controller.chooseDecisionCard?.(cardId);
          return;
        }
        if (controller.decisionFocus) return;
        if (event.key === ' ' && instance.zone === 'battlefield') {
          event.preventDefault();
          runQuickAction();
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const rect = rootRef.current?.getBoundingClientRect();
          if (rect) controller.openCardMenuAt?.(cardId, rect.right, rect.top + rect.height / 2);
        }
      }}
    >
      <CardView
        instance={instance}
        def={def}
        size="battlefield"
        draggable={draggable && !controller.decisionFocus}
        badge={undefined}
        summoningSick={isSummoningSick(state, cardId)}
        focusable
        onContextMenu={(e) => {
          if (controller.decisionFocus) {
            e.preventDefault();
            return;
          }
          controller.openCardMenu(cardId, e);
        }}
        onTouchTap={handleTouchTap}
        onDoubleClick={handleDoubleClick}
      />
      {commander && showCommanderBadge && (
        <span className="game-card__commander-marker" aria-label="統率者" title="統率者">統</span>
      )}
      {quickAction.kind !== 'manual-tap' && (
        <button
          type="button"
          className="game-card__quick-ability-marker"
          data-testid={`quick-ability-${cardId}`}
          aria-label={quickAction.kind === 'activate' ? 'タップ能力を起動' : 'タップ能力を選ぶ'}
          title={quickAction.kind === 'activate'
            ? immediateQuickLineIndexes.has(quickAction.lines[0].index)
              ? 'クリックでマナ能力を即時起動'
              : 'クリックで能力をスタックへ置く'
            : 'クリックでタップ能力を選択'}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            runQuickAction();
          }}
        >
          <Icon name="tap" />
          {quickAction.kind === 'choose' && (
            <span className="game-card__quick-ability-count" aria-hidden="true">{quickAction.lines.length}</span>
          )}
        </button>
      )}
      {quickPickerOpen && quickAction.kind === 'choose' && (
        <div
          className="game-card__quick-picker"
          data-testid={`quick-ability-picker-${cardId}`}
          role="dialog"
          aria-label="起動するタップ能力を選ぶ"
          onClick={(event) => event.stopPropagation()}
        >
          {quickAction.lines.map((line) => (
            <button
              type="button"
              key={line.index}
              data-testid={`quick-ability-${cardId}-${line.index}`}
              onClick={() => {
                setQuickPickerOpen(false);
                if (controller.requestActivateAbility) controller.requestActivateAbility(cardId, line.index);
                else controller.store.activateAbility(cardId, line.index, { assistRestrictedMana: true });
              }}
            >
              {quickAbilityLabel(
                line,
                immediateQuickLineIndexes.has(line.index) ? 'immediate' : 'stack',
                52,
                def,
              )}
            </button>
          ))}
          <button type="button" onClick={() => setQuickPickerOpen(false)}>閉じる</button>
        </div>
      )}
      {combatAttacker && (
        <span className="game-card__combat-marker" data-role="attacker">
          攻撃 → {combatAttacker.target.lifeLabel ?? state.players[combatAttacker.target.playerId]?.label ?? combatAttacker.target.playerId}
        </span>
      )}
      {combatBlocker && <span className="game-card__combat-marker" data-role="blocker">ブロック</span>}
      {previewAnchor && (
        <CardPreview
          instance={instance}
          def={def}
          anchor={previewAnchor}
        />
      )}
    </div>
  );
}
