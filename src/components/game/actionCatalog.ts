/**
 * actionCatalog — カード操作の純粋モデル(docs/ui-architecture-v2.md §2/§4)。
 *
 * 旧 `Playmat.buildMenuItems`(374行のクロージャ)から「どのアクションが・どの順で
 * 存在するか」だけを純関数として抽出したもの。onSelect ハンドラ(store 依存)は持たず、
 * id(旧 MenuItem.key と一致)+ 表示メタ + 昇格優先度(priority)のみを返す。
 * コンポーネント側(Playmat / CardActionSheet)が id→handler を束ねる。
 *
 * これにより:
 *  - CardActionSheet が上位1〜3件を昇格し残りを「その他」へ畳める(D1)。
 *  - 旧 ContextMenu も同じカタログを消費するため、アクション集合が乖離しない。
 *
 * 純粋性: 同一 context → 同一出力。context も出力も変異しない。
 */

import type { CardInstance, ZoneId } from '../../engine/types';
import type { CardDef } from '../../types/card';
import { fetchAbility, cyclingCost } from '../../engine/status';
import { classifyCardRules } from '../../data/ruleClassifier';
import { ruleActionCandidatesFromTags } from '../playmat/ruleActionCandidates';

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
        { zone: 'battlefield', label: '戦場へ移す' },
        { zone: 'graveyard', label: '墓地へ移す' },
        { zone: 'exile', label: '追放へ移す' },
        { zone: 'hand', label: '手札へ戻す' },
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
    const produced = def?.producedMana ?? [];
    const isLand = typeLine.includes('Land');
    specs.push({
      id: 'tap',
      label: card.tapped ? 'アンタップ' : 'タップ',
      // タップ済み土地のアンタップだけ昇格(優先6)。
      priority: card.tapped && isLand ? ACTION_PRIORITY.untapLand : undefined,
    });

    if (isTreasure) {
      specs.push({ id: 'crack-treasure', label: '割ってマナを出す', separator: true });
    } else if (produced.length > 0 && !card.tapped) {
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
    specs.push(
      { id: 'ability-activate', label: '能力を起動(スタックへ)', testId: 'ability-activate', separator: true },
      { id: 'ability-trigger', label: '誘発を積む(スタックへ)', testId: 'ability-trigger' },
    );
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
    specs.push({ id: 'discard', label: '捨てる(墓地へ)' });
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

  // --- 墓地/追放からの唱える ---
  if ((card.zone === 'graveyard' || card.zone === 'exile') && !typeLine.includes('Land')) {
    specs.push({ id: 'cast-from-zone', label: '唱える(スタック)', testId: 'cast-from-zone', separator: true });
    const advisory = castCostAdvisorySpec(def);
    if (advisory) specs.push(advisory);
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

  const allMoveTargets: { zone: ZoneId; label: string }[] = [
    { zone: 'battlefield', label: '戦場へ' },
    { zone: 'hand', label: '手札へ' },
    { zone: 'graveyard', label: '墓地へ' },
    { zone: 'exile', label: '追放へ' },
    { zone: 'library', label: 'ライブラリへ(一番上)' },
    { zone: 'command', label: '統率領域へ' },
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
