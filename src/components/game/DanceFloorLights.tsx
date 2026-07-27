/**
 * DanceFloorLights — AV6 dance-floor lighting layer.
 * docs/audio-visual-contract.md §11「ダンスフロア照明」.
 * Pure CSS animation (opacity only). No JS per-frame loops. No audio.
 */
import type { CSSProperties } from 'react';
import type { GameController } from './gameController';
import { lightPoolColors } from './presentation/twoPhaseBeat';

const MANA_TOKEN: Record<string, string> = {
  W: 'var(--mana-w)',
  U: 'var(--mana-u)',
  B: 'var(--mana-b)',
  R: 'var(--mana-r)',
  G: 'var(--mana-g)',
  gold: 'var(--gold-bright)',
};

export function DanceFloorLights({ controller }: { controller: GameController }) {
  const { state } = controller;
  if (!state) return null;
  const colors = lightPoolColors(state);
  const count = colors.length;

  return (
    <div className="dance-floor" aria-hidden data-testid="dance-floor-lights">
      {colors.map((color, i) => (
        <div
          key={`${color}-${i}`}
          className="dance-floor__pool"
          data-testid={`dance-floor-pool-${i}`}
          style={{
            '--pool-color': MANA_TOKEN[color] ?? MANA_TOKEN.gold,
            left: `${((i + 0.5) / count) * 100}%`,
            top: i % 2 === 0 ? '40%' : '60%',
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
