import { useEffect, useRef, useState } from 'react';
import type { MenuItem } from '../ContextMenu';
import './CardActionSheet.css';

export type CardActionSheetVariant = 'sheet' | 'popover';

export interface CardActionSheetProps {
  /** カード表示名(見出し)。 */
  title: string;
  /** type line(見出し補助行)。 */
  typeLine?: string;
  /** 色アイデンティティ(W/U/B/R/G)。縁光の色に使う。 */
  colorIdentity?: string[];
  /** 昇格した上位1〜3件(大ボタン)。 */
  rankedItems: MenuItem[];
  /** 「その他」に畳む残り全アクション。 */
  otherItems: MenuItem[];
  /** モバイル=bottom sheet / デスクトップ=カーソル近傍 popover。 */
  variant: CardActionSheetVariant;
  /** popover の表示位置(variant='popover' のとき)。 */
  anchor?: { x: number; y: number };
  onClose: () => void;
}

const MANA_EDGE: Record<string, string> = {
  W: 'var(--mana-w)',
  U: 'var(--mana-u)',
  B: 'var(--mana-b)',
  R: 'var(--mana-r)',
  G: 'var(--mana-g)',
};

/** 色アイデンティティ→縁光(box-shadow)。無色/多色は中立(--line-strong)。 */
function edgeGlow(colorIdentity: string[] | undefined): string {
  const colors = (colorIdentity ?? []).filter((c) => MANA_EDGE[c]);
  if (colors.length === 0) return `0 0 0 1px var(--line-strong)`;
  if (colors.length === 1) return `0 0 0 1.5px ${MANA_EDGE[colors[0]]}, 0 0 16px rgba(150, 185, 235, 0.18)`;
  // 多色は金の縁(統率者色的な「特別さ」ではなく彩度の混線を避ける)。
  return `0 0 0 1.5px var(--gold-dim), 0 0 16px rgba(216, 176, 106, 0.16)`;
}

function ActionRow({
  item,
  onClose,
  emphasized,
}: {
  item: MenuItem;
  onClose: () => void;
  emphasized?: boolean;
}) {
  const cls = ['card-sheet__action'];
  if (emphasized) cls.push('card-sheet__action--primary');
  if (item.danger) cls.push('card-sheet__action--danger');
  if (item.disabled) cls.push('card-sheet__action--disabled');
  return (
    <button
      type="button"
      className={cls.join(' ')}
      data-testid={item.testId ?? `card-sheet-action-${item.key}`}
      disabled={item.disabled}
      onClick={() => {
        if (item.disabled) return;
        item.onSelect();
        onClose();
      }}
    >
      {item.label}
    </button>
  );
}

/**
 * カード操作シート(ContextMenu 後継・D1)。docs/design-system.md §8。
 * 上位1〜3件を大ボタンで昇格し、残り全操作を「その他」に畳む(サンドボックス全操作保存)。
 */
export function CardActionSheet({
  title,
  typeLine,
  colorIdentity,
  rankedItems,
  otherItems,
  variant,
  anchor,
  onClose,
}: CardActionSheetProps) {
  const [showOther, setShowOther] = useState(rankedItems.length === 0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const style =
    variant === 'popover' && anchor
      ? ({ left: anchor.x, top: anchor.y } as const)
      : undefined;

  return (
    <div
      className={`card-sheet-overlay card-sheet-overlay--${variant}`}
      data-testid="card-sheet-overlay"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`card-sheet card-sheet--${variant}`}
        data-testid="card-sheet"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-sheet__header" style={{ boxShadow: edgeGlow(colorIdentity) }}>
          <div className="card-sheet__title" data-testid="card-sheet-title">
            {title}
          </div>
          {typeLine && <div className="card-sheet__type">{typeLine}</div>}
        </div>

        {rankedItems.length > 0 && (
          <div className="card-sheet__ranked" data-testid="card-sheet-ranked">
            {rankedItems.map((item, i) => (
              <ActionRow key={item.key} item={item} onClose={onClose} emphasized={i === 0} />
            ))}
          </div>
        )}

        {otherItems.length > 0 && (
          <div className="card-sheet__other">
            <button
              type="button"
              className="card-sheet__other-toggle"
              data-testid="card-sheet-other-toggle"
              aria-expanded={showOther}
              onClick={() => setShowOther((v) => !v)}
            >
              その他 ({otherItems.length}) {showOther ? '▲' : '▼'}
            </button>
            {showOther && (
              <div className="card-sheet__other-list" data-testid="card-sheet-other-list">
                {otherItems.map((item) => (
                  <ActionRow key={item.key} item={item} onClose={onClose} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
