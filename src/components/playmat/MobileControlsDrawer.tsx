import type { ReactNode } from 'react';

export interface MobileControlsDrawerProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function MobileControlsDrawer({
  open,
  onToggle,
  onClose,
  children,
}: MobileControlsDrawerProps) {
  return (
    <>
      <button
        type="button"
        className={`mobile-controls-drawer__toggle ${open ? 'mobile-controls-drawer__toggle--open' : ''}`}
        data-testid="mobile-drawer-toggle"
        aria-expanded={open}
        aria-controls="mobile-controls-drawer-panel"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <span className="ti ti-menu-2" aria-hidden="true" />
        <span>操作</span>
      </button>

      {open && (
        <button
          type="button"
          className="mobile-controls-drawer__backdrop"
          aria-label="操作パネルを閉じる"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
      )}

      <aside
        id="mobile-controls-drawer-panel"
        className={`mobile-controls-drawer ${open ? 'mobile-controls-drawer--open' : ''}`}
        aria-hidden={!open}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mobile-controls-drawer__panel">{children}</div>
      </aside>
    </>
  );
}
