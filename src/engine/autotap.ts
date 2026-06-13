import type { ManaColor } from '../types/card';
import { type ParsedCost, solvePayment } from './mana';
import { isSummoningSick } from './status';
import type { GameState, ManaPool } from './types';

export interface AutoTapPlan {
  ok: boolean;
  taps: { cardId: string; color: ManaColor }[];
  payment: ManaPool;
  shortfall: number;
}

interface Source {
  cardId: string;
  colors: ManaColor[];
  priority: number;
}

interface RankedPlan extends AutoTapPlan {
  candidateIndexes: number[];
}

const ALL_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function emptyPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function addPool(base: ManaPool, extra: ManaPool): ManaPool {
  return {
    W: base.W + extra.W,
    U: base.U + extra.U,
    B: base.B + extra.B,
    R: base.R + extra.R,
    G: base.G + extra.G,
    C: base.C + extra.C,
  };
}

function poolTotal(pool: ManaPool): number {
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
}

function compareIndexLists(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function isLand(typeLine: string): boolean {
  return typeLine.includes('Land');
}

function isCreature(typeLine: string): boolean {
  return typeLine.includes('Creature');
}

function candidatePriority(typeLine: string, colorCount: number): number {
  if (isLand(typeLine)) {
    return colorCount === 1 ? 0 : 1;
  }
  if (!isCreature(typeLine)) {
    return 2;
  }
  return 3;
}

function orderedUniqueColors(colors: ManaColor[] | undefined): ManaColor[] {
  if (!colors) return [];
  const seen = new Set<ManaColor>();
  const result: ManaColor[] = [];
  for (const color of colors) {
    if (!seen.has(color)) {
      seen.add(color);
      result.push(color);
    }
  }
  return result;
}

function currentTypeLine(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

function buildSources(state: GameState): Source[] {
  const battlefieldOrder = new Map<string, number>(
    state.zones.battlefield.map((cardId, index) => [cardId, index])
  );

  const sources = state.zones.battlefield
    .map((cardId) => {
      const card = state.cards[cardId];
      if (!card || card.tapped || isSummoningSick(state, cardId)) return null;
      const def = state.defs[card.defId];
      const colors = orderedUniqueColors(def?.producedMana);
      if (colors.length === 0 || def?.tokenKind === 'treasure') return null;
      const typeLine = currentTypeLine(state, cardId);
      return {
        cardId,
        colors,
        priority: candidatePriority(typeLine, colors.length),
      } satisfies Source;
    })
    .filter((source): source is Source => source !== null);

  sources.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.colors.length !== right.colors.length) return left.colors.length - right.colors.length;
    return (battlefieldOrder.get(left.cardId) ?? 0) - (battlefieldOrder.get(right.cardId) ?? 0);
  });

  return sources;
}

function colorSupplyCounts(sources: Source[]): Record<ManaColor, number> {
  const counts = emptyPool();
  for (const source of sources) {
    for (const color of source.colors) {
      counts[color] += 1;
    }
  }
  return counts;
}

function orderedColorOptions(
  colors: ManaColor[],
  supplyCounts: Record<ManaColor, number>
): ManaColor[] {
  return colors.slice().sort((left, right) => {
    const supplyDiff = supplyCounts[left] - supplyCounts[right];
    if (supplyDiff !== 0) return supplyDiff;
    return ALL_COLORS.indexOf(left) - ALL_COLORS.indexOf(right);
  });
}

function betterPlan(candidate: RankedPlan, best: RankedPlan): boolean {
  if (candidate.shortfall !== best.shortfall) {
    return candidate.shortfall < best.shortfall;
  }

  const byIndex = compareIndexLists(candidate.candidateIndexes, best.candidateIndexes);
  if (byIndex !== 0) return byIndex < 0;

  if (candidate.taps.length !== best.taps.length) {
    return candidate.taps.length < best.taps.length;
  }

  return poolTotal(candidate.payment) < poolTotal(best.payment);
}

export function planAutoTap(state: GameState, cost: ParsedCost, xValue: number): AutoTapPlan {
  const baseSolution = solvePayment(state.manaPool, cost, xValue);
  let best: RankedPlan = {
    ok: baseSolution.ok,
    taps: [],
    payment: baseSolution.payment,
    shortfall: baseSolution.shortfall,
    candidateIndexes: [],
  };

  if (baseSolution.ok) {
    return best;
  }

  const sources = buildSources(state);
  if (sources.length === 0) {
    return best;
  }

  const supplyCounts = colorSupplyCounts(sources);
  const maxUsefulTaps = baseSolution.shortfall;
  const addedMana = emptyPool();
  const taps: { cardId: string; color: ManaColor }[] = [];
  const candidateIndexes: number[] = [];
  // DFS visits source indexes in ascending (priority) order, so the FIRST
  // complete plan found is already the lexicographically-best one. Stop the
  // whole search there — exploring equal-shortfall siblings is exponential.
  let foundComplete = false;

  const search = (startIndex: number): void => {
    const combinedPool = addPool(state.manaPool, addedMana);
    const solution = solvePayment(combinedPool, cost, xValue);
    const candidatePlan: RankedPlan = {
      ok: solution.ok,
      taps: taps.slice(),
      payment: solution.payment,
      shortfall: solution.shortfall,
      candidateIndexes: candidateIndexes.slice(),
    };
    if (betterPlan(candidatePlan, best)) {
      best = candidatePlan;
    }

    if (solution.shortfall === 0) {
      foundComplete = true;
      return;
    }
    if (taps.length >= maxUsefulTaps) {
      return;
    }

    const remainingTapSlots = maxUsefulTaps - taps.length;
    const remainingCandidates = sources.length - startIndex;
    const minReachableShortfall = Math.max(
      0,
      solution.shortfall - Math.min(remainingTapSlots, remainingCandidates)
    );
    if (minReachableShortfall > best.shortfall) {
      return;
    }

    for (let sourceIndex = startIndex; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];
      for (const color of orderedColorOptions(source.colors, supplyCounts)) {
        addedMana[color] += 1;
        taps.push({ cardId: source.cardId, color });
        candidateIndexes.push(sourceIndex);
        search(sourceIndex + 1);
        candidateIndexes.pop();
        taps.pop();
        addedMana[color] -= 1;
        if (foundComplete) return;
      }
    }
  };

  search(0);

  return {
    ok: best.ok,
    taps: best.taps,
    payment: best.payment,
    shortfall: best.shortfall,
  };
}
