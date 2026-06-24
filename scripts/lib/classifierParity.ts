import { classifyCardRules } from '../../src/data/ruleClassifier.ts';
import type { CardDef } from '../../src/types/card';
import {
  classifyCardEvents,
  type EventFamily,
  type ObserverScope,
} from './eventClassify.ts';

export interface ClassifierParityMapping {
  eventFamily: EventFamily;
  runtimeTagIds: readonly string[];
  rationale: string;
}

export interface ClassifierParityAllowance {
  axis: string;
  researchSide: string;
  runtimeSide: string;
  rationale: string;
}

export const CLASSIFIER_PARITY_MAPPINGS: readonly ClassifierParityMapping[] = [
  {
    eventFamily: 'enters',
    runtimeTagIds: ['trigger.etb', 'trigger.etb-other', 'trigger.landfall'],
    rationale: 'Runtime splits self, watcher, and landfall entry triggers.',
  },
  {
    eventFamily: 'dies',
    runtimeTagIds: ['trigger.death', 'trigger.death-other'],
    rationale: 'Runtime splits self-death and watcher death triggers.',
  },
  {
    eventFamily: 'leaves',
    runtimeTagIds: ['trigger.leaves', 'trigger.leaves-other'],
    rationale: 'Runtime splits self and watcher leaves-the-battlefield triggers (CR 603.6c).',
  },
  {
    eventFamily: 'cast',
    runtimeTagIds: ['trigger.cast', 'trigger.cast-watcher'],
    rationale: 'Runtime splits spell-local and battlefield watcher cast triggers.',
  },
  {
    eventFamily: 'attacks',
    runtimeTagIds: ['trigger.attack', 'trigger.attack-watcher'],
    rationale: 'Runtime splits attacker-local and battlefield watcher attack triggers.',
  },
  {
    eventFamily: 'draw',
    runtimeTagIds: ['trigger.draw'],
    rationale: 'Both sides represent draw-trigger conditions.',
  },
  {
    eventFamily: 'sacrifice',
    runtimeTagIds: ['trigger.sacrifice'],
    rationale: 'Both sides represent sacrifice-trigger conditions.',
  },
];

export const CLASSIFIER_PARITY_ALLOWANCES: readonly ClassifierParityAllowance[] = [
  {
    axis: 'observer',
    researchSide: 'ObserverScope(any/controlled-set/opponent/self/unknown)',
    runtimeSide: 'no observer axis',
    rationale: 'Runtime trigger tags encode event kind, not observer scope.',
  },
  {
    axis: 'risk/layer/confidence',
    researchSide: 'no risk or automation metadata',
    runtimeSide: 'RuleRisk, RuleAutomationLayer, confidence',
    rationale: 'Metadata axes are intentionally outside event-family parity.',
  },
  {
    axis: 'unmapped event families',
    researchSide: 'zone, blocks, discard, tap, counter, life, other',
    runtimeSide: 'no corresponding trigger tags',
    rationale: 'Runtime has no same-granularity trigger tag for these families.',
  },
  {
    axis: 'phase',
    researchSide: 'all beginning-of phase/step triggers',
    runtimeSide: 'trigger.upkeep and trigger.end-step only',
    rationale: 'Research phase is broader than the two runtime phase tags.',
  },
  {
    axis: 'damage',
    researchSide: 'combat and noncombat damage triggers',
    runtimeSide: 'trigger.combat-damage only',
    rationale: 'Research damage is broader than runtime combat damage.',
  },
];

export interface ClassifierParityComparison {
  eventFamily: EventFamily;
  runtimeTagIds: string[];
  eventPresent: boolean;
  runtimePresent: boolean;
  agree: boolean;
  direction: 'agree' | 'research-only' | 'runtime-only';
}

export interface CardClassifierParity {
  oracleId: string;
  name: string;
  edhrecRank?: number;
  eventFamilies: EventFamily[];
  observers: ObserverScope[];
  runtimeTagIds: string[];
  comparisons: ClassifierParityComparison[];
  mismatches: ClassifierParityComparison[];
  comparable: boolean;
  agree: boolean;
}

export interface ClassifierParitySummary {
  totalCards: number;
  comparableCards: number;
  divergentCards: number;
  cardDivergenceRate: number;
  comparisons: number;
  mismatchedComparisons: number;
  comparisonDivergenceRate: number;
  researchOnlyComparisons: number;
  runtimeOnlyComparisons: number;
  perFamily: Record<EventFamily, ClassifierParityFamilySummary>;
}

export interface ClassifierParityFamilySummary {
  comparisons: number;
  mismatches: number;
  divergenceRate: number;
  researchOnly: number;
  runtimeOnly: number;
}

export interface ClassifierParityReport {
  summary: ClassifierParitySummary;
  cards: CardClassifierParity[];
  mismatches: CardClassifierParity[];
}

export function compareCardClassifiers(def: CardDef): CardClassifierParity {
  const eventSummary = classifyCardEvents(def);
  const eventFamilies = new Set(eventSummary.families);
  const runtimeTagIds = classifyCardRules(def).map((tag) => tag.id);
  const runtimeTags = new Set(runtimeTagIds);
  const comparisons = CLASSIFIER_PARITY_MAPPINGS.map((mapping) => {
    const eventPresent = eventFamilies.has(mapping.eventFamily);
    const runtimePresent = mapping.runtimeTagIds.some((tagId) => runtimeTags.has(tagId));
    const agree = eventPresent === runtimePresent;
    return {
      eventFamily: mapping.eventFamily,
      runtimeTagIds: mapping.runtimeTagIds.filter((tagId) => runtimeTags.has(tagId)),
      eventPresent,
      runtimePresent,
      agree,
      direction: agree
        ? 'agree'
        : eventPresent
          ? 'research-only'
          : 'runtime-only',
    } satisfies ClassifierParityComparison;
  }).filter((comparison) => comparison.eventPresent || comparison.runtimePresent);
  const mismatches = comparisons.filter((comparison) => !comparison.agree);

  return {
    oracleId: def.oracleId,
    name: def.name,
    edhrecRank: def.edhrecRank,
    eventFamilies: eventSummary.families,
    observers: eventSummary.observers,
    runtimeTagIds,
    comparisons,
    mismatches,
    comparable: comparisons.length > 0,
    agree: mismatches.length === 0,
  };
}

export function buildClassifierParityReport(
  defs: readonly CardDef[],
): ClassifierParityReport {
  const cards = defs.map(compareCardClassifiers);
  const mismatches = cards
    .filter((card) => card.comparable && !card.agree)
    .sort(compareParityCards);
  const comparableCards = cards.filter((card) => card.comparable);
  const comparisons = comparableCards.flatMap((card) => card.comparisons);
  const mismatchedComparisons = comparisons.filter((comparison) => !comparison.agree);

  return {
    summary: {
      totalCards: cards.length,
      comparableCards: comparableCards.length,
      divergentCards: mismatches.length,
      cardDivergenceRate: rate(mismatches.length, comparableCards.length),
      comparisons: comparisons.length,
      mismatchedComparisons: mismatchedComparisons.length,
      comparisonDivergenceRate: rate(mismatchedComparisons.length, comparisons.length),
      researchOnlyComparisons: mismatchedComparisons.filter(
        (comparison) => comparison.direction === 'research-only',
      ).length,
      runtimeOnlyComparisons: mismatchedComparisons.filter(
        (comparison) => comparison.direction === 'runtime-only',
      ).length,
      perFamily: buildPerFamilySummary(comparisons),
    },
    cards,
    mismatches,
  };
}

function buildPerFamilySummary(
  comparisons: readonly ClassifierParityComparison[],
): Record<EventFamily, ClassifierParityFamilySummary> {
  const output = {} as Record<EventFamily, ClassifierParityFamilySummary>;
  const families: readonly EventFamily[] = [
    'enters',
    'leaves',
    'dies',
    'zone',
    'cast',
    'attacks',
    'blocks',
    'damage',
    'draw',
    'discard',
    'sacrifice',
    'tap',
    'counter',
    'life',
    'phase',
    'other',
  ];

  for (const family of families) {
    const items = comparisons.filter((comparison) => comparison.eventFamily === family);
    const mismatches = items.filter((comparison) => !comparison.agree);
    output[family] = {
      comparisons: items.length,
      mismatches: mismatches.length,
      divergenceRate: rate(mismatches.length, items.length),
      researchOnly: mismatches.filter(
        (comparison) => comparison.direction === 'research-only',
      ).length,
      runtimeOnly: mismatches.filter(
        (comparison) => comparison.direction === 'runtime-only',
      ).length,
    };
  }
  return output;
}

function compareParityCards(a: CardClassifierParity, b: CardClassifierParity): number {
  const aRank = a.edhrecRank ?? Number.POSITIVE_INFINITY;
  const bRank = b.edhrecRank ?? Number.POSITIVE_INFINITY;
  if (aRank !== bRank) return aRank - bRank;
  const nameOrder = a.name.localeCompare(b.name);
  return nameOrder !== 0 ? nameOrder : a.oracleId.localeCompare(b.oracleId);
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
