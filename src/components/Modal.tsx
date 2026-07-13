import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  testId?: string;
}

/** A centered modal dialog with a dimmed backdrop. */
export function Modal({ title, onClose, children, width = 'md', testId }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restoreFocusTo = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const preferred = modalRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
    (preferred ?? firstFocusable)?.focus();
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector));
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
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
          {onClose && (
            <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
