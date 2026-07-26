/**
 * sfxPatches — ordinary tests for deterministic patch data.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  sfxPatch,
  SFX_LEVELS_DB,
  type SfxKind,
} from '../sfxPatches';

const ROOT = process.cwd();
const ALL_KINDS: SfxKind[] = ['spell-cast', 'land-played', 'turn-advanced', 'commander-cast'];
const ORDINARY_KINDS: SfxKind[] = ['spell-cast', 'land-played', 'turn-advanced'];

describe('sfxPatch determinism', () => {
  it('returns deep-equal output across repeated calls for every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(sfxPatch(kind)).toEqual(sfxPatch(kind));
    }
  });
});

describe('sfxPatch layer counts', () => {
  it('ordinary patches have at least 2 layers', () => {
    for (const kind of ORDINARY_KINDS) {
      expect(sfxPatch(kind).layers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('commander patch has at least 4 layers', () => {
    expect(sfxPatch('commander-cast').layers.length).toBeGreaterThanOrEqual(4);
  });
});

describe('sfxPatch commander duration', () => {
  it('commander durationMs is at most 650', () => {
    expect(sfxPatch('commander-cast').durationMs).toBeLessThanOrEqual(650);
  });
});

describe('SFX_LEVELS_DB contract values', () => {
  it('spell-cast is -13 dB', () => {
    expect(SFX_LEVELS_DB['spell-cast']).toBe(-13);
  });

  it('land-played is -11 dB', () => {
    expect(SFX_LEVELS_DB['land-played']).toBe(-11);
  });

  it('turn-advanced is -15 dB', () => {
    expect(SFX_LEVELS_DB['turn-advanced']).toBe(-15);
  });

  it('commander-cast is -8 dB', () => {
    expect(SFX_LEVELS_DB['commander-cast']).toBe(-8);
  });
});

describe('no Math.random in source', () => {
  it('sfxPatches.ts contains no Math.random', () => {
    const source = readFileSync(resolve(ROOT, 'src/components/game/presentation/sfxPatches.ts'), 'utf8');
    expect(source).not.toContain('Math.random');
  });

  it('sfxRenderer.ts contains no Math.random', () => {
    const source = readFileSync(resolve(ROOT, 'src/components/game/presentation/sfxRenderer.ts'), 'utf8');
    expect(source).not.toContain('Math.random');
  });
});
