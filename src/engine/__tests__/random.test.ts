import { describe, it, expect } from 'vitest';
import { createRng, shuffledOrder } from '../random';

describe('createRng (mulberry32)', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds give different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
  });
});

describe('shuffledOrder (Fisher-Yates)', () => {
  it('is a permutation of the input', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const rng = createRng(42);
    const out = shuffledOrder(ids, rng);
    expect(out.slice().sort()).toEqual(ids.slice().sort());
    expect(out).toHaveLength(ids.length);
  });

  it('does not mutate the input array', () => {
    const ids = ['a', 'b', 'c'];
    const copy = ids.slice();
    shuffledOrder(ids, createRng(1));
    expect(ids).toEqual(copy);
  });

  it('is deterministic for a fixed seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out1 = shuffledOrder(ids, createRng(99));
    const out2 = shuffledOrder(ids, createRng(99));
    expect(out1).toEqual(out2);
  });
});
