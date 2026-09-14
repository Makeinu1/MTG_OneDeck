import type { CockpitTable, TableStackEntry } from '../../engine/cockpitTable';

/** A stack-detail selection only owns input while that exact public entry still exists. */
export function liveStackDetail(
  table: CockpitTable,
  entryId: string | null,
): TableStackEntry | null {
  if (!entryId) return null;
  return (
    table.stack.find((entry) => entry.id === entryId) ??
    (table.resolution?.id === entryId ? table.resolution : null)
  );
}
