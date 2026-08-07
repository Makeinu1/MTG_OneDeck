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
import {
  ALL_SFX_KINDS,
  sfxLayersFor,
} from '../presentation/sfxManifest';
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

  it('uses the frozen hybrid sample palette with tap/untap variants', () => {
    expect(ALL_SFX_KINDS).toEqual([
      'draw-completed',
      'land-played',
      'spell-cast',
      'tap-changed',
      'stack-resolved',
      'shuffle-completed',
      'turn-advanced',
      'commander-cast',
      // feel-4-audio-gap-closure (contract revision 2026-08-07): gap-closure cues.
      'phase-advanced',
      'hand-kept',
    ]);
    const [spellPlace, spellSnap] = sfxLayersFor('spell-cast');
    expect(spellPlace?.src).toMatch(/spell-place\.wav$/);
    expect(spellPlace).toMatchObject({ gainDb: -2.85, offsetMs: 0, chokeGroup: 'spell' });
    expect(spellSnap?.src).toMatch(/spell-arcane-snap\.wav$/);
    expect(spellSnap).toMatchObject({ gainDb: -10.46, offsetMs: 0, chokeGroup: 'spell' });
    const [tap] = sfxLayersFor('tap-changed', { tapped: true });
    expect(tap?.src).toMatch(/tap-shove\.wav$/);
    expect(tap).toMatchObject({ gainDb: -2.5, chokeGroup: 'tap-change' });
    const [untap] = sfxLayersFor('tap-changed', { tapped: false });
    expect(untap?.src).toMatch(/untap-slide\.wav$/);
    expect(untap).toMatchObject({ gainDb: -2.85, chokeGroup: 'tap-change' });
    expect(sfxLayersFor('commander-cast')).toHaveLength(3);
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
    expect(renderer).toContain('decodeAudioData');
    expect(renderer).toContain('fetch(');
    expect(renderer).not.toContain('OfflineAudioContext');
    expect(renderer).not.toContain('Math.random');
    expect(session).toContain('getSessionTransportPositionSec');
    expect(sound).not.toContain('Math.random');
    expect(sound).not.toMatch(/\bchain\b|Math\.random/i);
    expect(runtime).not.toContain('Date.now');
  });
});
