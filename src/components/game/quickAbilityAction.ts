import { activatedAbilityLines, type ActivatedAbilityLine } from '../../engine/grammar';
import { naiveTapManaColors } from '../../engine/grammar/manaShortcut';
import type { CardInstance } from '../../engine/types';
import type { CardDef, ManaColor } from '../../types/card';
import { activatedAbilityDisplayText } from './abilityDisplay';

export type QuickAbilityAction =
  | { kind: 'manual-tap'; lines: [] }
  | { kind: 'tap-for-mana'; lines: []; colors: ManaColor[] }
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

  const activatedLines = activatedAbilityLines(def, card.faceIndex);
  const lines = activatedLines.filter((line) => /\{T\}/i.test(line.costText));
  if (lines.length === 0) {
    // CR 305.6 intrinsic basic-land-type abilities and reminder-only oracle text
    // do not necessarily produce an explicit activated line. Only use the
    // producedMana shortcut when no printed activated ability competes for the
    // click; complex/costed/filter abilities stay in the normal ability UI.
    const colors = activatedLines.length === 0 ? naiveTapManaColors(def) : [];
    return colors.length > 0
      ? { kind: 'tap-for-mana', lines: [], colors }
      : { kind: 'manual-tap', lines: [] };
  }
  if (lines.length === 1) return { kind: 'activate', lines: [lines[0]] };
  return { kind: 'choose', lines };
}

/** カード上picker向け。長いoracle文を盤面からはみ出させない。 */
export function quickAbilityLabel(
  line: ActivatedAbilityLine,
  timing: 'immediate' | 'stack' | null = null,
  maxLength = 52,
  def?: CardDef,
): string {
  const timingLabel = timing === 'immediate' ? ' [即時]' : timing === 'stack' ? ' [スタック]' : '';
  const displayText = def ? activatedAbilityDisplayText(def, line) : `${line.costText}: ${line.effectText}`;
  const label = `${displayText}${timingLabel}`;
  return label.length <= maxLength ? label : `${label.slice(0, maxLength).trimEnd()}…`;
}
