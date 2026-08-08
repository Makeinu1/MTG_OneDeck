import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('AV8 game-start audio gesture ordering', () => {
  it('starts the session before initializing the opening hand', () => {
    const app = read('src/App.tsx');
    const unlock = app.indexOf('startAudioForGameGesture()');
    const newGame = app.indexOf('useGameStore.getState().newGame(deck)');
    expect(unlock).toBeGreaterThanOrEqual(0);
    expect(newGame).toBeGreaterThan(unlock);
  });

  it('reuses the session helper without intercepting the start action', () => {
    const provider = read('src/components/game/presentation/AudioVisualProvider.tsx');
    expect(provider).toContain('export function startAudioForGameGesture');
    expect(provider).toContain('sessionGestureUnlocked = true');
    expect(provider).toContain('ensureSessionRuntime(getThemeTrack(resolvedTheme()));');
    expect(provider).toContain('context.resume()');
    expect(provider).toContain('sessionRuntime?.resume()');
    expect(provider).toContain('loadAllSfx(context)');
    expect(provider).toContain('if (sessionGestureUnlocked)');
    expect(provider).toContain('retrySfxLoad();');
    expect(provider).not.toMatch(/preventDefault\(|stopPropagation\(/);
  });

  it('keeps opening deal as one existing draw cue and avoids a new event kind', () => {
    const layer = read('src/components/game/presentation/SemanticPresentationLayer.tsx');
    const events = read('src/components/game/presentation/presentationEvents.ts');
    expect(layer).toContain('consumePendingOpeningDealCue');
    expect(layer).toContain("action: 'draw'");
    expect(events).not.toContain("kind: 'game-start'");
  });
});
