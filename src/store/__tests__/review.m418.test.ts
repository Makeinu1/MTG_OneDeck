/**
 * Reviewer-owned adversarial tests for M4.18: announce/dice/coin (UI-only, no
 * GameState mutation) and the "N mana of any one color" production amount.
 * Implementation agents must NOT modify this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../gameStore';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import type { CardDef, ManaColor } from '../../types/card';

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false, warnings: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function onBattlefield(def: CardDef): string {
  useGameStore.getState().newGame([{ def, isCommander: false }, ...makeDeck(6)], 1);
  const id = Object.values(useGameStore.getState().state!.cards).find(
    (c) => c.defId === def.scryfallId
  )!.id;
  useGameStore.getState().moveCard(id, 'battlefield', 'bottom');
  return id;
}

describe('announce / rollDie / flipCoin are UI-only (no GameState/history mutation)', () => {
  it('announce appends a toast and clearWarnings empties it', () => {
    useGameStore.getState().newGame(makeDeck(10), 1);
    const stateRef = useGameStore.getState().state;
    const undoBefore = useGameStore.getState().canUndo;

    useGameStore.getState().announce('hello');
    expect(useGameStore.getState().warnings).toContain('hello');
    // GameState identity + history untouched
    expect(useGameStore.getState().state).toBe(stateRef);
    expect(useGameStore.getState().canUndo).toBe(undoBefore);

    useGameStore.getState().clearWarnings();
    expect(useGameStore.getState().warnings).toEqual([]);
  });

  it('rollDie stays within 1..sides at both extremes and announces', () => {
    useGameStore.getState().newGame(makeDeck(10), 1);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    useGameStore.getState().rollDie(6);
    expect(useGameStore.getState().warnings.some((w) => w.includes('1'))).toBe(true);

    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    useGameStore.getState().rollDie(20);
    expect(useGameStore.getState().warnings.some((w) => w.includes('20'))).toBe(true);
  });

  it('flipCoin announces 表 or 裏', () => {
    useGameStore.getState().newGame(makeDeck(10), 1);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    useGameStore.getState().flipCoin();
    const w = useGameStore.getState().warnings.join(' ');
    expect(w.includes('表') || w.includes('裏')).toBe(true);
  });
});

describe('manaProductionAmount: "N mana of any one color" sources (M4.18 機能D)', () => {
  it('Lotus Field (en): choose a color, get 3', () => {
    const lotus = makeDef({
      scryfallId: 'lotus-en',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'] as ManaColor[],
      faces: [
        {
          name: 'lotus-en',
          typeLine: 'Land',
          oracleText: 'Hexproof\n{T}: Add three mana of any one color.',
        },
      ],
    });
    const id = onBattlefield(lotus);
    expect(useGameStore.getState().tapForMana(id)).toBe('needs-choice');
    expect(useGameStore.getState().tapForMana(id, 'R')).toBe('ok');
    expect(useGameStore.getState().state!.manaPool.R).toBe(3);
  });

  it('睡蓮の原野 (ja): choose a color, get 3', () => {
    const lotus = makeDef({
      scryfallId: 'lotus-ja',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'] as ManaColor[],
      faces: [
        {
          name: 'lotus-ja',
          typeLine: 'Land',
          printedText: '呪禁\n{T}：好きな色１色のマナ３点を加える。',
        },
      ],
    });
    const id = onBattlefield(lotus);
    expect(useGameStore.getState().tapForMana(id, 'G')).toBe('ok');
    expect(useGameStore.getState().state!.manaPool.G).toBe(3);
  });

  it('Mana Confluence-style "one mana of any color" yields 1', () => {
    const conf = makeDef({
      scryfallId: 'confluence',
      typeLine: 'Land',
      producedMana: ['W', 'U', 'B', 'R', 'G'] as ManaColor[],
      faces: [
        {
          name: 'confluence',
          typeLine: 'Land',
          printedText: '{T}, ライフを１点支払う：好きな色１色のマナ１点を加える。',
        },
      ],
    });
    const id = onBattlefield(conf);
    expect(useGameStore.getState().tapForMana(id, 'U')).toBe('ok');
    expect(useGameStore.getState().state!.manaPool.U).toBe(1);
  });

  it('regression: explicit {C}{C}{C} symbol source still yields 3', () => {
    const vault = makeDef({
      scryfallId: 'vault',
      typeLine: 'Artifact',
      producedMana: ['C'] as ManaColor[],
      faces: [{ name: 'vault', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}{C}.' }],
    });
    const id = onBattlefield(vault);
    expect(useGameStore.getState().tapForMana(id)).toBe('ok');
    expect(useGameStore.getState().state!.manaPool.C).toBe(3);
  });
});
