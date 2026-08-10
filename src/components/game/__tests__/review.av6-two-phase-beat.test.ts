/**
 * review.av6-two-phase-beat — M-AV6 の判定者専有ピン。
 * docs/audio-visual-contract.md §11「2フェーズリズム + ダンスフロア照明」の実装を固定する。
 * 実装者はこのテストを変更しない(落ちたら実装側を直す)。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commanderOnBattlefield,
  lightPoolColors,
} from '../presentation/twoPhaseBeat';
import { DEFAULT_AUDIO_VISUAL_TUNING } from '../presentation/presentationTuning';
import type { GameState } from '../../../engine/types';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

/* ------------------------------------------------------------------ */
/*  Helpers: minimal GameState fixtures                                */
/* ------------------------------------------------------------------ */

function makeState(overrides: Record<string, unknown> = {}): GameState {
  return {
    commanders: [],
    cards: {},
    defs: {},
    ...overrides,
  } as unknown as GameState;
}

/* ------------------------------------------------------------------ */
/*  Phase derivation (フェーズ導出)                                     */
/* ------------------------------------------------------------------ */

describe('AV6 phase derivation', () => {
  it('returns false when no commanders exist', () => {
    const state = makeState({ commanders: [] });
    expect(commanderOnBattlefield(state)).toBe(false);
  });

  it('returns false when commander is in command zone', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
    });
    expect(commanderOnBattlefield(state)).toBe(false);
  });

  it('returns true when commander is on battlefield', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 1 }],
      cards: { cmd1: { defId: 'd1', zone: 'battlefield', faceIndex: 0 } },
    });
    expect(commanderOnBattlefield(state)).toBe(true);
  });

  it('returns false when commander was destroyed (graveyard)', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 1 }],
      cards: { cmd1: { defId: 'd1', zone: 'graveyard', faceIndex: 0 } },
    });
    expect(commanderOnBattlefield(state)).toBe(false);
  });

  it('returns false when commander is on stack (countered scenario)', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 1 }],
      cards: { cmd1: { defId: 'd1', zone: 'stack', faceIndex: 0 } },
    });
    expect(commanderOnBattlefield(state)).toBe(false);
  });

  it('returns true if ANY commander is on battlefield (multi-commander)', () => {
    const state = makeState({
      commanders: [
        { cardId: 'cmd1', castCount: 0 },
        { cardId: 'cmd2', castCount: 1 },
      ],
      cards: {
        cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 },
        cmd2: { defId: 'd2', zone: 'battlefield', faceIndex: 0 },
      },
    });
    expect(commanderOnBattlefield(state)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Light pool colors (照明色導出)                                      */
/* ------------------------------------------------------------------ */

describe('AV6 light pool colors', () => {
  it('returns gold for colorless commander', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
      defs: { d1: { colorIdentity: [] } },
    });
    expect(lightPoolColors(state)).toEqual(['gold']);
  });

  it('returns single mana color for mono-color commander', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
      defs: { d1: { colorIdentity: ['R'] } },
    });
    expect(lightPoolColors(state)).toEqual(['R']);
  });

  it('returns WUBRG-ordered union for multi-color commander', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
      defs: { d1: { colorIdentity: ['R', 'U'] } },
    });
    expect(lightPoolColors(state)).toEqual(['U', 'R']);
  });

  it('dedupes across multiple commanders', () => {
    const state = makeState({
      commanders: [
        { cardId: 'cmd1', castCount: 0 },
        { cardId: 'cmd2', castCount: 0 },
      ],
      cards: {
        cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 },
        cmd2: { defId: 'd2', zone: 'command', faceIndex: 0 },
      },
      defs: {
        d1: { colorIdentity: ['U', 'R'] },
        d2: { colorIdentity: ['R', 'G'] },
      },
    });
    expect(lightPoolColors(state)).toEqual(['U', 'R', 'G']);
  });

  it('caps at 5 pools maximum', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
      defs: { d1: { colorIdentity: ['W', 'U', 'B', 'R', 'G'] } },
    });
    expect(lightPoolColors(state)).toHaveLength(5);
  });

  it('returns gold when defs are missing (fallback)', () => {
    const state = makeState({
      commanders: [{ cardId: 'cmd1', castCount: 0 }],
      cards: { cmd1: { defId: 'd1', zone: 'command', faceIndex: 0 } },
      defs: {},
    });
    expect(lightPoolColors(state)).toEqual(['gold']);
  });
});

/* ------------------------------------------------------------------ */
/*  Tuning fields (TUNABLE 一か所集約)                                  */
/* ------------------------------------------------------------------ */

describe('AV6 tuning fields', () => {
  it('has all AV6 tuning fields with correct defaults', () => {
    expect(DEFAULT_AUDIO_VISUAL_TUNING.lightPeakPre).toBe(0.10);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.lightPeakPost).toBe(0.22);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.lightBase).toBe(0.04);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.commanderIdlePeak).toBe(0.35);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.stampSinkPx).toBe(2.5);
    expect(DEFAULT_AUDIO_VISUAL_TUNING.lightPoolSizePct).toBe(55);
  });
});

/* ------------------------------------------------------------------ */
/*  CSS structure (game.css)                                           */
/* ------------------------------------------------------------------ */

describe('AV6 CSS choreography structure', () => {
  const css = read('src/components/game/game.css');

  it('defines land-heartbeat keyframes', () => {
    expect(css).toContain('@keyframes land-heartbeat');
  });

  it('defines land-stamp keyframes', () => {
    expect(css).toContain('@keyframes land-stamp');
  });

  it('defines commander-idle-breathe keyframes', () => {
    expect(css).toContain('@keyframes commander-idle-breathe');
  });

  it('defines light-pool keyframes (heartbeat, groove, stamp)', () => {
    expect(css).toContain('@keyframes light-pool-heartbeat');
    expect(css).toContain('@keyframes light-pool-groove');
    expect(css).toContain('@keyframes light-pool-stamp');
  });

  it('gates AV6 elements behind :root[data-ambient="on"]', () => {
    expect(css).toMatch(/:root\[data-ambient='on'\][^{]*land-heartbeat/);
    expect(css).toMatch(/:root\[data-ambient='on'\][^{]*light-pool/);
  });

  it('uses phase selectors on .game-screen', () => {
    expect(css).toContain('data-commander-on-battlefield');
    expect(css).toContain('data-just-arrived');
  });

  it('heartbeat uses :not([data-commander-on-battlefield]) selector', () => {
    expect(css).toMatch(/\.game-screen:not\(\[data-commander-on-battlefield\]\)/);
  });

  it('groove uses [data-commander-on-battlefield] selector', () => {
    expect(css).toMatch(/\.game-screen\[data-commander-on-battlefield\]/);
  });

  it('stamp uses [data-just-arrived] selector', () => {
    expect(css).toMatch(/\.game-screen\[data-just-arrived\]/);
  });

  it('does not animate filter or box-shadow on AV6 keyframes (transform/opacity only)', () => {
    const av6Keyframes = css.match(
      /@keyframes (?:land-heartbeat|land-stamp|commander-idle-breathe|light-pool-(?:heartbeat|groove|stamp))[^}]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g,
    ) ?? [];
    const allAv6Css = av6Keyframes.join('\n');
    expect(allAv6Css).not.toMatch(/\bfilter\s*:/);
    expect(allAv6Css).not.toMatch(/\bbox-shadow\s*:/);
  });

  it('includes reduced-motion override for AV6 elements', () => {
    const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedBlock).toMatch(/land-heartbeat|dance-floor|light-pool/);
  });

  it('keeps AV6 choreography available to both themes', () => {
    expect(css).toContain(":root[data-ambient='on'] .game-screen:not([data-commander-on-battlefield]) .dance-floor__pool");
    expect(css).not.toMatch(/html\[data-theme='light'\] \.dance-floor__pool/);
    expect(css).not.toMatch(/html\[data-theme='light'\] \.game-card--commander-idle::after/);
  });

  it('dance-floor layer has pointer-events: none', () => {
    const danceFloorBlock = css.slice(css.indexOf('.dance-floor'));
    expect(danceFloorBlock.slice(0, 300)).toContain('pointer-events: none');
  });
});

/* ------------------------------------------------------------------ */
/*  React structure (フェーズ導出 + スタンプ)                           */
/* ------------------------------------------------------------------ */

describe('AV6 React structure', () => {
  it('GameScreen sets data-commander-on-battlefield', () => {
    const source = read('src/components/game/GameScreen.tsx');
    expect(source).toContain('data-commander-on-battlefield');
  });

  it('GameScreen sets data-just-arrived for stamp', () => {
    const source = read('src/components/game/GameScreen.tsx');
    expect(source).toContain('data-just-arrived');
  });

  it('GameCard adds game-card--commander-idle for command zone commanders', () => {
    const source = read('src/components/game/GameCard.tsx');
    expect(source).toContain('game-card--commander-idle');
  });

  it('DanceFloorLights component exists', () => {
    const source = read('src/components/game/DanceFloorLights.tsx');
    expect(source).toContain('dance-floor');
    expect(source).toContain('lightPoolColors');
  });

  it('AudioVisualProvider sets AV6 CSS variables', () => {
    const source = read('src/components/game/presentation/AudioVisualProvider.tsx');
    expect(source).toContain('--light-peak-pre');
    expect(source).toContain('--light-peak-post');
    expect(source).toContain('--commander-idle-peak');
    expect(source).toContain('--stamp-sink');
  });
});

/* ------------------------------------------------------------------ */
/*  No new PresentationEvent / sound / BGM change                      */
/* ------------------------------------------------------------------ */

describe('AV6 no new events, sound, or BGM change', () => {
  it('does not add new PresentationEvent kinds', () => {
    const source = read('src/components/game/presentation/presentationEvents.ts');
    expect(source).not.toContain('two-phase');
    expect(source).not.toContain('dance-floor');
    expect(source).not.toContain('heartbeat');
    expect(source).not.toContain('stamp');
  });

  it('twoPhaseBeat module does not import audio/sound modules', () => {
    const source = read('src/components/game/presentation/twoPhaseBeat.ts');
    expect(source).not.toContain('AudioContext');
    expect(source).not.toContain('sfxRenderer');
    expect(source).not.toContain('musicBus');
  });

  it('DanceFloorLights does not import audio modules', () => {
    const source = read('src/components/game/DanceFloorLights.tsx');
    expect(source).not.toContain('AudioContext');
    expect(source).not.toContain('sfxRenderer');
    expect(source).not.toContain('musicBus');
  });
});
// verifies: AV-003
