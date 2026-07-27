/**
 * AudioVisualProvider — AV2 streaming runtime provider.
 * docs/audio-visual-contract.md §6, §7.
 *
 * Mounts once around the game screen subtree. Unlocks audio on the first
 * game-screen pointerdown or non-modifier keydown (capture phase) without
 * cancelling the underlying action. Exposes transport phase to the game
 * root via CSS custom properties (--transport-beat-ms, --transport-phase-delay).
 *
 * Theme/route/settings only alter effective output, not saved preferences.
 * Pauses outside dark game scope; resumes remembered position on return.
 * Failure is contained as audio status — never throws to the game.
 *
 * Session persistence: the AudioContext, bus lanes, and MusicRuntime are
 * module-level singletons that survive GameScreen unmount/remount within
 * the same browser page session. Gesture unlock is likewise sticky for
 * the page session (sessionGestureUnlocked). Only page teardown
 * (beforeunload) disposes the runtime.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  loadAudioPreferences,
  getAudioVisualRuntimePolicy,
  type AudioPreferences,
  type AudioVisualRuntimePolicy,
} from './audioVisualPreferences';
import { AudioVisualContext, type AudioVisualContextValue } from './audioVisualContext';
import { AMBIENT_CHANGE_EVENT, isAmbientEnabled } from '../ambientMotion';
import {
  createBusLanes,
  createMusicRuntime,
  type MusicBusLanes,
  type MusicRuntime,
  type AudioStatus,
} from './musicBus';
import { getTransportCssTiming } from './audioVisualTransport';
import { setSessionRuntime, clearSessionRuntime, setSessionTransportPositionGetter } from './audioVisualSession';
import { setSessionSfxVolume } from './audioVisualSession';
import { DARK_GAME_TRACK } from './trackManifest';
import { renderAllPatches } from './sfxRenderer';
import { DEFAULT_AUDIO_VISUAL_TUNING } from './presentationTuning';

const SILENT_POLICY: AudioVisualRuntimePolicy = {
  transportRunning: false,
  musicAudible: false,
  eventsAudible: false,
};

/* ------------------------------------------------------------------ */
/*  Module-level session singletons (survive unmount/remount)          */
/* ------------------------------------------------------------------ */

let sessionGestureUnlocked = false;
let sessionContext: AudioContext | null = null;
let sessionLanes: MusicBusLanes | null = null;
let sessionRuntime: MusicRuntime | null = null;
let sessionFailed = false;

function tryCreateAudioContext(): AudioContext | null {
  try {
    const windowWithWebkit = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = windowWithWebkit.AudioContext ?? windowWithWebkit.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function ensureSessionRuntime(): void {
  if (sessionContext || sessionFailed) return;
  const ctx = tryCreateAudioContext();
  if (!ctx) {
    sessionFailed = true;
    return;
  }
  sessionContext = ctx;
  sessionLanes = createBusLanes(ctx);
  setSessionRuntime(ctx, sessionLanes);
  const runtime = createMusicRuntime(DARK_GAME_TRACK, sessionLanes, ctx);
  if (!runtime) {
    sessionFailed = true;
  } else {
    sessionRuntime = runtime;
    setSessionTransportPositionGetter(() => runtime.currentPositionSec());
    // Pre-render SFX patches (fire-and-forget; errors are swallowed per-patch).
    renderAllPatches().catch(() => {});
  }
}

function disposeSessionRuntime(): void {
  sessionRuntime?.dispose();
  sessionRuntime = null;
  sessionLanes = null;
  clearSessionRuntime();
  const ctx = sessionContext;
  sessionContext = null;
  if (ctx && ctx.state !== 'closed') {
    ctx.close().catch(() => {});
  }
}

function resolvedTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AudioVisualProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<AudioPreferences>(loadAudioPreferences);
  const [unlocked, setUnlocked] = useState(sessionGestureUnlocked);
  const [failed, setFailed] = useState(sessionFailed);
  const [themeNonce, setThemeNonce] = useState(0);
  const [ambientNonce, setAmbientNonce] = useState(0);
  const [playStatus, setPlayStatus] = useState<'idle' | 'playing' | 'paused' | 'error'>('idle');

  const cssTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setPreferences(next: AudioPreferences): void {
    setPreferencesState(next);
  }

  // Gesture unlock + lazy session runtime creation.
  useEffect(() => {
    function unlock(): void {
      if (sessionGestureUnlocked) {
        if (!unlocked) setUnlocked(true);
        return;
      }
      sessionGestureUnlocked = true;
      ensureSessionRuntime();
      if (sessionFailed) setFailed(true);
      setUnlocked(true);
    }

    function onPointerDown(): void {
      unlock();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      unlock();
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [unlocked]);

  // Page teardown: dispose session runtime.
  useEffect(() => {
    function onBeforeUnload(): void {
      disposeSessionRuntime();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  // Track theme/ambient changes so effective output (not saved prefs) updates.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeNonce((value) => value + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const onAmbient = (): void => setAmbientNonce((value) => value + 1);
    document.addEventListener(AMBIENT_CHANGE_EVENT, onAmbient);
    return () => {
      observer.disconnect();
      document.removeEventListener(AMBIENT_CHANGE_EVENT, onAmbient);
    };
  }, []);

  // Derived runtime policy (pure; recomputed when inputs change).
  const policy = useMemo<AudioVisualRuntimePolicy>(() => {
    void themeNonce;
    void ambientNonce;
    if (failed) return SILENT_POLICY;
    return getAudioVisualRuntimePolicy(preferences, {
      theme: resolvedTheme(),
      isGameScreen: true,
      userGestureUnlocked: unlocked,
      ambientMotionEnabled: isAmbientEnabled(),
    });
  }, [preferences, unlocked, failed, themeNonce, ambientNonce]);

  // Drive the runtime + CSS transport variables based on the derived policy.
  useEffect(() => {
    const runtime = sessionRuntime;
    const ctx = sessionContext;
    const root = document.querySelector<HTMLElement>('[data-testid="game-screen"]');
    let cancelled = false;

    if (cssTimerRef.current !== null) {
      clearInterval(cssTimerRef.current);
      cssTimerRef.current = null;
    }

    if (policy.transportRunning && runtime && ctx) {
      const activeRuntime = runtime;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      activeRuntime.setMusicAudible(policy.musicAudible);
      activeRuntime.setMusicVolume(preferences.bgmVolume ?? 70);
      void activeRuntime.resume().then((ok) => {
        if (!cancelled) setPlayStatus(ok ? 'playing' : 'error');
      });

      let previousBeatMs: number | null = null;
      function updateCssTiming(force = false): void {
        if (!root) return;
        const currentSec = activeRuntime.currentPositionSec();
        const timing = getTransportCssTiming(currentSec, DARK_GAME_TRACK);
        if (
          force
          || previousBeatMs === null
          || Math.abs(timing.beatMs - previousBeatMs) > 0.001
        ) {
          root.style.setProperty('--transport-beat-ms', `${timing.beatMs.toFixed(3)}ms`);
          root.style.setProperty(
            '--transport-phase-delay',
            `${timing.phaseDelayMs.toFixed(3)}ms`,
          );
          root.style.setProperty('--transport-bar-ms', `${timing.barMs.toFixed(3)}ms`);
          root.style.setProperty(
            '--transport-bar-phase-delay',
            `${timing.barPhaseDelayMs.toFixed(3)}ms`,
          );
          previousBeatMs = timing.beatMs;
        }
      }
      updateCssTiming(true);
      cssTimerRef.current = setInterval(updateCssTiming, 250);
    } else {
      runtime?.pause();
      if (root) {
        root.style.removeProperty('--transport-beat-ms');
        root.style.removeProperty('--transport-phase-delay');
        root.style.removeProperty('--transport-bar-ms');
        root.style.removeProperty('--transport-bar-phase-delay');
      }
    }

    return () => {
      cancelled = true;
      if (cssTimerRef.current !== null) {
        clearInterval(cssTimerRef.current);
        cssTimerRef.current = null;
      }
    };
  }, [policy]);

  // Apply SFX volume whenever preferences change.
  useEffect(() => {
    setSessionSfxVolume(preferences.sfxVolume ?? 80);
  }, [preferences.sfxVolume]);

  // AV5: wire permanent-beat TUNABLEs to CSS custom properties on the game
  // root (contract §10 "一か所集約"). Independent of transport state — the
  // permanent beat runs on the fallback clock when transport is not ready.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="game-screen"]');
    if (!root) return;
    root.style.setProperty('--beat-wave-step', `${DEFAULT_AUDIO_VISUAL_TUNING.beatWaveStepMs}ms`);
    root.style.setProperty('--land-amp', `${DEFAULT_AUDIO_VISUAL_TUNING.landAmpScale}`);
    root.style.setProperty('--commander-amp', `${DEFAULT_AUDIO_VISUAL_TUNING.commanderAmpScale}`);
  }, []);

  // On unmount: pause and remember position (do NOT dispose).
  useEffect(() => {
    return () => {
      sessionRuntime?.pause();
    };
  }, []);

  const audioStatus: AudioStatus = failed
    ? 'error'
    : playStatus === 'error'
      ? 'error'
      : policy.transportRunning
        ? playStatus === 'playing'
          ? 'playing'
          : 'loading'
        : unlocked
          ? 'paused'
          : 'idle';

  const value = useMemo<AudioVisualContextValue>(
    () => ({ audioStatus, preferences, policy, setPreferences }),
    [audioStatus, preferences, policy],
  );

  return (
    <AudioVisualContext.Provider value={value}>
      {children}
    </AudioVisualContext.Provider>
  );
}
