import type { CardDef } from '../types/card';
import { computeDeckStats } from '../data/deckStats';

const CURVE_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'] as const;
const COLOR_ITEMS = [
  { key: 'W', label: '白', className: 'deck-stats__color-chip--w' },
  { key: 'U', label: '青', className: 'deck-stats__color-chip--u' },
  { key: 'B', label: '黒', className: 'deck-stats__color-chip--b' },
  { key: 'R', label: '赤', className: 'deck-stats__color-chip--r' },
  { key: 'G', label: '緑', className: 'deck-stats__color-chip--g' },
  { key: 'colorless', label: '無色', className: 'deck-stats__color-chip--c' },
] as const;
const TYPE_ITEMS = [
  { key: 'land', label: '土地' },
  { key: 'creature', label: 'クリーチャー' },
  { key: 'planeswalker', label: 'プレインズウォーカー' },
  { key: 'instant', label: 'インスタント' },
  { key: 'sorcery', label: 'ソーサリー' },
  { key: 'artifact', label: 'アーティファクト' },
  { key: 'enchantment', label: 'エンチャント' },
  { key: 'battle', label: 'バトル' },
  { key: 'other', label: 'その他' },
] as const;

export interface DeckStatsProps {
  entries: { card: CardDef; quantity: number; section: 'commander' | 'main' }[];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function DeckStats({ entries }: DeckStatsProps) {
  const stats = computeDeckStats(entries);
  const maxCurveCount = stats.curve.reduce((max, count) => Math.max(max, count), 0);
  const landRate = stats.total > 0 ? stats.lands / stats.total : 0;

  return (
    <section className="deck-stats" data-testid="deck-stats">
      <div className="deck-stats__header">
        <div>
          <h2>デッキ統計</h2>
          <p>統率者を含む解決済みリストから自動集計</p>
        </div>
        <span className="deck-stats__total">{stats.total}枚</span>
      </div>

      <div className="deck-stats__summary">
        <div className="deck-stats__metric">
          <span className="deck-stats__metric-label">土地率</span>
          <strong className="deck-stats__metric-value">{formatPercent(landRate)}</strong>
        </div>
        <div className="deck-stats__metric">
          <span className="deck-stats__metric-label">土地</span>
          <strong className="deck-stats__metric-value">{stats.lands}</strong>
        </div>
        <div className="deck-stats__metric">
          <span className="deck-stats__metric-label">非土地</span>
          <strong className="deck-stats__metric-value">{stats.nonland}</strong>
        </div>
        <div className="deck-stats__metric">
          <span className="deck-stats__metric-label">平均MV</span>
          <strong className="deck-stats__metric-value">{stats.avgCmc.toFixed(1)}</strong>
        </div>
      </div>

      <div className="deck-stats__panels">
        <section className="deck-stats__panel">
          <h3>マナカーブ</h3>
          <div className="deck-stats__curve" aria-label="マナカーブ">
            {stats.curve.map((count, index) => {
              const height =
                maxCurveCount > 0 && count > 0 ? Math.max((count / maxCurveCount) * 100, 10) : 0;

              return (
                <div key={CURVE_LABELS[index]} className="deck-stats__curve-column">
                  <span className="deck-stats__curve-count">{count}</span>
                  <div className="deck-stats__curve-track">
                    <div className="deck-stats__curve-bar" style={{ height: `${height}%` }} />
                  </div>
                  <span className="deck-stats__curve-label">{CURVE_LABELS[index]}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="deck-stats__panel">
          <h3>色内訳</h3>
          <div className="deck-stats__colors">
            {COLOR_ITEMS.map((item) => (
              <div key={item.key} className={`deck-stats__color-chip ${item.className}`}>
                <span className="deck-stats__color-label">{item.label}</span>
                <strong className="deck-stats__color-count">{stats.colors[item.key]}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="deck-stats__panel">
          <h3>タイプ内訳</h3>
          <ul className="deck-stats__type-list">
            {TYPE_ITEMS.map((item) => (
              <li key={item.key} className="deck-stats__type-row">
                <span>{item.label}</span>
                <strong>{stats.types[item.key]}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="deck-stats__panel">
          <h3>開幕土地</h3>
          <dl className="deck-stats__opening">
            <div className="deck-stats__opening-row">
              <dt>期待値</dt>
              <dd>{stats.opening.expectedLands.toFixed(1)}枚</dd>
            </div>
            <div className="deck-stats__opening-row">
              <dt>事故率</dt>
              <dd>{formatPercent(stats.opening.pMullRisk)}</dd>
            </div>
            <div className="deck-stats__opening-row">
              <dt>理想</dt>
              <dd>{formatPercent(stats.opening.pIdeal)}</dd>
            </div>
            <div className="deck-stats__opening-row">
              <dt>フラッド</dt>
              <dd>{formatPercent(stats.opening.pFlood)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
