import type { ManaColor } from '../types/card';
import type { ManaPool } from './types';

export type Pip =
  | { kind: 'color'; color: Exclude<ManaColor, 'C'> }
  | { kind: 'colorless' } // {C}
  | { kind: 'hybrid'; options: [ManaColor, ManaColor] } // {W/U}
  | { kind: 'monoHybrid'; color: Exclude<ManaColor, 'C'> } // {2/W}
  | { kind: 'phyrexian'; color: Exclude<ManaColor, 'C'> } // {W/P}
  | { kind: 'snow' }; // {S} — 汎用1として扱う(v1制限、要ログ)

export interface ParsedCost {
  generic: number;
  x: number;
  pips: Pip[];
}

const COLORED: ReadonlySet<string> = new Set(['W', 'U', 'B', 'R', 'G']);

function isColor(s: string): s is Exclude<ManaColor, 'C'> {
  return COLORED.has(s);
}

/**
 * Parse a Scryfall-style mana cost string into a ParsedCost.
 * Unknown tokens are treated as generic 0 (ignored) for forward-compatibility.
 */
export function parseManaCost(cost: string): ParsedCost {
  const result: ParsedCost = { generic: 0, x: 0, pips: [] };
  if (!cost) return result;

  const tokens = cost.match(/\{[^}]*\}/g);
  if (!tokens) return result;

  for (const raw of tokens) {
    const body = raw.slice(1, -1).toUpperCase();

    // pure numeric generic
    if (/^\d+$/.test(body)) {
      result.generic += parseInt(body, 10);
      continue;
    }
    if (body === 'X') {
      result.x += 1;
      continue;
    }
    if (body === 'C') {
      result.pips.push({ kind: 'colorless' });
      continue;
    }
    if (body === 'S') {
      result.pips.push({ kind: 'snow' });
      continue;
    }
    if (isColor(body)) {
      result.pips.push({ kind: 'color', color: body });
      continue;
    }

    // composite pips: contain '/'
    if (body.includes('/')) {
      const parts = body.split('/');
      if (parts.length === 2) {
        const [a, b] = parts;
        // phyrexian {W/P}
        if (b === 'P' && isColor(a)) {
          result.pips.push({ kind: 'phyrexian', color: a });
          continue;
        }
        if (a === 'P' && isColor(b)) {
          result.pips.push({ kind: 'phyrexian', color: b });
          continue;
        }
        // mono-hybrid {2/W}
        if (/^\d+$/.test(a) && isColor(b)) {
          result.pips.push({ kind: 'monoHybrid', color: b });
          continue;
        }
        if (/^\d+$/.test(b) && isColor(a)) {
          result.pips.push({ kind: 'monoHybrid', color: a });
          continue;
        }
        // two-color hybrid {W/U}; also hybrid colorless {C/W}
        const optA: ManaColor | undefined = a === 'C' || isColor(a) ? a : undefined;
        const optB: ManaColor | undefined = b === 'C' || isColor(b) ? b : undefined;
        if (optA && optB) {
          result.pips.push({ kind: 'hybrid', options: [optA, optB] });
          continue;
        }
      }
    }
    // unknown token: ignore (generic 0)
  }

  return result;
}

export interface PaymentSolution {
  ok: boolean; // 完全に支払えたか
  payment: ManaPool; // プールから引くべき量(ok=false でも「払える分」を返す)
  shortfall: number; // 不足点数(ok=true なら 0)
}

const ALL_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function emptyPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function clonePool(p: ManaPool): ManaPool {
  return { W: p.W, U: p.U, B: p.B, R: p.R, G: p.G, C: p.C };
}

function poolTotal(p: ManaPool): number {
  return p.W + p.U + p.B + p.R + p.G + p.C;
}

/**
 * Solve a mana payment from `pool` for `cost` (with X set to `xValue`).
 *
 * Strategy:
 *  - Color pips and {C} are mandatory single-color requirements.
 *  - Hybrid / mono-hybrid pips have multiple ways to pay; we backtrack over
 *    all colored-requirement assignments to guarantee completeness.
 *  - Phyrexian pips are paid with mana when possible, otherwise SKIPPED (not
 *    counted as shortfall; life payment is left to the user).
 *  - Snow {S} is treated as 1 generic.
 *  - Generic (cost.generic + X) is paid C-first then most-abundant color.
 *
 * Returns the best (fully-paying if possible) solution. When no full payment
 * exists, returns the assignment that minimises shortfall while spending the
 * least mana to cover what it can.
 */
export function solvePayment(pool: ManaPool, cost: ParsedCost, xValue: number): PaymentSolution {
  // Collect mandatory single-color demands (color pips + colorless {C}).
  // Snow is folded into generic. Generic total includes X.
  // cost.x counts the number of {X} symbols; each costs xValue.
  let generic = cost.generic + cost.x * Math.max(0, xValue);

  // Choice pips that need backtracking: hybrid (2 color options) and
  // mono-hybrid (color OR 2 generic). Phyrexian handled greedily afterwards.
  const fixedDemand = emptyPool(); // mandatory colored/colorless demands
  const hybridChoices: ManaColor[][] = [];
  const monoHybridColors: Exclude<ManaColor, 'C'>[] = [];
  const phyrexianColors: Exclude<ManaColor, 'C'>[] = [];

  for (const pip of cost.pips) {
    switch (pip.kind) {
      case 'color':
        fixedDemand[pip.color] += 1;
        break;
      case 'colorless':
        fixedDemand.C += 1;
        break;
      case 'snow':
        generic += 1;
        break;
      case 'hybrid':
        hybridChoices.push([pip.options[0], pip.options[1]]);
        break;
      case 'monoHybrid':
        monoHybridColors.push(pip.color);
        break;
      case 'phyrexian':
        phyrexianColors.push(pip.color);
        break;
    }
  }

  // Backtrack over hybrid + mono-hybrid choices.
  // Each mono-hybrid choice is either: pay 1 of its color, OR add 2 generic.
  // Represent mono-hybrid as a hybrid-like choice list of length 2:
  //   ['<color>', '__GEN2__'].
  type Choice = { options: (ManaColor | 'GEN2')[] };
  const choices: Choice[] = [];
  for (const opts of hybridChoices) {
    choices.push({ options: opts.slice() });
  }
  for (const c of monoHybridColors) {
    choices.push({ options: [c, 'GEN2'] });
  }

  let best: PaymentSolution | null = null;

  const consider = (assignment: (ManaColor | 'GEN2')[]): void => {
    // Build the full colored demand for this assignment.
    const demand = clonePool(fixedDemand);
    let genericNeed = generic;
    for (const a of assignment) {
      if (a === 'GEN2') {
        genericNeed += 2;
      } else {
        demand[a] += 1;
      }
    }

    // Pay mandatory colored/colorless demands from matching colors first.
    const payment = emptyPool();
    const remaining = clonePool(pool);
    let shortfall = 0;

    for (const color of ALL_COLORS) {
      const need = demand[color];
      const pay = Math.min(need, remaining[color]);
      payment[color] += pay;
      remaining[color] -= pay;
      shortfall += need - pay;
    }

    // Pay generic: C first, then most-abundant color.
    let genRemaining = genericNeed;
    if (genRemaining > 0) {
      const payC = Math.min(genRemaining, remaining.C);
      payment.C += payC;
      remaining.C -= payC;
      genRemaining -= payC;

      while (genRemaining > 0) {
        // find most-abundant non-C color
        let bestColor: ManaColor | null = null;
        let bestAmt = 0;
        for (const color of ['W', 'U', 'B', 'R', 'G'] as ManaColor[]) {
          if (remaining[color] > bestAmt) {
            bestAmt = remaining[color];
            bestColor = color;
          }
        }
        if (!bestColor || bestAmt === 0) break;
        payment[bestColor] += 1;
        remaining[bestColor] -= 1;
        genRemaining -= 1;
      }
      shortfall += genRemaining;
    }

    const candidate: PaymentSolution = {
      ok: shortfall === 0,
      payment,
      shortfall,
    };

    if (
      best === null ||
      candidate.shortfall < best.shortfall ||
      (candidate.shortfall === best.shortfall && poolTotal(candidate.payment) < poolTotal(best.payment))
    ) {
      best = candidate;
    }
  };

  const backtrack = (idx: number, acc: (ManaColor | 'GEN2')[]): void => {
    if (best !== null && best.ok) return; // early exit once a full payment found
    if (idx === choices.length) {
      consider(acc);
      return;
    }
    for (const opt of choices[idx].options) {
      acc.push(opt);
      backtrack(idx + 1, acc);
      acc.pop();
      if (best !== null && best.ok) return;
    }
  };

  backtrack(0, []);

  // best is guaranteed set (backtrack always reaches consider at least once,
  // because choices may be empty -> consider([])).
  if (best === null) {
    consider([]);
  }
  const solution: PaymentSolution = best ?? {
    ok: generic === 0 && poolTotal(fixedDemand) === 0,
    payment: emptyPool(),
    shortfall: 0,
  };

  // Phyrexian: pay with mana opportunistically using whatever is left, but do
  // NOT add to shortfall if unpayable. We only attempt this on a successful or
  // partial solution by spending from leftover pool after the chosen payment.
  if (phyrexianColors.length > 0) {
    const remaining = clonePool(pool);
    for (const color of ALL_COLORS) {
      remaining[color] -= solution.payment[color];
    }
    for (const color of phyrexianColors) {
      if (remaining[color] > 0) {
        remaining[color] -= 1;
        solution.payment[color] += 1;
      }
      // else: skip; user pays 2 life (handled outside engine).
    }
  }

  return solution;
}
