import type { LogEntry } from '../../engine/types';

export interface GameLogProps {
  log: LogEntry[];
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

/** Scrollable game log, newest entries first. */
export function GameLog({ log }: GameLogProps) {
  const entries = log.slice().reverse();

  return (
    <div className="game-log" data-testid="game-log">
      <h3>ゲームログ</h3>
      <ul className="game-log__list">
        {entries.map((entry) => (
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
