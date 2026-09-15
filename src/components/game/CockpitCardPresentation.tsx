import { useMemo, type ReactNode } from 'react';
import type { CockpitTable } from '../../engine/cockpitTable';
import { cockpitPowerToughness } from '../../engine/cockpitPowerToughness';
import { objectIdOf } from '../../engine/types';

import { RecordedStats, type RecordedStatsEntry } from './cockpitCardPresentationContext';

/** The current seat projection only; never an alternative writable game state. */
export function CockpitCardPresentation({
  table,
  className,
  children,
}: {
  table: CockpitTable;
  className?: string;
  children: ReactNode;
}) {
  const stats = useMemo(() => {
    const result: Record<string, RecordedStatsEntry> = {};
    for (const card of Object.values(table.cards)) {
      const pt = cockpitPowerToughness(table, card.id);
      if (card.zone === 'battlefield' && pt)
        result[card.id] = { ...pt, objectId: objectIdOf(card) };
    }
    return result;
  }, [table]);
  return (
    <RecordedStats.Provider value={stats}>
      <main className={className} data-testid="game-screen">
        {children}
      </main>
    </RecordedStats.Provider>
  );
}
