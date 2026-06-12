import type { CardDef } from '../types/card';
import type { CardInstance } from '../engine/types';

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 680) / 488);
const GAP = 12;

export interface CardPreviewProps {
  instance: CardInstance;
  def: CardDef | undefined;
  /** Bounding rect of the hovered card element, used to position the preview. */
  anchorRect: DOMRect;
}

/**
 * A floating enlarged preview of a card, shown near the hovered element.
 * Flips to the opposite side when it would overflow the viewport edge.
 */
export function CardPreview({ instance, def, anchorRect }: CardPreviewProps) {
  const face = instance.faceDown ? undefined : (def?.faces[instance.faceIndex] ?? def?.faces[0]);
  const displayName = instance.faceDown
    ? '裏向きのカード'
    : (face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード');
  const imageUrl = instance.faceDown ? undefined : face?.imageUrl;

  // Prefer showing to the right of the card; flip to the left if it would overflow.
  const overflowsRight = anchorRect.right + GAP + PREVIEW_WIDTH > window.innerWidth;
  const left = overflowsRight ? anchorRect.left - GAP - PREVIEW_WIDTH : anchorRect.right + GAP;

  // Vertically center on the anchor, clamped into the viewport.
  let top = anchorRect.top + anchorRect.height / 2 - PREVIEW_HEIGHT / 2;
  top = Math.max(8, Math.min(top, window.innerHeight - PREVIEW_HEIGHT - 8));

  const style: React.CSSProperties = {
    left: Math.max(8, left),
    top,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
  };

  return (
    <div className="card-preview" style={style}>
      {imageUrl ? (
        <img src={imageUrl} alt={displayName} draggable={false} />
      ) : (
        <div className="card-preview__fallback">
          <span className="card-preview__name">{displayName}</span>
          {!instance.faceDown && face?.typeLine && (
            <span className="card-preview__type">{face.printedTypeLine ?? face.typeLine}</span>
          )}
          {!instance.faceDown && face?.oracleText && (
            <p className="card-preview__oracle">{face.printedText ?? face.oracleText}</p>
          )}
        </div>
      )}
    </div>
  );
}
