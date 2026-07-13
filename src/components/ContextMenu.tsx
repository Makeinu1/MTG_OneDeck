import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Visual grouping separator rendered above this item. */
  separator?: boolean;
  disabled?: boolean;
  testId?: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
  restoreFocusTo?: HTMLElement | null;
}

/**
 * A small floating action menu anchored at a screen position. Closes on
 * outside click, Escape, or item selection.
 */
export function ContextMenu({ x, y, title, items, onClose, restoreFocusTo }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    restoreFocusRef.current = restoreFocusTo ?? (
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    );
    const enabledItems = (): HTMLButtonElement[] => (
      Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
    );
    enabledItems()[0]?.focus();

    function handlePointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        // A transient menu must not remain open after focus leaves it. Closing
        // and restoring the invoking control avoids accidental board shortcuts.
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const buttons = enabledItems();
      if (buttons.length === 0) return;
      e.preventDefault();
      const current = document.activeElement instanceof HTMLButtonElement
        ? buttons.indexOf(document.activeElement)
        : -1;
      if (e.key === 'Home') buttons[0]?.focus();
      else if (e.key === 'End') buttons.at(-1)?.focus();
      else if (e.key === 'ArrowDown') buttons[(current + 1 + buttons.length) % buttons.length]?.focus();
      else buttons[(current - 1 + buttons.length) % buttons.length]?.focus();
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [restoreFocusTo]);

  // Clamp into viewport using the menu's actual rendered size, so menus
  // opened near the bottom/right edge (e.g. hand cards) stay fully visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(0, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(0, Math.min(y, window.innerHeight - height - 8)),
    });
  }, [x, y, items.length]);

  const style: React.CSSProperties = pos;

  return (
    <div
      className="context-menu"
      style={style}
      ref={ref}
      role="menu"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : '操作メニュー'}
    >
      {title && <div className="context-menu__title" id={titleId}>{title}</div>}
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            {item.separator && <div className="context-menu__separator" />}
            <button
              type="button"
              role="menuitem"
              className={item.danger ? 'context-menu__item--danger' : ''}
              data-testid={item.testId}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
