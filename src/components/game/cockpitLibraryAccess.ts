import type { CockpitTable } from '../../engine/cockpitTable';

export interface CockpitLibraryPeek {
  seatId: string;
  zone: 'hand' | 'library';
  count?: number;
}

export interface CockpitLibraryAccess {
  seatId: string;
  totalCount: number;
  peek: CockpitLibraryPeek | null;
  request: (count?: number) => Promise<CockpitTable | null>;
  release: () => Promise<CockpitTable | null>;
}

export function hasCockpitLibraryAccess(
  access: CockpitLibraryAccess | undefined,
  count?: number,
): boolean {
  if (!access) return true;
  const peek = access.peek;
  if (!peek || peek.seatId !== access.seatId || peek.zone !== 'library') return false;
  if (count === undefined) return peek.count === undefined;
  if (peek.count === undefined) return true;
  const required = Math.min(Math.max(0, Math.trunc(count)), Math.max(0, access.totalCount));
  return peek.count >= required;
}
