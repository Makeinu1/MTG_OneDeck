import type { CardDef } from '../types/card';
import { classifyCardRules, compareRuleTagIds, type RuleTag } from './ruleClassifier';

export interface RuleDeckEntry {
  card: CardDef;
  quantity: number;
  section: 'commander' | 'main';
}

export interface RuleDeckSummaryItem {
  tag: RuleTag;
  deckCount: number;
  cardNames: string[];
}

interface MutableSummary {
  tag: RuleTag;
  deckCount: number;
  cardNames: string[];
  cardNameSet: Set<string>;
}

const CONFIDENCE_RANK: Record<RuleTag['confidence'], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function summarizeDeckRuleTags(entries: RuleDeckEntry[]): RuleDeckSummaryItem[] {
  const summaries = new Map<string, MutableSummary>();

  for (const entry of entries) {
    const quantity = quantityOf(entry.quantity);
    if (quantity === 0) {
      continue;
    }

    const cardName = entry.card.printedName ?? entry.card.name;
    const tags = classifyCardRules(entry.card);
    for (const tag of tags) {
      const current = summaries.get(tag.id);
      if (!current) {
        summaries.set(tag.id, {
          tag,
          deckCount: quantity,
          cardNames: [cardName],
          cardNameSet: new Set([cardName]),
        });
        continue;
      }

      current.deckCount += quantity;
      if (!current.cardNameSet.has(cardName)) {
        current.cardNameSet.add(cardName);
        current.cardNames.push(cardName);
      }

      if (CONFIDENCE_RANK[tag.confidence] > CONFIDENCE_RANK[current.tag.confidence]) {
        current.tag = tag;
      }
    }
  }

  return [...summaries.values()]
    .map(({ tag, deckCount, cardNames }) => ({ tag, deckCount, cardNames }))
    .sort((a, b) => {
      if (a.deckCount !== b.deckCount) {
        return b.deckCount - a.deckCount;
      }
      return compareRuleTagIds(a.tag.id, b.tag.id);
    });
}

function quantityOf(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.max(0, Math.floor(quantity));
}
