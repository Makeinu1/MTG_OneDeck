import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSessionRuntime,
  getSessionTransportPositionSec,
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
