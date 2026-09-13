import { useState, type ReactNode } from 'react';

/** Presentation and uncommitted visibility only; confirmed state stays in the session. */
export function CockpitWorkPanel({
  title,
  open = true,
  onClose,
  children,
  wide = false,
  preserveDraft = false,
  onPeekChange,
  folded,
}: {
  title: string;
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  preserveDraft?: boolean;
  folded?: boolean;
  onPeekChange?: (peek: boolean) => void;
}) {
  const [localPeek, setPeek] = useState(false);
  const peek = folded ?? localPeek;
  const [expanded, setExpanded] = useState(wide);
  const togglePeek = (next: boolean) => {
    setPeek(next);
    onPeekChange?.(next);
  };
  return (
    <aside
      className={`table-work-panel modal${expanded ? ' table-work-panel--wide' : ''}${peek ? ' table-work-panel--peek' : ''}`}
      aria-label={title}
      hidden={!open}
    >
      <header className="modal__header">
        <h2>{title}</h2>
        <button onClick={() => togglePeek(!peek)}>{peek ? '作業を表示' : '盤面を見る'}</button>
        <button aria-label="作業面の幅を切り替え" onClick={() => setExpanded(!expanded)}>
          {expanded ? '縮める' : '広げる'}
        </button>
        <button
          className="modal__close"
          aria-label={preserveDraft ? '作業面をたたむ' : '作業面を閉じる'}
          onClick={() => (preserveDraft ? togglePeek(true) : onClose())}
        >
          ×
        </button>
      </header>
      <div className="modal__body" hidden={peek}>
        {children}
      </div>
    </aside>
  );
}
