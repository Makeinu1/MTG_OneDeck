#!/usr/bin/env node
// 禁止ファイル走査の単一正本。npm run check:forbidden で起動する。
// 既定は worktree の変更(git status --short)、--diff <ref> で ref との差分を走査。
// DOC-GOV-RESET の judge lane は --policy governance-reset で承認済み統治領域だけを検査する。
// `review.` の裸の部分一致は CardPreview.tsx 等を誤検出する(ee45cf6 の教訓)。
// 一方 `Name.review.test.tsx`(ドット区切りの review テスト)も判定者専有ゆえ拾う必要がある。
// ゆえに境界を「行頭・パス区切り・ドット」に固定する: `.review.` は拾い、`Preview.`(直前が
// 英字)は拾わない。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// FORBIDDEN: 実装エージェントが変更してはならないファイル(検出時 exit 1)
const FORBIDDEN = [
  { re: /(^|\/|\.)review\./, why: 'review.* はレビュー担当(判定者)専有' },
  { re: /^CLAUDE\.md$/, why: 'CLAUDE.md は判定者専有' },
  { re: /^AGENTS\.md$/, why: 'AGENTS.md は判定者専有' },
  { re: /^eslint\.config\.js$/, why: 'lint 設定の変更は判定者承認が必要' },
];

// NEEDS-REAUTH: 判定者の独立再検証・再オーナー化が要る領域(情報表示のみ・exit 0)
const NEEDS_REAUTH = [
  { re: /^docs\//, why: '契約ドキュメント' },
  { re: /^research\//, why: '台帳・計測レーン' },
  { re: /^rule\//, why: 'CR 正本' },
  { re: /^src\/engine\//, why: 'エンジン(spec 契約対象)' },
  { re: /^package\.json$/, why: '依存・スクリプト定義' },
];

const GOVERNANCE_RESET_ALLOWED = [
  /^(?:AGENTS|CLAUDE|QWEN)\.md$/,
  /^README\.md$/,
  /^docs\/(?:README|acceptance|audio-visual-contract|design-system|design-vision|engine-spec|ui-architecture-v2)\.md$/,
  /^docs\/acceptance\/scenarios\.json$/,
  /^docs\/contracts\/manifest\.json$/,
  /^docs\/contracts\/engine\/(?:commands-and-transactions|mana-costs-and-payment|multiplayer|oracle-compiler|state-and-invariants|turn-priority-and-stack|zones-events-and-lki)\.md$/,
  /^docs\/contracts\/ui\/(?:architecture|audio-visual|design-principles|responsive|visual-language)\.md$/,
  /^docs\/decisions\/(?:DOC-GOV-RESET-2026-08|audio-visual-contract)\.md$/,
  /^docs\/generated\/engine-api\.md$/,
  /^research\/archive\/document-reset-2026-08\/(?:audit-brief|baseline-report|cold-audit-findings|conflict-register|migration-map|original-(?:AGENTS|acceptance|audio-visual-contract|codex-autoloop|cycle|design-system|design-vision|docs-README|engine-spec|root-README|token-economy|ui-architecture-v2))\.(?:md|json)$/,
  /^\.agents\/skills\/mtg-onedeck-development\/(?:SKILL\.md|references\/(?:codex-autoloop|cycle|document-governance|token-economy)\.md)$/,
  /^\.github\/workflows\/deploy-pages\.yml$/,
  /^package\.json$/,
  /^scripts\/checks\/(?:check-docs|domain-check|fast-check|fingerprint|forbidden-files|generate-engine-api|generate-migration-map|machine-checks)\.mjs$/,
  /^scripts\/__tests__\/machine-checks\.test\.mjs$/,
  /^src\/test\/architecture\/deployPagesGates\.test\.ts$/,
];

const policyIdx = process.argv.indexOf('--policy');
const policy = policyIdx === -1 ? null : process.argv[policyIdx + 1];
if (policy !== null && policy !== 'governance-reset') {
  console.error('usage: forbidden-files.mjs [--diff <ref>] [--policy governance-reset]');
  process.exit(2);
}

function diffRef() {
  const diffIdx = process.argv.indexOf('--diff');
  if (diffIdx === -1) return null;
  const ref = process.argv[diffIdx + 1];
  if (!ref) {
    console.error('usage: forbidden-files.mjs [--diff <ref>]');
    process.exit(2);
  }
  return ref;
}

function changedFiles() {
  const diffIdx = process.argv.indexOf('--diff');
  if (diffIdx !== -1) {
    const ref = diffRef();
    const diffFiles = execFileSync('git', ['diff', '--name-only', ref], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    const untrackedFiles = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    return [...new Set([...diffFiles, ...untrackedFiles])].sort();
  }
  // git status --short: "XY path" / リネームは "R  old -> new"(新パスを採る)
  return execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const p = line.slice(3);
      const arrow = p.indexOf(' -> ');
      return arrow === -1 ? p : p.slice(arrow + 4);
    });
}

const files = changedFiles();
const forbidden = [];
const reauth = [];
for (const f of files) {
  if (policy === 'governance-reset') {
    if (!GOVERNANCE_RESET_ALLOWED.some((re) => re.test(f))) forbidden.push(`${f}  (DOC-GOV-RESET scope)`);
    continue;
  }
  const hit = FORBIDDEN.find((r) => r.re.test(f));
  if (hit) {
    forbidden.push(`${f}  (${hit.why})`);
    continue;
  }
  const soft = NEEDS_REAUTH.find((r) => r.re.test(f));
  if (soft) reauth.push(`${f}  (${soft.why})`);
}

if (policy === 'governance-reset' && files.includes('package.json')) {
  const ref = diffRef() ?? 'HEAD';
  try {
    const before = JSON.parse(execFileSync('git', ['show', `${ref}:package.json`], { encoding: 'utf8' }));
    const after = JSON.parse(readFileSync('package.json', 'utf8'));
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (key !== 'scripts' && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        forbidden.push(`package.json (${key} changed outside scripts)`);
      }
    }
  } catch (error) {
    forbidden.push(`package.json (cannot verify non-script changes: ${error instanceof Error ? error.message : String(error)})`);
  }
}

if (reauth.length > 0) {
  console.log('NEEDS-REAUTH(判定者の再オーナー化対象・情報表示):');
  for (const f of reauth) console.log(`  ${f}`);
}
if (forbidden.length > 0) {
  console.error('FORBIDDEN(実装エージェント変更禁止ファイルに変更あり):');
  for (const f of forbidden) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`OK: FORBIDDEN 変更なし(走査 ${files.length} ファイル)`);
