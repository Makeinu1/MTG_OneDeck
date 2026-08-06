/**
 * review.av7b-audio-gap-closure-runtime — judge-owned acceptance for the
 * feel-4 audio-gap closure (contract revision 2026-08-07 §2/§2.1/§3.1).
 *
 * Boundaries pinned here:
 *  R1 turn wrap via 「次のフェイズ」(cleanup cross) emits turn-advanced once.
 *  R2 the wrap's auto draw-step draw emits exactly one draw-completed.
 *  R3 phase-only transitions emit one phase-advanced, no turn/draw events.
 *  R4 explicit 「次のターン」 covers turn-advanced + auto draw exactly once each.
 *  R5 mulligan confirmation emits only shuffle-completed.
 *  R6 keep confirmation emits only hand-kept.
 *  R7 undo/redo never replay gap-closure events.
 *  R8 manifest completeness + asset constraints for the two new samples.
 *  R9 first-turn start (beginFirstTurn) stays silent (game-start DEFER).
 *
 * Implementers must NOT edit this file. If it fails, fix the implementation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { makeDeck } from '../../../engine/__tests__/helpers';
import { useGameStore } from '../../../store/gameStore';
import { useGameController, type GameController } from '../gameController';
import { presentationRuntime } from '../presentation/presentationRuntime';
import type { SequencedPresentationEvent } from '../presentation/presentationSequencer';
import { ALL_SFX_KINDS, sfxLayersFor, type SfxKind } from '../presentation/sfxManifest';

const store = () => useGameStore.getState();

const controllerRef = createRef<GameController>();
let root: Root;
let container: HTMLElement;

const Harness = forwardRef<GameController>(function Harness(_props, ref) {
  const game = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  useImperativeHandle(ref, () => game, [game]);
  return <>{game.overlays}</>;
});

function controller(): GameController {
  if (!controllerRef.current) throw new Error('controller unavailable');
  return controllerRef.current;
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    mulliganDecisionPending: false,
  });
}

function captureEvents(): {
  events: SequencedPresentationEvent[];
  unsubscribe: () => void;
} {
  const events: SequencedPresentationEvent[] = [];
  return {
    events,
    unsubscribe: presentationRuntime.subscribe((event) => events.push(event)),
  };
}

const count = (events: SequencedPresentationEvent[], kind: string): number =>
  events.filter((event) => event.kind === kind).length;

beforeEach(() => {
  resetStore();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  resetStore();
});

function startFreshGame(): GameController {
  store().newGame(makeDeck(40), 9011);
  store().keepOpeningHand();
  act(() => root.render(<Harness ref={controllerRef} />));
  return controller();
}

function advanceToEndPhase(game: GameController): void {
  for (let step = 0; step < 12; step += 1) {
    const current = store().state;
    if (!current) throw new Error('state missing');
    if (current.phase === 'end') return;
    act(() => game.advancePhase());
  }
  const current = store().state;
  if (!current || current.phase !== 'end') {
    throw new Error(`failed to reach end phase (phase=${store().state?.phase})`);
  }
}

describe('AV7b audio-gap closure boundaries', () => {
  it('R1+R2: cleanup-crossing wrap fires exactly one turn-advanced and one auto draw', () => {
    const game = startFreshGame();
    advanceToEndPhase(game);
    // The turn-1 draw step put the hand at 8; trim to 7 so the wrap's cleanup
    // completes without a discard prompt (setup commits, not captured).
    let hand = store().state?.zones.hand ?? [];
    while (hand.length > 7) {
      const dropId = hand[hand.length - 1];
      if (!dropId) break;
      store().moveCard(dropId, 'graveyard');
      hand = store().state?.zones.hand ?? [];
    }
    const turnBefore = store().state?.turn ?? 0;

    const { events, unsubscribe } = captureEvents();
    act(() => game.advancePhase());
    const after = store().state;
    if (!after) throw new Error('state missing');

    expect(after.turn).toBe(turnBefore + 1);
    expect(count(events, 'turn-advanced')).toBe(1);
    expect(count(events, 'draw-completed')).toBe(1);
    const draw = events.find((event) => event.kind === 'draw-completed');
    expect(draw).toMatchObject({ kind: 'draw-completed', count: 1 });
    // The wrap auto-advances through untap/upkeep/draw; those belong to the
    // turn increment and must not add phase ticks.
    expect(count(events, 'phase-advanced')).toBe(0);
    unsubscribe();
  });

  it('R3: a phase-only advance fires one phase-advanced and nothing else', () => {
    const game = startFreshGame();
    const phaseBefore = store().state?.phase;
    const turnBefore = store().state?.turn;
    if (phaseBefore !== 'main1') throw new Error(`expected main1, got ${phaseBefore}`);

    const { events, unsubscribe } = captureEvents();
    act(() => game.advancePhase());
    const after = store().state;
    if (!after) throw new Error('state missing');

    expect(after.turn).toBe(turnBefore);
    expect(after.phase).not.toBe(phaseBefore);
    expect(count(events, 'phase-advanced')).toBe(1);
    expect(count(events, 'turn-advanced')).toBe(0);
    expect(count(events, 'draw-completed')).toBe(0);
    unsubscribe();
  });

  it('R4: explicit turn advance fires turn-advanced once and auto draw once', () => {
    const game = startFreshGame();
    const turnBefore = store().state?.turn ?? 0;

    const { events, unsubscribe } = captureEvents();
    act(() => game.advanceTurn());
    const after = store().state;
    if (!after) throw new Error('state missing');

    expect(after.turn).toBeGreaterThan(turnBefore);
    expect(count(events, 'turn-advanced')).toBe(1);
    expect(count(events, 'draw-completed')).toBe(1);
    unsubscribe();
  });

  it('R5: mulligan confirmation emits only shuffle-completed', () => {
    store().newGame(makeDeck(40), 9013);
    act(() => root.render(<Harness ref={controllerRef} />));
    const game = controller();
    if (!store().mulliganDecisionPending) throw new Error('mulligan stage not pending');

    const { events, unsubscribe } = captureEvents();
    act(() => game.requestMulligan());
    unsubscribe();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'shuffle-completed' });
  });

  it('R6: keep confirmation emits only hand-kept (also for the bottom flow)', () => {
    store().newGame(makeDeck(40), 9015);
    act(() => root.render(<Harness ref={controllerRef} />));
    const game = controller();
    if (!store().mulliganDecisionPending) throw new Error('mulligan stage not pending');

    const { events, unsubscribe } = captureEvents();
    act(() => game.requestKeepHand());
    unsubscribe();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'hand-kept' });
  });

  it('R7: undo/redo never replay turn/phase/draw gap-closure events', () => {
    const game = startFreshGame();
    act(() => game.advancePhase()); // one phase tick committed
    const { events, unsubscribe } = captureEvents();
    act(() => game.undo());
    act(() => game.redo());
    expect(events).toEqual([]);
    unsubscribe();
  });

  it('R9: beginning the first turn stays silent (game-start DEFER)', () => {
    store().newGame(makeDeck(40), 9017);
    act(() => root.render(<Harness ref={controllerRef} />));
    const game = controller();

    const { events, unsubscribe } = captureEvents();
    act(() => game.requestKeepHand());
    events.length = 0;
    act(() => store().beginFirstTurn());
    unsubscribe();

    expect(events).toEqual([]);
  });
});

describe('AV7b manifest completeness for gap-closure cues', () => {
  it('R8: every SfxKind resolves layers; new samples exist with contract constraints', () => {
    const kinds: readonly SfxKind[] = ALL_SFX_KINDS;
    expect(kinds).toContain('phase-advanced');
    expect(kinds).toContain('hand-kept');

    for (const kind of kinds) {
      const layers = kind === 'tap-changed'
        ? sfxLayersFor(kind, { tapped: true })
        : sfxLayersFor(kind);
      expect(layers.length).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(layer.src).toContain('audio/sfx/');
        expect(layer.src.endsWith('.wav')).toBe(true);
      }
    }

    const phaseLayers = sfxLayersFor('phase-advanced');
    expect(phaseLayers.map((layer) => layer.src)).toEqual(
      expect.arrayContaining([expect.stringContaining('phase-tick.wav')]),
    );
    expect(phaseLayers[0].gainDb).toBe(-8.2);

    const keepLayers = sfxLayersFor('hand-kept');
    expect(keepLayers.map((layer) => layer.src)).toEqual(
      expect.arrayContaining([expect.stringContaining('keep-confirm.wav')]),
    );
    expect(keepLayers[0].gainDb).toBe(-6);

    // Contract: phase-tick must be clearly quieter than the turn cue.
    const turnPeak = Math.max(...sfxLayersFor('turn-advanced').map((layer) => layer.gainDb));
    expect(phaseLayers[0].gainDb).toBeLessThan(turnPeak);
  });

  it('R8b: new asset files are present, PCM16 stereo 48kHz, <= 1 second, with fades', () => {
    const base = resolve(__dirname, '../../../../public/audio/sfx');
    for (const file of ['phase-tick.wav', 'keep-confirm.wav']) {
      const path = resolve(base, file);
      expect(existsSync(path)).toBe(true);
      const buffer = readFileSync(path);
      expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buffer.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(buffer.readUInt16LE(20)).toBe(1); // PCM
      expect(buffer.readUInt16LE(22)).toBe(2); // stereo
      expect(buffer.readUInt32LE(24)).toBe(48000);
      const dataSize = buffer.readUInt32LE(40);
      const durationSec = dataSize / (48000 * 2 * 2);
      expect(durationSec).toBeLessThanOrEqual(1.0);
      expect(durationSec).toBeGreaterThan(0.01);
      // Contract: 2ms fade at both edges — the extreme edge frames must be
      // near-silent (no click), whatever the fade curve shape is.
      const frames = Math.floor(dataSize / 4);
      const edgeFrames = 8;
      let headMax = 0;
      let tailMax = 0;
      for (let frame = 0; frame < edgeFrames; frame += 1) {
        headMax = Math.max(headMax, Math.abs(buffer.readInt16LE(44 + frame * 4)));
        tailMax = Math.max(
          tailMax,
          Math.abs(buffer.readInt16LE(44 + (frames - 1 - frame) * 4)),
        );
      }
      expect(headMax).toBeLessThan(2000);
      expect(tailMax).toBeLessThan(2000);
      // true peak must not exceed -3dBFS (~0.7079 * 32767).
      let peak = 0;
      for (let offset = 44; offset < 44 + dataSize; offset += 2) {
        peak = Math.max(peak, Math.abs(buffer.readInt16LE(offset)));
      }
      expect(peak).toBeLessThanOrEqual(Math.round(0.7079 * 32767));
    }
  });

  it('R8c: LICENSE records the two new project-original samples', () => {
    const license = readFileSync(resolve(__dirname, '../../../../public/audio/sfx/LICENSE.txt'), 'utf8');
    expect(license).toContain('phase-tick.wav');
    expect(license).toContain('keep-confirm.wav');
  });
});
