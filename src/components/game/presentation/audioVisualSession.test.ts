import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSessionRuntime,
  getSessionTransportPositionSec,
  setSessionRuntime,
  setSessionSfxVolume,
  setSessionTransportPositionGetter,
} from './audioVisualSession';

describe('audioVisualSession transport position', () => {
  afterEach(() => {
    clearSessionRuntime();
  });

  it('returns 0 when no getter is registered', () => {
    expect(getSessionTransportPositionSec()).toBe(0);
  });

  it('delegates to the registered getter', () => {
    setSessionTransportPositionGetter(() => 42.5);
    expect(getSessionTransportPositionSec()).toBe(42.5);
  });

  it('clears getter on clearSessionRuntime', () => {
    setSessionTransportPositionGetter(() => 99);
    clearSessionRuntime();
    expect(getSessionTransportPositionSec()).toBe(0);
  });

  it('allows replacing the getter', () => {
    setSessionTransportPositionGetter(() => 1);
    setSessionTransportPositionGetter(() => 2);
    expect(getSessionTransportPositionSec()).toBe(2);
  });
});

describe('audioVisualSession SFX volume', () => {
  afterEach(() => {
    clearSessionRuntime();
  });

  it('applies the slider scale to both event lanes', () => {
    const lanes = {
      master: { gain: { value: 1 } },
      music: { gain: { value: 1 } },
      events: { gain: { value: 1 } },
      commander: { gain: { value: 1 } },
    };
    setSessionRuntime(
      {} as AudioContext,
      lanes as unknown as Parameters<typeof setSessionRuntime>[1],
    );

    setSessionSfxVolume(37);

    expect(lanes.events.gain.value).toBe(0.37);
    expect(lanes.commander.gain.value).toBe(0.37);
  });

  it('reapplies the saved slider after gesture unlock creates the bus', () => {
    const provider = readFileSync(
      'src/components/game/presentation/AudioVisualProvider.tsx',
      'utf8',
    );
    expect(provider).toMatch(
      /setSessionSfxVolume\(preferences\.sfxVolume \?\? 80\);[\s\S]{0,120}\[preferences\.sfxVolume,\s*unlocked\]/,
    );
  });
});
