import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ambientBackdrop = readFileSync('src/components/game/AmbientBackdrop.tsx', 'utf8');
const ambientMotion = readFileSync('src/components/game/ambientMotion.ts', 'utf8');
const gameCss = readFileSync('src/components/game/game.css', 'utf8');

describe('UXUI-AMBIENT-P2 production boundary', () => {
  it('keeps loop seconds in TrackManifest rather than production ambient files', () => {
    for (const source of [ambientBackdrop, ambientMotion, gameCss]) {
      expect(source).not.toContain('251.798458');
      expect(source).not.toContain('362.879979');
    }
    expect(ambientBackdrop).toContain('ambientMacroLoopDurationSec(theme)');
    expect(ambientMotion).toContain('getThemeTrack(theme)');
  });

  it('declares exactly the approved three logical groups for both skins', () => {
    expect(gameCss).toContain('ambient-backdrop__dark > .ambient-stars--far');
    expect(gameCss).toContain('ambient-backdrop__dark > .ambient-stars--mid');
    expect(gameCss).toContain('ambient-backdrop__dark > .ambient-stars--near');
    expect(gameCss).toContain('ambient-backdrop__light > .ambient-vignette--light');
    expect(gameCss).toContain('ambient-backdrop__light > .ambient-blooms');
    expect(gameCss).toContain('ambient-backdrop__light > .ambient-flecks');
    expect(gameCss).toContain('ambient-macro-g1, ambient-macro-g2, ambient-macro-g3');
  });

  it('leaves the approved dev fixture as the phase-controlled reference', () => {
    expect(gameCss).toContain(':root:not([data-fixture-scenario]) .game-screen');
    expect(gameCss).toContain(":root[data-ambient='on']:not([data-fixture-scenario]) .game-screen");
  });

  it('keeps macro keyframes free of new rotation, will-change, layout, and audio clock code', () => {
    const macroEnd = gameCss.indexOf('/* ---------- ダーク =');
    const macroSection = gameCss.slice(gameCss.indexOf('@keyframes ambient-macro-g1'), macroEnd);
    expect(macroSection).not.toContain('rotate(');
    expect(macroSection).not.toContain('will-change');
    expect(macroSection).not.toContain('background-position');
    expect(macroSection).toContain(':has(.ambient-backdrop[data-paused])');
    expect(macroSection).toContain(':has(.ambient-backdrop[data-reduced])');
    expect(ambientBackdrop).not.toContain('currentTime');
    expect(ambientBackdrop).not.toContain('requestAnimationFrame');
  });

  it('pins the approved closed-orbit keyframe values', () => {
    expect(gameCss).toContain('--ambient-macro-g1-x: calc(4px * var(--ambient-macro-width-scale));');
    expect(gameCss).toContain('--ambient-macro-g2-x: calc(8px * var(--ambient-macro-width-scale));');
    expect(gameCss).toContain('--ambient-macro-g3-x: calc(12px * var(--ambient-macro-width-scale));');
    expect(gameCss).toContain('--ambient-macro-g1-scale: 1.004;');
    expect(gameCss).toContain('--ambient-macro-g2-scale: 1.008;');
    expect(gameCss).toContain('--ambient-macro-g3-scale: 1.012;');
    expect(gameCss).toContain('--ambient-macro-g1-opacity: 0.025;');
    expect(gameCss).toContain('--ambient-macro-g2-opacity: 0.050;');
    expect(gameCss).toContain('--ambient-macro-g3-opacity: 0.070;');
    expect(gameCss).toContain("animation-delay: 0s, calc(var(--ambient-macro-loop-duration, 0s) * -0.3333333333333333), calc(var(--ambient-macro-loop-duration, 0s) * -0.6666666666666667);");
    expect((gameCss.match(/0%, 100% \{/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
