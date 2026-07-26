/**
 * review.av3-semantic-runtime — AV3 の意味イベント配線を凍結する判定者専有ピン。
 *
 * 通常操作の音・光は controller が成功済み commit から明示的に発行する。
 * React の再描画やログ文言から意味を推測してはならない。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createPresentationRuntime,
} from '../presentation/presentationRuntime';
import {
  presentationSoundDelayMs,
} from '../presentation/semanticSound';
import { sfxPatch, SFX_LEVELS_DB } from '../presentation/sfxPatches';
import { getNextGridDelayMs } from '../presentation/audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from '../presentation/presentationTuning';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('AV3 semantic presentation runtime', () => {
  it('publishes only successful projected events, once, to future subscribers', () => {
    const runtime = createPresentationRuntime('review-session', () => 42);
    const first = vi.fn();
    const unsubscribe = runtime.subscribe(first);

    expect(runtime.publish({
      action: 'cast',
      status: 'failed',
      cardId: 'failed',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: false,
      sourceEventId: 'engine:0',
    })).toBeNull();
    expect(first).not.toHaveBeenCalled();

    const spell = runtime.publish({
      action: 'cast',
      status: 'committed',
      cardId: 'spell',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: false,
      sourceEventId: 'engine:1',
    });
    expect(spell).toMatchObject({
      id: 'review-session:1',
      committedAtMs: 42,
      kind: 'spell-cast',
    });
    expect(first).toHaveBeenCalledTimes(1);

    unsubscribe();
    const late = vi.fn();
    runtime.subscribe(late);
    runtime.publish({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 1,
      nextTurn: 2,
    });
    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0]?.[0]).toMatchObject({
      id: 'review-session:2',
      kind: 'turn-advanced',
    });
  });

  it('uses one fixed, non-commander voice per ordinary semantic event', () => {
    const spell = sfxPatch('spell-cast');
    const land = sfxPatch('land-played');
    const turn = sfxPatch('turn-advanced');
    expect(spell).toEqual(sfxPatch('spell-cast'));
    expect(land).toEqual(sfxPatch('land-played'));
    expect(turn).toEqual(sfxPatch('turn-advanced'));
    expect(spell.layers.length).toBeGreaterThanOrEqual(2);
    expect(land.layers.length).toBeGreaterThanOrEqual(2);
    expect(turn.layers.length).toBeGreaterThanOrEqual(2);
    expect(SFX_LEVELS_DB['spell-cast']).toBe(-13);
    expect(SFX_LEVELS_DB['land-played']).toBe(-11);
    expect(SFX_LEVELS_DB['turn-advanced']).toBe(-15);
    expect(SFX_LEVELS_DB['commander-cast']).toBe(-8);
  });

  it('never schedules an ordinary event sound beyond the 80ms contract', () => {
    for (const positionSec of [0, 0.01, 0.12, 1.234, 251.77, 251.798]) {
      const delay = presentationSoundDelayMs(positionSec);
      expect(delay).toBe(
        getNextGridDelayMs(positionSec, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
      );
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(80);
    }
  });

  it('wires only newly appended commit evidence and removes log/chain inference', () => {
    const controller = read('src/components/game/gameController.tsx');
    const screen = read('src/components/game/GameScreen.tsx');
    const sound = read('src/components/game/presentation/semanticSound.ts');
    const layer = read('src/components/game/presentation/SemanticPresentationLayer.tsx');
    const renderer = read('src/components/game/presentation/sfxRenderer.ts');
    const session = read('src/components/game/presentation/audioVisualSession.ts');
    const runtime = read('src/components/game/presentation/presentationRuntime.ts');

    expect(controller).toContain('presentationRuntime.publish');
    expect(controller).toContain('eventLog.slice(beforeEventCount)');
    expect(controller).not.toContain("celebrate('primary')");
    expect(controller).not.toContain("celebrate('resolve')");
    expect(controller).not.toContain("celebrate('commander')");
    expect(screen).toContain('SemanticPresentationLayer');
    expect(screen).not.toContain('CelebrationLayer');
    expect(layer).toContain('getSessionTransportPositionSec');
    expect(layer).toContain('getBoundingClientRect');
    expect(layer).not.toContain('setTimeout(() => playVoice');
    expect(layer).toContain('sfxRenderer');
    expect(layer).not.toContain('createOscillator');
    expect(renderer).toContain('OfflineAudioContext');
    expect(renderer).not.toContain('Math.random');
    expect(session).toContain('getSessionTransportPositionSec');
    expect(sound).not.toContain('Math.random');
    expect(sound).not.toMatch(/\bchain\b|\bdraw\b|\bresolve\b|\btap\b|\bmana\b/i);
    expect(runtime).not.toContain('Date.now');
  });
});
