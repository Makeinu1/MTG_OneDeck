import { describe, expect, it } from 'vitest';
import { ALL_SFX_KINDS, sfxLayersFor } from '../sfxManifest';

describe('AV7 fixed SFX manifest', () => {
  it('defines all semantic kinds deterministically', () => {
    expect(ALL_SFX_KINDS).toHaveLength(8);
    for (const kind of ALL_SFX_KINDS) {
      expect(sfxLayersFor(kind)).toEqual(sfxLayersFor(kind));
    }
  });

  it('shares a choke group between tap and untap variants', () => {
    expect(sfxLayersFor('tap-changed', { tapped: true })[0].chokeGroup).toBe('tap-change');
    expect(sfxLayersFor('tap-changed', { tapped: false })[0].chokeGroup).toBe('tap-change');
  });

  it('uses only fixed zero-offset production WAV layers', () => {
    for (const kind of ALL_SFX_KINDS) {
      const variants =
        kind === 'tap-changed'
          ? [sfxLayersFor(kind, { tapped: true }), sfxLayersFor(kind, { tapped: false })]
          : [sfxLayersFor(kind)];
      for (const layers of variants) {
        expect(layers.length).toBeGreaterThan(0);
        for (const layer of layers) {
          expect(layer.offsetMs).toBe(0);
          expect(layer.src).toMatch(/audio\/sfx\/.+\.wav$/);
        }
      }
    }
  });
});
