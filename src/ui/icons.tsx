import type { ReactNode } from 'react';

/**
 * インライン SVG アイコンスプライト(D0・design-system.md §6)。
 * 外部アイコンフォント/CDN 非依存。24px グリッド・線幅1.5・currentColor。
 */
export type IconName =
  | 'phase-next'
  | 'turn-next'
  | 'undo'
  | 'redo'
  | 'menu'
  | 'bell'
  | 'close'
  | 'tap'
  | 'attack'
  | 'life-up'
  | 'life-down'
  | 'graveyard'
  | 'exile'
  | 'library'
  | 'command'
  | 'search'
  | 'settings'
  | 'dice'
  | 'coin'
  | 'warning'
  | 'auto'
  | 'info';

const PATHS: Record<IconName, ReactNode> = {
  'phase-next': <path d="M8 6l9 6-9 6V6z" />,
  'turn-next': (
    <>
      <path d="M6 6l8 6-8 6V6z" />
      <line x1="17" y1="5" x2="17" y2="19" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7L5 11l4 4" />
      <path d="M5 11h9a5 5 0 0 1 0 10h-2" />
    </>
  ),
  redo: (
    <>
      <path d="M15 7l4 4-4 4" />
      <path d="M19 11h-9a5 5 0 0 0 0 10h2" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  tap: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <polyline points="20 4 20 9 15 9" />
    </>
  ),
  attack: (
    <>
      <line x1="4" y1="20" x2="14" y2="10" />
      <line x1="10" y1="4" x2="20" y2="14" />
      <line x1="12" y1="8" x2="16" y2="4" />
      <line x1="8" y1="12" x2="4" y2="16" />
    </>
  ),
  'life-up': (
    <>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </>
  ),
  'life-down': (
    <>
      <circle cx="12" cy="12" r="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </>
  ),
  graveyard: (
    <>
      <path d="M7 20V11a5 5 0 0 1 10 0v9" />
      <line x1="5" y1="20" x2="19" y2="20" />
      <line x1="10" y1="9" x2="14" y2="9" />
      <line x1="12" y1="7" x2="12" y2="11" />
    </>
  ),
  exile: <circle cx="12" cy="12" r="8" strokeDasharray="4 3" />,
  library: (
    <>
      <rect x="7" y="4" width="10" height="14" rx="1.5" />
      <path d="M5 8v10a2 2 0 0 0 2 2h8" />
    </>
  ),
  command: <path d="M12 3l2.5 5.5L20 9l-4.5 4 1.2 6L12 16l-4.7 3 1.2-6L4 9l5.5-.5L12 3z" />,
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <line x1="15" y1="15" x2="20" y2="20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5M3 12h3M18 12h3" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 15H3L12 4z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  auto: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3a9 9 0 0 1 8.5 6" />
      <polyline points="21 5 20.5 9 16.5 8.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  label?: string;
  mirrored?: boolean;
  className?: string;
}

/** アイコン+スクリーンリーダー用ラベル(label省略時は装飾のみ扱い)。 */
export function Icon({ name, label, mirrored, className }: IconProps) {
  return (
    <>
      <span className={className ? `icon ${className}` : 'icon'} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
          style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
        >
          {PATHS[name]}
        </svg>
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
