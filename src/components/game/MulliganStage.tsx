import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { GameState } from '../../engine/types';
import { CardView } from '../CardView';
import { useInteractionHistory } from '../../hooks/useInteractionHistory';

export function MulliganStage({
  state,
  mode,
  bottomCount = 0,
  onKeep,
  onMulligan,
  onBottomConfirm,
  onUndoBoundary,
  disabled = false,
  onBack,
  onMenu,
  suspended = false,
}: {
  state: Pick<GameState, 'cards' | 'defs' | 'zones'>;
  mode: 'decision' | 'bottom';
  bottomCount?: number;
  onKeep?: () => void;
  onMulligan?: () => void;
  onBottomConfirm?: (cardIds: string[]) => void;
  onUndoBoundary?: () => void;
  disabled?: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  suspended?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useInteractionHistory<string[]>([], onUndoBoundary);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (suspended) return;
    const root = rootRef.current;
    const screen = root?.closest('.game-screen');
    const stageBranch =
      screen && root
        ? Array.from(screen.children).find((node) => node === root || node.contains(root))
        : null;
    const siblings = screen
      ? Array.from(screen.children).filter(
          (node): node is HTMLElement => node instanceof HTMLElement && node !== stageBranch,
        )
      : [];
    const previous = siblings.map((node) => ({
      node,
      inert: node.inert,
      hidden: node.getAttribute('aria-hidden'),
    }));
    for (const { node } of previous) {
      node.inert = true;
      node.setAttribute('aria-hidden', 'true');
    }
    root?.querySelector<HTMLButtonElement>('[data-autofocus="true"]')?.focus();
    return () => {
      for (const item of previous) {
        item.node.inert = Boolean(item.inert);
        if (item.hidden === null) item.node.removeAttribute('aria-hidden');
        else item.node.setAttribute('aria-hidden', item.hidden);
      }
    };
  }, [suspended]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && previewId) {
      event.preventDefault();
      setPreviewId(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function toggle(cardId: string): void {
    setSelected((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= bottomCount) return current;
      return [...current, cardId];
    });
  }

  return (
    <div
      ref={rootRef}
      hidden={suspended}
      className="mulligan-stage"
      data-testid="mulligan-stage"
      data-mode={mode}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mulligan-stage-title"
      onKeyDown={handleKeyDown}
    >
      <div className="mulligan-stage__scrim" aria-hidden="true" />
      <header className="mulligan-stage__header">
        <small>OPENING HAND</small>
        <h2 id="mulligan-stage-title">
          {mode === 'decision' ? '初手を選ぶ' : `${bottomCount}枚をライブラリーの下へ`}
        </h2>
        <span>
          {mode === 'decision'
            ? `手札 ${state.zones.hand.length}枚`
            : `選択 ${selected.length}/${bottomCount}`}
        </span>
      </header>
      <div className="mulligan-stage__cards" data-testid="mulligan-stage-cards">
        {state.zones.hand.map((cardId, index) => {
          const card = state.cards[cardId];
          const def = card ? state.defs[card.defId] : undefined;
          if (!card) return null;
          const chosen = selected.includes(cardId);
          return (
            <button
              key={cardId}
              type="button"
              className="mulligan-stage__card"
              data-layout-card-id={cardId}
              data-chosen={chosen || undefined}
              data-testid={`mulligan-stage-card-${cardId}`}
              style={{ '--mulligan-index': index } as CSSProperties}
              onClick={() => (mode === 'bottom' ? toggle(cardId) : setPreviewId(cardId))}
              disabled={disabled && mode === 'bottom'}
              aria-pressed={mode === 'bottom' ? chosen : undefined}
              aria-label={
                mode === 'bottom'
                  ? `${chosen ? '選択解除' : '下へ戻すカードに選択'}`
                  : 'カードを拡大'
              }
            >
              <CardView instance={card} def={def} size="battlefield" draggable={false} />
              {chosen && <span>戻す</span>}
            </button>
          );
        })}
      </div>
      <footer className="mulligan-stage__actions">
        {onMenu && (
          <button type="button" onClick={onMenu}>
            招待・メニュー
          </button>
        )}
        {mode === 'decision' ? (
          <>
            <button
              type="button"
              className="mulligan-stage__secondary"
              disabled={disabled}
              onClick={onMulligan}
              data-testid="mulligan-again"
            >
              マリガン
            </button>
            <button
              type="button"
              className="mulligan-stage__primary"
              disabled={disabled}
              onClick={onKeep}
              data-testid="mulligan-keep"
              data-autofocus="true"
            >
              {state.zones.hand.length}枚でキープ
            </button>
          </>
        ) : (
          <>
            {onBack && (
              <button
                type="button"
                className="mulligan-stage__secondary"
                disabled={disabled}
                onClick={onBack}
              >
                判断に戻る
              </button>
            )}
            <button
              type="button"
              className="mulligan-stage__primary"
              disabled={disabled || selected.length !== bottomCount}
              onClick={() => onBottomConfirm?.(selected)}
              data-testid="mulligan-bottom-confirm"
              data-autofocus="true"
            >
              選んだ{bottomCount}枚を下へ
            </button>
          </>
        )}
      </footer>
      {previewId &&
        (() => {
          const card = state.cards[previewId];
          const def = card ? state.defs[card.defId] : undefined;
          return card ? (
            <button
              type="button"
              className="mulligan-stage__preview"
              onClick={() => setPreviewId(null)}
              aria-label="拡大を閉じる"
            >
              <CardView instance={card} def={def} size="battlefield" draggable={false} />
            </button>
          ) : null;
        })()}
    </div>
  );
}
