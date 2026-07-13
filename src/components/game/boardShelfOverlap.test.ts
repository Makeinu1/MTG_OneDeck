import { describe, expect, it } from 'vitest';
import { boardOverlapMargin } from './boardShelf';

describe('boardOverlapMargin', () => {
  it('derives overlap from the card width instead of the containing shelf', () => {
    expect(boardOverlapMargin(96)).toBe(-35);
    expect(boardOverlapMargin(84)).toBe(-30);
    expect(boardOverlapMargin(72)).toBe(-26);
  });
});
