/**
 * review.d2-layout-model — D2 縦持ちレイアウトの純関数層ピン(レビュー担当専有)。
 * 対象: boardShelf 密度 / landRowModel 束ね / statusBandModel selector。
 * 契約: docs/design-system.md §8・docs/design-playbook.md §3 D2(b)。
 *
 * これが落ちたら実装(src/components/game/*.ts)を直す。テストは変更禁止(review.*)。
 */

import { describe, it, expect } from 'vitest';
import { boardCardWidth, isBoardOverlap, boardDensity } from '../boardShelf';
import { bundleLands, type LandRowCard } from '../landRowModel';
import { statusBandModel, PHASE_META } from '../statusBandModel';
import { initGame } from '../../../engine/init';
import { makeDeck, makeDef } from '../../../engine/__tests__/helpers';

describe('boardShelf density (design-system §8)', () => {
  it('〜5枚は96px', () => {
    for (const n of [0, 1, 3, 5]) expect(boardCardWidth(n)).toBe(96);
  });
  it('6〜9枚は84px', () => {
    for (const n of [6, 7, 9]) expect(boardCardWidth(n)).toBe(84);
  });
  it('10枚以上は72px', () => {
    for (const n of [10, 13, 14, 30]) expect(boardCardWidth(n)).toBe(72);
  });
  it('14枚以上で重ねに切り替わる(それ未満は重ねない)', () => {
    expect(isBoardOverlap(13)).toBe(false);
    expect(isBoardOverlap(14)).toBe(true);
    expect(isBoardOverlap(20)).toBe(true);
  });
  it('密度段階の識別子が境界で正しい', () => {
    expect(boardDensity(5)).toBe('base');
    expect(boardDensity(6)).toBe('mid');
    expect(boardDensity(9)).toBe('mid');
    expect(boardDensity(10)).toBe('high');
    expect(boardDensity(13)).toBe('high');
    expect(boardDensity(14)).toBe('overlap');
  });
});

describe('landRowModel bundling (design-system §8)', () => {
  const forest = (id: string, tapped = false): LandRowCard => ({
    id,
    name: 'Forest',
    isBasic: true,
    tapped,
  });
  const island = (id: string, tapped = false): LandRowCard => ({
    id,
    name: 'Island',
    isBasic: true,
    tapped,
  });

  it('同名の基本地形を1束に畳む', () => {
    const bundles = bundleLands([forest('a'), forest('b'), forest('c')]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].cardIds).toEqual(['a', 'b', 'c']);
    expect(bundles[0].isBundle).toBe(true);
    expect(bundles[0].key).toBe('basic:Forest');
  });

  it('異名の基本地形は別束(Island と Forest)', () => {
    const bundles = bundleLands([forest('a'), island('b'), forest('c')]);
    expect(bundles).toHaveLength(2);
    // 出現順を保つ: Forest束が先、Island束が後。
    expect(bundles[0].name).toBe('Forest');
    expect(bundles[0].cardIds).toEqual(['a', 'c']);
    expect(bundles[1].name).toBe('Island');
    expect(bundles[1].cardIds).toEqual(['b']);
  });

  it('Snow-Covered は名前が異なるため別束になる', () => {
    const snow: LandRowCard = { id: 's', name: 'Snow-Covered Forest', isBasic: true, tapped: false };
    const bundles = bundleLands([forest('a'), snow, forest('b')]);
    expect(bundles).toHaveLength(2);
    expect(bundles.find((b) => b.name === 'Forest')?.cardIds).toEqual(['a', 'b']);
    expect(bundles.find((b) => b.name === 'Snow-Covered Forest')?.cardIds).toEqual(['s']);
  });

  it('特殊地形(非基本)は束ねず個別', () => {
    const command: LandRowCard = { id: 'ct', name: 'Command Tower', isBasic: false, tapped: false };
    const strand: LandRowCard = { id: 'fs', name: 'Flooded Strand', isBasic: false, tapped: false };
    const bundles = bundleLands([command, strand, forest('a'), forest('b')]);
    expect(bundles).toHaveLength(3);
    expect(bundles[0].isBundle).toBe(false);
    expect(bundles[0].key).toBe('ct');
    expect(bundles[1].key).toBe('fs');
    expect(bundles[2].cardIds).toEqual(['a', 'b']);
  });

  it('束内のタップ済み枚数を集計する', () => {
    const bundles = bundleLands([forest('a', true), forest('b'), forest('c', true)]);
    expect(bundles[0].tappedCount).toBe(2);
  });

  it('基本地形1枚は isBundle=false(2枚目で束化)', () => {
    expect(bundleLands([forest('a')])[0].isBundle).toBe(false);
    expect(bundleLands([forest('a'), forest('b')])[0].isBundle).toBe(true);
  });

  it('純粋: 入力配列を変異しない', () => {
    const input = [forest('a'), forest('b')];
    const snapshot = JSON.stringify(input);
    bundleLands(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('statusBandModel selector (design-system §8)', () => {
  function freshState() {
    // 基本地形入りデッキで初期化(ライブラリ枚数=デッキ - 初手7)。
    const deck = makeDeck(40, [makeDef({ scryfallId: 'cmd-a', typeLine: 'Legendary Creature' })]);
    return initGame(deck, 1);
  }

  it('ターン・フェイズ・ライフが GameState と一致する', () => {
    const state = freshState();
    const model = statusBandModel(state);
    expect(model.turn).toBe(state.turn);
    expect(model.phase).toBe(state.phase);
    expect(model.life).toBe(state.life);
    expect(model.phaseLabel).toBe(PHASE_META[state.phase].label);
  });

  it('ゾーン枚数チップが各 zone の実枚数と一致する', () => {
    const state = freshState();
    const model = statusBandModel(state);
    const byZone = Object.fromEntries(model.zones.map((z) => [z.zone, z.count]));
    expect(byZone.hand).toBe(state.zones.hand.length);
    expect(byZone.graveyard).toBe(state.zones.graveyard.length);
    expect(byZone.exile).toBe(state.zones.exile.length);
    expect(byZone.library).toBe(state.zones.library.length);
  });

  it('スタック非空で stackActive=true', () => {
    const state = freshState();
    expect(statusBandModel(state).stackActive).toBe(false);
    const withStack = { ...state, zones: { ...state.zones, stack: ['x'] } };
    expect(statusBandModel(withStack).stackActive).toBe(true);
  });

  it('常設チップは手・墓・追・山の4種のみ(相手ライフ行なし=vision原則7)', () => {
    const model = statusBandModel(freshState());
    expect(model.zones.map((z) => z.zone)).toEqual(['hand', 'graveyard', 'exile', 'library']);
  });
});
