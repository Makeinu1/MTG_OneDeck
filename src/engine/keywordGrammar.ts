import type { CardDef } from '../types/card';

export interface KeywordDefinition {
  id: string;
  name: string;
  label: string;
  ruleRef?: string;
  aliases?: readonly string[];
}

export interface KeywordClause {
  definition: KeywordDefinition;
  text: string;
}

export const KEYWORD_DEFINITIONS: readonly KeywordDefinition[] = [
  { id: 'deathtouch', name: 'deathtouch', label: '接死', ruleRef: '702.2' },
  { id: 'defender', name: 'defender', label: '防衛', ruleRef: '702.3' },
  { id: 'double-strike', name: 'double strike', label: '二段攻撃', ruleRef: '702.4' },
  { id: 'enchant', name: 'enchant', label: 'エンチャント', ruleRef: '702.5' },
  { id: 'equip', name: 'equip', label: '装備', ruleRef: '702.6' },
  { id: 'first-strike', name: 'first strike', label: '先制攻撃', ruleRef: '702.7' },
  { id: 'flash', name: 'flash', label: '瞬速', ruleRef: '702.8' },
  { id: 'flying', name: 'flying', label: '飛行', ruleRef: '702.9' },
  { id: 'haste', name: 'haste', label: '速攻', ruleRef: '702.10' },
  { id: 'hexproof', name: 'hexproof', label: '呪禁', ruleRef: '702.11' },
  { id: 'indestructible', name: 'indestructible', label: '破壊不能', ruleRef: '702.12' },
  { id: 'lifelink', name: 'lifelink', label: '絆魂', ruleRef: '702.13' },
  {
    id: 'landwalk',
    name: 'landwalk',
    label: '土地渡り',
    ruleRef: '702.14',
    aliases: [
      'plainswalk',
      'islandwalk',
      'swampwalk',
      'mountainwalk',
      'forestwalk',
      'desertwalk',
      'legendary landwalk',
      'nonbasic landwalk',
      'snow landwalk',
    ],
  },
  { id: 'protection', name: 'protection', label: 'プロテクション', ruleRef: '702.16' },
  { id: 'reach', name: 'reach', label: '到達', ruleRef: '702.17' },
  { id: 'shroud', name: 'shroud', label: '被覆', ruleRef: '702.18' },
  { id: 'trample', name: 'trample', label: 'トランプル', ruleRef: '702.19' },
  { id: 'vigilance', name: 'vigilance', label: '警戒', ruleRef: '702.20' },
  { id: 'ward', name: 'ward', label: '護法', ruleRef: '702.21' },
  { id: 'banding', name: 'banding', label: 'バンド', ruleRef: '702' },
  { id: 'rampage', name: 'rampage', label: 'ランページ', ruleRef: '702' },
  { id: 'cumulative-upkeep', name: 'cumulative upkeep', label: '累加アップキープ', ruleRef: '702' },
  { id: 'flanking', name: 'flanking', label: '側面攻撃', ruleRef: '702' },
  { id: 'phasing', name: 'phasing', label: 'フェイジング', ruleRef: '702' },
  { id: 'buyback', name: 'buyback', label: 'バイバック', ruleRef: '702' },
  { id: 'shadow', name: 'shadow', label: 'シャドー', ruleRef: '702' },
  { id: 'cycling', name: 'cycling', label: 'サイクリング', ruleRef: '702.29' },
  { id: 'echo', name: 'echo', label: 'エコー', ruleRef: '702' },
  { id: 'horsemanship', name: 'horsemanship', label: '馬術', ruleRef: '702' },
  { id: 'fading', name: 'fading', label: '消散', ruleRef: '702' },
  { id: 'kicker', name: 'kicker', label: 'キッカー', ruleRef: '702' },
  { id: 'flashback', name: 'flashback', label: 'フラッシュバック', ruleRef: '702' },
  { id: 'madness', name: 'madness', label: 'マッドネス', ruleRef: '702' },
  { id: 'fear', name: 'fear', label: '畏怖', ruleRef: '702' },
  { id: 'morph', name: 'morph', label: '変異', ruleRef: '702' },
  { id: 'amplify', name: 'amplify', label: '増幅', ruleRef: '702' },
  { id: 'provoke', name: 'provoke', label: '挑発', ruleRef: '702' },
  { id: 'storm', name: 'storm', label: 'ストーム', ruleRef: '702' },
  { id: 'affinity', name: 'affinity', label: '親和', ruleRef: '702' },
  { id: 'entwine', name: 'entwine', label: '双呪', ruleRef: '702' },
  { id: 'modular', name: 'modular', label: '接合', ruleRef: '702' },
  { id: 'sunburst', name: 'sunburst', label: '烈日', ruleRef: '702' },
  { id: 'bushido', name: 'bushido', label: '武士道', ruleRef: '702' },
  { id: 'soulshift', name: 'soulshift', label: '転生', ruleRef: '702' },
  { id: 'splice', name: 'splice', label: '連繋', ruleRef: '702' },
  { id: 'offering', name: 'offering', label: '献身', ruleRef: '702' },
  { id: 'ninjutsu', name: 'ninjutsu', label: '忍術', ruleRef: '702', aliases: ['commander ninjutsu'] },
  { id: 'epic', name: 'epic', label: '歴伝', ruleRef: '702' },
  { id: 'convoke', name: 'convoke', label: '召集', ruleRef: '702' },
  { id: 'dredge', name: 'dredge', label: '発掘', ruleRef: '702' },
  { id: 'transmute', name: 'transmute', label: '変成', ruleRef: '702' },
  { id: 'bloodthirst', name: 'bloodthirst', label: '狂喜', ruleRef: '702' },
  { id: 'haunt', name: 'haunt', label: '憑依', ruleRef: '702' },
  { id: 'replicate', name: 'replicate', label: '複製', ruleRef: '702' },
  { id: 'forecast', name: 'forecast', label: '予見', ruleRef: '702' },
  { id: 'graft', name: 'graft', label: '移植', ruleRef: '702' },
  { id: 'recover', name: 'recover', label: '復活', ruleRef: '702' },
  { id: 'ripple', name: 'ripple', label: '波及', ruleRef: '702' },
  { id: 'split-second', name: 'split second', label: '刹那', ruleRef: '702' },
  { id: 'suspend', name: 'suspend', label: '待機', ruleRef: '702' },
  { id: 'vanishing', name: 'vanishing', label: '消失', ruleRef: '702' },
  { id: 'absorb', name: 'absorb', label: '吸収', ruleRef: '702' },
  { id: 'aura-swap', name: 'aura swap', label: 'オーラ交換', ruleRef: '702' },
  { id: 'delve', name: 'delve', label: '探査', ruleRef: '702' },
  { id: 'fortify', name: 'fortify', label: '城砦化', ruleRef: '702' },
  { id: 'frenzy', name: 'frenzy', label: '狂乱', ruleRef: '702' },
  { id: 'gravestorm', name: 'gravestorm', label: '墓地ストーム', ruleRef: '702' },
  { id: 'poisonous', name: 'poisonous', label: '有毒', ruleRef: '702' },
  { id: 'transfigure', name: 'transfigure', label: '変形', ruleRef: '702' },
  { id: 'champion', name: 'champion', label: '覇権', ruleRef: '702' },
  { id: 'changeling', name: 'changeling', label: '多相', ruleRef: '702' },
  { id: 'evoke', name: 'evoke', label: '想起', ruleRef: '702' },
  { id: 'hideaway', name: 'hideaway', label: '秘匿', ruleRef: '702' },
  { id: 'prowl', name: 'prowl', label: '徘徊', ruleRef: '702' },
  { id: 'reinforce', name: 'reinforce', label: '補強', ruleRef: '702' },
  { id: 'conspire', name: 'conspire', label: '共謀', ruleRef: '702' },
  { id: 'persist', name: 'persist', label: '頑強', ruleRef: '702' },
  { id: 'wither', name: 'wither', label: '萎縮', ruleRef: '702' },
  { id: 'retrace', name: 'retrace', label: '回顧', ruleRef: '702' },
  { id: 'devour', name: 'devour', label: '貪食', ruleRef: '702' },
  { id: 'exalted', name: 'exalted', label: '賛美', ruleRef: '702' },
  { id: 'unearth', name: 'unearth', label: '蘇生', ruleRef: '702' },
  { id: 'cascade', name: 'cascade', label: '続唱', ruleRef: '702' },
  { id: 'annihilator', name: 'annihilator', label: '滅殺', ruleRef: '702.86' },
  { id: 'level-up', name: 'level up', label: 'Lvアップ', ruleRef: '702' },
  { id: 'rebound', name: 'rebound', label: '反復', ruleRef: '702' },
  { id: 'totem-armor', name: 'totem armor', label: '族霊鎧', ruleRef: '702' },
  { id: 'infect', name: 'infect', label: '感染', ruleRef: '702' },
  { id: 'battle-cry', name: 'battle cry', label: '喊声', ruleRef: '702' },
  { id: 'living-weapon', name: 'living weapon', label: '生体武器', ruleRef: '702' },
  { id: 'undying', name: 'undying', label: '不死', ruleRef: '702' },
  { id: 'miracle', name: 'miracle', label: '奇跡', ruleRef: '702' },
  { id: 'soulbond', name: 'soulbond', label: '結魂', ruleRef: '702' },
  { id: 'overload', name: 'overload', label: '超過', ruleRef: '702' },
  { id: 'scavenge', name: 'scavenge', label: '活用', ruleRef: '702' },
  { id: 'unleash', name: 'unleash', label: '解鎖', ruleRef: '702' },
  { id: 'cipher', name: 'cipher', label: '暗号', ruleRef: '702' },
  { id: 'evolve', name: 'evolve', label: '進化', ruleRef: '702' },
  { id: 'extort', name: 'extort', label: '強請', ruleRef: '702' },
  { id: 'fuse', name: 'fuse', label: '融合', ruleRef: '702' },
  { id: 'bestow', name: 'bestow', label: '授与', ruleRef: '702' },
  { id: 'tribute', name: 'tribute', label: '貢納', ruleRef: '702' },
  { id: 'dethrone', name: 'dethrone', label: '廃位', ruleRef: '702' },
  { id: 'hidden-agenda', name: 'hidden agenda', label: '秘策', ruleRef: '702' },
  { id: 'outlast', name: 'outlast', label: '長久', ruleRef: '702' },
  { id: 'prowess', name: 'prowess', label: '果敢', ruleRef: '702' },
  { id: 'dash', name: 'dash', label: '疾駆', ruleRef: '702' },
  { id: 'exploit', name: 'exploit', label: '濫用', ruleRef: '702' },
  { id: 'menace', name: 'menace', label: '威迫', ruleRef: '702' },
  { id: 'renown', name: 'renown', label: '高名', ruleRef: '702' },
  { id: 'awaken', name: 'awaken', label: '覚醒', ruleRef: '702' },
  { id: 'devoid', name: 'devoid', label: '欠色', ruleRef: '702' },
  { id: 'ingest', name: 'ingest', label: '嚥下', ruleRef: '702' },
  { id: 'myriad', name: 'myriad', label: '無尽', ruleRef: '702' },
  { id: 'surge', name: 'surge', label: '怒濤', ruleRef: '702' },
  { id: 'skulk', name: 'skulk', label: '潜伏', ruleRef: '702' },
  { id: 'emerge', name: 'emerge', label: '現出', ruleRef: '702' },
  { id: 'escalate', name: 'escalate', label: '増呪', ruleRef: '702' },
  { id: 'melee', name: 'melee', label: '会戦', ruleRef: '702' },
  { id: 'crew', name: 'crew', label: '搭乗', ruleRef: '702' },
  { id: 'fabricate', name: 'fabricate', label: '製造', ruleRef: '702' },
  { id: 'partner', name: 'partner', label: '共闘', ruleRef: '702', aliases: ['partner with'] },
  { id: 'undaunted', name: 'undaunted', label: '不抜', ruleRef: '702' },
  { id: 'improvise', name: 'improvise', label: '即席', ruleRef: '702' },
  { id: 'aftermath', name: 'aftermath', label: '余波', ruleRef: '702' },
  { id: 'embalm', name: 'embalm', label: '不朽', ruleRef: '702' },
  { id: 'eternalize', name: 'eternalize', label: '永遠', ruleRef: '702' },
  { id: 'afflict', name: 'afflict', label: '加虐', ruleRef: '702' },
  { id: 'ascend', name: 'ascend', label: '昇殿', ruleRef: '702' },
  { id: 'assist', name: 'assist', label: '助力', ruleRef: '702' },
  { id: 'jump-start', name: 'jump-start', label: '再活', ruleRef: '702' },
  { id: 'mentor', name: 'mentor', label: '教導', ruleRef: '702' },
  { id: 'afterlife', name: 'afterlife', label: '死後', ruleRef: '702' },
  { id: 'riot', name: 'riot', label: '暴動', ruleRef: '702' },
  { id: 'spectacle', name: 'spectacle', label: '絢爛', ruleRef: '702' },
  { id: 'escape', name: 'escape', label: '脱出', ruleRef: '702' },
  { id: 'companion', name: 'companion', label: '相棒', ruleRef: '702' },
  { id: 'mutate', name: 'mutate', label: '変容', ruleRef: '702' },
  { id: 'boast', name: 'boast', label: '誇示', ruleRef: '702' },
  { id: 'foretell', name: 'foretell', label: '予顕', ruleRef: '702' },
  { id: 'demonstrate', name: 'demonstrate', label: '実演', ruleRef: '702' },
  { id: 'daybound', name: 'daybound', label: '日暮', ruleRef: '702' },
  { id: 'nightbound', name: 'nightbound', label: '夜明', ruleRef: '702' },
  { id: 'disturb', name: 'disturb', label: '降霊', ruleRef: '702' },
  { id: 'decayed', name: 'decayed', label: '腐乱', ruleRef: '702' },
  { id: 'cleave', name: 'cleave', label: '切除', ruleRef: '702' },
  { id: 'training', name: 'training', label: '訓練', ruleRef: '702' },
  { id: 'compleated', name: 'compleated', label: '完成化', ruleRef: '702' },
  { id: 'reconfigure', name: 'reconfigure', label: '換装', ruleRef: '702' },
  { id: 'blitz', name: 'blitz', label: '奇襲', ruleRef: '702' },
  { id: 'casualty', name: 'casualty', label: '犠牲', ruleRef: '702' },
  { id: 'enlist', name: 'enlist', label: '後援', ruleRef: '702' },
  { id: 'read-ahead', name: 'read ahead', label: '先読', ruleRef: '702' },
  { id: 'ravenous', name: 'ravenous', label: '貪欲', ruleRef: '702' },
  { id: 'squad', name: 'squad', label: '分隊', ruleRef: '702' },
  { id: 'space-sculptor', name: 'space sculptor', label: '空間彫刻家', ruleRef: '702' },
  { id: 'prototype', name: 'prototype', label: '試作', ruleRef: '702' },
  { id: 'toxic', name: 'toxic', label: '毒性', ruleRef: '702.164' },
  { id: 'for-mirrodin', name: 'for mirrodin!', label: 'ミラディンのために！', ruleRef: '702' },
  { id: 'backup', name: 'backup', label: '賛助', ruleRef: '702' },
  { id: 'bargain', name: 'bargain', label: '協約', ruleRef: '702' },
  { id: 'craft', name: 'craft', label: '作製', ruleRef: '702' },
  { id: 'disguise', name: 'disguise', label: '偽装', ruleRef: '702' },
  { id: 'cloak', name: 'cloak', label: '偽装する', ruleRef: '702' },
  { id: 'offspring', name: 'offspring', label: '新生', ruleRef: '702' },
  { id: 'gift', name: 'gift', label: '贈呈', ruleRef: '702' },
  { id: 'saddle', name: 'saddle', label: '騎乗', ruleRef: '702' },
  { id: 'impending', name: 'impending', label: '兆候', ruleRef: '702.176' },
  { id: 'exhaust', name: 'exhaust', label: '消尽', ruleRef: '702.177' },
  { id: 'mobilize', name: 'mobilize', label: '動員', ruleRef: '702.181' },
  { id: 'station', name: 'station', label: '配備', ruleRef: '702.184' },
  { id: 'warp', name: 'warp', label: 'ワープ', ruleRef: '702.185' },
  { id: 'sneak', name: 'sneak', label: '奇襲潜入', ruleRef: '702.190' },
];

const KEYWORD_DEFINITIONS_BY_LONGEST_NAME = [...KEYWORD_DEFINITIONS].sort(
  (a, b) => b.name.length - a.name.length,
);

const EQUIP_MANA_COST_PATTERN =
  /(?:^|^.*-)equip(?:[ -](?:[a-z][a-z ]*?))?[ -]?(?:\{[^}]+\})+(?: or (?:\{[^}]+\})+)?$/;
const EQUIP_MANA_COST_WITH_MODIFIER_PATTERN =
  /(?:^|^.*-)equip(?:[ -](?:[a-z][a-z ]*?))?[ -]?(?:\{[^}]+\})+(?:\. (?:this ability costs \{\d+\} less to activate(?: [a-z0-9 {}',/+.-]+)?|activate only once each turn))$/;
const EQUIP_DASH_COST_PATTERN =
  /(?:^|^.*-)equip-(?!\{)[a-z][a-z0-9 {}',/+.-]*$/;

const KEYWORD_ALIASES = new Map<string, KeywordDefinition>();
for (const definition of KEYWORD_DEFINITIONS) {
  KEYWORD_ALIASES.set(definition.name, definition);
  for (const alias of definition.aliases ?? []) {
    KEYWORD_ALIASES.set(alias, definition);
  }
}

const KEYWORD_PREFIX_PATTERNS = new Map<string, RegExp>();
for (const definition of KEYWORD_DEFINITIONS) {
  for (const name of [definition.name, ...(definition.aliases ?? [])]) {
    KEYWORD_PREFIX_PATTERNS.set(
      name,
      new RegExp(`^${escapeRegex(name)}(?:\\s|\\{|\\d|x\\b|n\\b|[-:])`),
    );
  }
}

export function cardOracleTexts(def: CardDef | undefined): string[] {
  if (!Array.isArray(def?.faces)) {
    return [];
  }

  return def.faces.flatMap((face) => {
    if (typeof face.oracleText !== 'string') {
      return [];
    }
    const text = face.oracleText.trim();
    return text === '' ? [] : [text];
  });
}

export function possessedKeywords(def: CardDef | undefined): string[] {
  const seen = new Set<string>();

  for (const text of cardOracleTexts(def)) {
    for (const paragraph of splitParagraphs(text)) {
      const keywordClauses = parsePureKeywordLine(removeReminderAndQuotes(paragraph));
      if (!keywordClauses) {
        continue;
      }
      for (const clause of keywordClauses) {
        seen.add(clause.definition.id);
      }
    }
  }

  return KEYWORD_DEFINITIONS.flatMap((definition) =>
    seen.has(definition.id) ? [definition.id] : [],
  );
}

export function splitParagraphs(text: string): string[] {
  return text
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function removeReminderAndQuotes(text: string): string {
  let output = '';
  let parenthesisDepth = 0;
  let inStraightQuote = false;
  let inCurlyQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inStraightQuote) {
      if (char === '"') {
        inStraightQuote = false;
      }
      continue;
    }

    if (inCurlyQuote) {
      if (char === '”') {
        inCurlyQuote = false;
      }
      continue;
    }

    if (parenthesisDepth > 0) {
      if (char === '(') {
        parenthesisDepth += 1;
      } else if (char === ')') {
        parenthesisDepth -= 1;
      }
      continue;
    }

    if (char === '(') {
      parenthesisDepth = 1;
      continue;
    }
    if (char === '"') {
      inStraightQuote = true;
      continue;
    }
    if (char === '“') {
      inCurlyQuote = true;
      continue;
    }

    output += char;
  }

  return normalizeWhitespace(output);
}

export function parsePureKeywordLine(core: string): KeywordClause[] | null {
  const rawClauses = splitKeywordClauses(core);
  if (rawClauses.length === 0) {
    return null;
  }

  const parsed: KeywordClause[] = [];
  for (const rawClause of rawClauses) {
    const clause = rawClause.replace(/\.$/, '').trim();
    if (clause === '') {
      return null;
    }
    const definition = parseKeywordClause(clause);
    if (!definition) {
      return null;
    }
    parsed.push({ definition, text: clause });
  }

  return parsed;
}

function splitKeywordClauses(core: string): string[] {
  const commaParts = core.split(/[;,]/).map((part) => part.trim());
  const clauses: string[] = [];

  for (const part of commaParts) {
    const withoutListMarker = part.replace(/^and\s+/i, '').trim();
    if (withoutListMarker === '') {
      continue;
    }

    if (parseKeywordClause(withoutListMarker)) {
      clauses.push(withoutListMarker);
      continue;
    }

    const andParts = withoutListMarker.split(/\s+and\s+/i).map((item) => item.trim());
    if (
      andParts.length > 1 &&
      andParts.every((item) => item !== '' && parseKeywordClause(item) !== null)
    ) {
      clauses.push(...andParts);
      continue;
    }

    clauses.push(withoutListMarker);
  }

  return clauses;
}

function parseKeywordClause(clause: string): KeywordDefinition | null {
  const normalized = normalizeKeywordText(clause);
  if (isEquipClauseCandidate(normalized)) {
    if (isEquipKeywordClause(normalized)) {
      return KEYWORD_ALIASES.get('equip') ?? null;
    }
    return null;
  }

  const directAlias = KEYWORD_ALIASES.get(normalized);
  if (directAlias) {
    return directAlias;
  }

  if (/^[a-z][a-z -]*cycling(?:\s|$)/.test(normalized)) {
    return KEYWORD_ALIASES.get('cycling') ?? null;
  }

  if (/^[a-z][a-z -]*walk(?:\s|$)/.test(normalized)) {
    return KEYWORD_ALIASES.get('landwalk') ?? null;
  }

  if (/^[a-z][a-z -]* offering(?:\s|$)/.test(normalized)) {
    return KEYWORD_ALIASES.get('offering') ?? null;
  }

  for (const definition of KEYWORD_DEFINITIONS_BY_LONGEST_NAME) {
    if (definition.id === 'equip') {
      continue;
    }
    if (keywordStartsClause(normalized, definition.name)) {
      return definition;
    }
    for (const alias of definition.aliases ?? []) {
      if (keywordStartsClause(normalized, alias)) {
        return definition;
      }
    }
  }

  return null;
}

function isEquipClauseCandidate(clause: string): boolean {
  return clause.startsWith('equip') || /^.*-equip/.test(clause);
}

function isEquipKeywordClause(clause: string): boolean {
  return (
    EQUIP_MANA_COST_PATTERN.test(clause) ||
    EQUIP_MANA_COST_WITH_MODIFIER_PATTERN.test(clause) ||
    EQUIP_DASH_COST_PATTERN.test(clause)
  );
}

function keywordStartsClause(clause: string, keyword: string): boolean {
  if (clause === keyword) {
    return true;
  }
  return KEYWORD_PREFIX_PATTERNS.get(keyword)?.test(clause) ?? false;
}

function normalizeKeywordText(text: string): string {
  return normalizeWhitespace(text)
    .replace(/[—―]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*:\s*/g, ':')
    .replace(/\.$/, '')
    .toLowerCase();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
