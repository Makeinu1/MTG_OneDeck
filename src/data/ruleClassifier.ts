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
  'trigger.cast': {
    label: '唱えたときの誘発',
    kind: 'trigger',
    risk: 'C',
    layer: 'trigger-assist',
  },
  'trigger.attack': {
    label: '攻撃したときの誘発',
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
  'trigger.cast',
  'trigger.attack',
  'trigger.landfall',
  'trigger.upkeep',
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
        continue;
      }

      classifyAbilityText(tags, core);
    }
  }

  return [...tags.values()].sort((a, b) => compareRuleTagIds(a.id, b.id));
}

function classifyAbilityText(tags: Map<string, RuleTag>, core: string): void {
  matchTag(tags, core, 'trigger.etb', /\b(?:when|whenever)\b[^,.]*\benters\b/i, 'high');
  matchTag(tags, core, 'trigger.death', /\b(?:when|whenever)\b[^,.]*\bdies\b/i, 'high');
  matchTag(
    tags,
    core,
    'trigger.death',
    /\bput into a graveyard from the battlefield\b/i,
    'high',
  );
  matchTag(
    tags,
    core,
    'trigger.cast',
    /\b(?:when|whenever)\b[^.]*\bcasts?\b[^.]*\bspell\b/i,
    'high',
  );
  matchTag(tags, core, 'trigger.attack', /\b(?:when|whenever)\b[^,.]*\battacks?\b/i, 'high');
  matchTag(tags, core, 'trigger.landfall', /\blandfall\b/i, 'high');
  matchTag(
    tags,
    core,
    'trigger.landfall',
    /\b(?:when|whenever)\b[^,.]*\bland\b[^,.]*\benters\b/i,
    'high',
  );
  matchTag(tags, core, 'trigger.upkeep', /\bat the beginning of[^.]*\bupkeep\b/i, 'high');
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
  matchTag(tags, core, 'action.sacrifice', /\bsacrifices?\b/i, 'medium');
  matchTag(tags, core, 'action.exile', /\bexiles?\b/i, 'medium');
  matchTag(tags, core, 'action.search', /\bsearch(?:es)?\b[^.]*\blibrary\b/i, 'medium');
  matchTag(
    tags,
    core,
    'action.return',
    /\breturn(?:s)?\b[^.]*\bfrom\b[^.]*\b(?:graveyard|exile)\b/i,
    'medium',
  );
  matchTag(tags, core, 'action.destroy', /\bdestroys?\b/i, 'medium');
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
  matchTag(tags, core, 'effect.replacement', /\bwould\b[^.]*\binstead\b/i, 'high');
  matchTag(tags, core, 'effect.replacement', /\bas\b[^.]*\benters\b/i, 'high');
  matchTag(tags, core, 'effect.replacement', /\benters\s+(?:with|as)\b/i, 'high');
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

  addTag(tags, {
    id: tagId,
    label: template.label,
    kind: template.kind,
    risk: template.risk,
    layer: template.layer,
    confidence,
    matchedText: snippet(match[0]),
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
