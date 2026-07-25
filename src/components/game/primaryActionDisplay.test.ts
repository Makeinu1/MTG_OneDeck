import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { primaryActionDisplayLabel, primaryActionLanguage } from './primaryActionDisplay';

describe('primaryActionDisplayLabel', () => {
  const state = buildVisualFixture('stack').snapshot.state;

  it('names the result of advancing instead of saying next phase', () => {
    expect(primaryActionDisplayLabel(
      { ...state, phase: 'main1' },
      { kind: 'next-phase', label: '次のフェイズ →', testId: 'primary-action', glow: false },
    )).toBe('次へ：戦闘');
  });

  it('describes the action that opens the attack chooser with the eligible count', () => {
    expect(primaryActionDisplayLabel(
      { ...state, phase: 'combat' },
      { kind: 'attack', label: '3体で攻撃', testId: 'primary-action', glow: false, eligibleAttackers: 3 },
    )).toBe('3体で攻撃');
  });

  it('labels the zero-attacker case as skipping combat', () => {
    expect(primaryActionDisplayLabel(
      { ...state, phase: 'combat' },
      { kind: 'skip-combat', label: '攻撃せず進む', testId: 'primary-action', glow: false, eligibleAttackers: 0 },
    )).toBe('攻撃せず進む');
  });

  it('keeps full accessible meaning and emits compact icon-first labels', () => {
    expect(primaryActionLanguage(
      { ...state, zones: { ...state.zones, stack: state.zones.stack.slice(0, 2) } },
      { kind: 'resolve', label: 'スタックを解決 (2)', testId: 'primary-action', glow: true },
    )).toEqual({ full: 'スタックを解決 (2)', compact: '解決', icon: 'stack' });

    expect(primaryActionLanguage(
      { ...state, zones: { ...state.zones, stack: [] } },
      { kind: 'triggers', label: '誘発を処理 (3)', testId: 'primary-action', glow: false },
    )).toEqual({ full: '誘発を処理 (3)', compact: '誘発', icon: 'bell' });

    expect(primaryActionLanguage(
      { ...state, phase: 'main1', zones: { ...state.zones, stack: [] } },
      { kind: 'next-phase', label: '次のフェイズ →', testId: 'primary-action', glow: false },
    )).toEqual({ full: '次へ：戦闘', compact: '戦闘', icon: 'phase-next' });
  });
});
