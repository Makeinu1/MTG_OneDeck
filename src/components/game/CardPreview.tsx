import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { needsJapaneseDisplayRefresh, refreshJapaneseCardDefs } from '../../data/scryfall';
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
  const [localizedDef, setLocalizedDef] = useState<CardDef | undefined>();
  const [failedOracleId, setFailedOracleId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    if (!def || instance.faceDown || !needsJapaneseDisplayRefresh(def)) {
      return () => {
        cancelled = true;
      };
    }

    void refreshJapaneseCardDefs([def])
      .then((refreshed) => {
        if (cancelled) return;
        const localized = refreshed.get(def.oracleId);
        if (localized) {
          setLocalizedDef(localized);
        } else {
          setFailedOracleId(def.oracleId);
        }
      })
      .catch(() => {
        if (!cancelled) setFailedOracleId(def.oracleId);
      });
    return () => {
      cancelled = true;
    };
  }, [def, instance.faceDown]);

  const displayDef = localizedDef?.oracleId === def?.oracleId ? localizedDef : def;
  const localizationPending = Boolean(
    def
    && !instance.faceDown
    && needsJapaneseDisplayRefresh(def)
    && localizedDef?.oracleId !== def.oracleId
    && failedOracleId !== def.oracleId,
  );

  const face = instance.faceDown
    ? undefined
    : (displayDef?.faces[instance.faceIndex] ?? displayDef?.faces[0]);
  const name = instance.faceDown
    ? '裏向きのカード'
    : (face?.printedName ?? face?.name ?? displayDef?.printedName ?? displayDef?.name ?? '不明なカード');
  const typeLine = face?.printedTypeLine ?? face?.typeLine ?? displayDef?.typeLine;
  const rulesText = localizationPending ? undefined : (face?.printedText ?? face?.oracleText);
  const usesEnglishOracleFallback = displayDef?.lang === 'ja'
    && Boolean(face?.printedName && !face?.printedText && face?.oracleText);
  const oppositeFace = instance.faceDown || (displayDef?.faces.length ?? 0) < 2
    ? undefined
    : displayDef?.faces.find((_, index) => index !== instance.faceIndex);
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
        <CardView instance={instance} def={displayDef} size="battlefield" draggable={false} imageQuality="normal" />
      </div>
      <div className="game-card-preview__details">
        <strong>{name}</strong>
        <span className="game-card-preview__touch-hint">もう一度タップで操作</span>
        {face?.manaCost && <span className="game-card-preview__mana">{face.manaCost}</span>}
        {typeLine && <span>{typeLine}</span>}
        {localizationPending && (
          <p className="game-card-preview__localization">日本語表示を更新中…</p>
        )}
        {rulesText && (
          <p>
            {usesEnglishOracleFallback && (
              <span className="game-card-preview__language-label">Oracle（英語）</span>
            )}
            {rulesText}
          </p>
        )}
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
