import type { CardDef } from '../../types/card';
import {
  cardOracleTexts,
  parsePureKeywordLine,
  possessedKeywords,
  removeReminderAndQuotes,
  splitParagraphs,
} from '../keywordGrammar';

export type AbilityShape =
  | 'activated'
  | 'triggered'
  | 'delayed-triggered'
  | 'replacement'
  | 'static'
  | 'spell'
  | 'keyword';

export interface AbilityLine {
  faceIndex: number;
  text: string;
  shape: AbilityShape;
}

export type EffectAtomId = string;
export type ConstructId = string;

interface ProbeDefinition<Id extends string> {
  id: Id;
  label: string;
  probe: RegExp;
}

export interface EffectAtomDefinition extends ProbeDefinition<EffectAtomId> {
  ruleRef: string;
}
export type ConstructDefinition = ProbeDefinition<ConstructId>;

export const EFFECT_ATOM_DEFINITIONS: readonly EffectAtomDefinition[] = [
  {
    id: 'effect.add-mana',
    label: 'マナを加える',
    ruleRef: '106',
    probe: /\badd(?:s|ed)?\b(?=[^.]*?(?:\{[WUBRGC]\}|\bmana\b))/i,
  },
  { id: 'effect.attach', label: 'つける', ruleRef: '701.3', probe: /\battach(?:es|ed|ing)?\b/i },
  { id: 'effect.copy', label: 'コピーする', ruleRef: '707', probe: /\bcop(?:y|ies|ied|ying)\b/i },
  {
    id: 'effect.counter-plus',
    label: 'カウンターを置く',
    ruleRef: '122',
    probe: /[+-](?:\d+|X)\/[+-]?(?:\d+|X)\s+counters?\b/i,
  },
  {
    id: 'effect.counter-spell',
    label: '呪文を打ち消す',
    ruleRef: '701.6',
    probe: /\bcounter(?:s|ed|ing)?\b[^.]*\bspell\b/i,
  },
  {
    id: 'effect.create-token',
    label: 'トークンを生成する',
    ruleRef: '701.7',
    probe: /\bcreate(?:s|d)?\b[^.]*\btokens?\b/i,
  },
  { id: 'effect.damage', label: 'ダメージを与える', ruleRef: '120', probe: /\bdamage\b/i },
  { id: 'effect.destroy', label: '破壊する', ruleRef: '701.8', probe: /\bdestroy(?:s|ed|ing)?\b/i },
  { id: 'effect.discard', label: '捨てる', ruleRef: '701.9', probe: /\bdiscard(?:s|ed|ing)?\b/i },
  { id: 'effect.draw', label: 'カードを引く', ruleRef: '121', probe: /\bdraw(?:s|n|ing)?\b/i },
  { id: 'effect.energy', label: 'エネルギー・カウンター', ruleRef: '122', probe: /\benergy counters?\b|\{E\}/i },
  { id: 'effect.exile', label: '追放する', ruleRef: '701.13', probe: /\bexile(?:s|d|ing)?\b/i },
  { id: 'effect.experience', label: '経験カウンター', ruleRef: '122', probe: /\bexperience counters?\b/i },
  { id: 'effect.extra-turn', label: '追加ターン', ruleRef: 'standard', probe: /\bextra turn\b/i },
  {
    id: 'effect.gain-control',
    label: 'コントロールを得る',
    ruleRef: 'standard',
    probe: /\bgain(?:s|ed|ing)? control\b/i,
  },
  { id: 'effect.gain-life', label: 'ライフを得る', ruleRef: '119', probe: /\bgain(?:s|ed|ing)?\b[^.]*\blife\b/i },
  {
    id: 'effect.grant-keyword',
    label: 'キーワードを得る',
    ruleRef: '702',
    probe:
      /\bgain(?:s|ed|ing)?\b[^.]*\b(?:deathtouch|defender|double strike|first strike|flying|haste|hexproof|indestructible|lifelink|menace|protection|reach|trample|vigilance|ward)\b/i,
  },
  { id: 'effect.lose-life', label: 'ライフを失う', ruleRef: '119', probe: /\blose(?:s|t|ing)?\b[^.]*\blife\b/i },
  { id: 'effect.loyalty', label: '忠誠度', ruleRef: '122', probe: /\bloyalty\b/i },
  { id: 'effect.mill', label: '切削する', ruleRef: '701.17', probe: /\bmill(?:s|ed|ing)?\b/i },
  { id: 'effect.poison', label: '毒カウンター', ruleRef: '122', probe: /\bpoison counters?\b/i },
  {
    id: 'effect.pump',
    label: '修整する',
    ruleRef: 'standard',
    probe: /\bgets?\s+[+-]?(?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)\b/i,
  },
  {
    id: 'effect.put-onto-battlefield',
    label: '戦場に出す',
    ruleRef: 'standard',
    probe: /\bput\b[^.]*\bonto the battlefield\b/i,
  },
  { id: 'effect.restriction', label: '禁止する', ruleRef: 'standard', probe: /\bcan't\b|\bcannot\b/i },
  { id: 'effect.return', label: '戻す', ruleRef: 'standard', probe: /\breturn(?:s|ed|ing)?\b/i },
  { id: 'effect.reveal', label: '公開する', ruleRef: '701.20', probe: /\breveal(?:s|ed|ing)?\b/i },
  { id: 'effect.sacrifice', label: '生け贄に捧げる', ruleRef: '701.21', probe: /\bsacrifice(?:s|d|ing)?\b/i },
  { id: 'effect.scry', label: '占術を行う', ruleRef: '701.22', probe: /\bscry(?:s|ed|ing)?\b/i },
  { id: 'effect.search', label: '探す', ruleRef: '701.23', probe: /\bsearch(?:es|ed|ing)?\b/i },
  { id: 'effect.surveil', label: '諜報を行う', ruleRef: '701.25', probe: /\bsurveil(?:s|ed|ing)?\b/i },
  { id: 'effect.tap', label: 'タップする', ruleRef: '701.26', probe: /\btap(?:s|ped|ping)?\b/i },
  { id: 'effect.transform', label: '変身する', ruleRef: '701.27', probe: /\btransform(?:s|ed|ing)?\b/i },
  { id: 'effect.treasure', label: '宝物', ruleRef: 'standard', probe: /\btreasure\b/i },
  { id: 'effect.untap', label: 'アンタップする', ruleRef: '701.26', probe: /\buntap(?:s|ped|ping)?\b/i },
];

export const CONSTRUCT_DEFINITIONS: readonly ConstructDefinition[] = [
  {
    id: 'construct.choose-modal',
    label: 'モード選択',
    probe: /(?:^|\n)\s*•|\bchoose (?:one|two|three|four|one or more|up to)\b/i,
  },
  {
    id: 'construct.each-player',
    label: '各プレイヤー/対戦相手',
    probe: /\beach (?:player|opponent)\b|\beach of your opponents\b/i,
  },
  { id: 'construct.for-each', label: '数え上げ', probe: /\bfor each\b/i },
  { id: 'construct.intervening-if', label: 'if節つき誘発', probe: /,\s*if\b/i },
  { id: 'construct.may', label: '任意', probe: /\byou may\b/i },
  { id: 'construct.target', label: '対象', probe: /\btarget\b/i },
  { id: 'construct.variable-x', label: 'X変数', probe: /\{X\}|\bX\b/ },
  { id: 'construct.you-control', label: 'あなたがコントロール', probe: /\byou control\b/i },
];

export function splitAbilityLines(def: CardDef): AbilityLine[] {
  if (cardOracleTexts(def).length === 0) {
    return [];
  }

  const hasKnownKeywordLine = possessedKeywords(def).length > 0;
  const lines: AbilityLine[] = [];
  for (const [faceIndex, face] of def.faces.entries()) {
    if (typeof face.oracleText !== 'string') {
      continue;
    }
    for (const paragraph of splitParagraphs(face.oracleText)) {
      const text = sanitizeLine(paragraph);
      if (text === '') {
        continue;
      }
      const shape =
        hasKnownKeywordLine && parsePureKeywordLine(text)
          ? 'keyword'
          : classifyAbilityShape(text, face.typeLine);
      lines.push({ faceIndex, text, shape });
    }
  }
  return lines;
}

export function classifyAbilityShape(line: string, typeLine: string): AbilityShape {
  const text = sanitizeLine(line);
  if (parsePureKeywordLine(text)) {
    return 'keyword';
  }
  if (isActivatedAbilityLine(text)) {
    return 'activated';
  }
  if (/^(?:When|Whenever|At)\b/i.test(text)) {
    if (/\bthe next\b[^.]*\b(?:turn|end step|upkeep)\b/i.test(text)) {
      return 'delayed-triggered';
    }
    return 'triggered';
  }
  if (
    /\bif\b[^.]*\bwould\b[^.]*\binstead\b/i.test(text) ||
    /\benters\b[^.]*\bwith\b/i.test(text) ||
    /\bas\b[^.]*\benters\b/i.test(text) ||
    /\bskips?\b/i.test(text)
  ) {
    return 'replacement';
  }
  if (/\b(?:Instant|Sorcery)\b/.test(typeLine)) {
    return 'spell';
  }
  return 'static';
}

export function detectEffectAtoms(line: string): EffectAtomId[] {
  const text = effectText(sanitizeLine(line));
  return matchingProbeIds(EFFECT_ATOM_DEFINITIONS, text);
}

export function detectConstructs(line: string): ConstructId[] {
  const text = sanitizeLine(line);
  return matchingProbeIds(CONSTRUCT_DEFINITIONS, text);
}

function matchingProbeIds<Id extends string>(
  definitions: readonly ProbeDefinition<Id>[],
  text: string,
): Id[] {
  return definitions
    .filter((definition) => definition.probe.test(text))
    .map((definition) => definition.id)
    .sort((a, b) => a.localeCompare(b));
}

function sanitizeLine(line: string): string {
  return removeReminderAndQuotes(line).replace(/\s+/g, ' ').trim();
}

function effectText(line: string): string {
  const colonIndex = line.indexOf(':');
  if (colonIndex < 0) {
    return line;
  }

  const left = line.slice(0, colonIndex).trim();
  if (!isCostLikeActivatedPrefix(left)) {
    return line;
  }
  return line.slice(colonIndex + 1).trim();
}

function isActivatedAbilityLine(line: string): boolean {
  const colonIndex = line.indexOf(':');
  if (colonIndex < 0) {
    return false;
  }

  return isCostLikeActivatedPrefix(line.slice(0, colonIndex).trim());
}

function isCostLikeActivatedPrefix(left: string): boolean {
  if (left === '') {
    return false;
  }
  if (/\{T\}/i.test(left) || /\{[^}]+\}/.test(left)) {
    return true;
  }
  return /^(?:Sacrifice|Discard|Pay|Tap|Exile|Remove)\b\s+.+/i.test(left);
}
