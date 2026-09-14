import { expect, it } from 'vitest';
import { hasCockpitLibraryAccess, type CockpitLibraryAccess } from './cockpitLibraryAccess';

function access(peek: CockpitLibraryAccess['peek'], totalCount = 10): CockpitLibraryAccess {
  return {
    seatId: 'P1',
    totalCount,
    peek,
    request: () => Promise.resolve(null),
    release: () => Promise.resolve(null),
  };
}

it('distinguishes full library access from bounded top-card access', () => {
  expect(hasCockpitLibraryAccess(undefined)).toBe(true);
  expect(hasCockpitLibraryAccess(access(null))).toBe(false);
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'library', count: 2 }), 2)).toBe(
    true,
  );
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'library', count: 2 }), 3)).toBe(
    false,
  );
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'library', count: 2 }))).toBe(false);
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'library' }))).toBe(true);
  expect(hasCockpitLibraryAccess(access({ seatId: 'P2', zone: 'library' }))).toBe(false);
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'hand' }))).toBe(false);
});

it('treats a confirmed bounded peek as sufficient when the real library is shorter', () => {
  expect(hasCockpitLibraryAccess(access({ seatId: 'P1', zone: 'library', count: 5 }, 1), 5)).toBe(
    true,
  );
});
