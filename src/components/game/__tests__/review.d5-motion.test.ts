/**
 * review.d5-motion — D5 祝祭感の純関数層ピン(レビュー専有)。docs/design-playbook.md §3 D5(b)。
 * これが落ちたら実装(src/components/game/motion.ts)を直す。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  motionLevelFor,
  motionDuration,
  shouldCompress,
  lifeFlashDirection,
  isSoundEnabled,
  setSoundEnabled,
  SOUND_STORAGE_KEY,
} from '../motion';

describe('motionLevelFor (design-system §7)', () => {
  it('中核4種を正しいレベルへ写像する', () => {
    expect(motionLevelFor('draw')).toBe('L2');
    expect(motionLevelFor('resolve')).toBe('L3');
    expect(motionLevelFor('etb')).toBe('L3');
    expect(motionLevelFor('life')).toBe('L1');
    expect(motionLevelFor('damage')).toBe('L2');
  });
});

describe('motionDuration (reduced-motion 分岐)', () => {
  it('通常時はレベル別トークンを返す', () => {
    expect(motionDuration('L1', false)).toBe('var(--dur-fast)');
    expect(motionDuration('L2', false)).toBe('var(--dur-move)');
    expect(motionDuration('L3', false)).toBe('var(--dur-hero)');
  });
  it('reduced-motion 時は全レベル 0ms(フェードのみ)', () => {
    for (const lv of ['L1', 'L2', 'L3', 'L4'] as const) {
      expect(motionDuration(lv, true)).toBe('0ms');
    }
  });
  it('L0 は常に 0ms', () => {
    expect(motionDuration('L0', false)).toBe('0ms');
  });
});

describe('shouldCompress (連続イベント圧縮 §7)', () => {
  it('前イベントが無ければ圧縮しない', () => {
    expect(shouldCompress(null, 1000)).toBe(false);
  });
  it('window 内の連続は圧縮する', () => {
    expect(shouldCompress(1000, 1100, 300)).toBe(true);
  });
  it('window を超えたら圧縮しない', () => {
    expect(shouldCompress(1000, 1400, 300)).toBe(false);
  });
});

describe('lifeFlashDirection', () => {
  it('増減方向を返す', () => {
    expect(lifeFlashDirection(3)).toBe('gain');
    expect(lifeFlashDirection(-2)).toBe('loss');
    expect(lifeFlashDirection(0)).toBe('none');
  });
});

describe('legacy musical-event preference migration (§7b・新規既定 ON・localStorage 永続)', () => {
  beforeEach(() => {
    localStorage.removeItem(SOUND_STORAGE_KEY);
  });
  it('未設定は ON(新規既定)', () => {
    expect(isSoundEnabled()).toBe(true);
  });
  it('setSoundEnabled(true) で ON が永続する', () => {
    setSoundEnabled(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on');
    expect(isSoundEnabled()).toBe(true);
  });
  it('setSoundEnabled(false) で OFF に戻る', () => {
    setSoundEnabled(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });
});
