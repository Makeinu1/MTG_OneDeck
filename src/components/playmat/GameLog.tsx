import type { LogEntry } from '../../engine/types';

export interface GameLogProps {
  log: LogEntry[];
  /** Whether the log is expanded to show the full scrollable history. */
  expanded: boolean;
  onToggle: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  untap: 'アンタップ',
  upkeep: 'アップキープ',
  draw: 'ドロー',
  main1: 'メイン1',
  combat: '戦闘',
  main2: 'メイン2',
  end: '終了',
};

const COLLAPSED_COUNT = 3;

/** Collapsible game log, newest entries first. Collapsed view shows the latest
 *  3 entries; clicking the header expands it to fill the remaining column height. */
export function GameLog({ log, expanded, onToggle }: GameLogProps) {
  const entries = log.slice().reverse();
  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);

  return (
    <div className={`game-log ${expanded ? 'game-log--expanded' : ''}`} data-testid="game-log">
      <button
        type="button"
        className="game-log__header"
        onClick={onToggle}
        data-testid="game-log-toggle"
        aria-expanded={expanded}
      >
        <h3>ゲームログ</h3>
        <span className="game-log__toggle-icon">{expanded ? '▾' : '▸'}</span>
      </button>
      <ul className="game-log__list">
        {visible.map((entry) => (
          <li key={entry.seq} className="game-log__item">
            <span className="game-log__meta">
              T{entry.turn} {PHASE_LABELS[entry.phase] ?? entry.phase}
            </span>
            <span className="game-log__message">{entry.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
