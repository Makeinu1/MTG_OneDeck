/**
 * actionCatalog — カード操作の純粋モデル(docs/ui-architecture-v2.md §2/§4)。
 *
 * 「どのアクションが・どの順で存在するか」だけを純関数として定義。
 * onSelect ハンドラ(store 依存)は持たず、id + 表示メタ + 昇格優先度(priority)のみを返す。
 * コンポーネント側(CardActionSheet 等)が id→handler を束ねる。
 *
 * 純粋性: 同一 context → 同一出力。context も出力も変異しない。
 */

import { activatedAbilityLines } from '../../engine/grammar';
import { naiveTapManaColors } from '../../engine/grammar/manaShortcut';
import type { CardInstance, ZoneId } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { fetchAbility, cyclingCost } from '../../engine/status';
import { classifyCardRules } from '../../data/ruleClassifier';
import { ruleActionCandidatesFromTags } from './ruleActionCandidates';
import { activatedAbilityDisplayText } from './abilityDisplay';

/** 唱えるコストの手動精算アドバイザリを出すルールタグ。 */
const CAST_COST_ADVISORY_TAG_IDS = [
  'cost.additional',
  'cost.alternative',
  'concept.alt-cast',
  'concept.cast-from-zone',
] as const;

/**
 * 昇格優先度(大きいほどシート上位)。docs/design-playbook.md §3 D1 の規則表:
 *   優先1 統率者の唱える / 優先2 未タップ土地のマナ生成 / 優先3 手札土地のプレイ /
 *   優先4 手札呪文(マナ可)の唱える / 優先5 フェッチ起動 / 優先6 タップ済み土地のアンタップ。
 * マナ不足の「唱える」は priority 無し(warn 付きで「その他」に常存=強行可)。
 */
export const ACTION_PRIORITY = {
  commanderCast: 100,
  tapForMana: 90,
  playLand: 80,
  handCast: 70,
  fetchActivate: 60,
  untapLand: 55,
} as const;

export interface ActionSpec {
  /** 安定 id(旧 MenuItem.key と一致)。 */
  id: string;
  label: string;
  testId?: string;
  danger?: boolean;
  /** ContextMenu 上での視覚区切り(旧 MenuItem.separator を保存)。 */
  separator?: boolean;
  disabled?: boolean;
  /** 昇格優先度。undefined=「その他」内のみ(昇格しない)。 */
  priority?: number;
  /** マナ不足の唱える等、警告色で常存し昇格しない項目。 */
  warn?: boolean;
}

export interface ActionCatalogContext {
  card: CardInstance;
  def: CardDef | undefined;
  /** 表示中フェイスの type line(英語 oracle 正本)。 */
  typeLine: string;
  /** カード名(《》抜きの生表示名)。シート見出し用。 */
  displayName: string;
  /** 統率領域の統率者か(isCommander(state, cardId) の結果)。 */
  isCommanderCard: boolean;
  /** このカードを唱えるコストをマナ支払可能か(昇格判定用。統率者は無関係)。 */
  canAffordCast: boolean;
  /** 手札の土地をこのターンまだプレイできるか(土地権が残っているか)。 */
  landDropAvailable: boolean;
  /** 統率者税(統率領域からの唱えるラベルに表示)。 */
  commanderTax: number;
}

export interface CardActionCatalog {
  title: string;
  specs: ActionSpec[];
}

function castCostAdvisorySpec(def: CardDef | undefined): ActionSpec | null {
  if (!def) return null;
  const tagsById = new Map(classifyCardRules(def).map((tag) => [tag.id, tag.label]));
  const labels = CAST_COST_ADVISORY_TAG_IDS.flatMap((tagId) => {
    const label = tagsById.get(tagId);
    return label ? [label] : [];
  });
  if (labels.length === 0) return null;
  return {
    id: 'cast-cost-advisory',
    label: `⚠ ${labels.join('/')}(コストは手動精算)`,
    testId: 'cast-cost-advisory',
    disabled: true,
  };
}

/** 効果プレビューを ~60 字で切って弁別ラベル用に短縮する。 */
function truncateAbilityPreview(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function activationSpecsForZone(
  def: CardDef | undefined,
  faceIndex: number,
  zone: ZoneId,
): ActionSpec[] {
  if (!def) return [];

  const available = activatedAbilityLines(def, faceIndex).filter((line) =>
    line.activationZones
      ? line.activationZones.some((activationZone) => activationZone === zone)
      : zone === 'battlefield');
  if (available.length === 0) return [];

  const requiresExplicitLine = zone !== 'battlefield' || available.some((line) => line.keywordId);
  if (available.length === 1 && !requiresExplicitLine) {
    return [{
      id: 'ability-activate',
      label: '能力を起動(スタックへ)',
      testId: 'ability-activate',
      separator: true,
    }];
  }

  return available.map((line, index) => ({
    id: `ability-activate-${line.index}`,
    label: line.keywordLabel
      ? `${line.keywordLabel} (${line.keywordCost ?? line.costText})`
      : truncateAbilityPreview(activatedAbilityDisplayText(def, line)),
    testId: `ability-activate-${line.index}`,
    separator: index === 0,
  }));
}

function ruleCandidateSpecs(def: CardDef | undefined): ActionSpec[] {
  if (!def) return [];
  return ruleActionCandidatesFromTags(classifyCardRules(def)).map((candidate, index) => ({
    id: `rule-candidate-${candidate.kind}`,
    label: candidate.label,
    testId: candidate.testId,
    separator: index === 0,
  }));
}

/**
 * カードの全アクション仕様を、旧 buildMenuItems と同じ順序・同じ id で返す純関数。
 */
export function buildCardActionCatalog(ctx: ActionCatalogContext): CardActionCatalog {
  const { card, def, typeLine, displayName, isCommanderCard, commanderTax } = ctx;
  const specs: ActionSpec[] = [];

  const isTreasure = def?.tokenKind === 'treasure';
  const fetch = typeLine.includes('Land') ? fetchAbility(def) : null;
  const isSacrificeToken =
    def?.tokenKind === 'treasure' ||
    def?.tokenKind === 'clue' ||
    def?.tokenKind === 'food' ||
    def?.tokenKind === 'blood';

  // --- スタック ---
  if (card.zone === 'stack') {
    specs.push(
      { id: 'stack-resolve-top', label: '上から解決' },
      { id: 'stack-resolve-all', label: '全解決' },
    );

    if (!card.isAbility) {
      const isPermanentSpell = !/Instant|Sorcery/i.test(typeLine);
      specs.push({
        id: 'stack-copy-effect',
        label: '効果をコピー(スタックへ)',
        testId: 'copy-effect',
        separator: true,
      });
      if (isPermanentSpell) {
        specs.push({
          id: 'stack-copy-permanent',
          label: 'パーマネントとしてコピー(トークン)',
          testId: 'copy-permanent',
        });
      }
      const stackMoveTargets: Array<{ zone: ZoneId; label: string }> = [
        { zone: 'battlefield', label: '戦場に出す（手動）' },
        { zone: 'graveyard', label: '墓地に置く（手動）' },
        { zone: 'exile', label: '追放する' },
        { zone: 'hand', label: '手札に戻す' },
      ];
      stackMoveTargets.forEach((target, index) => {
        specs.push({
          id: `stack-move-${target.zone}`,
          label: target.label,
          separator: index === 0,
        });
      });
      specs.push({ id: 'stack-counter', label: '打ち消す', danger: true });
    } else {
      specs.push(
        { id: 'stack-copy-ability', label: 'コピー(スタックへ)', testId: 'copy-ability', separator: true },
        { id: 'stack-remove-ability', label: '取り除く', danger: true },
      );
    }

    specs.push(...ruleCandidateSpecs(def));
    return { title: displayName, specs };
  }

  // --- 戦場 ---
  if (card.zone === 'battlefield') {
    const naiveManaColors = naiveTapManaColors(def);
    const isLand = typeLine.includes('Land');
    specs.push({
      id: 'tap',
      label: card.tapped ? 'アンタップ' : 'タップ',
      // タップ済み土地のアンタップだけ昇格(優先6)。
      priority: card.tapped && isLand ? ACTION_PRIORITY.untapLand : undefined,
    });

    if (isTreasure) {
      specs.push({ id: 'crack-treasure', label: '割ってマナを出す', separator: true });
    } else if (naiveManaColors.length > 0 && !card.tapped) {
      specs.push({
        id: 'tapForMana',
        label: 'マナを生成してタップ',
        separator: true,
        // 未タップの土地(マナ生成)は一等地(優先2)。
        priority: isLand ? ACTION_PRIORITY.tapForMana : undefined,
      });
    }

    if (def?.tokenKind === 'clue') {
      specs.push({ id: 'crack-clue', label: '割って1ドロー(生け贄)', testId: 'crack-clue', separator: !isTreasure });
    } else if (def?.tokenKind === 'food') {
      specs.push({ id: 'crack-food', label: '割って3点ゲイン(生け贄)', testId: 'crack-food', separator: !isTreasure });
    } else if (def?.tokenKind === 'blood') {
      specs.push({ id: 'crack-blood', label: '割って1枚捨ててドロー(生け贄)', testId: 'crack-blood', separator: !isTreasure });
    }

    if (isSacrificeToken) {
      specs.push({ id: 'sacrifice-token', label: '生け贄に捧げる', danger: true, separator: !isTreasure });
    }

    if (fetch) {
      specs.push({
        id: 'fetch-activate',
        label: 'フェッチ起動(スタックへ)',
        testId: 'fetch-activate',
        separator: true,
        priority: ACTION_PRIORITY.fetchActivate,
      });
    }

    if (typeLine.includes('Creature')) {
      specs.push({ id: 'manual-keywords', label: '手動キーワード…', testId: 'manual-keywords-open', separator: true });
    }

    specs.push({ id: 'copy-permanent', label: 'コピー(トークン)', testId: 'copy-permanent', separator: !fetch });

    const activationSpecs = activationSpecsForZone(def, card.faceIndex, card.zone);
    if (activationSpecs.length > 0) {
      specs.push(...activationSpecs);
    } else {
      // 能力行を認識できないカードにも手動起動の逃げ道を残す(ACT-2 非回帰)。
      specs.push({
        id: 'ability-activate',
        label: '能力を起動(スタックへ)',
        testId: 'ability-activate',
        separator: true,
      });
    }
    specs.push({ id: 'ability-trigger', label: '誘発を積む(スタックへ)', testId: 'ability-trigger' });
  }

  // --- 手札 ---
  if (card.zone === 'hand') {
    if (typeLine.includes('Land')) {
      specs.push({
        id: 'play-land',
        label: '土地としてプレイ',
        separator: true,
        priority: ctx.landDropAvailable ? ACTION_PRIORITY.playLand : undefined,
      });
    } else {
      specs.push({
        id: 'cast-to-stack',
        label: '唱える(スタック)',
        testId: 'cast-to-stack',
        separator: true,
        priority: ctx.canAffordCast ? ACTION_PRIORITY.handCast : undefined,
        warn: !ctx.canAffordCast,
      });
      const advisory = castCostAdvisorySpec(def);
      if (advisory) specs.push(advisory);
    }

    const cycleCost = cyclingCost(def);
    if (cycleCost) {
      specs.push({ id: 'cycle', label: `サイクリング(${cycleCost})` });
    }
    specs.push(...activationSpecsForZone(def, card.faceIndex, card.zone));
    specs.push({ id: 'discard', label: '捨てる' });
  }

  // --- 統率領域(統率者) ---
  if (card.zone === 'command' && isCommanderCard) {
    const taxLabel = commanderTax > 0 ? `唱える(統率者税 +${commanderTax})` : '唱える(スタック)';
    specs.push({
      id: 'cast-to-stack',
      label: taxLabel,
      testId: 'cast-to-stack',
      separator: true,
      priority: ACTION_PRIORITY.commanderCast,
    });
    const advisory = castCostAdvisorySpec(def);
    if (advisory) specs.push(advisory);
  }

  if (card.zone === 'command') {
    specs.push(...activationSpecsForZone(def, card.faceIndex, card.zone));
  }

  // --- 墓地/追放からの唱える ---
  if ((card.zone === 'graveyard' || card.zone === 'exile') && !typeLine.includes('Land')) {
    specs.push({ id: 'cast-from-zone', label: '唱える(スタック)', testId: 'cast-from-zone', separator: true });
    const advisory = castCostAdvisorySpec(def);
    if (advisory) specs.push(advisory);
  }

  if (card.zone === 'graveyard') {
    specs.push(...activationSpecsForZone(def, card.faceIndex, card.zone));
  }

  if (card.zone === 'graveyard' && typeLine.includes('Land')) {
    specs.push({
      id: 'play-land-from-graveyard',
      label: '土地としてプレイ(墓地から)',
      testId: 'play-land-from-graveyard',
      separator: true,
    });
  }

  if (card.zone === 'battlefield' || card.zone === 'hand' || card.zone === 'command') {
    specs.push(...ruleCandidateSpecs(def));
  }

  if (card.zone === 'battlefield' && typeLine.includes('Planeswalker')) {
    specs.push(
      { id: 'loyalty-plus', label: '忠誠値+1', separator: true },
      { id: 'loyalty-minus', label: '忠誠値-1', disabled: (card.counters.loyalty ?? 0) <= 0 },
    );
  }

  // --- 全ゾーン共通の末尾 ---
  specs.push({
    id: 'card-effects-auto',
    label: card.effectsAuto === false ? 'このカードの効果を自動化する' : 'このカードの効果を自動化しない',
    testId: 'card-effects-auto-off',
    separator: true,
  });

  if (!card.faceDown && def && def.faces.length > 1) {
    specs.push({ id: 'flip', label: '裏返す', separator: true });
  }

  specs.push({ id: 'facedown', label: card.faceDown ? '表向きにする' : '裏向きにする' });

  specs.push(
    { id: 'counter-plus', label: '+1/+1カウンターを置く', separator: true },
    { id: 'counter-minus', label: '+1/+1カウンターを取り除く', disabled: (card.counters['+1/+1'] ?? 0) <= 0 },
  );

  const specialCounters = Object.entries(card.counters)
    .filter(([kind]) => kind !== '+1/+1' && kind !== '-1/-1' && kind !== 'loyalty' && kind !== 'lore')
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [counterType, count] of specialCounters) {
    specs.push(
      { id: `counter-other-plus:${counterType}`, label: `${counterType}カウンターを置く(${count})` },
      { id: `counter-other-minus:${counterType}`, label: `${counterType}カウンターを取り除く`, disabled: count <= 0 },
    );
  }
  const isBasicLand = /\bBasic\b/i.test(typeLine) && /\bLand\b/i.test(typeLine);
  if (!isBasicLand) {
    specs.push({ id: 'counter-custom', label: 'その他のカウンターを指定して置く…' });
  }

  const allMoveTargets: { zone: ZoneId; label: string }[] = [
    { zone: 'battlefield', label: '戦場に出す（手動）' },
    { zone: 'hand', label: card.zone === 'library' ? '手札に加える' : '手札に戻す' },
    { zone: 'graveyard', label: '墓地に置く（手動）' },
    { zone: 'exile', label: '追放する' },
    { zone: 'library', label: 'ライブラリーの上に置く' },
    { zone: 'command', label: '統率領域に戻す' },
  ];
  allMoveTargets
    .filter((t) => t.zone !== card.zone)
    .forEach((t, i) => {
      specs.push({ id: `move-${t.zone}`, label: t.label, testId: `move-${t.zone}`, separator: i === 0 });
    });

  return { title: displayName, specs };
}

/**
 * シート上位に昇格するアクション(priority 付き)を優先度降順で最大 limit 件返す純関数。
 * priority が無い(=「その他」内のみ)アクションは含めない。同優先度は入力順を保つ。
 */
export function rankActions(specs: ActionSpec[], limit = 3): ActionSpec[] {
  return specs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => spec.priority !== undefined)
    .sort((a, b) => {
      const pd = (b.spec.priority ?? 0) - (a.spec.priority ?? 0);
      return pd !== 0 ? pd : a.index - b.index;
    })
    .slice(0, limit)
    .map(({ spec }) => spec);
}
