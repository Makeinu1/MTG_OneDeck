// M-GATE-2 step1: parity 和解ワークシート草稿の生成器(契約 = docs/engine-spec.md §34.7.3)。
// research/classifier-parity/report.json の per-card 不一致(225枚/233 比較)を族×方向クラスタへ束ね、
// snapshot から oracleText を join し、各クラスタへ Fable 裁定用の「草稿帰属 + 統べる CR 条文」を添える。
//
// 重要: CLUSTER_ANALYSIS は **草稿**(judgment ではない)。最終帰属はクラスタ単位で Fable が CR を引いて裁定する
// (method §3 = CR 一次権威)。本器は分類器コードを一切変更しない(計測・整理専用)。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import { mapScryfallCardToCardDef, type ScryfallCard } from '../src/data/scryfall';

const REPORT_PATH = resolve(process.cwd(), 'research/classifier-parity/report.json');
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OUT_PATH = resolve(process.cwd(), 'research/classifier-parity/reconciliation.md');

type Attribution =
  | 'runtime-FP'
  | 'runtime-FN'
  | 'research-FP'
  | 'research-FN'
  | 'granularity-allowance'
  | 'undecided';

interface ClusterAnalysis {
  governingCR: string;
  draftAttribution: Attribution;
  rationale: string;
  proposedFix: string;
}

// 草稿(Fable が per-card で覆しうる)。CR 条文は rule/Magic_The_Gathering_Comprehensive_Rules.txt 由来。
const CLUSTER_ANALYSIS: Record<string, ClusterAnalysis> = {
  'cast|runtime-only': {
    governingCR: 'CR 603.2 / 603.3(誘発条件)・608(解決)',
    draftAttribution: 'runtime-FP',
    rationale:
      'runtime が "cast" の語(`spent to cast`・装備/呪文文中の cast 言及)で trigger.cast を過剰検出している疑い。研究 eventClassify は「Whenever ... cast(s) a spell」型の cast 誘発のみを族 cast とする。',
    proposedFix:
      'runtime trigger.cast を「Whenever <player> cast(s) ...」の cast 誘発へ限定し、mana-spent 反射誘発・非誘発の cast 言及を除外(per-card 確認後)。',
  },
  'enters|research-only': {
    governingCR: 'CR 603.2 / 603.6e(ETB 誘発)・603.10',
    draftAttribution: 'runtime-FN',
    rationale:
      '「Whenever another creature enters under your control」型 ETB watcher を runtime が取りこぼしている疑い(研究は enters 族として検出)。',
    proposedFix: 'runtime etb-other 検出を「another ... enters (under your control)」へ拡張(per-card 確認後)。',
  },
  'dies|runtime-only': {
    governingCR: 'CR 700.4(dies=creature/PW 限定)・603.6c',
    draftAttribution: 'runtime-FP',
    rationale:
      'runtime が dies を過剰検出している疑い(置換「would die」や非 creature の戦場→墓地を死亡として拾う)。',
    proposedFix: '「would die」置換を除外し主語を creature/PW へ限定(trigger.leaves との弁別=Slice2/iter3 裁定の runtime ミラー)。',
  },
  'attacks|runtime-only': {
    governingCR: 'CR 508(攻撃クリーチャー指定)・603.3',
    draftAttribution: 'runtime-FP',
    rationale: 'runtime が attacks を過剰検出している疑い(攻撃誘発でない attack 言及を拾う)。',
    proposedFix: 'runtime trigger.attack を「Whenever <creature> attacks」型へ限定(per-card 確認後)。',
  },
  'enters|runtime-only': {
    governingCR: 'CR 603.6e(ETB 誘発)',
    draftAttribution: 'runtime-FP',
    rationale: 'runtime が enters を過剰検出している疑い(自己 ETB でない enters 言及)。研究との境界を要確認。',
    proposedFix: 'runtime etb/etb-other の発火条件を CR 603.6e に合わせ精密化(per-card 確認後)。',
  },
  'dies|research-only': {
    governingCR: 'CR 700.4・603.2(複数主語「one or more ... die」)',
    draftAttribution: 'runtime-FN',
    rationale:
      '「Whenever one or more other creatures die」型を runtime が取りこぼす疑い(研究は dies 族・iter2 で複数形を閉鎖済み。Morbid Opportunist 等)。',
    proposedFix: 'runtime death-other 検出を複数形「one or more (other) creatures die」へ拡張(per-card 確認後)。',
  },
  'leaves|runtime-only': {
    governingCR: 'CR 603.6c(leaves-the-battlefield 誘発)・700.4',
    draftAttribution: 'undecided',
    rationale:
      'runtime は trigger.leaves を持つが研究 leaves が未検出の対。新設 trigger.leaves の境界差(延長誘発の構文粒度差=許容差 候補)か研究 FN かを per-card で弁別する。',
    proposedFix: '研究 leaves と runtime trigger.leaves の境界を突合し、粒度差なら allowance(CR 引用付き)・取りこぼしなら研究側を拡張。',
  },
  'attacks|research-only': {
    governingCR: 'CR 508・802(攻撃される=is attacked)',
    draftAttribution: 'runtime-FN',
    rationale:
      '「Whenever enchanted player is attacked」型(Curse 系)を runtime が取りこぼす疑い(研究は受動 is-attacked を attacks 族へ・Curse of Opulence 等)。',
    proposedFix: 'runtime attack 検出を受動「is attacked」へ拡張(per-card 確認後)。',
  },
  'draw|research-only': {
    governingCR: 'CR 603.2・120(draw)',
    draftAttribution: 'undecided',
    rationale: '単発(Trouble in Pairs)。複合誘発の draw 条件の取りこぼし候補。per-card 確認。',
    proposedFix: 'oracleText を精査し研究/runtime いずれの境界かを裁定。',
  },
  'draw|runtime-only': {
    governingCR: 'CR 603.2・120(draw)',
    draftAttribution: 'undecided',
    rationale: '単発(Starving Revenant)。runtime の draw 誘発過剰 or 研究取りこぼし候補。per-card 確認。',
    proposedFix: 'oracleText を精査し裁定。',
  },
};

interface ParityComparison {
  eventFamily: string;
  direction: string;
}

interface ParityMismatchCard {
  oracleId: string;
  name: string;
  edhrecRank?: number;
  mismatches: ParityComparison[];
}

interface ParityReport {
  mismatches: ParityMismatchCard[];
}

interface ClusterRow {
  oracleId: string;
  name: string;
  oracleText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function coerceScryfallCard(value: unknown): ScryfallCard | undefined {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string') {
    return value as unknown as ScryfallCard;
  }
  return undefined;
}

async function buildOracleTextMap(): Promise<Map<string, string>> {
  const payload = await readJson(SNAPSHOT_PATH);
  const cards = isRecord(payload) && Array.isArray(payload.cards) ? payload.cards : [];
  const map = new Map<string, string>();
  for (const raw of cards) {
    const card = coerceScryfallCard(raw);
    if (!card) continue;
    try {
      const def = mapScryfallCardToCardDef(card);
      // oracleText は CardDef.faces[].oracleText に入る(top-level oracleText は未設定)。
      // join キーは def.oracleId(= Scryfall oracle_id ?? id。parity report の oracleId と一致)。
      const text = def.faces
        .map((face) => face.oracleText ?? '')
        .filter((t) => t.length > 0)
        .join(' // ');
      map.set(def.oracleId, text);
    } catch {
      // マップ失敗カードはスキップ(join 失敗として後段で空文字)。
    }
  }
  return map;
}

function firstSentences(text: string, max: number): string {
  const flat = text.replace(/\n+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

async function main(): Promise<void> {
  const report = (await readJson(REPORT_PATH)) as ParityReport;
  const oracleMap = await buildOracleTextMap();

  // クラスタ(族|方向)→ 行。1カードが複数族で割れる場合は各クラスタへ計上(比較=233)。
  const clusters = new Map<string, ClusterRow[]>();
  const uniqueCards = new Set<string>();
  for (const card of report.mismatches) {
    uniqueCards.add(card.oracleId);
    const seen = new Set<string>();
    for (const mm of card.mismatches) {
      const key = `${mm.eventFamily}|${mm.direction}`;
      if (seen.has(key)) continue; // 同カード同クラスタの重複比較は1回
      seen.add(key);
      const rows = clusters.get(key) ?? [];
      rows.push({
        oracleId: card.oracleId,
        name: card.name,
        oracleText: oracleMap.get(card.oracleId) ?? '(oracleText join 失敗)',
      });
      clusters.set(key, rows);
    }
  }

  const orderedKeys = [...clusters.keys()].sort((a, b) => clusters.get(b)!.length - clusters.get(a)!.length);
  let totalRows = 0;

  const lines: string[] = [
    '# Parity 和解ワークシート(草稿・判定なし)',
    '',
    `生成: ${new Date().toISOString()} / 生成器: \`npm run parity-reconcile\``,
    '',
    '> 契約 = engine-spec §34.7.3。**本書は草稿**。`draftAttribution` は Codex/器の暫定見立てで、',
    '> 最終帰属はクラスタ単位で **Fable が CR(`rule/...txt`)を引いて裁定**する(method §3 = CR 一次権威)。',
    '> 裁定後に Codex が `ruleClassifier.ts`/`*Classify.ts`/`CLASSIFIER_PARITY_ALLOWANCES` を修正し parity を 0 へ。',
    '',
    '## クラスタ一覧',
    '',
    '| Cluster (family\\|direction) | 件数 | 草稿帰属 | 統べる CR |',
    '| --- | ---: | --- | --- |',
  ];
  for (const key of orderedKeys) {
    const rows = clusters.get(key)!;
    totalRows += rows.length;
    const a = CLUSTER_ANALYSIS[key];
    lines.push(
      `| ${escapeCell(key)} | ${rows.length} | ${a ? a.draftAttribution : 'undecided'} | ${a ? escapeCell(a.governingCR) : '(未登録)'} |`,
    );
  }
  lines.push(
    '',
    `**検算**: 比較行合計 = ${totalRows}(report.json mismatchedComparisons=233 と一致するはず)/ ユニークカード = ${uniqueCards.size}(divergentCards=225 と一致するはず)。`,
    '',
    '---',
    '',
  );

  for (const key of orderedKeys) {
    const rows = clusters.get(key)!;
    const a = CLUSTER_ANALYSIS[key];
    lines.push(`## ${key}(${rows.length}件)`, '');
    if (a) {
      lines.push(
        `- **統べる CR**: ${a.governingCR}`,
        `- **草稿帰属**: \`${a.draftAttribution}\``,
        `- **根拠(草稿)**: ${a.rationale}`,
        `- **提案する修正(草稿)**: ${a.proposedFix}`,
        '',
      );
    } else {
      lines.push('- **草稿未登録**(CLUSTER_ANALYSIS に追記要)', '');
    }
    lines.push('| oracleId | name | oracleText 抜粋 |', '| --- | --- | --- |');
    for (const row of rows) {
      lines.push(`| \`${row.oracleId}\` | ${escapeCell(row.name)} | ${escapeCell(firstSentences(row.oracleText, 180))} |`);
    }
    lines.push('');
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, lines.join('\n'), 'utf8');
  console.log(`Parity reconciliation worksheet written: ${relative(process.cwd(), OUT_PATH)}`);
  console.log(`clusters=${orderedKeys.length} comparisonRows=${totalRows} uniqueCards=${uniqueCards.size}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
