import type { CardDef } from '../types/card';

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;
const TYPE_PRIORITY = [
  ['Land', 'land'],
  ['Creature', 'creature'],
  ['Planeswalker', 'planeswalker'],
  ['Instant', 'instant'],
  ['Sorcery', 'sorcery'],
  ['Artifact', 'artifact'],
  ['Enchantment', 'enchantment'],
  ['Battle', 'battle'],
] as const;

type DeckEntry = {
  card: CardDef;
  quantity: number;
  section: 'commander' | 'main';
};

type TypeBucket =
  | 'land'
  | 'creature'
  | 'planeswalker'
  | 'instant'
  | 'sorcery'
  | 'artifact'
  | 'enchantment'
  | 'battle'
  | 'other';

export interface DeckStats {
  total: number;
  lands: number;
  nonland: number;
  avgCmc: number;
  curve: number[];
  colors: {
    W: number;
    U: number;
    B: number;
    R: number;
    G: number;
    colorless: number;
  };
  types: {
    land: number;
    creature: number;
    planeswalker: number;
    instant: number;
    sorcery: number;
    artifact: number;
    enchantment: number;
    battle: number;
    other: number;
  };
  opening: {
    expectedLands: number;
    pMullRisk: number;
    pIdeal: number;
    pFlood: number;
  };
}

function initialStats(): DeckStats {
  return {
    total: 0,
    lands: 0,
    nonland: 0,
    avgCmc: 0,
    curve: [0, 0, 0, 0, 0, 0, 0, 0],
    colors: {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
      colorless: 0,
    },
    types: {
      land: 0,
      creature: 0,
      planeswalker: 0,
      instant: 0,
      sorcery: 0,
      artifact: 0,
      enchantment: 0,
      battle: 0,
      other: 0,
    },
    opening: {
      expectedLands: 0,
      pMullRisk: 0,
      pIdeal: 0,
      pFlood: 0,
    },
  };
}

function quantityOf(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.max(0, Math.floor(quantity));
}

function frontTypeLine(card: CardDef): string {
  return card.faces[0]?.typeLine ?? card.typeLine ?? '';
}

function classifyType(typeLine: string): TypeBucket {
  for (const [needle, bucket] of TYPE_PRIORITY) {
    if (typeLine.includes(needle)) {
      return bucket;
    }
  }
  return 'other';
}

function curveBucket(cmc: number): number {
  if (!Number.isFinite(cmc) || cmc <= 0) {
    return 0;
  }
  return cmc >= 7 ? 7 : Math.floor(cmc);
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }

  const picks = Math.min(k, n - k);
  let result = 1;

  for (let i = 1; i <= picks; i += 1) {
    result = (result * (n - picks + i)) / i;
  }

  return result;
}

function hypergeometric(successes: number, total: number, draws: number, hits: number): number {
  if (total <= 0) {
    return 0;
  }

  const safeSuccesses = Math.max(0, Math.min(successes, total));
  const safeDraws = Math.max(0, Math.min(draws, total));
  if (hits < 0 || hits > safeSuccesses || hits > safeDraws) {
    return 0;
  }

  const denominator = combinations(total, safeDraws);
  if (denominator === 0) {
    return 0;
  }

  return (
    (combinations(safeSuccesses, hits) * combinations(total - safeSuccesses, safeDraws - hits)) /
    denominator
  );
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function computeDeckStats(entries: DeckEntry[]): DeckStats {
  const stats = initialStats();
  let nonCommanderTotal = 0;
  let nonCommanderLands = 0;
  let nonlandCount = 0;
  let nonlandCmcTotal = 0;

  for (const entry of entries) {
    const quantity = quantityOf(entry.quantity);
    if (quantity === 0) {
      continue;
    }

    const typeLine = frontTypeLine(entry.card);
    const isLand = typeLine.includes('Land');
    const identity = new Set(entry.card.colorIdentity);

    stats.total += quantity;
    stats.types[classifyType(typeLine)] += quantity;

    if (identity.size === 0) {
      stats.colors.colorless += quantity;
    } else {
      for (const color of COLOR_KEYS) {
        if (identity.has(color)) {
          stats.colors[color] += quantity;
        }
      }
    }

    if (isLand) {
      stats.lands += quantity;
    } else {
      nonlandCount += quantity;
      nonlandCmcTotal += entry.card.cmc * quantity;
      stats.curve[curveBucket(entry.card.cmc)] += quantity;
    }

    if (entry.section === 'main') {
      nonCommanderTotal += quantity;
      if (isLand) {
        nonCommanderLands += quantity;
      }
    }
  }

  stats.nonland = stats.total - stats.lands;
  stats.avgCmc = nonlandCount > 0 ? nonlandCmcTotal / nonlandCount : 0;

  const openingDraws = Math.max(0, Math.min(7, nonCommanderTotal));
  if (nonCommanderTotal > 0 && openingDraws > 0) {
    stats.opening.expectedLands = (openingDraws * nonCommanderLands) / nonCommanderTotal;

    let pMullRisk = 0;
    let pIdeal = 0;
    let pFlood = 0;

    for (let hits = 0; hits <= openingDraws; hits += 1) {
      const probability = hypergeometric(nonCommanderLands, nonCommanderTotal, openingDraws, hits);
      if (hits <= 1) {
        pMullRisk += probability;
      }
      if (hits >= 2 && hits <= 4) {
        pIdeal += probability;
      }
      if (hits >= 5) {
        pFlood += probability;
      }
    }

    stats.opening.pMullRisk = clampProbability(pMullRisk);
    stats.opening.pIdeal = clampProbability(pIdeal);
    stats.opening.pFlood = clampProbability(pFlood);
  }

  return stats;
}
