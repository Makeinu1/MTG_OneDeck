import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';
import type { CardDef } from '../src/types/card';
import {
  buildClassifierParityReport,
  CLASSIFIER_PARITY_ALLOWANCES,
  CLASSIFIER_PARITY_MAPPINGS,
  type CardClassifierParity,
  type ClassifierParityReport,
} from './lib/classifierParity.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_MD_PATH = resolve(process.cwd(), 'research/classifier-parity/report.md');
const REPORT_JSON_PATH = resolve(process.cwd(), 'research/classifier-parity/report.json');
const EXAMPLE_LIMIT = 30;

interface MappingFailure {
  index: number;
  cardName: string;
  reason: string;
}

async function main(): Promise<void> {
  const payload = await readJson(INPUT_PATH);
  const rawCards = extractRawCards(payload);
  const defs: CardDef[] = [];
  const mappingFailures: MappingFailure[] = [];

  for (const [index, rawCard] of rawCards.entries()) {
    const fallbackName = readStringField(rawCard, 'name') ?? `(index ${index})`;
    const scryfallCard = coerceScryfallCard(rawCard);
    if (!scryfallCard) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: 'Invalid Scryfall card shape',
      });
      continue;
    }
    try {
      defs.push(mapScryfallCardToCardDef(scryfallCard));
    } catch (error: unknown) {
      mappingFailures.push({
        index,
        cardName: fallbackName,
        reason: errorMessage(error),
      });
    }
  }

  const report = buildClassifierParityReport(defs);
  const generatedAt = new Date().toISOString();
  const reportJson = {
    generatedAt,
    inputPath: relative(process.cwd(), INPUT_PATH),
    rawCards: rawCards.length,
    mappedCards: defs.length,
    mappingFailures,
    mappings: CLASSIFIER_PARITY_MAPPINGS,
    allowances: CLASSIFIER_PARITY_ALLOWANCES,
    summary: report.summary,
    mismatches: report.mismatches,
  };

  await mkdir(dirname(REPORT_MD_PATH), { recursive: true });
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, 'utf8');
  await writeFile(
    REPORT_MD_PATH,
    renderMarkdown(generatedAt, rawCards.length, mappingFailures, report),
    'utf8',
  );

  console.log(`Classifier parity report written: ${relative(process.cwd(), REPORT_MD_PATH)}`);
  console.log(`Raw report written: ${relative(process.cwd(), REPORT_JSON_PATH)}`);
  console.log(
    `cards=${defs.length} comparable=${report.summary.comparableCards} divergent=${report.summary.divergentCards} cardRate=${percent(report.summary.cardDivergenceRate)}`,
  );
}

function renderMarkdown(
  generatedAt: string,
  rawCards: number,
  mappingFailures: readonly MappingFailure[],
  report: ClassifierParityReport,
): string {
  const summary = report.summary;
  const lines = [
    '# Classifier Parity Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Summary',
    '',
    `- Snapshot cards: ${rawCards}`,
    `- Mapped cards: ${summary.totalCards}`,
    `- Mapping failures: ${mappingFailures.length}`,
    `- Comparable cards: ${summary.comparableCards}`,
    `- Divergent cards: ${summary.divergentCards} (${percent(summary.cardDivergenceRate)})`,
    `- Comparable family checks: ${summary.comparisons}`,
    `- Mismatched family checks: ${summary.mismatchedComparisons} (${percent(summary.comparisonDivergenceRate)})`,
    `- Direction: research-only ${summary.researchOnlyComparisons}, runtime-only ${summary.runtimeOnlyComparisons}`,
    '',
    '## Mapping',
    '',
    '| Research EventFamily | Runtime RuleTag | Rationale |',
    '| --- | --- | --- |',
    ...CLASSIFIER_PARITY_MAPPINGS.map(
      (mapping) =>
        `| ${mapping.eventFamily} | ${mapping.runtimeTagIds.map((tagId) => `\`${tagId}\``).join(', ')} | ${cell(mapping.rationale)} |`,
    ),
    '',
    '## Allowed Differences',
    '',
    '| Axis | Research classifier | Runtime classifier | Rationale |',
    '| --- | --- | --- | --- |',
    ...CLASSIFIER_PARITY_ALLOWANCES.map(
      (allowance) =>
        `| ${cell(allowance.axis)} | ${cell(allowance.researchSide)} | ${cell(allowance.runtimeSide)} | ${cell(allowance.rationale)} |`,
    ),
    '',
    '## Per-family Divergence',
    '',
    '| Family | Checks | Mismatches | Rate | Research only | Runtime only |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...CLASSIFIER_PARITY_MAPPINGS.map((mapping) => {
      const item = summary.perFamily[mapping.eventFamily];
      return `| ${mapping.eventFamily} | ${item.comparisons} | ${item.mismatches} | ${percent(item.divergenceRate)} | ${item.researchOnly} | ${item.runtimeOnly} |`;
    }),
    '',
    `## Mismatch Examples (top ${EXAMPLE_LIMIT})`,
    '',
    '| Card | EDHREC rank | Direction/family | Research families | Runtime trigger tags |',
    '| --- | ---: | --- | --- | --- |',
    ...report.mismatches.slice(0, EXAMPLE_LIMIT).map(renderMismatchRow),
    '',
    '## All Mismatch Cards',
    '',
  ];

  if (report.mismatches.length === 0) {
    lines.push('- none', '');
  } else {
    for (const card of report.mismatches) {
      lines.push(
        `- ${card.oracleId} — 《${cell(card.name)}》 — ${mismatchSummary(card)}`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## Notes',
    '',
    '- Divergence is measured only for mapped event families; allowed axes are excluded from numerator and denominator.',
    '- A mapped family agrees when the research family presence equals the presence of any corresponding runtime tag.',
    '- `report.json` contains every card comparison and mismatch record for machine analysis.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function renderMismatchRow(card: CardClassifierParity): string {
  const rank = card.edhrecRank === undefined ? '-' : String(card.edhrecRank);
  const runtimeTriggers = card.runtimeTagIds.filter((tagId) => tagId.startsWith('trigger.'));
  return `| 《${cell(card.name)}》 | ${rank} | ${cell(mismatchSummary(card))} | ${cell(card.eventFamilies.join(', '))} | ${cell(runtimeTriggers.join(', '))} |`;
}

function mismatchSummary(card: CardClassifierParity): string {
  return card.mismatches
    .map((mismatch) => `${mismatch.direction}:${mismatch.eventFamily}`)
    .join(', ');
}

async function readJson(path: string): Promise<unknown> {
  const source = await readFile(path, 'utf8');
  return JSON.parse(source) as unknown;
}

function extractRawCards(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.cards)) return payload.cards;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new Error('Input JSON must be an array or an object with cards/data array.');
}

function coerceScryfallCard(value: unknown): ScryfallCard | undefined {
  return isRecord(value) ? (value as unknown as ScryfallCard) : undefined;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
