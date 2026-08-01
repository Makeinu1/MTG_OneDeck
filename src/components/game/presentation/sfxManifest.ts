/** Fixed AV7 production sample palette. */

export type SfxKind =
  | 'draw-completed'
  | 'land-played'
  | 'spell-cast'
  | 'tap-changed'
  | 'stack-resolved'
  | 'shuffle-completed'
  | 'turn-advanced'
  | 'commander-cast';

export interface SfxLayer {
  src: string;
  gainDb: number;
  offsetMs: number;
  chokeGroup: string;
}

export const ALL_SFX_KINDS: readonly SfxKind[] = [
  'draw-completed',
  'land-played',
  'spell-cast',
  'tap-changed',
  'stack-resolved',
  'shuffle-completed',
  'turn-advanced',
  'commander-cast',
];

const asset = (file: string): string => `${import.meta.env.BASE_URL}audio/sfx/${file}`;

const layer = (file: string, gainDb: number, chokeGroup: string): SfxLayer => ({
  src: asset(file),
  gainDb,
  offsetMs: 0,
  chokeGroup,
});

const FIXED_LAYERS: Record<Exclude<SfxKind, 'tap-changed'>, readonly SfxLayer[]> = {
  'draw-completed': [layer('draw-slide.wav', -2.38, 'draw'), layer('draw-fan.wav', -9.9, 'draw')],
  'land-played': [layer('land-place.wav', -1.41, 'land'), layer('low-thud.wav', -7.54, 'land')],
  'spell-cast': [
    layer('spell-place.wav', -2.85, 'spell'),
    layer('spell-arcane-snap.wav', -10.46, 'spell'),
  ],
  'stack-resolved': [layer('resolve-shove.wav', -3.88, 'resolve')],
  'shuffle-completed': [layer('shuffle.wav', -1.94, 'shuffle')],
  'turn-advanced': [layer('turn-chip.wav', -1.94, 'turn'), layer('low-thud.wav', -9.12, 'turn')],
  'commander-cast': [
    layer('commander-contact.wav', -7.13, 'commander'),
    layer('low-thud.wav', -6.02, 'commander'),
    layer('commander-portal-open.wav', -6.74, 'commander'),
  ],
};

const TAP_LAYERS = {
  tapped: [layer('tap-shove.wav', -2.5, 'tap-change')],
  untapped: [layer('untap-slide.wav', -2.85, 'tap-change')],
} as const;

export function sfxLayersFor(
  kind: SfxKind,
  options: { tapped?: boolean } = {},
): readonly SfxLayer[] {
  if (kind === 'tap-changed') {
    return options.tapped === false ? TAP_LAYERS.untapped : TAP_LAYERS.tapped;
  }
  return FIXED_LAYERS[kind];
}

export function allSfxAssetSources(): readonly string[] {
  return [
    ...new Set(
      ALL_SFX_KINDS.flatMap((kind) =>
        kind === 'tap-changed'
          ? [...sfxLayersFor(kind, { tapped: true }), ...sfxLayersFor(kind, { tapped: false })]
          : [...sfxLayersFor(kind)],
      ).map((item) => item.src),
    ),
  ];
}
