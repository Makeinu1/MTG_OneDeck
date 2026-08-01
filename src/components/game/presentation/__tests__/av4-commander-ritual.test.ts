/**
 * av4-commander-ritual — ordinary tests for AV4 patch, envelope,
 * duck policy, subscription filtering, cleanup, and repeated ritual behavior.
 */

import { describe, expect, it } from 'vitest';
import {
  COMMANDER_RITUAL_DURATION_MS,
  commanderDuckEnvelope,
  shouldDuckMusic,
} from '../commanderRitual';
import { sfxLayersFor } from '../sfxManifest';
import { presentationSoundDelayMs } from '../semanticSound';

describe('AV4 commander patch and ritual constants', () => {
  it('freezes ritual duration at 650ms', () => {
    expect(COMMANDER_RITUAL_DURATION_MS).toBe(650);
  });

  it('returns a deterministic commander sample motif', () => {
    const first = sfxLayersFor('commander-cast');
    const second = sfxLayersFor('commander-cast');
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first.every((layer) => layer.chokeGroup === 'commander')).toBe(true);
  });

  it('computes the duck envelope from COMMANDER_MIX_TUNING', () => {
    const env = commanderDuckEnvelope(5, 0.8);
    expect(env.attackEndSec).toBeCloseTo(5.04, 6);
    expect(env.holdEndSec).toBeCloseTo(5.4, 6);
    expect(env.releaseEndSec).toBeCloseTo(5.72, 6);
    expect(env.duckGain).toBeCloseTo(0.8 * Math.pow(10, -4 / 20), 8);
  });

  it('produces a duck gain lower than the base gain', () => {
    const env = commanderDuckEnvelope(0, 1);
    expect(env.duckGain).toBeLessThan(1);
    expect(env.duckGain).toBeGreaterThan(0);
  });
});

describe('AV4 duck policy (shouldDuckMusic)', () => {
  it('ducks only when both eventsAudible and musicAudible are true', () => {
    expect(shouldDuckMusic(true, true)).toBe(true);
  });

  it('does not duck when event sounds are disabled', () => {
    expect(shouldDuckMusic(false, true)).toBe(false);
  });

  it('does not duck when music is disabled', () => {
    expect(shouldDuckMusic(true, false)).toBe(false);
  });

  it('does not duck when both are disabled', () => {
    expect(shouldDuckMusic(false, false)).toBe(false);
  });
});

describe('AV4 beat-snap delay', () => {
  it('returns a non-negative delay within the snap window or ceiling', () => {
    const delay = presentationSoundDelayMs(0);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(80);
  });

  it('is deterministic for the same position', () => {
    expect(presentationSoundDelayMs(10.5)).toBe(presentationSoundDelayMs(10.5));
  });
});

describe('AV4 CommanderRitualLayer source contract', () => {
  it('subscribes only to commander-cast events', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain("event.kind !== 'commander-cast'");
    expect(source).not.toContain('spell-cast');
    expect(source).not.toContain('land-played');
    expect(source).not.toContain('turn-advanced');
  });

  it('uses session lane accessors for audio routing', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('getSessionCommanderLane');
    expect(source).toContain('getSessionMusicLane');
  });

  it('contains no randomness or Date.now', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('Date.now');
  });

  it('cleans up motif nodes and duck on unmount/replacement', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('stopMotif');
    expect(source).toContain('cancelDuck');
    expect(source).toContain('cleanup');
  });

  it('disconnects source nodes on onended for bounded cleanup', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('source.onended');
    expect(source).toContain('source.disconnect()');
  });

  it('keys CommanderCutIn by sequenced event id for CSS restart', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('key={ritual.id}');
    expect(source).toContain('id: event.id');
  });

  it('uses shared beat-snap delay for motif and duck', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('presentationSoundDelayMs');
    expect(source).toContain('getSessionTransportPositionSec');
    expect(source).toContain('audioStartAtSec');
    expect(source).toContain('playMotif(audioStartAtSec)');
    expect(source).toContain('scheduleDuck(audioStartAtSec)');
  });

  it('replaces identical ritual by clearing timer before restart', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('clearTimeout');
    expect(source).toContain('COMMANDER_RITUAL_DURATION_MS');
  });

  it('uses sfxRenderer for playback instead of inline oscillators', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/game/presentation/CommanderRitualLayer.tsx', 'utf8'),
    );
    expect(source).toContain('sfxRenderer');
    expect(source).not.toContain('createOscillator');
  });
});
