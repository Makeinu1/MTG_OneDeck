import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  testId?: string;
  /** Keep the pending selection mounted while the player looks at the board. */
  allowBoardPeek?: boolean;
}

/** A centered modal dialog with a dimmed backdrop. */
export function Modal({ title, onClose, children, width = 'md', testId, allowBoardPeek = false }: ModalProps) {
  const [boardPeek, setBoardPeek] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restoreFocusTo = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const focusScope = () => boardPeek ? modalRef.current?.querySelector('.modal__header') : modalRef.current;
    const preferred = boardPeek ? null : modalRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
    const firstFocusable = focusScope()?.querySelector<HTMLElement>(focusableSelector);
    (preferred ?? firstFocusable)?.focus();
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(focusScope()?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (restoreFocusTo?.isConnected) restoreFocusTo.focus();
    };
  }, [onClose, boardPeek]);

  return (
    <div className={`modal-backdrop${boardPeek ? ' modal-backdrop--board-peek' : ''}`} onClick={boardPeek ? undefined : onClose}>
      <div
        ref={modalRef}
        className={`modal modal--${width}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <div className="modal__header">
          <h2>{title}</h2>
          {allowBoardPeek && (
            <button type="button" className="btn modal__peek" onClick={() => setBoardPeek(!boardPeek)}>
              {boardPeek ? '選択に戻る' : '盤面を見る'}
            </button>
          )}
          {onClose && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          )}
        </div>
        <div className="modal__body" hidden={boardPeek}>{children}</div>
      </div>
    </div>
  );
}
