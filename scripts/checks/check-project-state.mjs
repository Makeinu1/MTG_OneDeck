#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { loadProjectState, renderProjectState, repositoryRoot } from './generate-project-state.mjs';

const errors = [];
const semantic = new Set(['UNKNOWN','MATCH','GAP','CONFLICT']);
const delivery = new Set(['UNKNOWN','UNPLANNED','PLANNED','ACTIVE_WORK','IMPLEMENTED','VERIFIED']);
const lifecycle = new Set(['ACTIVE','DEPRECATED','RETIRED']);
const requirement = new Set(['REQUIRED','OPTIONAL']);
const pendingDecisionStatus = new Set(['PENDING_JUDGMENT','OWNER_REQUIRED']);
const ownerDecisionStatus = new Set(['OPEN','RESOLVED']);
const sha40 = /^[0-9a-f]{40}$/u;
const crId = /^CR-[0-9]{2}$/u;
const conflictId = /^CONFLICT-[A-Z0-9-]+$/u;
const ownerDecisionId = /^OD-[0-9]{3}$/u;
const locatorStopWords = new Set([
  'and','the','for','with','from','into','current','normal','exact','boundary','boundaries',
  'authority','constitutional','invariant','operation','operations','handling','path','section',
]);

function err(message) { errors.push(message); }
function nonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }
function requirePath(path, label) {
  if (!nonEmpty(path) || !existsSync(resolve(repositoryRoot, path))) err(`${label}: missing path ${path}`);
}
function readRegistry(path, label) {
  try { return JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')); }
  catch (error) { err(`${label}: cannot load ${path} (${error instanceof Error ? error.message : String(error)})`); return null; }
}
function git(args, options = {}) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], ...options }).trim();
}
function gitRefIfPresent(ref) {
  try { return git(['rev-parse','--verify',`${ref}^{commit}`]); }
  catch { return null; }
}
function declaredBranchRef(branch) {
  for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) {
    const sha = gitRefIfPresent(ref);
    if (sha) return { ref, sha };
  }
  return null;
}
function assertAncestor(ancestor, descendant, label) {
  try { execFileSync('git', ['merge-base','--is-ancestor',ancestor,descendant], { cwd: repositoryRoot, stdio:'ignore' }); }
  catch { err(`${label}: ${ancestor} is not an ancestor of ${descendant}`); }
}
function locatorTokens(locator) {
  return [...locator.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+)*/gu)].map((match) => match[0]);
}
function checkLocator(path, locator, label) {
  const absolute = resolve(repositoryRoot, path);
  if (!existsSync(absolute) || !nonEmpty(locator)) return;
  let content;
  try { content = readFileSync(absolute, 'utf8'); }
  catch (error) { err(`${label}: cannot read locator target (${error instanceof Error ? error.message : String(error)})`); return; }
  if (content.includes(locator)) return;
  const tokens = locatorTokens(locator);
  const strong = [...new Set(tokens.filter((token) =>
    /[a-z][A-Z]/u.test(token) || token.includes('.') || token.includes('_') || /^[A-Z0-9_$-]{3,}$/u.test(token)
  ))];
  if (strong.length > 0) {
    const missing = strong.filter((token) => !content.includes(token));
    if (missing.length > 0) err(`${label}: locator anchor missing in ${path}: ${missing.join(', ')}`);
    return;
  }
  const lower = content.toLowerCase();
  const meaningful = [...new Set(tokens.filter((token) => token.length >= 4 && !locatorStopWords.has(token.toLowerCase())))];
  if (meaningful.length === 0) {
    err(`${label}: locator has no checkable anchor: ${locator}`);
    return;
  }
  if (!meaningful.some((token) => lower.includes(token.toLowerCase()))) {
    err(`${label}: locator no longer resolves in ${path}: ${locator}`);
  }
}
function validRef(ref, label) {
  if (ref === null || typeof ref !== 'object' || Array.isArray(ref) || !nonEmpty(ref.path)) {
    err(`${label}: invalid reference`);
    return;
  }
  requirePath(ref.path, label);
  if ('locator' in ref) {
    if (!nonEmpty(ref.locator)) err(`${label}: locator must be non-empty`);
    else checkLocator(ref.path, ref.locator, label);
  }
}

let state;
try { state = loadProjectState(); }
catch (error) {
  console.error(`project-state: cannot load JSON (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}
const { index, capabilities } = state;

if (index.schemaVersion !== 2) err('index: schemaVersion must be 2');
if (index.status !== 'ACTIVE') err('index: status must be ACTIVE');
if (!sha40.test(index.baseline?.commit ?? '')) err('index: invalid baseline commit');
if (!nonEmpty(index.baseline?.repository) || !nonEmpty(index.baseline?.branch) || !nonEmpty(index.baseline?.auditedDate)) err('index: incomplete baseline');
if (!Array.isArray(index.baseline?.watchedRoots) || index.baseline.watchedRoots.length === 0) err('index: watchedRoots must be non-empty');
for (const root of index.baseline?.watchedRoots ?? []) requirePath(root, 'index watchedRoots');
for (const [key, value] of Object.entries(index.authorities ?? {})) {
  if (Array.isArray(value)) value.forEach((path) => requirePath(path, `authority ${key}`));
  else requirePath(value, `authority ${key}`);
}
requirePath(index.roles?.nowAuthority, 'roles.nowAuthority');
requirePath(index.roles?.generatedHumanView, 'roles.generatedHumanView');
requirePath(index.roles?.productionImplementationMap, 'roles.productionImplementationMap');
requirePath(index.roles?.roadmapHistory, 'roles.roadmapHistory');
requirePath(index.roles?.roadmapHistoryPolicy, 'roles.roadmapHistoryPolicy');
requirePath(index.coldRestartAcceptance, 'coldRestartAcceptance');
if (!nonEmpty(index.program?.activeMilestone) || !nonEmpty(index.program?.nextGate) || !nonEmpty(index.program?.nextWork)) {
  err('index: active milestone, next gate and next work are required');
}

if (index.coverage?.mode !== 'BOUNDED') err('index coverage: mode must be BOUNDED');
if (!nonEmpty(index.coverage?.scope)) err('index coverage: scope is required');
if (!Array.isArray(index.coverage?.completenessSources) || index.coverage.completenessSources.length === 0) {
  err('index coverage: completenessSources must be non-empty');
} else {
  for (const path of index.coverage.completenessSources) requirePath(path, 'index coverage completenessSources');
  const requiredCompletenessSources = [
    index.authorities?.traceabilityRegistry,
    index.authorities?.acceptanceRegistry,
    index.roles?.productionImplementationMap,
  ].filter(nonEmpty);
  for (const path of requiredCompletenessSources) {
    if (!index.coverage.completenessSources.includes(path)) err(`index coverage: missing required completeness source ${path}`);
  }
}
if (!Array.isArray(index.coverage?.knownLimitations) || index.coverage.knownLimitations.length === 0 || index.coverage.knownLimitations.some((item) => !nonEmpty(item))) {
  err('index coverage: knownLimitations must contain non-empty entries');
}

const ids = new Set(), slugs = new Set(), paths = new Set();
if (!Array.isArray(index.capabilities) || index.capabilities.length === 0) err('index: capabilities must be non-empty');
index.capabilities?.forEach((entry, position) => {
  if (!crId.test(entry?.id ?? '')) err(`index capability ${position}: invalid id`);
  if (!nonEmpty(entry?.path)) err(`index capability ${position}: invalid path`);
  else requirePath(entry.path, `index capability ${entry.id}`);
  if (ids.has(entry.id)) err(`index: duplicate capability id ${entry.id}`);
  ids.add(entry.id);
  if (paths.has(entry.path)) err(`index: duplicate capability path ${entry.path}`);
  paths.add(entry.path);
});
if (capabilities.length !== index.capabilities.length) err('index: capability load count mismatch');
capabilities.forEach((item, position) => {
  const label = item?.id ?? `#${position}`;
  if (item.schemaVersion !== 1) err(`${label}: schemaVersion must be 1`);
  if (!crId.test(item.id ?? '')) err(`${label}: invalid id`);
  if (item.id !== index.capabilities[position]?.id) err(`${label}: index/file id mismatch`);
  if (!nonEmpty(item.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.slug)) err(`${label}: invalid slug`);
  if (slugs.has(item.slug)) err(`${label}: duplicate slug ${item.slug}`);
  slugs.add(item.slug);
  if (!nonEmpty(item.title)) err(`${label}: missing title`);
  if (!semantic.has(item.semanticVerdict)) err(`${label}: invalid semanticVerdict`);
  if (!delivery.has(item.deliveryState)) err(`${label}: invalid deliveryState`);
  if (!lifecycle.has(item.lifecycle)) err(`${label}: invalid lifecycle`);
  if (!requirement.has(item.requirementLevel)) err(`${label}: invalid requirementLevel`);
  if (item.auditedAtCommit !== index.baseline.commit) err(`${label}: auditedAtCommit differs from index baseline`);
  if (!Array.isArray(item.authorityRefs)) err(`${label}: authorityRefs must be an array`);
  else item.authorityRefs.forEach((ref, i) => validRef(ref, `${label} authorityRefs[${i}]`));
  if (!Array.isArray(item.implementationRefs)) err(`${label}: implementationRefs must be an array`);
  else item.implementationRefs.forEach((ref, i) => validRef(ref, `${label} implementationRefs[${i}]`));
  if (!Array.isArray(item.verificationRefs)) err(`${label}: verificationRefs must be an array`);
  else item.verificationRefs.forEach((ref, i) => validRef(ref, `${label} verificationRefs[${i}]`));
  if (!nonEmpty(item.rationale) || !nonEmpty(item.nextAction)) err(`${label}: rationale and nextAction are required`);
  if (!Array.isArray(item.ownerDecisionRefs)) err(`${label}: ownerDecisionRefs must be an array`);
  if (item.semanticVerdict === 'CONFLICT' && (item.authorityRefs.length === 0 || item.implementationRefs.length === 0)) err(`${label}: CONFLICT requires authority and implementation evidence`);
  if (item.semanticVerdict === 'GAP' && item.authorityRefs.length === 0) err(`${label}: GAP requires authority evidence`);
});

const traceability = readRegistry(index.authorities?.traceabilityRegistry, 'traceability registry');
const acceptance = readRegistry(index.authorities?.acceptanceRegistry, 'acceptance registry');
const traceabilityClauses = new Map((traceability?.clauses ?? []).filter((item) => item && typeof item === 'object').map((item) => [item.id, item]));
const acceptanceScenarios = new Map((acceptance?.scenarios ?? []).filter((item) => item && typeof item === 'object').map((item) => [item.id, item]));
const pendingDecisions = new Map();
if (!Array.isArray(index.pendingDecisions)) err('index: pendingDecisions must be an array');
for (const [position, decision] of (index.pendingDecisions ?? []).entries()) {
  const label = `pending decision ${decision?.id ?? `#${position}`}`;
  if (!conflictId.test(decision?.id ?? '')) err(`${label}: invalid id`);
  if (pendingDecisions.has(decision?.id)) err(`${label}: duplicate id`);
  else pendingDecisions.set(decision?.id, decision);
  if (!pendingDecisionStatus.has(decision?.status)) err(`${label}: invalid status`);
  if (!Array.isArray(decision?.traceabilityRefs) || decision.traceabilityRefs.length === 0) err(`${label}: traceabilityRefs must be non-empty`);
  if (!Array.isArray(decision?.acceptanceRefs)) err(`${label}: acceptanceRefs must be an array`);
  if (!nonEmpty(decision?.summary) || !nonEmpty(decision?.nextAction)) err(`${label}: summary and nextAction are required`);
  if (decision?.status === 'PENDING_JUDGMENT' && nonEmpty(decision?.ownerDecisionRef)) err(`${label}: PENDING_JUDGMENT must not claim an Owner escalation`);
  for (const clauseId of decision?.traceabilityRefs ?? []) {
    const clause = traceabilityClauses.get(clauseId);
    if (!clause) err(`${label}: unresolved traceability ref ${clauseId}`);
    else if (clause.status !== 'active' || clause.verificationDisposition !== 'deferred-needs-decision') err(`${label}: traceability ref ${clauseId} is not an active deferred-needs-decision clause`);
    else {
      const referencedId = typeof clause.needsDecision === 'string' ? clause.needsDecision.match(/\b(CONFLICT-[A-Z0-9-]+)\b/u)?.[1] : undefined;
      if (referencedId !== decision.id) err(`${label}: ${clauseId} points to ${referencedId ?? 'no conflict id'}`);
    }
  }
  for (const scenarioId of decision?.acceptanceRefs ?? []) {
    const scenario = acceptanceScenarios.get(scenarioId);
    if (!scenario) {
      err(`${label}: unresolved acceptance ref ${scenarioId}`);
      continue;
    }
    if (scenario.status !== 'deferred') err(`${label}: acceptance ref ${scenarioId} is not deferred`);
    const verifies = Array.isArray(scenario.verifies) ? scenario.verifies : [];
    if (!verifies.some((clauseId) => decision.traceabilityRefs.includes(clauseId))) {
      err(`${label}: acceptance ref ${scenarioId} does not verify a referenced deferred clause`);
    }
  }
}
for (const clause of traceabilityClauses.values()) {
  if (clause.status !== 'active' || clause.verificationDisposition !== 'deferred-needs-decision') continue;
  const decisionId = typeof clause.needsDecision === 'string' ? clause.needsDecision.match(/\b(CONFLICT-[A-Z0-9-]+)\b/u)?.[1] : undefined;
  if (!decisionId) { err(`traceability ${clause.id}: deferred decision has no machine-readable CONFLICT id`); continue; }
  const decision = pendingDecisions.get(decisionId);
  if (!decision) { err(`traceability ${clause.id}: ${decisionId} is not surfaced in Project State pendingDecisions`); continue; }
  if (!decision.traceabilityRefs.includes(clause.id)) err(`${decisionId}: missing traceability ref ${clause.id}`);
  for (const scenarioId of clause.acceptedBy ?? []) {
    const scenario = acceptanceScenarios.get(scenarioId);
    if (scenario?.status === 'deferred' && !decision.acceptanceRefs.includes(scenarioId)) err(`${decisionId}: deferred acceptance ${scenarioId} is not surfaced`);
  }
}

const decisions = new Map();
if (!Array.isArray(index.ownerDecisions)) err('index: ownerDecisions must be an array');
for (const [position, decision] of (index.ownerDecisions ?? []).entries()) {
  const label = `owner decision ${decision?.id ?? `#${position}`}`;
  if (!ownerDecisionId.test(decision?.id ?? '')) err(`${label}: invalid id`);
  if (decisions.has(decision?.id)) err(`${label}: duplicate id`);
  else decisions.set(decision?.id, decision);
  if (!ownerDecisionStatus.has(decision?.status)) err(`${label}: invalid status`);
  if (!nonEmpty(decision?.summary)) err(`${label}: summary is required`);
  if (decision?.status === 'RESOLVED' && (!nonEmpty(decision?.decision) || !nonEmpty(decision?.decidedDate))) {
    err(`${label}: RESOLVED requires decision and decidedDate`);
  }
  if (decision?.status === 'OPEN' && (nonEmpty(decision?.decision) || nonEmpty(decision?.decidedDate))) {
    err(`${label}: OPEN must not contain a resolved decision/date`);
  }
}
for (const decision of pendingDecisions.values()) {
  if (decision.status !== 'OWNER_REQUIRED') continue;
  if (!nonEmpty(decision.ownerDecisionRef)) {
    err(`${decision.id}: OWNER_REQUIRED must link ownerDecisionRef`);
    continue;
  }
  const ownerDecision = decisions.get(decision.ownerDecisionRef);
  if (!ownerDecision) err(`${decision.id}: unresolved owner decision reference ${decision.ownerDecisionRef}`);
  else if (ownerDecision.status !== 'OPEN') err(`${decision.id}: OWNER_REQUIRED must link an OPEN Owner Decision`);
}
for (const ownerDecision of decisions.values()) {
  if (ownerDecision.status !== 'OPEN') continue;
  const linked = [...pendingDecisions.values()].some((decision) => decision.status === 'OWNER_REQUIRED' && decision.ownerDecisionRef === ownerDecision.id);
  if (!linked) err(`${ownerDecision.id}: OPEN Owner Decision is not linked from an OWNER_REQUIRED pending decision`);
}
for (const [id, expected] of [['OD-001','B'],['OD-002','2A']]) {
  const decision = decisions.get(id);
  if (decision?.status !== 'RESOLVED' || decision?.decision !== expected) err(`${id}: must remain RESOLVED as ${expected}`);
}
for (const item of capabilities) {
  for (const id of item.ownerDecisionRefs ?? []) if (!decisions.has(id)) err(`${item.id}: unresolved owner decision reference ${id}`);
}

const productionMap = readRegistry(index.roles?.productionImplementationMap, 'production implementation map');
if (productionMap?.schemaVersion !== 1) err('production implementation map: schemaVersion must be 1');
if (productionMap?.status !== 'CURRENT_ROUTING_SNAPSHOT') err('production implementation map: invalid status');
if (!sha40.test(productionMap?.observedAtCommit ?? '')) err('production implementation map: invalid observedAtCommit');
if (!Array.isArray(productionMap?.freshness?.watchedPaths) || productionMap.freshness.watchedPaths.length === 0) {
  err('production implementation map: freshness.watchedPaths must be non-empty');
} else {
  for (const path of productionMap.freshness.watchedPaths) requirePath(path, 'production implementation map freshness.watchedPaths');
}
if (!Array.isArray(productionMap?.surfaces) || productionMap.surfaces.length === 0) err('production implementation map: surfaces must be non-empty');
for (const [position, surface] of (productionMap?.surfaces ?? []).entries()) {
  const label = `production surface ${surface?.id ?? `#${position}`}`;
  if (!nonEmpty(surface?.id) || !nonEmpty(surface?.role) || !nonEmpty(surface?.entry)) err(`${label}: id, role and entry are required`);
  else requirePath(surface.entry, label);
  if (!Array.isArray(surface?.route) || surface.route.length === 0 || surface.route.some((item) => !nonEmpty(item))) err(`${label}: route must be non-empty`);
}
for (const key of ['deploymentConfig','workerEntry','productionEndpointResolver']) {
  requirePath(productionMap?.backend?.[key], `production implementation map backend.${key}`);
}

try {
  const baseline = index.baseline.commit;
  execFileSync('git', ['cat-file','-e',`${baseline}^{commit}`], { cwd: repositoryRoot, stdio:'ignore' });
  const branch = declaredBranchRef(index.baseline.branch);
  if (!branch) {
    err(`baseline provenance: cannot resolve declared branch ${index.baseline.branch}`);
  } else {
    assertAncestor(baseline, branch.sha, 'baseline provenance');
    const head = git(['rev-parse','HEAD']);
    if (head !== branch.sha) assertAncestor(branch.sha, head, 'candidate freshness against declared branch');
    if (sha40.test(productionMap?.observedAtCommit ?? '')) assertAncestor(productionMap.observedAtCommit, head, 'production map provenance');
  }
  execFileSync('git', ['merge-base','--is-ancestor',baseline,'HEAD'], { cwd: repositoryRoot, stdio:'ignore' });
  const changed = execFileSync('git', ['diff','--name-only',`${baseline}..HEAD`,'--',...index.baseline.watchedRoots], { cwd: repositoryRoot, encoding:'utf8' }).trim();
  if (changed) err(`semantic audit stale after ${baseline}: ${changed.split(/\r?\n/u).join(', ')}`);
  if (sha40.test(productionMap?.observedAtCommit ?? '') && Array.isArray(productionMap?.freshness?.watchedPaths) && productionMap.freshness.watchedPaths.length > 0) {
    execFileSync('git', ['cat-file','-e',`${productionMap.observedAtCommit}^{commit}`], { cwd: repositoryRoot, stdio:'ignore' });
    const routingChanged = execFileSync('git', ['diff','--name-only',`${productionMap.observedAtCommit}..HEAD`,'--',...productionMap.freshness.watchedPaths], { cwd: repositoryRoot, encoding:'utf8' }).trim();
    if (routingChanged) err(`production implementation map stale after ${productionMap.observedAtCommit}: ${routingChanged.split(/\r?\n/u).join(', ')}`);
  }
} catch (error) {
  err(`baseline freshness check failed: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const generatedPath = resolve(repositoryRoot, index.roles.generatedHumanView);
  const actual = readFileSync(generatedPath, 'utf8');
  const expected = renderProjectState(state);
  if (actual !== expected) err(`${relative(repositoryRoot, generatedPath)} is stale; regenerate project state`);
} catch (error) {
  err(`generated view check failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (errors.length) {
  console.error('project-state integrity: FAIL');
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`project-state integrity: PASS (${capabilities.length} capabilities, ${pendingDecisions.size} pending decisions, bounded coverage, baseline ${index.baseline.commit})`);
