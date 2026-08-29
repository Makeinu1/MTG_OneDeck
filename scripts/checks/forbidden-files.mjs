#!/usr/bin/env node
// 禁止ファイル走査の単一正本。npm run check:forbidden で起動する。
// 既定は worktree の変更(git status --short)、--diff <ref> で ref との差分を走査。
// DOC-GOV-RESET の judge lane は --policy governance-reset で承認済み統治領域だけを検査する。
// `review.` の裸の部分一致は CardPreview.tsx 等を誤検出する(ee45cf6 の教訓)。
// 一方 `Name.review.test.tsx`(ドット区切りの review テスト)も判定者専有ゆえ拾う必要がある。
// ゆえに境界を「行頭・パス区切り・ドット」に固定する: `.review.` は拾い、`Preview.`(直前が
// 英字)は拾わない。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { createContextProjection } from '../codex-context.mjs';
import { findActiveSupervisedDomainId } from '../lib/supervisor-state.mjs';
import {
  readGitPathAtRef,
  readTrackedSupervisorAuthority,
  supervisorAuthorityPath,
  verifySupervisorAuthorityOffline,
} from '../lib/supervisor-authority.mjs';
import { buildGuardImpact, equivalentGuardAcknowledgement } from './guard-impact.mjs';
import { isReviewPath, requiredOwner } from './ownership.mjs';

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

function parseArguments(argv) {
  const options = { diff: null, policy: null };
  for (let index = 0; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (
      !['--diff', '--policy'].includes(argument) ||
      !value || value.startsWith('--') ||
      options[argument.slice(2)] !== null
    ) throw new Error('usage: forbidden-files.mjs [--diff <ref>] [--policy governance-reset]');
    options[argument.slice(2)] = value;
  }
  if (options.policy !== null && options.policy !== 'governance-reset') {
    throw new Error('usage: forbidden-files.mjs [--diff <ref>] [--policy governance-reset]');
  }
  return options;
}

const options = (() => {
  try {
    return parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
})();
const policy = options.policy;

function changedFiles(root = process.cwd()) {
  if (options.diff !== null) {
    const ref = options.diff;
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

const PROVENANCE_ACTIONS = new Set([
  'bootstrap', 'refresh-fingerprint', 'acknowledge-guard-impact',
  'push', 'record-semantic-push', 'record-replacement-push',
]);

function verifyJudgeReauthorization({ root, base, files, forbiddenPaths }) {
  if (!base || existsSync('.claude/loop-state.md')) return { ok: false, code: 'CI_REAUTHORIZATION_REQUIRES_CLEAN_CHECKOUT' };
  const nonReviewHardPaths = forbiddenPaths.filter((path) => !isReviewPath(path));
  if (nonReviewHardPaths.some((path) => path !== 'AGENTS.md')) {
    return { ok: false, code: 'NON_REVIEW_FORBIDDEN_PATH' };
  }
  if (execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }) !== '') {
    return { ok: false, code: 'CI_REAUTHORIZATION_REQUIRES_CLEAN_CHECKOUT' };
  }
  const ledger = JSON.parse(readFileSync('research/cr-grounding/cr-backbone-ledger.json', 'utf8'));
  const domainId = findActiveSupervisedDomainId(ledger);
  if (!domainId) return { ok: false, code: 'MISSING_ACTIVE_SUPERVISED_DOMAIN' };
  const projection = createContextProjection(root, domainId);
  if (!projection.health.ok || projection.supervisionEnforced !== true || projection.activeCandidate?.state !== 'push-ready') {
    return { ok: false, code: 'INVALID_SUPERVISED_CONTEXT' };
  }
  const tracked = readTrackedSupervisorAuthority(root, domainId);
  if (tracked.errors.length > 0 || !tracked.authority || !tracked.headAuthority) {
    return { ok: false, code: 'INVALID_TRACKED_SUPERVISOR_AUTHORITY' };
  }
  const latestCandidate = tracked.authority.events?.at(-1)?.candidate ?? null;
  if (
    latestCandidate?.id !== projection.activeCandidate.id ||
    latestCandidate?.treeFingerprint !== projection.activeCandidate.treeFingerprint
  ) return { ok: false, code: 'TRACKED_CANDIDATE_PROJECTION_MISMATCH' };
  const activeAuthorityPath = supervisorAuthorityPath(domainId);
  const baseAuthorityRead = readGitPathAtRef(root, base, activeAuthorityPath);
  if (baseAuthorityRead.status === 'error') return { ok: false, code: 'INVALID_BASE_SUPERVISOR_AUTHORITY' };
  let baseAuthority = null;
  const bootstrapMode = baseAuthorityRead.status === 'absent';
  if (baseAuthorityRead.status === 'present') {
    try { baseAuthority = JSON.parse(baseAuthorityRead.text); } catch { return { ok: false, code: 'INVALID_BASE_SUPERVISOR_AUTHORITY' }; }
  } else if (
    !files.includes(activeAuthorityPath) ||
    tracked.authority.events[0]?.action !== 'bootstrap' ||
    tracked.authority.events[0]?.actorRole !== 'supervisor' ||
    tracked.authority.events[0]?.reason !== 'migration-from-loop-state' ||
    tracked.authority.events[0]?.previousHash !== null ||
    tracked.authority.events[0]?.candidate?.baseSha !== base
  ) return { ok: false, code: 'INVALID_SUPERVISOR_BOOTSTRAP' };
  if (bootstrapMode) {
    let baseLedger;
    try {
      const baseLedgerRead = readGitPathAtRef(root, base, 'research/cr-grounding/cr-backbone-ledger.json');
      if (baseLedgerRead.status !== 'present') return { ok: false, code: 'INVALID_BASE_LEDGER' };
      baseLedger = JSON.parse(baseLedgerRead.text);
    } catch {
      return { ok: false, code: 'INVALID_BASE_LEDGER' };
    }
    const currentDomain = ledger.domains?.filter((entry) => entry?.id === domainId) ?? [];
    const currentPlanned = ledger.plannedSequence?.filter((entry) => entry?.domainId === domainId) ?? [];
    const baseDomains = baseLedger.domains ?? [];
    const basePlanned = baseLedger.plannedSequence ?? [];
    const dependencies = currentDomain[0]?.dependsOn;
    const predecessor = dependencies?.find((id) =>
      baseDomains.find((entry) => entry?.id === id)?.status === 'shipped' &&
      basePlanned.find((entry) => entry?.domainId === id)?.status === 'shipped',
    );
    const baseIds = baseLedger.goalPolicy?.activeProgram?.domainIds;
    const currentIds = ledger.goalPolicy?.activeProgram?.domainIds;
    const insertion = Array.isArray(baseIds) && predecessor
      ? [...baseIds.slice(0, baseIds.indexOf(predecessor) + 1), domainId, ...baseIds.slice(baseIds.indexOf(predecessor) + 1)]
      : null;
    if (
      baseDomains.some((entry) => entry?.id === domainId) ||
      basePlanned.some((entry) => entry?.domainId === domainId) ||
      currentDomain.length !== 1 || currentPlanned.length !== 1 ||
      currentPlanned[0]?.type !== 'checkpoint' ||
      currentDomain[0]?.lane !== 'pruned' || currentPlanned[0]?.lane !== 'pruned' ||
      currentDomain[0]?.deliveryClass !== 'substrate' || currentPlanned[0]?.deliveryClass !== 'substrate' ||
      JSON.stringify(currentDomain[0]?.dependsOn) !== JSON.stringify(currentPlanned[0]?.dependsOn) ||
      !Array.isArray(dependencies) || dependencies.length === 0 ||
      !predecessor || JSON.stringify(currentIds) !== JSON.stringify(insertion)
    ) return { ok: false, code: 'INVALID_BOOTSTRAP_DOMAIN_SUCCESSOR' };
  }
  const appendVerification = verifySupervisorAuthorityOffline({
    authority: tracked.authority,
    headAuthority: baseAuthority,
    loopCandidate: latestCandidate,
    completeAutonomy: ledger.goalPolicy?.activeProgram?.autonomy?.mode === 'complete',
  });
  if (!appendVerification.ok) return { ok: false, code: 'INVALID_SUPERVISOR_AUTHORITY_APPEND' };
  const eventPaths = files.filter((path) => path.startsWith('research/cr-grounding/supervisor-events/'));
  if (eventPaths.some((path) => path !== activeAuthorityPath)) {
    return { ok: false, code: 'UNEXPECTED_SUPERVISOR_AUTHORITY_PATH' };
  }
  if (nonReviewHardPaths.includes('AGENTS.md')) {
    const epochs = tracked.authority.events.filter((event) =>
      event.action === 'user-reauthorize' && event.actorRole === 'supervisor' &&
      typeof event.reason === 'string' && event.reason.startsWith('user-ruling:') &&
      event.candidate?.authoritySource === event.reason,
    );
    const currentAuthority = latestCandidate.authority;
    if (
      epochs.length !== 1 ||
      latestCandidate.authoritySource !== epochs[0].reason ||
      JSON.stringify(latestCandidate.authority) !== JSON.stringify(epochs[0].candidate.authority) ||
      latestCandidate.acceptanceFingerprint !== epochs[0].candidate.acceptanceFingerprint ||
      !Object.values(currentAuthority ?? {}).every((value) => value === true)
    ) return { ok: false, code: 'INVALID_AGENTS_REAUTHORIZATION_EPOCH' };
  }
  const report = buildGuardImpact({
    root,
    base,
    domain: domainId,
    projection: { activeCandidate: latestCandidate },
  });
  const acknowledgement = latestCandidate.guardImpact?.acknowledgement;
  if (!equivalentGuardAcknowledgement(acknowledgement, report, activeAuthorityPath)) {
    return { ok: false, code: 'GUARD_ACKNOWLEDGEMENT_MISMATCH' };
  }
  const judgePaths = files.filter((path) => requiredOwner(path) === 'judge' && path !== activeAuthorityPath);
  const acknowledgedPaths = new Map((acknowledgement?.paths ?? []).map((entry) => [entry.path, entry]));
  if (judgePaths.some((path) => acknowledgedPaths.get(path)?.owner !== 'judge')) {
    return { ok: false, code: 'UNACKNOWLEDGED_JUDGE_PATH' };
  }
  if (forbiddenPaths.some((path) => acknowledgedPaths.get(path)?.owner !== 'judge')) {
    return { ok: false, code: 'UNACKNOWLEDGED_FORBIDDEN_PATH' };
  }
  const hasSupervisorProvenance = tracked.authority.events
    .slice(baseAuthority?.events.length ?? 0)
    .some((event) =>
    event.candidate?.id === latestCandidate.id &&
    event.actorRole === 'supervisor' &&
    PROVENANCE_ACTIONS.has(event.action) &&
    equivalentGuardAcknowledgement(event.candidate?.guardImpact?.acknowledgement, report, activeAuthorityPath));
  if (!hasSupervisorProvenance) return { ok: false, code: 'MISSING_SUPERVISOR_ACKNOWLEDGEMENT_PROVENANCE' };
  return { ok: true, domainId, paths: judgePaths };
}

const files = changedFiles();
const forbidden = [];
const forbiddenPaths = [];
const reauth = [];
for (const f of files) {
  if (policy === 'governance-reset') {
    if (!GOVERNANCE_RESET_ALLOWED.some((re) => re.test(f))) {
      forbidden.push(`${f}  (DOC-GOV-RESET scope)`);
      forbiddenPaths.push(f);
    }
    continue;
  }
  const hit = FORBIDDEN.find((r) => r.re.test(f));
  if (hit) {
    forbidden.push(`${f}  (${hit.why})`);
    forbiddenPaths.push(f);
    continue;
  }
  const soft = NEEDS_REAUTH.find((r) => r.re.test(f));
  if (soft) reauth.push(`${f}  (${soft.why})`);
}

if (policy === 'governance-reset' && files.includes('package.json')) {
  const ref = options.diff ?? 'HEAD';
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

let judgeProof = null;
if (policy === null && options.diff !== null && forbidden.length > 0) {
  try {
    judgeProof = verifyJudgeReauthorization({
      root: process.cwd(),
      base: options.diff,
      files,
      forbiddenPaths,
    });
  } catch (error) {
    judgeProof = {
      ok: false,
      code: 'JUDGE_REAUTHORIZATION_VERIFICATION_FAILED',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (judgeProof.ok) forbidden.length = 0;
}

if (reauth.length > 0 && !judgeProof?.ok) {
  console.log('NEEDS-REAUTH(判定者の再オーナー化対象・情報表示):');
  for (const f of reauth) console.log(`  ${f}`);
}
if (forbidden.length > 0) {
  if (judgeProof && !judgeProof.ok) {
    console.error(`JUDGE-REAUTHORIZATION-REJECTED: ${judgeProof.code}`);
  }
  console.error('FORBIDDEN(実装エージェント変更禁止ファイルに変更あり):');
  for (const f of forbidden) console.error(`  ${f}`);
  process.exit(1);
}
if (judgeProof?.ok) {
  console.log(`JUDGE-REAUTHORIZED: ${judgeProof.paths.length} exact path(s) for ${judgeProof.domainId}`);
}
console.log(`OK: FORBIDDEN 変更なし(走査 ${files.length} ファイル)`);
