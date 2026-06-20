import { summarizeDeckRuleTags, type RuleDeckEntry } from '../data/ruleDeckSummary';
import type { RuleAutomationLayer } from '../data/ruleClassifier';

export interface RuleAutomationReportProps {
  entries: RuleDeckEntry[];
}

const LAYER_LABELS: Record<RuleAutomationLayer, string> = {
  primitive: '基礎処理',
  'semi-automatic': '半自動',
  'trigger-assist': '誘発補助',
  warning: '警告',
  advisory: '助言のみ',
};

export function RuleAutomationReport({ entries }: RuleAutomationReportProps) {
  const summary = summarizeDeckRuleTags(entries);

  return (
    <section className="rule-report" data-testid="rule-automation-report">
      <div className="rule-report__header">
        <div>
          <h2>ルール補助候補</h2>
          <p>英語Oracle本文から自動分類</p>
        </div>
        <span className="rule-report__total">{summary.length}件</span>
      </div>

      {summary.length === 0 ? (
        <p className="rule-report__empty">候補は見つかりませんでした。</p>
      ) : (
        <div className="rule-report__table" role="table" aria-label="ルール補助候補">
          <div className="rule-report__row rule-report__row--head" role="row">
            <span role="columnheader">タグ</span>
            <span role="columnheader">Risk</span>
            <span role="columnheader">Layer</span>
            <span role="columnheader">枚数</span>
            <span role="columnheader">代表カード</span>
            <span role="columnheader">判定根拠</span>
            <span role="columnheader">種別</span>
          </div>
          {summary.map((item) => (
            <div
              key={item.tag.id}
              className="rule-report__row"
              data-testid={`rule-tag-${item.tag.id.replace(/\./g, '-')}`}
              role="row"
            >
              <strong role="cell">{item.tag.label}</strong>
              <span className="rule-report__badge" role="cell">
                Risk {item.tag.risk}
              </span>
              <span className="rule-report__badge rule-report__badge--layer" role="cell">
                {LAYER_LABELS[item.tag.layer]}
                {item.tag.risk === 'E' && item.tag.layer !== 'advisory' ? '・助言のみ' : ''}
              </span>
              <span className="rule-report__count" role="cell">
                {item.deckCount}枚
              </span>
              <span className="rule-report__cards" role="cell">
                {formatCardNames(item.cardNames)}
              </span>
              <code className="rule-report__match" role="cell">
                {item.tag.matchedText}
              </code>
              <span className="rule-report__estimate" role="cell">
                自動推定
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatCardNames(cardNames: string[]): string {
  const visibleNames = cardNames.slice(0, 3).map((name) => `《${name}》`);
  const hiddenCount = cardNames.length - visibleNames.length;
  if (hiddenCount <= 0) {
    return visibleNames.join('、');
  }
  return `${visibleNames.join('、')} ほか${hiddenCount}件`;
}
