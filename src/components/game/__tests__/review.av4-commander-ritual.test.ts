/**
 * review.av4-commander-ritual — AV4 のcast時儀式と非ブロッキング境界。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDef, makeDeck } from '../../../engine/__tests__/helpers';
import type { GameState } from '../../../engine/types';
import { useGameStore } from '../../../store/gameStore';
import {
  COMMANDER_RITUAL_DURATION_MS,
  commanderDuckEnvelope,
  shouldDuckMusic,
} from '../presentation/commanderRitual';
import { sfxPatch, SFX_LEVELS_DB } from '../presentation/sfxPatches';

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function state(): GameState {
  const value = useGameStore.getState().state;
  if (!value) throw new Error('missing game state');
  return value;
}

describe('AV4 commander ritual contract', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      pendingCommanderResolution: null,
      pendingForceActivation: null,
      canUndo: false,
      canRedo: false,
    });
  });

  it('freezes the 650ms ritual, fixed motif and -4dB duck envelope', () => {
    expect(COMMANDER_RITUAL_DURATION_MS).toBe(650);
    const patch = sfxPatch('commander-cast');
    expect(patch).toEqual(sfxPatch('commander-cast'));
    expect(patch.durationMs).toBeLessThanOrEqual(COMMANDER_RITUAL_DURATION_MS);
    expect(patch.layers.length).toBeGreaterThanOrEqual(12);
    expect(SFX_LEVELS_DB['commander-cast']).toBe(-3);

    const envelope = commanderDuckEnvelope(10, 1);
    expect(envelope.attackEndSec).toBeCloseTo(10.04, 6);
    expect(envelope.holdEndSec).toBeCloseTo(10.4, 6);
    expect(envelope.releaseEndSec).toBeCloseTo(10.72, 6);
    expect(envelope.duckGain).toBeCloseTo(10 ** (-4 / 20), 8);
    expect(shouldDuckMusic(true, true)).toBe(true);
    expect(shouldDuckMusic(false, true)).toBe(false);
    expect(shouldDuckMusic(true, false)).toBe(false);
  });

  it('resolves commanders immediately without the obsolete presentation gate', () => {
    const def = makeDef({
      scryfallId: 'av4-commander',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'AV4 Commander', typeLine: 'Legendary Creature', manaCost: '{1}' }],
    });
    useGameStore.getState().newGame(makeDeck(4, [def]), 1);
    const id = state().commanders[0].cardId;
    expect(useGameStore.getState().castToStack(id, { force: true })).toBe('ok');
    expect(state().cards[id].zone).toBe('stack');

    useGameStore.getState().resolveTop();
    expect(state().cards[id].zone).toBe('battlefield');
    expect(useGameStore.getState().pendingCommanderResolution).toBeNull();
  });

  it('mounts a cast-event ritual without generic feedback or UI locking', () => {
    const screen = read('src/components/game/GameScreen.tsx');
    const controller = read('src/components/game/gameController.tsx');
    const ritual = read('src/components/game/presentation/CommanderRitualLayer.tsx');
    const sound = read('src/components/game/presentation/commanderRitual.ts');
    const css = read('src/components/game/game.css');
    const commanderCss = css.slice(
      css.indexOf('/* AV4 統率者キャスト儀式'),
      css.indexOf('.cast-face-choice'),
    );

    expect(screen).toContain('CommanderRitualLayer');
    expect(screen).not.toContain('controller.commanderCutIn');
    expect(screen).not.toContain('data-resolution-locked');
    expect(controller).not.toContain('pendingCommanderResolution');
    expect(controller).not.toContain('commitCommanderResolution');
    expect(controller).not.toContain('780');
    expect(ritual).toContain("event.kind !== 'commander-cast'");
    expect(ritual).toContain('getSessionCommanderLane');
    expect(ritual).toContain('getSessionMusicLane');
    expect(ritual).toContain('presentationSoundDelayMs');
    expect(ritual).toContain('shouldDuckMusic(');
    expect(ritual).toContain('audioStartAtSec');
    expect(ritual).toContain('sfxRenderer');
    expect(ritual).not.toContain('createOscillator');
    expect(ritual).toContain('key={ritual.id}');
    expect(ritual).not.toContain('Date.now');
    expect(ritual).not.toContain('Math.random');
    expect(sound).not.toContain('Math.random');
    expect(commanderCss).toContain('var(--dur-ritual)');
    expect(commanderCss).not.toContain('1050ms');
    expect(commanderCss).not.toContain('data-landed');
  });
});
