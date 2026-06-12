import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  testId?: string;
}

/** A centered modal dialog with a dimmed backdrop. */
export function Modal({ title, onClose, children, width = 'md', testId }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    const close = onClose;
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
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
