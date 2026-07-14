import { useDraggable } from '@dnd-kit/core';
import { useRef, useState } from 'react';
import type { CardDef } from '../types/card';
import type { CardInstance } from '../engine/types';
import { keywords, normalizeKeywords, type Keyword } from '../engine/status';
import cardBackUrl from '../assets/onedeck/card-back.svg';
import { tokenVisualFor } from '../ui/tokenVisual';
import { Icon } from '../ui/icons';

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
  /** Keyboard users can focus the card to show the same details as hover. */
  focusable?: boolean;
  /** Prefer the bandwidth-friendly Scryfall small image on dense surfaces. */
  imageQuality?: 'small' | 'normal';
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

type DraggableCardBinding = ReturnType<typeof useDraggable>;

interface CardViewSurfaceProps extends CardViewProps {
  dnd: DraggableCardBinding | null;
}

function counterLabel(type: string): string {
  return COUNTER_LABELS[type] ?? type;
}

function DraggableCardView(props: CardViewProps) {
  const dnd = useDraggable({ id: props.instance.id });
  return <CardViewSurface {...props} dnd={dnd} />;
}

/**
 * Display-only copies must not call useDraggable. dnd-kit registers disabled
 * draggables too, so a preview using the same card id can otherwise replace
 * the real card node and become the source of the initial drag rectangle.
 */
export function CardView(props: CardViewProps) {
  return props.draggable
    ? <DraggableCardView {...props} />
    : <CardViewSurface {...props} dnd={null} />;
}

function CardViewSurface({
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
  badge,
  summoningSick = false,
  faded = false,
  focusable = false,
  imageQuality = size === 'battlefield' || size === 'small' ? 'small' : 'normal',
  dnd,
}: CardViewSurfaceProps) {
  const touchStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const transform = dnd?.transform;
  const isDragging = dnd?.isDragging ?? false;

  const face = instance.faceDown
    ? undefined
    : (def?.faces[instance.faceIndex] ?? def?.faces[0]);
  const displayName = instance.faceDown
    ? '裏向きのカード'
    : (face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード');
  const tokenVisual = instance.isToken ? tokenVisualFor(def) : undefined;
  const requestedImageUrl = instance.faceDown
    ? cardBackUrl
    : imageQuality === 'small'
      ? (face?.imageUrlSmall ?? face?.imageUrl ?? tokenVisual?.imageUrl)
      : (face?.imageUrl ?? face?.imageUrlSmall ?? tokenVisual?.imageUrl);
  const imageUrl = requestedImageUrl === failedImageUrl ? undefined : requestedImageUrl;
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
    // DragOverlay is the sole moving representation. Leaving the source at
    // partial opacity creates a second, ancestor-transformed card that can
    // appear one card away from the pointer in a rotated hand fan.
    opacity: isDragging ? 0 : faded ? 0.35 : undefined,
  };

  const classes = ['card-view', `card-view--${size}`];
  if (instance.tapped) classes.push('card-view--tapped');
  if (instance.isToken) classes.push('card-view--token');
  if (instance.isCommander) classes.push('card-view--commander');
  if (instance.faceDown) classes.push('card-view--facedown');
  if (!instance.faceDown && (def?.faces.length ?? 0) > 1) classes.push('card-view--dfc');
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
      ref={dnd?.setNodeRef}
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
      onDoubleClick={(event) => {
        event.preventDefault();
        onDoubleClick?.(event);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      {...(dnd?.attributes ?? {})}
      data-testid={`card-${instance.id}`}
      title={displayName}
      tabIndex={focusable ? 0 : undefined}
      {...(dnd?.listeners ?? {})}
    >
      <div
        className="card-view__face"
        key={instance.faceDown ? 'hidden' : instance.faceIndex}
        data-token-art={tokenVisual?.key}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={instance.faceDown ? 'OneDeckのカード裏面' : displayName}
            draggable={false}
            loading="lazy"
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : (
          <div className="card-view__fallback" data-token-art={tokenVisual?.key}>
            <span className="card-view__fallback-name">{displayName}</span>
            {!instance.faceDown && face?.typeLine && (
              <span className="card-view__fallback-type">
                {face.printedTypeLine ?? face.typeLine}
              </span>
            )}
          </div>
        )}
      </div>

      {!instance.faceDown && (def?.faces.length ?? 0) > 1 && (
        <div className="card-view__dfc" title="両面カード">
          <Icon name="transform" label="両面カード" />
        </div>
      )}

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
