#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const sources = [
  ['research/archive/document-reset-2026-08/original-acceptance.md', 'acceptance'],
  ['research/archive/document-reset-2026-08/original-engine-spec.md', 'engine-spec'],
];

const clauseTargets = {
  state: ['ENG-STATE-001'],
  immutable: ['ENG-STATE-001', 'ENG-STATE-002'],
  identity: ['ENG-STATE-003'],
  snapshot: ['ENG-STATE-004'],
  undo: ['ENG-STATE-004', 'ENG-CMD-003'],
  command: ['ENG-CMD-001', 'ENG-CMD-002'],
  transaction: ['ENG-CMD-003'],
  guided: ['ENG-CMD-004', 'ENG-COMP-002'],
  zone: ['ENG-ZONES-001', 'ENG-ZONES-002'],
  lki: ['ENG-ZONES-004'],
  event: ['ENG-ZONES-003'],
  turn: ['ENG-TURN-001'],
  phase: ['ENG-TURN-001'],
  priority: ['ENG-TURN-002'],
  apnap: ['ENG-TURN-002'],
  stack: ['ENG-TURN-002'],
  draw: ['ENG-TURN-003'],
  untap: ['ENG-TURN-003'],
  cleanup: ['ENG-TURN-003'],
  pending: ['ENG-TURN-004'],
  choice: ['ENG-TURN-004'],
  mana: ['ENG-MANA-001'],
  payment: ['ENG-MANA-002'],
  cost: ['ENG-MANA-001'],
  compiler: ['ENG-COMP-001', 'ENG-COMP-002'],
  oracle: ['ENG-COMP-001'],
  printedtext: ['ENG-COMP-001'],
  player: ['ENG-MP-001', 'ENG-MP-002'],
  opponent: ['ENG-MP-003'],
  multiplayer: ['ENG-MP-001'],
  responsive: ['UI-RESP-001'],
  viewport: ['UI-RESP-001'],
  visual: ['UI-VIS-001'],
  audio: ['AV-001'],
  motion: ['AV-002'],
  sfx: ['AV-001'],
};

function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function itemType(sourceKind, line) {
  const trimmed = line.trim();
  if (/^#{1,6}\s/.test(trimmed)) return 'heading';
  if (/^\s*\|/.test(line) && !/^\s*\|\s*:?-{2,}/.test(line)) return 'table-row';
  if (/完了条件|completion condition|done when/i.test(line)) return 'completion-condition';
  if (sourceKind === 'acceptance' || /受け入れ|acceptance|合否|pass\/fail/i.test(line)) return 'acceptance-condition';
  return 'normative-statement';
}

function tokensFor(text) {
  return [...text.toLocaleLowerCase('en-US').matchAll(/[a-z][a-z0-9-]*/g)].map((match) => match[0]);
}

function targetFor(sourceKind, text) {
  const tokens = new Set(tokensFor(text.replaceAll('GameState', 'state').replaceAll('GameCommand', 'command')));
  if (sourceKind === 'acceptance') {
    if (tokens.has('turn') || tokens.has('draw') || tokens.has('phase')) return ['ACC-TURN-001'];
    if (tokens.has('zone') || tokens.has('lki')) return ['ACC-ZONE-001'];
    if (tokens.has('stack') || tokens.has('priority')) return ['ACC-STACK-001'];
    if (tokens.has('mana') || tokens.has('payment')) return ['ACC-MANA-001'];
    if (tokens.has('oracle') || tokens.has('compiler')) return ['ACC-COMPILER-001'];
    if (tokens.has('ui') || tokens.has('viewport')) return ['ACC-UI-RESP-001'];
    if (tokens.has('audio') || tokens.has('motion')) return ['ACC-AV-MANUAL-001'];
    if (tokens.has('online') || tokens.has('scryfall')) return ['ACC-ONLINE-001'];
    return ['ACC-CR-REPLAY-001'];
  }
  const ordered = [
    'printedtext', 'compiler', 'oracle', 'guided', 'immutable', 'identity', 'snapshot', 'undo',
    'command', 'transaction', 'lki', 'zone', 'event', 'priority', 'apnap', 'stack', 'pending',
    'choice', 'draw', 'untap', 'cleanup', 'phase', 'turn', 'mana', 'payment', 'cost', 'player',
    'opponent', 'multiplayer', 'responsive', 'viewport', 'visual', 'audio', 'motion', 'sfx', 'state',
  ];
  for (const token of ordered) if (tokens.has(token) && clauseTargets[token]) return clauseTargets[token];
  return [];
}

function dispositionFor({ sourceKind, type, text, targets }) {
  if (sourceKind === 'acceptance' && targets.length > 0) return { disposition: 'active-acceptance', rationale: 'Acceptance item is retained as an explicit scenario-level behavior and linked to the current acceptance registry.' };
  if (targets.length > 0) return { disposition: 'active-clause', rationale: 'Normative item is retained as current behavior and linked to the current active clause registry.' };
  if (/obsolete|superseded|historical|retired|release evidence/i.test(text) && type === 'heading') return { disposition: 'archived-historical', rationale: 'This heading explicitly labels historical or superseded material; no current behavior is inferred from it.' };
  return { disposition: 'deferred-needs-decision', rationale: 'The legacy item has no unambiguous current clause or acceptance target; preserve it pending explicit judge decision.' };
}

function extract(sourcePath, sourceKind) {
  const text = readFileSync(join(root, sourcePath), 'utf8');
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*\|\s*:?-{2,}/.test(line)) continue;
    const type = itemType(sourceKind, line);
    const trimmed = line.trim();
    const looksNormative = /^#{1,6}\s/.test(trimmed)
      || /^\s*\|/.test(line)
      || /^\s*(?:\d+[.)]|[A-Z][0-9]+[.)])\s/.test(line)
      || /MUST(?: NOT)?|SHALL|SHOULD|契約|完了条件|受け入れ|acceptance|pass\/fail|done when|invariant|不変|例外|precondition|oracle|manual/i.test(line);
    if (!looksNormative) continue;
    const sourceText = line;
    const targets = targetFor(sourceKind, sourceText);
    const disposition = dispositionFor({ sourceKind, type, text: sourceText, targets });
    items.push({
      legacyItemId: `LEGACY-${sourceKind === 'acceptance' ? 'ACC' : 'ENG'}-${String(items.length + 1).padStart(4, '0')}`,
      sourcePath,
      sourceAnchor: { lineStart: index + 1, lineEnd: index + 1 },
      itemType: type,
      sourceText,
      textHash: hashText(sourceText),
      summary: sourceText.trim().slice(0, 240),
      disposition: disposition.disposition,
      targetIds: targets,
      rationale: disposition.rationale,
    });
  }
  return items;
}

const items = sources.flatMap(([sourcePath, sourceKind]) => extract(sourcePath, sourceKind));
const outputPath = join(root, 'research/archive/document-reset-2026-08/legacy-contract-inventory.json');
writeFileSync(outputPath, `${JSON.stringify({ schemaVersion: 1, sources: sources.map(([sourcePath]) => sourcePath), items }, null, 2)}\n`);
console.log(`generated ${items.length} legacy inventory items at ${outputPath}`);
