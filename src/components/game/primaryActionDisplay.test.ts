import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { primaryActionDisplayLabel } from './primaryActionDisplay';

describe('primaryActionDisplayLabel', () => {
  const state = buildVisualFixture('stack').snapshot.state;

  it('names the result of advancing instead of saying next phase', () => {
    expect(primaryActionDisplayLabel(
      { ...state, phase: 'main1' },
      { kind: 'next-phase', label: '次のフェイズ →', testId: 'primary-action', glow: false },
    )).toBe('次へ：戦闘');
  });

  it('describes the action that opens the attack chooser', () => {
    expect(primaryActionDisplayLabel(
      { ...state, phase: 'combat' },
      { kind: 'attack', label: '攻撃を確定', testId: 'primary-action', glow: false },
    )).toBe('攻撃クリーチャーを選ぶ');
  });
});
