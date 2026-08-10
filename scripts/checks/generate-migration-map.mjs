#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const archive = join(root, 'research/archive/document-reset-2026-08');
const output = join(archive, 'migration-map.json');

function headings(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((heading) => heading.trim());
}

function engineDestination(heading) {
  const lower = heading.toLowerCase();
  if (/state|状態|型定義|不変/.test(lower)) return 'docs/contracts/engine/state-and-invariants.md';
  if (/command|コマンド|transaction|取引/.test(lower)) return 'docs/contracts/engine/commands-and-transactions.md';
  if (/zone|領域|event|イベント|lki/.test(lower)) return 'docs/contracts/engine/zones-events-and-lki.md';
  if (/turn|phase|priority|stack|ターン|フェイズ|優先権|スタック/.test(lower)) return 'docs/contracts/engine/turn-priority-and-stack.md';
  if (/mana|マナ|cost|コスト|payment|支払/.test(lower)) return 'docs/contracts/engine/mana-costs-and-payment.md';
  if (/multiplayer|player|多人|対戦相手|プレイヤー/.test(lower)) return 'docs/contracts/engine/multiplayer.md';
  if (/compiler|grammar|oracle|文法|コンパイラ/.test(lower)) return 'docs/contracts/engine/oracle-compiler.md';
  return 'research/archive/document-reset-2026-08/original-engine-spec.md';
}

function classify(source, heading) {
  if (source.includes('acceptance')) {
    if (/AV|オーディオ|音|体感|モバイル|UI|実機/.test(heading)) return 'active manual scenario';
    if (/G[1-9]|CRG|G[2-9]|自動|コンパイラ|コスト|検証/.test(heading)) return 'active automated scenario';
    if (/前提|シナリオ/.test(heading)) return 'active manual scenario';
    return 'historical release evidence';
  }
  if (/追補|完了条件|監査|位置づけ|改訂|実装/.test(heading)) return 'historical release evidence';
  if (engineDestination(heading).startsWith('docs/')) return 'active automated scenario';
  return 'historical release evidence';
}

function mapSource(source, archiveName) {
  const path = join(archive, archiveName);
  return headings(path).map((heading, index) => ({
    source,
    ordinal: index + 1,
    heading,
    classification: classify(source, heading),
    destination: source.includes('acceptance')
      ? (/AV|オーディオ|音|体感|モバイル|UI|実機|G[1-9]|CRG|UX-MANA|シナリオ/.test(heading)
        ? 'docs/acceptance/scenarios.json'
        : `research/archive/document-reset-2026-08/${archiveName}`)
      : engineDestination(heading),
  }));
}

function legacyIds() {
  const text = readFileSync(join(archive, 'original-acceptance.md'), 'utf8');
  const ids = text.match(/\b(?:UX-MANA|UX-TRIGGER|UX-ABILITY|UX-LANGUAGE|UXF|ACT3)-\d+\b/g) ?? [];
  return [...new Set(ids)].sort();
}

export function renderMigrationMap() {
  if (!existsSync(join(archive, 'original-acceptance.md')) || !existsSync(join(archive, 'original-engine-spec.md'))) {
    throw new Error('original acceptance/engine-spec archives are required');
  }
  return {
    milestone: 'DOC-GOV-RESET-2026-08',
    legacyIds: legacyIds().map((id) => ({ id, source: 'research/archive/document-reset-2026-08/original-acceptance.md' })),
    sources: [
      ...mapSource('research/archive/document-reset-2026-08/original-acceptance.md', 'original-acceptance.md'),
      ...mapSource('research/archive/document-reset-2026-08/original-engine-spec.md', 'original-engine-spec.md'),
    ],
  };
}

function run() {
  writeFileSync(output, `${JSON.stringify(renderMigrationMap(), null, 2)}\n`);
  console.log(`Wrote research/archive/document-reset-2026-08/migration-map.json`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) run();
