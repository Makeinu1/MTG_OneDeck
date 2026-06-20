import { useDraggable } from '@dnd-kit/core';
import { useRef } from 'react';
import type { CardDef } from '../types/card';
import type { CardInstance } from '../engine/types';
import { keywords, normalizeKeywords, type Keyword } from '../engine/status';

export interface CardViewProps {
  instance: CardInstance;
  def: CardDef | undefined;
  /** Whether to render at hand size (slightly larger) vs battlefield size. */
  size?: 'hand' | 'battlefield' | 'small';
  /** Right-click or touch tap: opens the action menu. */
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => void;
  /** Double-click: quick action (play land / cast / tap / etc.). */
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  draggable?: boolean;
  /** Extra label rendered in a corner ribbon, e.g. "統率者". */
  badge?: string;
  summoningSick?: boolean;
  /** Render dimmed/ghosted (e.g. while a drag overlay copy exists). */
  faded?: boolean;
}

const COUNTER_LABELS: Record<string, string> = {
  '+1/+1': '+1/+1',
  '-1/-1': '-1/-1',
  loyalty: '忠誠',
  charge: '充填',
};

const KEYWORD_BADGES: Record<Keyword, string> = {
  flying: '飛',
  vigilance: '警',
  trample: 'T',
  deathtouch: '接',
  lifelink: '絆',
  menace: '威',
  'first-strike': '先',
  'double-strike': '二',
  reach: '到',
  haste: '速',
  hexproof: '呪',
  indestructible: '不',
  defender: '防',
  ward: '護',
};

const TOUCH_TAP_MAX_DISTANCE_PX = 8;
const TOUCH_TAP_MAX_DURATION_MS = 220;

function counterLabel(type: string): string {
  return COUNTER_LABELS[type] ?? type;
}

export function CardView({
  instance,
  def,
  size = 'battlefield',
  onContextMenu,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  draggable = false,
  badge,
  summoningSick = false,
  faded = false,
}: CardViewProps) {
  const touchStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: instance.id,
    disabled: !draggable,
  });

  const face = instance.faceDown
    ? undefined
    : (def?.faces[instance.faceIndex] ?? def?.faces[0]);
  const displayName = instance.faceDown
    ? '裏向きのカード'
    : (face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード');
  const imageUrl = instance.faceDown ? undefined : face?.imageUrl;
  const counters = Object.entries(instance.counters).filter(
    ([type, value]) => value !== 0 && type !== 'loyalty' && type !== 'lore'
  );
  const loyalty = instance.counters.loyalty;
  const lore = instance.counters.lore;
  const keywordList = instance.faceDown
    ? []
    : normalizeKeywords([...keywords(def), ...(instance.manualKeywords ?? [])]);

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) ${instance.tapped ? 'rotate(90deg)' : ''}`
      : instance.tapped
        ? 'rotate(90deg)'
        : undefined,
    opacity: isDragging || faded ? 0.35 : undefined,
  };

  const classes = ['card-view', `card-view--${size}`];
  if (instance.tapped) classes.push('card-view--tapped');
  if (instance.isToken) classes.push('card-view--token');
  if (instance.isCommander) classes.push('card-view--commander');
  if (instance.faceDown) classes.push('card-view--facedown');
  if (instance.attachedTo) classes.push('card-view--attached');

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    suppressClickRef.current = false;
    if (e.pointerType === 'touch') {
      touchStartRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startedAt: performance.now(),
      };
    } else {
      touchStartRef.current = null;
    }
    onPointerDown?.(e);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const touchStart =
      touchStartRef.current?.pointerId === e.pointerId ? touchStartRef.current : null;
    touchStartRef.current = null;
    onPointerUp?.(e);

    if (e.pointerType !== 'touch' || !onContextMenu || !touchStart) {
      return;
    }

    const distance = Math.hypot(e.clientX - touchStart.startX, e.clientY - touchStart.startY);
    const duration = performance.now() - touchStart.startedAt;
    if (distance >= TOUCH_TAP_MAX_DISTANCE_PX || duration > TOUCH_TAP_MAX_DURATION_MS) {
      return;
    }

    suppressClickRef.current = true;
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e);
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLDivElement>): void {
    if (touchStartRef.current?.pointerId === e.pointerId) {
      touchStartRef.current = null;
    }
    suppressClickRef.current = false;
    onPointerCancel?.(e);
  }

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      style={style}
      onClick={(e) => {
        if (!suppressClickRef.current) {
          return;
        }
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-testid={`card-${instance.id}`}
      title={displayName}
      {...attributes}
      {...listeners}
    >
      <div className="card-view__face">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} draggable={false} loading="lazy" />
        ) : (
          <div className="card-view__fallback">
            <span className="card-view__fallback-name">{displayName}</span>
            {!instance.faceDown && face?.typeLine && (
              <span className="card-view__fallback-type">
                {face.printedTypeLine ?? face.typeLine}
              </span>
            )}
          </div>
        )}
      </div>

      {badge && <div className="card-view__badge">{badge}</div>}
      {instance.isToken && <div className="card-view__badge card-view__badge--token">T</div>}
      {summoningSick && <div className="card-view__badge card-view__badge--sick">酔</div>}
      {typeof loyalty === 'number' && loyalty > 0 && (
        <div className="card-view__badge card-view__badge--loyalty">{loyalty}</div>
      )}
      {typeof lore === 'number' && lore > 0 && (
        <div className="card-view__badge card-view__badge--lore">第{lore}章</div>
      )}

      {keywordList.length > 0 && (
        <div className="card-view__keywords">
          {keywordList.map((keyword) => (
            <span key={keyword} className="card-view__keyword" title={keyword}>
              {KEYWORD_BADGES[keyword]}
            </span>
          ))}
        </div>
      )}

      {counters.length > 0 && (
        <div className="card-view__counters">
          {counters.map(([type, value]) => (
            <span key={type} className="card-view__counter" data-counter-type={type}>
              {counterLabel(type)} {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
