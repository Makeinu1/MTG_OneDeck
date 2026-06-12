import { useEffect, useRef } from 'react';

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Visual grouping separator rendered above this item. */
  separator?: boolean;
  disabled?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: MenuItem[];
  onClose: () => void;
}

/**
 * A small floating action menu anchored at a screen position. Closes on
 * outside click, Escape, or item selection.
 */
export function ContextMenu({ x, y, title, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp into viewport.
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 24),
  };

  return (
    <div className="context-menu" style={style} ref={ref} role="menu">
      {title && <div className="context-menu__title">{title}</div>}
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            {item.separator && <div className="context-menu__separator" />}
            <button
              type="button"
              role="menuitem"
              className={item.danger ? 'context-menu__item--danger' : ''}
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
