import { describe, it, expect } from 'vitest';
import { parseManaCost, solvePayment } from '../mana';
import type { ManaPool } from '../types';

function pool(p: Partial<ManaPool>): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...p };
}

describe('parseManaCost', () => {
  it('parses generic + colored {2}{W}{W}', () => {
    const c = parseManaCost('{2}{W}{W}');
    expect(c.generic).toBe(2);
    expect(c.x).toBe(0);
    expect(c.pips).toEqual([
      { kind: 'color', color: 'W' },
      { kind: 'color', color: 'W' },
    ]);
  });

  it('parses X {X}{R}', () => {
    const c = parseManaCost('{X}{R}');
    expect(c.generic).toBe(0);
    expect(c.x).toBe(1);
    expect(c.pips).toEqual([{ kind: 'color', color: 'R' }]);
  });

  it('parses hybrid {W/U}', () => {
    const c = parseManaCost('{W/U}');
    expect(c.pips).toEqual([{ kind: 'hybrid', options: ['W', 'U'] }]);
  });

  it('parses mono-hybrid {2/W}', () => {
    const c = parseManaCost('{2/W}');
    expect(c.pips).toEqual([{ kind: 'monoHybrid', color: 'W' }]);
  });

  it('parses phyrexian {G/P}', () => {
    const c = parseManaCost('{G/P}');
    expect(c.pips).toEqual([{ kind: 'phyrexian', color: 'G' }]);
  });

  it('parses colorless {C}{C}', () => {
    const c = parseManaCost('{C}{C}');
    expect(c.pips).toEqual([{ kind: 'colorless' }, { kind: 'colorless' }]);
  });

  it('parses snow {S}', () => {
    const c = parseManaCost('{S}');
    expect(c.pips).toEqual([{ kind: 'snow' }]);
  });

  it('parses {0}', () => {
    const c = parseManaCost('{0}');
    expect(c.generic).toBe(0);
    expect(c.pips).toEqual([]);
  });

  it('parses empty string', () => {
    const c = parseManaCost('');
    expect(c).toEqual({ generic: 0, x: 0, pips: [] });
  });

  it('ignores unknown tokens', () => {
    const c = parseManaCost('{2}{HALF}{W}');
    expect(c.generic).toBe(2);
    expect(c.pips).toEqual([{ kind: 'color', color: 'W' }]);
  });
});

describe('solvePayment', () => {
  it('fully pays a simple cost', () => {
    const cost = parseManaCost('{2}{W}{W}');
    const sol = solvePayment(pool({ W: 2, C: 2 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.shortfall).toBe(0);
    expect(sol.payment.W).toBe(2);
    expect(sol.payment.C).toBe(2);
  });

  it('reports shortfall when underpaying', () => {
    const cost = parseManaCost('{3}{R}');
    const sol = solvePayment(pool({ R: 1, C: 1 }), cost, 0);
    expect(sol.ok).toBe(false);
    expect(sol.shortfall).toBe(2);
    // pays what it can
    expect(sol.payment.R).toBe(1);
    expect(sol.payment.C).toBe(1);
  });

  it('solves hybrid requiring backtracking {W/U}{U}', () => {
    // pool has only one U and one W. Greedy "pay U for hybrid" would fail the
    // mandatory {U}. Backtracking must assign W to the hybrid.
    const cost = parseManaCost('{W/U}{U}');
    const sol = solvePayment(pool({ W: 1, U: 1 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.shortfall).toBe(0);
    expect(sol.payment.W).toBe(1);
    expect(sol.payment.U).toBe(1);
  });

  it('handles X-spell payment', () => {
    const cost = parseManaCost('{X}{R}');
    const sol = solvePayment(pool({ R: 1, C: 3 }), cost, 3);
    expect(sol.ok).toBe(true);
    expect(sol.shortfall).toBe(0);
    // R for colored, 3 generic from C
    expect(sol.payment.R).toBe(1);
    expect(sol.payment.C).toBe(3);
  });

  it('mono-hybrid paid with 2 generic when color unavailable', () => {
    const cost = parseManaCost('{2/W}');
    const sol = solvePayment(pool({ C: 2 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.payment.C).toBe(2);
  });

  it('mono-hybrid prefers the color when available', () => {
    const cost = parseManaCost('{2/W}');
    const sol = solvePayment(pool({ W: 1 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.payment.W).toBe(1);
  });

  it('phyrexian paid with mana when available', () => {
    const cost = parseManaCost('{G/P}');
    const sol = solvePayment(pool({ G: 1 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.payment.G).toBe(1);
  });

  it('phyrexian skipped (not shortfall) when unpayable', () => {
    const cost = parseManaCost('{G/P}');
    const sol = solvePayment(pool({}), cost, 0);
    // ok because phyrexian is not counted as shortfall
    expect(sol.ok).toBe(true);
    expect(sol.shortfall).toBe(0);
    expect(sol.payment.G).toBe(0);
  });

  it('snow treated as generic', () => {
    const cost = parseManaCost('{S}');
    const sol = solvePayment(pool({ C: 1 }), cost, 0);
    expect(sol.ok).toBe(true);
    expect(sol.payment.C).toBe(1);
  });
});
