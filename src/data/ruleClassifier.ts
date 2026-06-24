import type { CardDef } from '../types/card';
import {
  cardOracleTexts,
  KEYWORD_DEFINITIONS,
  parsePureKeywordLine,
  removeReminderAndQuotes,
  splitParagraphs,
} from '../engine/keywordGrammar';

export type RuleRisk = 'A' | 'B' | 'C' | 'D' | 'E';
export type RuleAutomationLayer =
  | 'primitive'
  | 'semi-automatic'
  | 'trigger-assist'
  | 'warning'
  | 'advisory';
export type RuleTagKind =
  | 'keyword-ability'
  | 'keyword-action'
  | 'trigger'
  | 'effect-kind'
  | 'game-concept'
  | 'oracle-phrase'
  | 'resource-token';

export interface RuleTag {
  id: string;
  label: string;
  kind: RuleTagKind;
  risk: RuleRisk;
  layer: RuleAutomationLayer;
  confidence: 'high' | 'medium' | 'low';
  matchedText: string;
  ruleRef?: string;
}

interface TagTemplate {
  label: string;
  kind: RuleTagKind;
  risk: RuleRisk;
  layer: RuleAutomationLayer;
  ruleRef?: string;
}

const TAG_TEMPLATES: Record<string, TagTemplate> = {
  'trigger.etb': {
    label: '戦場に出たときの誘発',
    kind: 'trigger',
    risk: 'D',
    layer: 'trigger-assist',
    ruleRef: '603.6a',
  },
  'trigger.death': {
    label: '死亡・墓地に置かれたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.leaves': {
    label: '戦場を離れた/墓地に置かれたとき(非クリーチャー)の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
    ruleRef: '603.6c',
  },
  'trigger.cast': {
    label: '唱えたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.cast-watcher': {
    label: '呪文を唱えるたびの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.etb-other': {
    label: '他が戦場に出たときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.death-other': {
    label: '他の死亡時の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.leaves-other': {
    label: '他の非クリーチャーが戦場を離れたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
    ruleRef: '603.6c',
  },
  'trigger.attack': {
    label: '攻撃したときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.attack-watcher': {
    label: 'クリーチャー攻撃時の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.landfall': {
    label: '上陸の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.upkeep': {
    label: 'アップキープ開始時の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.end-step': {
    label: 'エンドステップ開始時の誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.draw': {
    label: 'カードを引いたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.sacrifice': {
    label: '生け贄に捧げたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.combat-damage': {
    label: '戦闘ダメージを与えたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'action.draw': {
    label: 'カードを引く',
    kind: 'keyword-action',
    risk: 'B',
    layer: 'semi-automatic',
    ruleRef: '121',
  },
  'action.create-token': {
    label: 'トークン生成',
    kind: 'resource-token',
    risk: 'C',
    layer: 'semi-automatic',
    ruleRef: '701.7',
  },
  'action.proliferate': {
    label: '増殖',
    kind: 'keyword-action',
    risk: 'A',
    layer: 'primitive',
    ruleRef: '701.27',
  },
  'action.counter': {
    label: '呪文や能力を打ち消す',
    kind: 'keyword-action',
    risk: 'C',
    layer: 'warning',
    ruleRef: '701.5',
  },
  'action.card-counters': {
    label: 'カウンターを置く・増やす',
    kind: 'keyword-action',
    risk: 'D',
    layer: 'warning',
    ruleRef: '122',
  },
  'action.sacrifice': {
    label: '生け贄',
    kind: 'keyword-action',
    risk: 'C',
    layer: 'semi-automatic',
    ruleRef: '701.17',
  },
  'action.exile': {
    label: '追放',
    kind: 'keyword-action',
    risk: 'C',
    layer: 'semi-automatic',
    ruleRef: '701.13',
  },
  'action.search': {
    label: 'ライブラリーから探す',
    kind: 'keyword-action',
    risk: 'C',
    layer: 'semi-automatic',
    ruleRef: '701.19',
  },
  'action.return': {
    label: '墓地/追放から戻す',
    kind: 'keyword-action',
    risk: 'D',
    layer: 'semi-automatic',
  },
  'action.destroy': {
    label: '破壊',
    kind: 'keyword-action',
    risk: 'C',
    layer: 'semi-automatic',
    ruleRef: '701.7',
  },
  'action.mill': {
    label: '切削',
    kind: 'keyword-action',
    risk: 'B',
    layer: 'semi-automatic',
    ruleRef: '701.13',
  },
  'action.scry': {
    label: '占術',
    kind: 'keyword-action',
    risk: 'B',
    layer: 'semi-automatic',
    ruleRef: '701.18',
  },
  'action.discard': {
    label: '捨てる',
    kind: 'keyword-action',
    risk: 'B',
    layer: 'semi-automatic',
    ruleRef: '701.8',
  },
  'action.shuffle': {
    label: 'シャッフル',
    kind: 'keyword-action',
    risk: 'A',
    layer: 'primitive',
    ruleRef: '701.24',
  },
  'action.surveil': {
    label: '諜報',
    kind: 'keyword-action',
    risk: 'B',
    layer: 'semi-automatic',
    ruleRef: '701.42',
  },
  'action.attach': {
    label: '装備/付与',
    kind: 'keyword-action',
    risk: 'D',
    layer: 'semi-automatic',
    ruleRef: '702.6',
  },
  'concept.target': {
    label: '対象',
    kind: 'game-concept',
    risk: 'A',
    layer: 'primitive',
    ruleRef: '115',
  },
  'concept.alt-cast': {
    label: '代替キャスト',
    kind: 'keyword-ability',
    risk: 'D',
    layer: 'warning',
    ruleRef: '702',
  },
  'concept.cast-from-zone': {
    label: '墓地/追放から唱える',
    kind: 'oracle-phrase',
    risk: 'D',
    layer: 'warning',
    ruleRef: '601.3',
  },
  'cost.additional': {
    label: '追加コスト',
    kind: 'oracle-phrase',
    risk: 'D',
    layer: 'warning',
    ruleRef: '601.2b',
  },
  'cost.alternative': {
    label: '代替コスト',
    kind: 'oracle-phrase',
    risk: 'D',
    layer: 'warning',
    ruleRef: '601.3b',
  },
  'effect.replacement': {
    label: '置換効果',
    kind: 'effect-kind',
    risk: 'E',
    layer: 'advisory',
    ruleRef: '614',
  },
};

const FIXED_TAG_ORDER = [
  ...KEYWORD_DEFINITIONS.map((definition) => `keyword.${definition.id}`),
  'trigger.etb',
  'trigger.death',
  'trigger.leaves',
  'trigger.cast',
  'trigger.attack',
  'trigger.landfall',
  'trigger.upkeep',
  'trigger.end-step',
  'trigger.draw',
  'trigger.sacrifice',
  'trigger.combat-damage',
  'trigger.cast-watcher',
  'trigger.etb-other',
  'trigger.death-other',
  'trigger.leaves-other',
  'trigger.attack-watcher',
  'action.draw',
  'action.create-token',
  'action.proliferate',
  'action.counter',
  'action.card-counters',
  'action.sacrifice',
  'action.exile',
  'action.search',
  'action.return',
  'action.destroy',
  'action.mill',
  'action.scry',
  'action.discard',
  'action.shuffle',
  'action.surveil',
  'action.attach',
  'concept.target',
  'cost.additional',
  'cost.alternative',
  'concept.alt-cast',
  'concept.cast-from-zone',
  'effect.replacement',
] as const;

const TAG_ORDER_INDEX = new Map<string, number>(
  FIXED_TAG_ORDER.map((tagId, index) => [tagId, index]),
);

const CONFIDENCE_RANK: Record<RuleTag['confidence'], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const ALT_CAST_KEYWORD_PATTERN =
  /\b(?:flashback|escape|disturb|aftermath|jump-?start|embalm|eternalize|foretell|retrace)\b/i;
const LAND_ENTERS_TRIGGER_PATTERN =
  /\b(?:when|whenever)\b\s+(?:(?:a|one or more)\s+lands?)\b(?:\s+you control)?\s+enters?\b/i;

export function compareRuleTagIds(a: string, b: string): number {
  const aIndex = TAG_ORDER_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bIndex = TAG_ORDER_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b);
}

export function classifyCardRules(def: CardDef): RuleTag[] {
  const tags = new Map<string, RuleTag>();

  for (const text of cardOracleTexts(def)) {
    for (const paragraph of splitParagraphs(text)) {
      const core = removeReminderAndQuotes(paragraph);
      if (core === '') {
        continue;
      }

      const keywordClauses = parsePureKeywordLine(core);
      if (keywordClauses) {
        for (const clause of keywordClauses) {
          addTag(tags, {
            id: `keyword.${clause.definition.id}`,
            label: clause.definition.label,
            kind: 'keyword-ability',
            risk: 'C',
            layer: 'warning',
            confidence: 'high',
            matchedText: snippet(clause.text),
            ruleRef: clause.definition.ruleRef,
          });
        }
        classifyAttachAction(tags, core);
        matchTag(tags, core, 'concept.alt-cast', ALT_CAST_KEYWORD_PATTERN, 'medium');
        continue;
      }

      classifyAbilityText(tags, core, def);
    }
  }

  return [...tags.values()].sort((a, b) => compareRuleTagIds(a.id, b.id));
}

function classifyAbilityText(tags: Map<string, RuleTag>, core: string, def: CardDef): void {
  matchTag(tags, core, 'trigger.etb', /\b(?:when|whenever)\b[^,.]*\benters\b/i, 'high');
  matchTag(tags, core, 'trigger.death', /\b(?:when|whenever)\b[^,.]*\bdies\b/i, 'high');
  classifyBattlefieldDepartureTriggers(tags, core, def);
  matchTag(
    tags,
    core,
    'trigger.cast',
    /\b(?:when|whenever)\b[^.]*\bcasts?\b[^.]*\bspell\b/i,
    'high',
  );
  matchTag(tags, core, 'trigger.cast-watcher', /\bwhenever\b[^.]{0,40}\bcasts?\b/i, 'high');
  matchTag(tags, core, 'trigger.cast-watcher', /\bmagecraft\b/i, 'high');
  matchTag(
    tags,
    core,
    'trigger.etb-other',
    /\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\benters\b/i,
    'high',
  );
  matchTag(
    tags,
    core,
    'trigger.death-other',
    /\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\bdies\b/i,
    'high',
  );
  matchTag(tags, core, 'trigger.attack', /\b(?:when|whenever)\b[^,.]*\battacks?\b/i, 'high');
  matchTag(
    tags,
    core,
    'trigger.attack-watcher',
    /\b(?:when|whenever)\b[^.]*\b(?:another|a|an|one or more)\b[^.]{0,40}\battacks?\b/i,
    'high',
  );
  matchTag(tags, core, 'trigger.landfall', /\blandfall\b/i, 'high');
  matchTag(tags, core, 'trigger.landfall', LAND_ENTERS_TRIGGER_PATTERN, 'high');
  matchTag(tags, core, 'trigger.upkeep', /\bat the beginning of[^.]*\bupkeep\b/i, 'high');
  if (!/\bnext end step\b/i.test(core)) {
    matchTag(tags, core, 'trigger.end-step', /\bat the beginning of\b[^.]*\bend step\b/i, 'high');
  }
  matchTag(
    tags,
    core,
    'trigger.draw',
    /\b(?:when|whenever)\b[^,.]*\bdraws?\b[^,.]*\bcards?\b/i,
    'high',
  );
  matchTag(
    tags,
    core,
    'trigger.sacrifice',
    /\b(?:when|whenever)\b[^,.]*\b(?:sacrifices?|sacrificed)\b/i,
    'high',
  );
  matchTag(
    tags,
    core,
    'trigger.combat-damage',
    /\b(?:when|whenever)\b[^,.]*\bdeals?\b[^,.]*\bcombat damage\b/i,
    'high',
  );
  matchTag(tags, core, 'action.draw', /\bdraw(?:s|n)?\b[^,.]*\bcards?\b/i, 'medium');
  matchTag(tags, core, 'action.create-token', /\bcreate\b[^,.]*\btokens?\b/i, 'high');
  matchTag(
    tags,
    core,
    'action.counter',
    /\bcounter\b\s+(?:(?:up to|each|all)\s+)?(?:one\s+)?target\s+(?:spell|activated or triggered ability|ability)\b/i,
    'high',
  );
  matchTag(tags, core, 'action.card-counters', /\bput\b[^.]*\bcounters?\b[^.]*\bon\b/i, 'high');
  matchTag(
    tags,
    core,
    'action.card-counters',
    /\bcounters?\b[^.]*\b(?:would be|are|is|was|were|be)\s+put\s+on\b/i,
    'high',
  );
  matchTag(
    tags,
    core,
    'action.sacrifice',
    /\bsacrifices?\s+(?:target|all|each|up to|that|those|the|it|them|this|a |an |another|\d)\b/i,
    'medium',
  );
  matchTag(
    tags,
    core,
    'action.exile',
    /(?<!\bfrom\s)(?<!\bin\s)(?<!\binto\s)\bexiles?\s+(?:target|all|each|up to|that|those|the|it|them|this|a |an |any|another|cards?|\d)\b/i,
    'medium',
  );
  matchTag(tags, core, 'action.search', /\bsearch(?:es)?\b[^.]*\blibrary\b/i, 'medium');
  matchTag(
    tags,
    core,
    'action.return',
    /\breturn(?:s)?\b[^.]*\bfrom\b[^.]*\b(?:graveyard|exile)\b/i,
    'medium',
  );
  matchTag(
    tags,
    core,
    'action.destroy',
    /\bdestroys?\s+(?:target|all|each|up to|that|those|the|it|them|this|any|another|\d)\b/i,
    'medium',
  );
  matchTag(tags, core, 'action.mill', /\bmills?\b/i, 'medium');
  matchTag(tags, core, 'action.scry', /\bscry\b\s*\d*/i, 'medium');
  matchTag(tags, core, 'action.proliferate', /\bproliferate\b/i, 'medium');
  if (!/can(?:'|’)t\s+discard/i.test(core)) {
    matchTag(tags, core, 'action.discard', /\bdiscards?\b/i, 'medium');
  }
  matchTag(tags, core, 'action.shuffle', /\bshuffle\b/i, 'medium');
  matchTag(tags, core, 'action.surveil', /\bsurveil\b\s*\d*/i, 'medium');
  classifyAttachAction(tags, core);
  matchTag(tags, core, 'concept.target', /\btarget\b/i, 'high');
  matchTag(
    tags,
    core,
    'concept.alt-cast',
    ALT_CAST_KEYWORD_PATTERN,
    'medium',
  );
  matchTag(
    tags,
    core,
    'concept.cast-from-zone',
    /\b(?:cast|play)s?\b[^.]*\bfrom\b[^.]*\b(?:your\s+)?(?:graveyard|exile)\b/i,
    'medium',
  );
  matchTag(
    tags,
    core,
    'cost.additional',
    /\bas an additional cost to cast\b/i,
    'medium',
  );
  matchTag(
    tags,
    core,
    'cost.alternative',
    /\b(?:without paying (?:its|their) mana cost|rather than pay (?:this spell'?s|its) mana cost)\b/i,
    'medium',
  );
  matchTag(tags, core, 'effect.replacement', /\bwould\b[^.]*\binstead\b/i, 'high');
  matchTag(tags, core, 'effect.replacement', /\bas\b[^.]*\benters\b/i, 'high');
  matchTag(tags, core, 'effect.replacement', /\benters\s+(?:with|as)\b/i, 'high');
}

function classifyBattlefieldDepartureTriggers(
  tags: Map<string, RuleTag>,
  core: string,
  def: CardDef,
): void {
  for (const condition of triggerConditionBodies(core, def)) {
    const graveyardSubjects = battlefieldToGraveyardSubjects(condition);
    const explicitLeavesSubjects = leavesBattlefieldSubjects(condition);

    // CR 700.4: only creature/planeswalker subjects use the dies runtime family.
    if (isDiesCondition(condition, def)) {
      const deathSubjects = graveyardSubjects.filter((subject) =>
        isCreatureOrPlaneswalkerSubject(subject, def),
      );
      if (deathSubjects.length > 0) {
        addTemplateTag(tags, 'trigger.death', condition, 'high');
      }
      if (deathSubjects.some((subject) => isWatcherSubject(subject, def))) {
        addTemplateTag(tags, 'trigger.death-other', condition, 'high');
      }
    }

    // CR 603.6c: explicit LTB conditions and noncreature battlefield-to-graveyard
    // conditions are leaves-the-battlefield triggers, not dies triggers.
    if (
      isNonCreatureBattlefieldToGraveyardCondition(condition, def) ||
      explicitLeavesSubjects.length > 0
    ) {
      const leavesSubjects = [
        ...graveyardSubjects.filter((subject) => isNonCreatureSubject(subject, def)),
        ...explicitLeavesSubjects,
      ];
      if (leavesSubjects.some((subject) => isSelfSubject(subject, def))) {
        addTemplateTag(tags, 'trigger.leaves', condition, 'high');
      }
      if (leavesSubjects.some((subject) => isWatcherSubject(subject, def))) {
        addTemplateTag(tags, 'trigger.leaves-other', condition, 'high');
      }
    }
  }
}

function triggerConditionBodies(core: string, def: CardDef): string[] {
  const conditions: string[] = [];
  const probe = /\b(?:when|whenever)\b\s+([^,.;]+)/gi;
  let protectedCore = core;
  for (const name of selfNames(def).filter((candidate) => candidate.includes(','))) {
    protectedCore = protectedCore.replace(
      new RegExp(escapeRegExp(name), 'gi'),
      name.replaceAll(',', '\u0000'),
    );
  }
  for (const match of protectedCore.matchAll(probe)) {
    conditions.push(normalizeWhitespace(match[1].replaceAll('\u0000', ',')));
  }
  return conditions;
}

function isDiesCondition(text: string, def: CardDef): boolean {
  return (
    /\bdies\b/i.test(text) ||
    /\b(?:creatures?|tokens?)\b[^,.;]*\bdie\b/i.test(text) ||
    /\bthey\s+die\b/i.test(text) ||
    battlefieldToGraveyardSubjects(text).some((subject) =>
      isCreatureOrPlaneswalkerSubject(subject, def),
    )
  );
}

function isNonCreatureBattlefieldToGraveyardCondition(
  text: string,
  def: CardDef,
): boolean {
  return battlefieldToGraveyardSubjects(text).some((subject) =>
    isNonCreatureSubject(subject, def),
  );
}

function battlefieldToGraveyardSubjects(text: string): string[] {
  const subjects: string[] = [];
  const probe =
    /(?:^|,\s*(?:or\s+)?)([^,.;]*?)\b(?:is|are)\s+put\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+the battlefield\b/gi;
  for (const match of text.matchAll(probe)) {
    subjects.push(normalizeWhitespace(match[1]));
  }
  return subjects;
}

function leavesBattlefieldSubjects(text: string): string[] {
  const subjects: string[] = [];
  const probe = /(?:^|,\s*(?:or\s+)?)([^,.;]*?)\bleaves?\s+the battlefield\b/gi;
  for (const match of text.matchAll(probe)) {
    subjects.push(normalizeWhitespace(match[1]));
  }
  return subjects;
}

function isCreatureOrPlaneswalkerSubject(subject: string, def: CardDef): boolean {
  if (/\b(?:creatures?|planeswalkers?)\b/i.test(subject)) {
    return true;
  }
  return isSelfSubject(subject, def) && /\b(?:Creature|Planeswalker)\b/.test(def.typeLine);
}

function isNonCreatureSubject(subject: string, def: CardDef): boolean {
  const explicitlyNonCreature =
    /\b(?:artifacts?|lands?|enchantments?|auras?|permanents?|battles?|tokens?)\b/i.test(
      subject,
    );
  if (explicitlyNonCreature) {
    return true;
  }
  if (/\b(?:creatures?|planeswalkers?)\b/i.test(subject)) {
    return false;
  }
  if (isSelfSubject(subject, def)) {
    return !/\b(?:Creature|Planeswalker)\b/.test(def.typeLine);
  }
  return true;
}

function isSelfSubject(subject: string, def: CardDef): boolean {
  if (/\b(?:this|it)\b/i.test(subject)) {
    return true;
  }
  return selfNames(def).some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(subject));
}

function isWatcherSubject(subject: string, def: CardDef): boolean {
  if (!isSelfSubject(subject, def)) {
    return true;
  }
  return /\b(?:another|other)\b/i.test(subject);
}

function selfNames(def: CardDef): string[] {
  const names = new Set<string>();
  for (const name of [def.name, ...def.faces.map((face) => face.name)]) {
    for (const faceName of name.split(' // ')) {
      const trimmed = faceName.trim();
      if (trimmed !== '') {
        names.add(trimmed);
        const shortName = trimmed.split(',')[0]?.trim();
        if (shortName) {
          names.add(shortName);
        }
      }
    }
  }
  return [...names];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classifyAttachAction(tags: Map<string, RuleTag>, core: string): void {
  matchTag(tags, core, 'action.attach', /\battach(?:es)?\b/i, 'medium');
  matchTag(tags, core, 'action.attach', /\bequip\b/i, 'medium');
}

function matchTag(
  tags: Map<string, RuleTag>,
  core: string,
  tagId: string,
  pattern: RegExp,
  confidence: RuleTag['confidence'],
): void {
  const match = core.match(pattern);
  if (!match) {
    return;
  }

  const template = TAG_TEMPLATES[tagId];
  if (!template) {
    return;
  }

  addTemplateTag(tags, tagId, match[0], confidence);
}

function addTemplateTag(
  tags: Map<string, RuleTag>,
  tagId: string,
  matchedText: string,
  confidence: RuleTag['confidence'],
): void {
  const template = TAG_TEMPLATES[tagId];
  if (!template) {
    return;
  }

  addTag(tags, {
    id: tagId,
    label: template.label,
    kind: template.kind,
    risk: template.risk,
    layer: template.layer,
    confidence,
    matchedText: snippet(matchedText),
    ruleRef: template.ruleRef,
  });
}

function addTag(tags: Map<string, RuleTag>, tag: RuleTag): void {
  const existing = tags.get(tag.id);
  if (!existing || CONFIDENCE_RANK[tag.confidence] > CONFIDENCE_RANK[existing.confidence]) {
    tags.set(tag.id, tag);
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function snippet(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 137).trimEnd()}...`;
}
