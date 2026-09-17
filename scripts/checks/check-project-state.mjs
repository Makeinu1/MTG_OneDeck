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
const sha40 = /^[0-9a-f]{40}$/u;
const crId = /^CR-[0-9]{2}$/u;
function err(message) { errors.push(message); }
function nonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }
function requirePath(path, label) { if (!nonEmpty(path) || !existsSync(resolve(repositoryRoot, path))) err(`${label}: missing path ${path}`); }
function validRef(ref, label) { if (ref === null || typeof ref !== 'object' || Array.isArray(ref) || !nonEmpty(ref.path)) { err(`${label}: invalid reference`); return; } requirePath(ref.path, label); if ('locator' in ref && !nonEmpty(ref.locator)) err(`${label}: locator must be non-empty`); }

let state;
try { state = loadProjectState(); } catch (error) { console.error(`project-state: cannot load JSON (${error instanceof Error ? error.message : String(error)})`); process.exit(1); }
const { index, capabilities } = state;
if (index.schemaVersion !== 1) err('index: schemaVersion must be 1');
if (index.status !== 'ACTIVE') err('index: status must be ACTIVE');
if (!sha40.test(index.baseline?.commit ?? '')) err('index: invalid baseline commit');
if (!nonEmpty(index.baseline?.repository) || !nonEmpty(index.baseline?.branch) || !nonEmpty(index.baseline?.auditedDate)) err('index: incomplete baseline');
if (!Array.isArray(index.baseline?.watchedRoots) || index.baseline.watchedRoots.length === 0) err('index: watchedRoots must be non-empty');
for (const root of index.baseline?.watchedRoots ?? []) requirePath(root, 'index watchedRoots');
for (const [key, value] of Object.entries(index.authorities ?? {})) { if (Array.isArray(value)) value.forEach((path) => requirePath(path, `authority ${key}`)); else requirePath(value, `authority ${key}`); }
requirePath(index.roles?.nowAuthority, 'roles.nowAuthority');
requirePath(index.roles?.generatedHumanView, 'roles.generatedHumanView');
requirePath(index.roles?.roadmapHistory, 'roles.roadmapHistory');
requirePath(index.coldRestartAcceptance, 'coldRestartAcceptance');
if (!nonEmpty(index.program?.activeMilestone) || !nonEmpty(index.program?.nextGate) || !nonEmpty(index.program?.nextWork)) err('index: active milestone, next gate and next work are required');

const ids = new Set(), slugs = new Set(), paths = new Set();
if (!Array.isArray(index.capabilities) || index.capabilities.length === 0) err('index: capabilities must be non-empty');
index.capabilities?.forEach((entry, position) => { if (!crId.test(entry?.id ?? '')) err(`index capability ${position}: invalid id`); if (!nonEmpty(entry?.path)) err(`index capability ${position}: invalid path`); else requirePath(entry.path, `index capability ${entry.id}`); if (ids.has(entry.id)) err(`index: duplicate capability id ${entry.id}`); ids.add(entry.id); if (paths.has(entry.path)) err(`index: duplicate capability path ${entry.path}`); paths.add(entry.path); });
if (capabilities.length !== index.capabilities.length) err('index: capability load count mismatch');
capabilities.forEach((item, position) => {
  const label = item?.id ?? `#${position}`;
  if (item.schemaVersion !== 1) err(`${label}: schemaVersion must be 1`);
  if (!crId.test(item.id ?? '')) err(`${label}: invalid id`);
  if (item.id !== index.capabilities[position]?.id) err(`${label}: index/file id mismatch`);
  if (!nonEmpty(item.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(item.slug)) err(`${label}: invalid slug`);
  if (slugs.has(item.slug)) err(`${label}: duplicate slug ${item.slug}`); slugs.add(item.slug);
  if (!nonEmpty(item.title)) err(`${label}: missing title`);
  if (!semantic.has(item.semanticVerdict)) err(`${label}: invalid semanticVerdict`);
  if (!delivery.has(item.deliveryState)) err(`${label}: invalid deliveryState`);
  if (!lifecycle.has(item.lifecycle)) err(`${label}: invalid lifecycle`);
  if (!requirement.has(item.requirementLevel)) err(`${label}: invalid requirementLevel`);
  if (item.auditedAtCommit !== index.baseline.commit) err(`${label}: auditedAtCommit differs from index baseline`);
  if (!Array.isArray(item.authorityRefs)) err(`${label}: authorityRefs must be an array`); else item.authorityRefs.forEach((r,i)=>validRef(r,`${label} authorityRefs[${i}]`));
  if (!Array.isArray(item.implementationRefs)) err(`${label}: implementationRefs must be an array`); else item.implementationRefs.forEach((r,i)=>validRef(r,`${label} implementationRefs[${i}]`));
  if (!Array.isArray(item.verificationRefs)) err(`${label}: verificationRefs must be an array`); else item.verificationRefs.forEach((r,i)=>validRef(r,`${label} verificationRefs[${i}]`));
  if (!nonEmpty(item.rationale) || !nonEmpty(item.nextAction)) err(`${label}: rationale and nextAction are required`);
  if (!Array.isArray(item.ownerDecisionRefs)) err(`${label}: ownerDecisionRefs must be an array`);
  if (item.semanticVerdict === 'CONFLICT' && (item.authorityRefs.length === 0 || item.implementationRefs.length === 0)) err(`${label}: CONFLICT requires authority and implementation evidence`);
  if (item.semanticVerdict === 'GAP' && item.authorityRefs.length === 0) err(`${label}: GAP requires authority evidence`);
});
const decisions = new Map((index.ownerDecisions ?? []).map((item) => [item.id, item]));
for (const [id, expected] of [['OD-001','B'],['OD-002','2A']]) { const decision = decisions.get(id); if (decision?.status !== 'RESOLVED' || decision?.decision !== expected) err(`${id}: must remain RESOLVED as ${expected}`); }
for (const item of capabilities) for (const id of item.ownerDecisionRefs ?? []) if (!decisions.has(id)) err(`${item.id}: unresolved owner decision reference ${id}`);
try {
  const baseline = index.baseline.commit;
  execFileSync('git', ['cat-file','-e',`${baseline}^{commit}`], { cwd: repositoryRoot, stdio:'ignore' });
  execFileSync('git', ['merge-base','--is-ancestor',baseline,'HEAD'], { cwd: repositoryRoot, stdio:'ignore' });
  const changed = execFileSync('git', ['diff','--name-only',`${baseline}..HEAD`,'--',...index.baseline.watchedRoots], { cwd: repositoryRoot, encoding:'utf8' }).trim();
  if (changed) err(`semantic audit stale after ${baseline}: ${changed.split(/\r?\n/u).join(', ')}`);
} catch (error) { err(`baseline freshness check failed: ${error instanceof Error ? error.message : String(error)}`); }
try {
  const generatedPath = resolve(repositoryRoot, index.roles.generatedHumanView);
  const actual = readFileSync(generatedPath, 'utf8');
  const expected = renderProjectState(state);
  if (actual !== expected) err(`${relative(repositoryRoot, generatedPath)} is stale; regenerate project state`);
} catch (error) { err(`generated view check failed: ${error instanceof Error ? error.message : String(error)}`); }
if (errors.length) { console.error('project-state integrity: FAIL'); for (const message of errors) console.error(`- ${message}`); process.exit(1); }
console.log(`project-state integrity: PASS (${capabilities.length} capabilities, baseline ${index.baseline.commit})`);
