/**
 * primaryAction — 「次にすること」駆動のプライマリアクション状態機械(純関数)。
 * docs/design-playbook.md §3 D3(1)・docs/design-system.md §8 PrimaryAction。
 *
 * 優先順(上から):
 *   ① スタック非空 → 「スタックを解決 (残n)」(スタック未解決中のフェイズ移動禁止=
 *      CLAUDE.md 唯一の強制ルールを「ボタンが解決になる」ことで構造表現。無効化グレーにしない)
 *   ② 未処理の誘発候補 n>0 → 「誘発を処理 (n)」
 *   ③ 戦闘の攻撃宣言ステップ → 「攻撃を確定」
 *   ④ それ以外 → 「次のフェイズ →」(隣接ボタンで「次のターン ≫」)
 *
 * 純粋性: 同一 (state, triggerCandidateCount) → 同一出力。state を変異しない。
 */

import type { GameState } from '../../engine/types';

export type PrimaryActionKind = 'manual-resolution' | 'resolve' | 'triggers' | 'attack' | 'next-phase';

export interface PrimaryActionModel {
  kind: PrimaryActionKind;
  label: string;
  testId: string;
  /** スタックの緊張表現(青白 glow)を出すか。 */
  glow: boolean;
}

export function primaryActionModel(
  state: GameState,
  triggerCandidateCount: number,
  manualResolutionRequired = false,
): PrimaryActionModel {
  if (manualResolutionRequired) {
    return { kind: 'manual-resolution', label: '手動処理済み', testId: 'primary-action', glow: true };
  }
  const stackN = state.zones.stack.length;
  if (stackN > 0) {
    return { kind: 'resolve', label: `スタックを解決 (${stackN})`, testId: 'primary-action', glow: true };
  }
  if (triggerCandidateCount > 0) {
    return { kind: 'triggers', label: `誘発を処理 (${triggerCandidateCount})`, testId: 'primary-action', glow: false };
  }
  // 戦闘フェイズで、まだ攻撃を宣言していない状態。engine では combat フェイズ突入時点では
  // state.combat は null(declareAttack が enterCombat→declareBlockers を1バッチで発行する)ため、
  // 「攻撃宣言前」= phase==='combat' かつ combat 未生成(or 生成直後の beginningOfCombat)で判定する。
  // 宣言後は combat.step が declareBlockers 以降へ進み、この分岐から外れて「次のフェイズ」になる。
  if (state.phase === 'combat' && (!state.combat || state.combat.step === 'beginningOfCombat')) {
    return { kind: 'attack', label: '攻撃を確定', testId: 'primary-action', glow: false };
  }
  return { kind: 'next-phase', label: '次のフェイズ →', testId: 'primary-action', glow: false };
}
