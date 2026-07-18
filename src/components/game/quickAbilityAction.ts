import { activatedAbilityLines, type ActivatedAbilityLine } from '../../engine/grammar';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';

export type QuickAbilityAction =
  | { kind: 'manual-tap'; lines: [] }
  | { kind: 'activate'; lines: [ActivatedAbilityLine] }
  | { kind: 'choose'; lines: ActivatedAbilityLine[] };

/**
 * 戦場カードの通常クリックを「状態だけのタップ」と「{T}能力の起動」に振り分ける。
 * タップ済みカードは{T}コストを払えないため、従来どおりアンタップ操作へ戻す。
 * 起動型能力一般ではなく、oracle 正本からモデル化できた{T}コストだけを smart tap の
 * 対象にすることで、攻撃用タップなどの手動サンドボックス操作を奪わない。
 */
export function quickAbilityAction(
  card: CardInstance,
  def: CardDef | undefined,
): QuickAbilityAction {
  if (card.zone !== 'battlefield' || card.tapped || card.faceDown || !def) {
    return { kind: 'manual-tap', lines: [] };
  }

  const lines = activatedAbilityLines(def, card.faceIndex).filter((line) => /\{T\}/i.test(line.costText));
  if (lines.length === 0) return { kind: 'manual-tap', lines: [] };
  if (lines.length === 1) return { kind: 'activate', lines: [lines[0]] };
  return { kind: 'choose', lines };
}

/** カード上picker向け。長いoracle文を盤面からはみ出させない。 */
export function quickAbilityLabel(
  line: ActivatedAbilityLine,
  timing: 'immediate' | 'stack' | null = null,
  maxLength = 52,
): string {
  const timingLabel = timing === 'immediate' ? ' [即時]' : timing === 'stack' ? ' [スタック]' : '';
  const label = `${line.costText}: ${line.effectText}${timingLabel}`;
  return label.length <= maxLength ? label : `${label.slice(0, maxLength).trimEnd()}…`;
}
