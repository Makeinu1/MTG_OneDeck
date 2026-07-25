/**
 * review.s5-compact-labels — S5 PrimaryAction短縮の契約(判定者専有)。
 * compact ラベルは短い動詞/局面名のみ。full は aria-label 用に完全な意味を保持。
 */
import { describe, it, expect } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { primaryActionLanguage } from '../primaryActionDisplay';

const state = buildVisualFixture('stack').snapshot.state;

describe('S5 compact labels are minimal', () => {
  it('resolve: compact = "解決" (no count suffix)', () => {
    const lang = primaryActionLanguage(
      { ...state, zones: { ...state.zones, stack: state.zones.stack.slice(0, 2) } },
      { kind: 'resolve', label: 'スタックを解決 (2)', testId: 'primary-action', glow: true },
    );
    expect(lang.compact).toBe('解決');
    expect(lang.full).toBe('スタックを解決 (2)');
  });

  it('triggers: compact = "誘発" (no count suffix)', () => {
    const lang = primaryActionLanguage(
      { ...state, zones: { ...state.zones, stack: [] } },
      { kind: 'triggers', label: '誘発を処理 (3)', testId: 'primary-action', glow: false },
    );
    expect(lang.compact).toBe('誘発');
    expect(lang.full).toBe('誘発を処理 (3)');
  });

  it('attack: compact = "攻撃" (no count suffix)', () => {
    const lang = primaryActionLanguage(
      { ...state, phase: 'combat', zones: { ...state.zones, stack: [] } },
      { kind: 'attack', label: '3体で攻撃', testId: 'primary-action', glow: false, eligibleAttackers: 3 },
    );
    expect(lang.compact).toBe('攻撃');
    expect(lang.full).toBe('3体で攻撃');
  });

  it('skip-combat: compact = "スキップ"', () => {
    const lang = primaryActionLanguage(
      { ...state, phase: 'combat', zones: { ...state.zones, stack: [] } },
      { kind: 'skip-combat', label: '攻撃せず進む', testId: 'primary-action', glow: false, eligibleAttackers: 0 },
    );
    expect(lang.compact).toBe('スキップ');
    expect(lang.full).toBe('攻撃せず進む');
  });

  it('next-phase: compact = phase name only (no "次へ：" prefix)', () => {
    const lang = primaryActionLanguage(
      { ...state, phase: 'main1', zones: { ...state.zones, stack: [] } },
      { kind: 'next-phase', label: '次のフェイズ →', testId: 'primary-action', glow: false },
    );
    expect(lang.compact).toBe('戦闘');
    expect(lang.full).toBe('次へ：戦闘');
  });

  it('manual-resolution: compact = "完了"', () => {
    const lang = primaryActionLanguage(
      { ...state, zones: { ...state.zones, stack: [] } },
      { kind: 'manual-resolution', label: '手動処理済み', testId: 'primary-action', glow: true },
    );
    expect(lang.compact).toBe('完了');
  });
});
