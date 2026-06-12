import { useDraggable } from '@dnd-kit/core';
import type { CardDef } from '../types/card';
import type { CardInstance } from '../engine/types';

export interface CardViewProps {
  instance: CardInstance;
  def: CardDef | undefined;
  /** Whether to render at hand size (slightly larger) vs battlefield size. */
  size?: 'hand' | 'battlefield' | 'small';
  /** Right-click: opens the action menu. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Double-click: quick action (play land / cast / tap / etc.). */
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
  draggable?: boolean;
  /** Extra label rendered in a corner ribbon, e.g. "統率者". */
  badge?: string;
  /** Render dimmed/ghosted (e.g. while a drag overlay copy exists). */
  faded?: boolean;
}

const COUNTER_LABELS: Record<string, string> = {
  '+1/+1': '+1/+1',
  '-1/-1': '-1/-1',
  loyalty: '忠誠',
  charge: '充填',
};

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
  draggable = false,
  badge,
  faded = false,
}: CardViewProps) {
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
  const counters = Object.entries(instance.counters).filter(([, v]) => v !== 0);

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

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
      {instance.isToken && !badge && <div className="card-view__badge card-view__badge--token">T</div>}

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
