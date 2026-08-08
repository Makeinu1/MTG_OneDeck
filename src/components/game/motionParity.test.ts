import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GAME_CSS = readFileSync('src/components/game/game.css', 'utf8');

describe('AV5/AV6 motion theme parity', () => {
  it('uses shared ambient choreography selectors for both themes', () => {
    expect(GAME_CSS).toContain(":root[data-ambient='on'] .game-screen .land-bundle[data-beat-tapped][data-beat-index]");
    expect(GAME_CSS).toContain(":root[data-ambient='on'] .game-card--commander");
    expect(GAME_CSS).toContain(":root[data-ambient='on'] .game-card--commander-idle::after");
    expect(GAME_CSS).toContain(":root[data-ambient='on'] .game-screen:not([data-commander-on-battlefield]) .dance-floor__pool");
  });

  it('does not structurally disable AV5/AV6 choreography for light theme', () => {
    expect(GAME_CSS).not.toContain("html[data-theme='light'] .land-bundle[data-beat-index]");
    expect(GAME_CSS).not.toContain("html[data-theme='light'] .visual-card-bundle[data-beat-index]");
    expect(GAME_CSS).not.toContain("html[data-theme='light'] .dance-floor__pool");
    expect(GAME_CSS).not.toContain("html[data-theme='light'] .game-card--commander-idle::after");
  });

  it('retains the ambient and reduced-motion safety gates', () => {
    expect(GAME_CSS).toContain(":root[data-ambient='on'] .game-screen[data-just-arrived]");
    expect(GAME_CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(GAME_CSS).toContain('.dance-floor__pool {');
    expect(GAME_CSS).toContain('.game-card--commander-idle::after,');
  });
});
