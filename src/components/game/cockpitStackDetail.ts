import type { CockpitTable } from '../../engine/cockpitTable';

export type CockpitStackDetailEntry = CockpitTable['stack'][number];

/** Resolve only a currently visible stack/resolution item; stale ids must not own input. */
export function cockpitStackDetailEntry(
  table: CockpitTable,
  id: string | null,
): CockpitStackDetailEntry | null {
  if (!id) return null;
  return (
    table.stack.find((entry) => entry.id === id) ??
    (table.resolution?.id === id ? table.resolution : null)
  );
}
