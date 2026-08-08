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
 * Pauses the optional BGM runtime outside its active game/theme scope while
 * retaining remembered position; event SFX follow eventsAudible independently.
 * Failure is contained as audio status — never throws to the game.
 *
 * Session persistence: the AudioContext, bus lanes, and MusicRuntime are
 * module-level singletons that survive GameScreen unmount/remount within
 * the same browser page session. Gesture unlock is likewise sticky for
 * the page session (sessionGestureUnlocked). Only page teardown
 * (beforeunload) disposes the runtime.
 */

import {
  useCallback,
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
import { getThemeTrack, type TrackManifest } from './trackManifest';
import { loadAllSfx } from './sfxRenderer';
import { DEFAULT_AUDIO_VISUAL_TUNING } from './presentationTuning';

const SILENT_POLICY: AudioVisualRuntimePolicy = {
  transportRunning: false,
  musicAudible: false,
  eventsAudible: false,
  track: null,
};

/* ------------------------------------------------------------------ */
/*  Module-level session singletons (survive unmount/remount)          */
/* ------------------------------------------------------------------ */

let sessionGestureUnlocked = false;
let sessionContext: AudioContext | null = null;
let sessionLanes: MusicBusLanes | null = null;
let sessionRuntime: MusicRuntime | null = null;
let sessionTrackId: string | null = null;
let sessionFailed = false;
let sessionSfxLoadFailed = false;
let pendingOpeningDealCue = false;

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

function disposeSessionMusicRuntime(): void {
  sessionRuntime?.dispose();
  sessionRuntime = null;
  sessionTrackId = null;
  setSessionTransportPositionGetter(null);
}

function ensureSessionRuntime(track: TrackManifest | null): void {
  if (sessionFailed) return;
  if (!sessionContext) {
    const ctx = tryCreateAudioContext();
    if (!ctx) {
      sessionFailed = true;
      return;
    }
    sessionContext = ctx;
    sessionLanes = createBusLanes(ctx);
    setSessionRuntime(ctx, sessionLanes);
  }

  if (track === null) {
    disposeSessionMusicRuntime();
    return;
  }
  if (sessionRuntime && sessionTrackId === track.id) return;

  disposeSessionMusicRuntime();
  const runtime = createMusicRuntime(track, sessionLanes!, sessionContext);
  if (!runtime) {
    return;
  }
  sessionRuntime = runtime;
  sessionTrackId = track.id;
  setSessionTransportPositionGetter(() => runtime.currentPositionSec());
}

function disposeSessionRuntime(): void {
  disposeSessionMusicRuntime();
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

/**
 * Starts the page-session audio runtime from the same user gesture as the
 * game's start action. The caller must not await this helper: game state
 * initialization remains synchronous and independent from audio I/O.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function startAudioForGameGesture(): void {
  pendingOpeningDealCue = true;
  sessionGestureUnlocked = true;
  try {
    ensureSessionRuntime(getThemeTrack(resolvedTheme()));

    const context = sessionContext;
    if (!context) return;

    const preferences = loadAudioPreferences();
    const policy = getAudioVisualRuntimePolicy(preferences, {
      theme: resolvedTheme(),
      isGameScreen: true,
      userGestureUnlocked: true,
      ambientMotionEnabled: isAmbientEnabled(),
    });
    setSessionSfxVolume(preferences.sfxVolume ?? 80);
    sessionRuntime?.setMusicAudible(policy.musicAudible);
    sessionRuntime?.setMusicVolume(preferences.bgmVolume ?? 70);

    if (context.state === 'suspended') void context.resume().catch(() => {});
    if (policy.transportRunning) {
      void sessionRuntime?.resume();
    } else {
      sessionRuntime?.pause();
    }

    void loadAllSfx(context)
      .then((ready) => {
        sessionSfxLoadFailed = !ready;
      })
      .catch(() => {
        sessionSfxLoadFailed = true;
      });
  } catch {
    // Audio startup is best-effort and never blocks game initialization.
  }
}

/** Consume the one opening-deal cue armed by the game-start gesture. */
// eslint-disable-next-line react-refresh/only-export-components
export function consumePendingOpeningDealCue(): boolean {
  if (!pendingOpeningDealCue) return false;
  pendingOpeningDealCue = false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AudioVisualProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<AudioPreferences>(loadAudioPreferences);
  const [unlocked, setUnlocked] = useState(sessionGestureUnlocked);
  const [failed, setFailed] = useState(sessionFailed);
  const [sfxLoadFailed, setSfxLoadFailed] = useState(sessionSfxLoadFailed);
  const [themeNonce, setThemeNonce] = useState(0);
  const [ambientNonce, setAmbientNonce] = useState(0);
  const [playStatus, setPlayStatus] = useState<'idle' | 'playing' | 'paused' | 'error'>('idle');

  const cssTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const retrySfxLoad = useCallback((): void => {
    const ctx = sessionContext;
    if (!ctx) return;
    void loadAllSfx(ctx)
      .then((ready) => {
        sessionSfxLoadFailed = !ready;
        setSfxLoadFailed(!ready);
      })
      .catch(() => {
        sessionSfxLoadFailed = true;
        setSfxLoadFailed(true);
      });
  }, []);

  const setPreferences = useCallback((next: AudioPreferences): void => {
    setPreferencesState(next);
    retrySfxLoad();
  }, [retrySfxLoad]);

  // Gesture unlock + lazy session runtime creation.
  useEffect(() => {
    // The game-start handler may unlock and begin preload before this provider
    // mounts. Reuse that session and bind the async preload result to React
    // state instead of waiting for another gesture.
    if (sessionGestureUnlocked) {
      ensureSessionRuntime(getThemeTrack(resolvedTheme()));
      retrySfxLoad();
    }

    function unlock(): void {
      if (sessionGestureUnlocked) {
        if (!unlocked) setUnlocked(true);
        retrySfxLoad();
        return;
      }
      sessionGestureUnlocked = true;
      ensureSessionRuntime(getThemeTrack(resolvedTheme()));
      if (sessionFailed) setFailed(true);
      setUnlocked(true);
      retrySfxLoad();
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
  }, [unlocked, retrySfxLoad]);

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

  // Leaving the game scope must be silent while retaining the page-session
  // position for a later game-screen remount.
  useEffect(() => () => {
    sessionRuntime?.pause();
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
    ensureSessionRuntime(policy.track);
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
        const timing = getTransportCssTiming(currentSec, policy.track!);
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
          root.style.setProperty('--light-peak-pre', String(DEFAULT_AUDIO_VISUAL_TUNING.lightPeakPre));
          root.style.setProperty('--light-peak-post', String(DEFAULT_AUDIO_VISUAL_TUNING.lightPeakPost));
          root.style.setProperty('--light-base', String(DEFAULT_AUDIO_VISUAL_TUNING.lightBase));
          root.style.setProperty('--commander-idle-peak', String(DEFAULT_AUDIO_VISUAL_TUNING.commanderIdlePeak));
          root.style.setProperty('--stamp-sink', String(DEFAULT_AUDIO_VISUAL_TUNING.stampSinkPx));
          root.style.setProperty('--light-pool-size', `${DEFAULT_AUDIO_VISUAL_TUNING.lightPoolSizePct}%`);
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
        root.style.removeProperty('--light-peak-pre');
        root.style.removeProperty('--light-peak-post');
        root.style.removeProperty('--light-base');
        root.style.removeProperty('--commander-idle-peak');
        root.style.removeProperty('--stamp-sink');
        root.style.removeProperty('--light-pool-size');
      }
    }

    return () => {
      cancelled = true;
      if (cssTimerRef.current !== null) {
        clearInterval(cssTimerRef.current);
        cssTimerRef.current = null;
      }
    };
  }, [policy, preferences.bgmVolume]);

  // Apply SFX volume whenever preferences change.
  useEffect(() => {
    if (!unlocked) return;
    setSessionSfxVolume(preferences.sfxVolume ?? 80);
  }, [preferences.sfxVolume, unlocked]);

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

  const audioStatus: AudioStatus = failed || sfxLoadFailed
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
    [audioStatus, preferences, policy, setPreferences],
  );

  return (
    <AudioVisualContext.Provider value={value}>
      {children}
    </AudioVisualContext.Provider>
  );
}
