import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const REPORT_PATH = resolve(process.cwd(), 'research/classifier-parity/report.json');
const OUTPUT_PATH = resolve(process.cwd(), 'research/classifier-parity/reconciliation.md');
const EXPECTED_CARD_COUNT = 225;

type Direction = 'research-only' | 'runtime-only';
type DraftAttribution =
  | 'runtime-FP'
  | 'runtime-FN'
  | 'research-FP'
  | 'research-FN'
  | 'granularity-allowance';
type ClusterKey =
  | 'cast|runtime-only'
  | 'enters|research-only'
  | 'dies|runtime-only'
  | 'attacks|runtime-only'
  | 'enters|runtime-only'
  | 'dies|research-only'
  | 'leaves|runtime-only'
  | 'attacks|research-only'
  | 'draw|mixed';

interface ReportMismatch {
  eventFamily: string;
  direction: Direction;
}

interface ReportCard {
  oracleId: string;
  name: string;
  mismatches: ReportMismatch[];
}

interface ReportPayload {
  generatedAt?: string;
  mismatches: ReportCard[];
}

interface ClusterAnalysis {
  clusterKey: ClusterKey;
  governingCR: string;
  draftAttribution: DraftAttribution;
  rationale: string;
  proposedFix: string;
}

interface ReconciliationCard extends ReportCard {
  oracleText: string;
}

const CLUSTER_ORDER: readonly ClusterKey[] = [
  'cast|runtime-only',
  'enters|research-only',
  'dies|runtime-only',
  'attacks|runtime-only',
  'enters|runtime-only',
  'dies|research-only',
  'leaves|runtime-only',
  'attacks|research-only',
  'draw|mixed',
];

// Fable 裁定前の草稿。分類器の変更は proposedFix に記録するだけで、この CLI は適用しない。
const CLUSTER_ANALYSIS: Record<ClusterKey, ClusterAnalysis> = {
  'cast|runtime-only': {
    clusterKey: 'cast|runtime-only',
    governingCR:
      'CR 603.1: “Triggered abilities have a trigger condition and an effect.” CR 601.2i: casting完了後に cast 誘発が誘発する。',
    draftAttribution: 'granularity-allowance',
    rationale:
      '真の埋め込み/遅延 cast 誘発（“When you next cast ...”）と、別誘発の効果や mana-spent 条件内に cast が現れるだけのカードが混在する。族の有無だけでは単一帰属にできない。',
    proposedFix:
      '裁定後、runtime の cast 検出を構文解析済み trigger condition と単なる効果/参照文へ分離し、research は bullet・threshold・埋め込み遅延誘発の接頭辞を認識する。',
  },
  'enters|research-only': {
    clusterKey: 'enters|research-only',
    governingCR:
      'CR 603.6a: ETB能力は “When [this object] enters” / “Whenever a [type] enters” と書かれ、各 entry event に一致する誘発を確認する。',
    draftAttribution: 'runtime-FN',
    rationale:
      '代表文は “one or more tokens ... enter”、 “other Elves ... enter”、 “enter or attack” など有効な watcher 条件。runtime が複数主語・修飾語・列挙条件を狭く扱っている候補。',
    proposedFix:
      'runtime ETB の trigger condition を構造的に解析し、複数形・修飾付き watcher・列挙条件を追加する。CR 603.6d の static “enters with/as/tapped” は除外する。',
  },
  'dies|runtime-only': {
    clusterKey: 'dies|runtime-only',
    governingCR:
      'CR 700.4: dies は “is put into a graveyard from the battlefield”。CR 603.7: 解決中に作られる delayed trigger も when/whenever/at を含む。',
    draftAttribution: 'research-FN',
    rationale:
      '“When that creature dies this turn” などの真の遅延誘発や、mode/bullet/attraction 接頭辞の後にある死亡誘発が多数。research の行頭前提で落ちる候補。',
    proposedFix:
      'research が文境界の delayed trigger と bullet・room・saga・attraction・threshold 接頭辞を正規化して解析する。効果文だけの runtime-FP は別途 per-card 裁定する。',
  },
  'attacks|runtime-only': {
    clusterKey: 'attacks|runtime-only',
    governingCR:
      'CR 508.1m: attacker 宣言で該当能力が誘発する。CR 508.3a–d: “attacks” / “is attacked” / player attacks の各条件を定義する。',
    draftAttribution: 'research-FN',
    rationale:
      'mode bullet、loyalty effect、station threshold、duration 文の後ろに実在する attack trigger が代表例。意味上は攻撃イベントだが research の ability line 先頭に来ない。',
    proposedFix:
      'research の非標準接頭辞を正規化し、文境界の trigger clause を解析する。CR 508.4 の「attacking だが attacked ではない」ケースは区別する。',
  },
  'enters|runtime-only': {
    clusterKey: 'enters|runtime-only',
    governingCR:
      'CR 603.6a が ETB誘発を定義する一方、CR 603.6d は “enters with/as/tapped” を triggered ability ではなく static ability とする。',
    draftAttribution: 'granularity-allowance',
    rationale:
      '接頭辞で隠れた有効な ETB 誘発と、“enters tapped/with” や “if ... entered this turn” の static/replacement/履歴条件が混在する。enters 語だけでは裁定できない。',
    proposedFix:
      '裁定後、runtime ETB tag を解析済み trigger condition に限定し、CR 603.6d は別 concept へ分離する。真の誘発について research の接頭辞処理を拡張する。',
  },
  'dies|research-only': {
    clusterKey: 'dies|research-only',
    governingCR:
      'CR 700.4 が dies を定義し、CR 603.2c は一つの event に複数 occurrence がある場合の反復誘発を認める。',
    draftAttribution: 'runtime-FN',
    rationale:
      '“Whenever one or more creatures die” 型が一貫している。runtime の singular “dies” 中心のパターンが plural subject の verb “die” と修飾語を落とす候補。',
    proposedFix:
      'runtime death condition に die/dies、one-or-more、other、attacking、token、controller/opponent 修飾を追加し、効果文の die 言及とは分離する。',
  },
  'leaves|runtime-only': {
    clusterKey: 'leaves|runtime-only',
    governingCR:
      'CR 603.6c が leaves-the-battlefield trigger と “from anywhere” の非該当を定義し、CR 603.10a が leaves trigger の look-back を定める。',
    draftAttribution: 'research-FN',
    rationale:
      '明示的 “leaves the battlefield” または battlefield-to-graveyard watcher が代表例。別文・mode 接頭辞・固有名の後ろに埋め込まれ、research の行頭解析で落ちる候補。',
    proposedFix:
      'research が埋め込み explicit-leaves と CR 603.6c の noncreature battlefield-to-graveyard を解析する。“from anywhere” は除外を維持する。',
  },
  'attacks|research-only': {
    clusterKey: 'attacks|research-only',
    governingCR:
      'CR 508.3b: “Whenever [a player/permanent] is attacked” は attacker 宣言で誘発する。CR 508.3d は “Whenever [a player] attacks” を定義する。',
    draftAttribution: 'runtime-FN',
    rationale:
      'Curse 系の passive “enchanted player is attacked” と “opponents are attacked” を runtime が未対応。Mr. Foxglove は省略名の句点に対する正規表現の脆弱性候補。',
    proposedFix:
      'runtime attack condition に passive attacked-subject と句読点を含むカード名を追加し、CR 508.4 の attacking/attacked 差は維持する。',
  },
  'draw|mixed': {
    clusterKey: 'draw|mixed',
    governingCR:
      'CR 121.1 が draw を定義し、CR 121.5 は “draw” を使わない hand 移動を draw でないとする。CR 603.1 は trigger condition を要求する。',
    draftAttribution: 'granularity-allowance',
    rationale:
      'Trouble in Pairs は comma 列挙の “draws their second card” を runtime が落とし、Starving Revenant は接頭辞付きの真の “Whenever you draw a card” を research が落とす。逆方向の parser boundary 問題。',
    proposedFix:
      'runtime は comma 列挙条件、research は数字を含む ability-word 接頭辞を処理する。単に draw を指示する action text と draw trigger condition は分離する。',
  },
};

async function main(): Promise<void> {
  const [snapshotPayload, reportPayload] = await Promise.all([
    readJson(INPUT_PATH),
    readJson(REPORT_PATH),
  ]);
  const rawCards = extractRawCards(snapshotPayload);
  const report = parseReport(reportPayload);
  if (report.mismatches.length !== EXPECTED_CARD_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CARD_COUNT} mismatch cards, got ${report.mismatches.length}.`,
    );
  }

  const oracleTextById = buildOracleTextMap(rawCards);
  const joinedCards = report.mismatches.map((card) => joinOracleText(card, oracleTextById));
  const clusters = groupCards(joinedCards);
  const markdown = renderMarkdown(report, clusters);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, markdown, 'utf8');

  console.log(`Parity reconciliation written: ${relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(
    `cards=${joinedCards.length} clusters=${CLUSTER_ORDER.length} assigned=${sumClusterCards(clusters)}`,
  );
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function extractRawCards(payload: unknown): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.cards)) {
    throw new Error('Snapshot JSON must be an object with a cards array.');
  }
  return payload.cards;
}

function parseReport(payload: unknown): ReportPayload {
  if (!isRecord(payload) || !Array.isArray(payload.mismatches)) {
    throw new Error('Parity report JSON must contain a mismatches array.');
  }
  return {
    generatedAt:
      typeof payload.generatedAt === 'string' ? payload.generatedAt : undefined,
    mismatches: payload.mismatches.map((value, index) => parseReportCard(value, index)),
  };
}

function parseReportCard(value: unknown, index: number): ReportCard {
  if (!isRecord(value)) {
    throw new Error(`Invalid report card at index ${index}.`);
  }
  const oracleId = readRequiredString(value, 'oracleId', `report card ${index}`);
  const name = readRequiredString(value, 'name', `report card ${index}`);
  if (!Array.isArray(value.mismatches) || value.mismatches.length === 0) {
    throw new Error(`Report card ${name} must contain mismatches.`);
  }
  return {
    oracleId,
    name,
    mismatches: value.mismatches.map((mismatch, mismatchIndex) =>
      parseMismatch(mismatch, `${name} mismatch ${mismatchIndex}`),
    ),
  };
}

function parseMismatch(value: unknown, context: string): ReportMismatch {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${context}.`);
  }
  const eventFamily = readRequiredString(value, 'eventFamily', context);
  const direction = readRequiredString(value, 'direction', context);
  if (direction !== 'research-only' && direction !== 'runtime-only') {
    throw new Error(`Invalid direction in ${context}: ${direction}`);
  }
  return { eventFamily, direction };
}

function buildOracleTextMap(rawCards: readonly unknown[]): Map<string, string> {
  const oracleTextById = new Map<string, string>();

  for (const [index, rawCard] of rawCards.entries()) {
    if (!isRecord(rawCard)) {
      throw new Error(`Invalid Scryfall card at snapshot index ${index}.`);
    }
    const rawId = readRequiredString(rawCard, 'id', `snapshot card ${index}`);
    const def = mapScryfallCardToCardDef(rawCard as unknown as ScryfallCard);
    const oracleText = def.faces
      .map((face) => face.oracleText?.trim())
      .filter((text): text is string => Boolean(text))
      .join('\n//\n');

    // raw id と CardDef oracle id の双方を登録する。現 report.json は後者で join される。
    oracleTextById.set(rawId, oracleText);
    oracleTextById.set(def.oracleId, oracleText);
  }

  return oracleTextById;
}

function joinOracleText(
  card: ReportCard,
  oracleTextById: ReadonlyMap<string, string>,
): ReconciliationCard {
  const oracleText = oracleTextById.get(card.oracleId);
  if (oracleText === undefined) {
    throw new Error(`Snapshot join failed: ${card.oracleId} — ${card.name}`);
  }
  return { ...card, oracleText };
}

function groupCards(
  cards: readonly ReconciliationCard[],
): Map<ClusterKey, ReconciliationCard[]> {
  const clusters = new Map<ClusterKey, ReconciliationCard[]>(
    CLUSTER_ORDER.map(
      (clusterKey): [ClusterKey, ReconciliationCard[]] => [clusterKey, []],
    ),
  );

  for (const card of cards) {
    const primaryMismatch = card.mismatches[0];
    if (!primaryMismatch) {
      throw new Error(`No mismatch available for ${card.name}.`);
    }
    clusters.get(clusterKeyFor(primaryMismatch))?.push(card);
  }

  const assigned = sumClusterCards(clusters);
  if (assigned !== cards.length) {
    throw new Error(`Cluster assignment mismatch: assigned=${assigned}, cards=${cards.length}`);
  }
  if ([...clusters.values()].some((clusterCards) => clusterCards.length === 0)) {
    throw new Error('All nine reconciliation clusters must be non-empty.');
  }
  return clusters;
}

function clusterKeyFor(mismatch: ReportMismatch): ClusterKey {
  if (mismatch.eventFamily === 'draw') {
    return 'draw|mixed';
  }
  const clusterKey = `${mismatch.eventFamily}|${mismatch.direction}`;
  if (isClusterKey(clusterKey)) {
    return clusterKey;
  }
  throw new Error(`No reconciliation cluster for ${clusterKey}.`);
}

function isClusterKey(value: string): value is ClusterKey {
  return (CLUSTER_ORDER as readonly string[]).includes(value);
}

function renderMarkdown(
  report: ReportPayload,
  clusters: ReadonlyMap<ClusterKey, readonly ReconciliationCard[]>,
): string {
  const assigned = sumClusterCards(clusters);
  const mismatchComparisons = report.mismatches.reduce(
    (total, card) => total + card.mismatches.length,
    0,
  );
  const lines = [
    '# Parity 和解ワークシート（草稿・判定なし）',
    '',
    '> Codex による Fable 裁定用の草稿。どちらの分類器が正しいかは確定せず、分類器も変更しない。',
    '',
    '## 入力と分類方法',
    '',
    `- parity report: \`${relative(process.cwd(), REPORT_PATH)}\``,
    `- Scryfall snapshot: \`${relative(process.cwd(), INPUT_PATH)}\``,
    `- report generated: ${report.generatedAt ?? 'unknown'}`,
    `- report mismatch cards: ${report.mismatches.length}`,
    '- snapshot join failures: 0',
    `- mismatch comparison records represented: ${mismatchComparisons}`,
    '- 一意配属規則: 各カードを report 内の先頭 mismatch へ1回だけ配属する。draw の両方向は mixed 1クラスタへ統合する。複数族カードの全 mismatch key は各行へ残す。',
    '',
    '## クラスタ一覧',
    '',
    '| Cluster | Assigned cards | Draft attribution | Governing CR |',
    '| --- | ---: | --- | --- |',
    ...CLUSTER_ORDER.map((clusterKey) => {
      const analysis = CLUSTER_ANALYSIS[clusterKey];
      const count = clusters.get(clusterKey)?.length ?? 0;
      return `| ${cell(clusterKey)} | ${count} | \`${analysis.draftAttribution}\` | ${cell(analysis.governingCR)} |`;
    }),
    '',
  ];

  for (const clusterKey of CLUSTER_ORDER) {
    const cards = clusters.get(clusterKey) ?? [];
    const analysis = CLUSTER_ANALYSIS[clusterKey];
    lines.push(
      `## ${clusterKey} (${cards.length} cards)`,
      '',
      `- Governing CR: ${analysis.governingCR}`,
      `- Draft attribution: \`${analysis.draftAttribution}\``,
      `- Rationale: ${analysis.rationale}`,
      `- Proposed fix (not applied): ${analysis.proposedFix}`,
      '',
      '| Oracle ID | Name | All mismatch keys | Relevant Oracle text |',
      '| --- | --- | --- | --- |',
      ...cards.map(renderCardRow),
      '',
    );
  }

  lines.push(
    '## 225枚の完全性検算',
    '',
    '| Cluster | Assigned cards |',
    '| --- | ---: |',
    ...CLUSTER_ORDER.map((clusterKey) => {
      const count = clusters.get(clusterKey)?.length ?? 0;
      return `| \`${clusterKey}\` | ${count} |`;
    }),
    `| **Total** | **${assigned}** |`,
    '',
    `検算結果: クラスタ合計 = ${assigned}。${assigned} assigned cards = ${report.mismatches.length} report mismatch cards。全225枚が9クラスタへ重複なく分類された。`,
    '',
  );
  return `${lines.join('\n')}\n`;
}

function renderCardRow(card: ReconciliationCard): string {
  const mismatchKeys = card.mismatches
    .map((mismatch) => `${mismatch.eventFamily}|${mismatch.direction}`)
    .join(', ');
  const families = new Set(card.mismatches.map((mismatch) => mismatch.eventFamily));
  return `| \`${card.oracleId}\` | ${cell(card.name)} | ${cell(mismatchKeys)} | ${cell(relevantExcerpt(card.oracleText, families))} |`;
}

function relevantExcerpt(oracleText: string, families: ReadonlySet<string>): string {
  const segments = oracleText
    .split('\n')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const matching = segments.filter((segment) =>
    [...families].some((family) => familyPattern(family).test(segment)),
  );
  return (matching.length > 0 ? matching : segments).slice(0, 2).join(' / ');
}

function familyPattern(family: string): RegExp {
  switch (family) {
    case 'cast':
      return /\b(?:cast|casts|spell)\b/i;
    case 'enters':
      return /\b(?:enter|enters|entered|landfall)\b/i;
    case 'dies':
      return /\b(?:die|dies)\b|graveyard from the battlefield/i;
    case 'attacks':
      return /\b(?:attack|attacks|attacked|attacking)\b/i;
    case 'leaves':
      return /\b(?:leave|leaves|left)\b|graveyard from the battlefield/i;
    case 'draw':
      return /\b(?:draw|draws|drew)\b/i;
    default:
      return new RegExp(`\\b${escapeRegExp(family)}\\b`, 'i');
  }
}

function sumClusterCards(
  clusters: ReadonlyMap<ClusterKey, readonly ReconciliationCard[]>,
): number {
  return [...clusters.values()].reduce((total, cards) => total + cards.length, 0);
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const field = value[key];
  if (typeof field !== 'string' || field === '') {
    throw new Error(`Missing ${key} in ${context}.`);
  }
  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' / ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
