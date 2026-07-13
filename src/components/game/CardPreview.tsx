import { createPortal } from 'react-dom';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { CardView } from '../CardView';
import { cardPreviewPosition, type CardPreviewAnchor } from './cardPreviewPosition';

export function CardPreview({
  instance,
  def,
  anchor,
}: {
  instance: CardInstance;
  def: CardDef | undefined;
  anchor: CardPreviewAnchor;
}) {
  const face = instance.faceDown
    ? undefined
    : (def?.faces[instance.faceIndex] ?? def?.faces[0]);
  const name = instance.faceDown
    ? '裏向きのカード'
    : (face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード');
  const typeLine = face?.printedTypeLine ?? face?.typeLine ?? def?.typeLine;
  const rulesText = face?.printedText ?? face?.oracleText;
  const oppositeFace = instance.faceDown || (def?.faces.length ?? 0) < 2
    ? undefined
    : def?.faces.find((_, index) => index !== instance.faceIndex);
  const position = cardPreviewPosition(anchor, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  return createPortal(
    <aside
      className="game-card-preview"
      data-testid={`card-preview-${instance.id}`}
      style={{ left: position.left, top: position.top }}
      aria-live="polite"
    >
      <div className="game-card-preview__image">
        <CardView instance={instance} def={def} size="battlefield" draggable={false} imageQuality="normal" />
      </div>
      <div className="game-card-preview__details">
        <strong>{name}</strong>
        {face?.manaCost && <span className="game-card-preview__mana">{face.manaCost}</span>}
        {typeLine && <span>{typeLine}</span>}
        {rulesText && <p>{rulesText}</p>}
        {oppositeFace && (
          <div className="game-card-preview__reverse" data-testid={`card-preview-reverse-${instance.id}`}>
            {oppositeFace.imageUrl ? (
              <img src={oppositeFace.imageUrl} alt={oppositeFace.printedName ?? oppositeFace.name} />
            ) : (
              <span>{oppositeFace.printedName ?? oppositeFace.name}</span>
            )}
            <small>反対面</small>
          </div>
        )}
      </div>
    </aside>,
    document.body,
  );
}
