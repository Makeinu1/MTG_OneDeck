import { createContext, useContext } from 'react';
import type { RecordedPowerToughness } from '../../engine/cockpitPowerToughness';
import { objectIdOf, type CardInstance } from '../../engine/types';

export type RecordedStatsEntry = RecordedPowerToughness & { objectId: string };
export const RecordedStats = createContext<Readonly<Record<string, RecordedStatsEntry>>>({});

export function useRecordedPowerToughness(card: CardInstance): RecordedPowerToughness | undefined {
  const entry = useContext(RecordedStats)[card.id];
  return !card.faceDown && card.zone === 'battlefield' && entry?.objectId === objectIdOf(card)
    ? entry
    : undefined;
}
