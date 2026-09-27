#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isActiveLegacySuggestion, LEGACY_SUGGESTED_DISPOSITIONS, validateLegacyDecision } from './legacy-inventory-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = join(root, 'docs/contracts/manifest.json');
const scenarioPath = join(root, 'docs/acceptance/scenarios.json');
const migrationPath = join(root, 'research/archive/document-reset-2026-08/migration-map.json');
const traceabilityPath = join(root, 'docs/contracts/traceability.json');
const traceabilityRelativePath = relative(root, traceabilityPath);
const productRequirementsPath = join(root, 'docs/product-requirements.md');
const semanticMapPath = join(root, 'docs/contracts/semantic-map.json');
const projectStatePath = join(root, 'docs/project-state/index.json');
const errors = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${relative(root, path)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function requireFile(path, label) {
  if (!existsSync(path)) errors.push(`${label}: missing ${relative(root, path)}`);
}

function localLinks(path) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    const target = raw.split(/[?#]/, 1)[0];
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(resolve(dirname(path), target))) errors.push(`${relative(root, path)}: broken link ${target}`);
  }
}

function walk(directory) {
  const files = [];
  if (!existsSync(directory)) return files;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function checkManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object') return;
  for (const key of ['legacyInventory', 'legacyInventoryDecisions']) {
    if (typeof manifest[key] !== 'string' || manifest[key].trim() === '') {
      errors.push(`manifest: ${key} path is required`);
    } else {
      requireFile(join(root, manifest[key]), `manifest ${key}`);
    }
  }
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const byId = new Map();
  const authorities = new Map();
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      errors.push('manifest: every contract entry must be an object');
      continue;
    }
    for (const key of ['id', 'status', 'path', 'authorityFor', 'owner', 'dependsOn', 'supersedes']) {
      if (!(key in entry)) errors.push(`manifest ${entry.id ?? '<unknown>'}: missing ${key}`);
    }
    if (entry.status === 'active' && ('verifiedBy' in entry || 'lastVerifiedCommit' in entry)) {
      errors.push(`manifest ${entry.id ?? '<unknown>'}: active contract must not carry retired verification pin fields`);
    }
    if (entry.status === 'generated') {
      for (const key of ['verifiedBy', 'lastVerifiedCommit']) {
        if (!(key in entry)) errors.push(`manifest ${entry.id ?? '<unknown>'}: generated entry missing ${key}`);
      }
    }
    if (typeof entry.id === 'string') {
      if (byId.has(entry.id)) errors.push(`manifest: duplicate contract id ${entry.id}`);
      byId.set(entry.id, entry);
    }
    requireFile(join(root, entry.path ?? ''), `manifest ${entry.id ?? '<unknown>'}`);
    if (entry.status === 'active') {
      const authoritiesForEntry = Array.isArray(entry.authorityFor) ? entry.authorityFor : [entry.authorityFor];
      for (const authority of authoritiesForEntry) {
        if (typeof authority !== 'string') continue;
        const prior = authorities.get(authority);
        if (prior !== undefined) errors.push(`manifest: authority ${authority} owned by both ${prior} and ${entry.id}`);
        else authorities.set(authority, entry.id);
      }
      const path = join(root, entry.path ?? '');
      if (extname(path) === '.md' && existsSync(path)) {
        const content = readFileSync(path, 'utf8');
        const forbidden = [
          /\brevision\b/i, /\bhistorical\b/i, /\bshipped\b/i, /\bsuperseded\b/i,
          /\bpartial\b/i, /\bpass\b/i, /\bdraft\b/i, /\baudit\b/i,
          /LLM\s+(?:session|id)/i, /現行性メモ/, /削除済み/, /作業予定/, /再オーナー化/,
        ];
        for (const pattern of forbidden) if (pattern.test(content)) errors.push(`${entry.path}: volatile lifecycle vocabulary ${pattern}`);
      }
    }
    for (const ref of [...(entry.dependsOn ?? []), ...(entry.supersedes ?? [])]) {
      if (typeof ref === 'string' && !byId.has(ref) && !ref.startsWith('legacy:')) errors.push(`manifest ${entry.id}: unresolved reference ${ref}`);
    }
    if (entry.status === 'generated') {
      for (const verifier of entry.verifiedBy ?? []) requireFile(join(root, verifier), `manifest ${entry.id} verifiedBy`);
      if (typeof entry.lastVerifiedCommit !== 'string' || !/^[0-9a-f]{40}$/.test(entry.lastVerifiedCommit)) {
        errors.push(`manifest ${entry.id}: invalid lastVerifiedCommit`);
      }
    }
  }
  if (Array.isArray(manifest.activeAllowlist)) {
    for (const allowance of manifest.activeAllowlist) {
      if (!allowance.path || !allowance.reason || !Array.isArray(allowance.patterns)) errors.push('manifest activeAllowlist: every entry needs path, patterns, and reason');
    }
  }
}

function checkScenarios(scenarios, migration, semanticIds = new Set()) {
  const seen = new Set();
  const legacyIds = new Set((migration?.legacyIds ?? []).map((entry) => entry.id));
  const allowedStatus = new Set(['active', 'deferred', 'periodic']);
  if (!Array.isArray(scenarios)) {
    errors.push('scenarios: expected an array');
    return;
  }
  for (const scenario of scenarios) {
    for (const key of ['id', 'status', 'risk', 'tags', 'preconditions', 'steps', 'oracle', 'automatedBy', 'manualOnly', 'supersedes', 'verifies']) {
      if (!(key in scenario)) errors.push(`scenario ${scenario.id ?? '<unknown>'}: missing ${key}`);
    }
    if ('contractRefs' in scenario) errors.push(`scenario ${scenario.id ?? '<unknown>'}: contractRefs is retired; derive contract ownership from verifies targets`);
    if (typeof scenario.id !== 'string') continue;
    if (!/^ACC-[A-Z0-9-]+$/u.test(scenario.id)) errors.push(`scenario ${scenario.id}: invalid stable scenario id`);
    if (seen.has(scenario.id)) errors.push(`scenario: duplicate id ${scenario.id}`);
    seen.add(scenario.id);
    if (!allowedStatus.has(scenario.status)) errors.push(`scenario ${scenario.id}: invalid status ${scenario.status}`);
    if (typeof scenario.oracle !== 'string' || scenario.oracle.trim() === '') errors.push(`scenario ${scenario.id}: oracle is required`);
    if (typeof scenario.manualOnly !== 'boolean') errors.push(`scenario ${scenario.id}: manualOnly must be boolean`);
    for (const key of ['tags', 'preconditions', 'steps', 'automatedBy', 'supersedes', 'verifies']) {
      if (!Array.isArray(scenario[key])) errors.push(`scenario ${scenario.id}: ${key} must be an array`);
    }
    if (Array.isArray(scenario.preconditions) && scenario.preconditions.length === 0) errors.push(`scenario ${scenario.id}: preconditions must not be empty`);
    if (Array.isArray(scenario.steps) && scenario.steps.length === 0) errors.push(`scenario ${scenario.id}: steps must not be empty`);
    if (scenario.status !== 'periodic' && Array.isArray(scenario.verifies) && scenario.verifies.length === 0) {
      errors.push(`scenario ${scenario.id}: active/deferred scenario must verify at least one semantic node`);
    }
    if (['deferred', 'periodic'].includes(scenario.status) && scenario.manualOnly !== true) {
      errors.push(`scenario ${scenario.id}: deferred/periodic evidence must remain outside ordinary automated acceptance`);
    }
    if (scenario.manualOnly === false && Array.isArray(scenario.automatedBy) && scenario.automatedBy.length === 0) {
      errors.push(`scenario ${scenario.id}: non-manual scenario requires automatedBy evidence`);
    }
    for (const ref of scenario.verifies ?? []) {
      if (ref.startsWith('ACC-')) errors.push(`scenario ${scenario.id}: Acceptance scenarios cannot verify Acceptance scenario IDs`);
      else if (!semanticIds.has(ref)) errors.push(`scenario ${scenario.id}: unresolved verifies ${ref}`);
    }
    for (const path of scenario.automatedBy ?? []) {
      requireFile(join(root, path), `scenario ${scenario.id} automatedBy`);
      const absolute = join(root, path);
      if (existsSync(absolute) && !fileText(absolute).includes(`scenario: ${scenario.id}`)) {
        errors.push(`scenario ${scenario.id}: automatedBy path lacks scenario marker ${path}`);
      }
    }
    for (const ref of scenario.supersedes ?? []) {
      if (typeof ref === 'string' && !legacyIds.has(ref) && !seen.has(ref)) errors.push(`scenario ${scenario.id}: unresolved supersedes ${ref}`);
    }
  }
  const goldenReplay = scenarios.find((scenario) => scenario?.id === 'ACC-CR-REPLAY-001');
  if (!goldenReplay) errors.push('scenarios: ACC-CR-REPLAY-001 structural replay scenario is required');
  else {
    if (goldenReplay.status !== 'active' || goldenReplay.manualOnly !== false) errors.push('ACC-CR-REPLAY-001: golden replay must remain active automated acceptance');
    if (!goldenReplay.tags?.includes('replay') || !goldenReplay.tags?.includes('golden')) errors.push('ACC-CR-REPLAY-001: replay/golden tags are required');
    if (!Array.isArray(goldenReplay.automatedBy) || goldenReplay.automatedBy.length === 0) errors.push('ACC-CR-REPLAY-001: automated replay evidence is required');
  }
}
function fileText(path) {
  return readFileSync(path, 'utf8');
}

function checkMarker(path, marker, clauseId) {
  const absolutePath = join(root, path);
  if (!existsSync(absolutePath)) {
    errors.push(`traceability ${clauseId}: verifiedBy path missing ${path}`);
    return;
  }
  const content = fileText(absolutePath);
  if (marker.startsWith('scenario: ')) {
    const scenarioId = marker.slice('scenario: '.length);
    const scenarios = readJson(scenarioPath)?.scenarios ?? [];
    if (!scenarios.some((scenario) => scenario.id === scenarioId)) errors.push(`traceability ${clauseId}: missing scenario marker ${marker}`);
    return;
  }
  if (!content.includes(marker)) errors.push(`traceability ${clauseId}: missing marker ${marker} in ${path}`);
  if (marker.startsWith('verifies: ') && marker.slice('verifies: '.length) !== clauseId) {
    errors.push(`traceability ${clauseId}: marker points to ${marker}`);
  }
}

function checkTraceability(traceability, manifest, contractSemanticIds) {
  if (traceability?.schemaVersion !== 2) errors.push('traceability: schemaVersion must be 2');
  if (traceability === null || typeof traceability !== 'object' || !Array.isArray(traceability.clauses)) {
    errors.push('traceability: expected clauses array');
    return new Set();
  }
  const contractIds = new Set((manifest?.contracts ?? []).map((entry) => entry.id));
  const clauseIds = new Set();
  const forbiddenSemanticFields = ['rule', 'precondition', 'resultingBehavior', 'failureBehavior', 'invariant', 'acceptedBy'];
  for (const clause of traceability.clauses) {
    if (clause === null || typeof clause !== 'object') {
      errors.push('traceability: every clause must be an object');
      continue;
    }
    for (const key of ['id', 'contractId', 'status', 'sourcePath', 'sourceMarker', 'verificationDisposition', 'evidenceBindings']) {
      if (!(key in clause)) errors.push(`traceability ${clause.id ?? '<unknown>'}: missing ${key}`);
    }
    for (const key of forbiddenSemanticFields) {
      if (key in clause) errors.push(`traceability ${clause.id ?? '<unknown>'}: retired semantic field ${key}`);
    }
    if (typeof clause.id !== 'string') continue;
    if (clause.id.startsWith('ACC-ACCEPT-')) errors.push(`traceability ${clause.id}: retired pseudo semantic clause`);
    if (clauseIds.has(clause.id)) errors.push(`traceability: duplicate clause id ${clause.id}`);
    clauseIds.add(clause.id);
    const semanticOwnerPath = contractSemanticIds.get(clause.id);
    if (!semanticOwnerPath) errors.push(`traceability ${clause.id}: does not resolve to an active inline semantic ID`);
    else if (clause.sourcePath !== semanticOwnerPath) errors.push(`traceability ${clause.id}: sourcePath does not match semantic owner ${semanticOwnerPath}`);
    if (!contractIds.has(clause.contractId)) errors.push(`traceability ${clause.id}: unresolved contractId ${clause.contractId}`);
    else {
      const ownerContract = (manifest?.contracts ?? []).find((entry) => entry.id === clause.contractId);
      if (ownerContract?.path !== clause.sourcePath) errors.push(`traceability ${clause.id}: contractId/path ownership mismatch`);
    }
    if (!['active', 'obsolete'].includes(clause.status)) errors.push(`traceability ${clause.id}: invalid status ${clause.status}`);
    if (!['automated', 'manual', 'deferred-needs-decision'].includes(clause.verificationDisposition)) {
      errors.push(`traceability ${clause.id}: invalid verificationDisposition ${clause.verificationDisposition}`);
    }
    const source = join(root, clause.sourcePath ?? '');
    requireFile(source, `traceability ${clause.id} source`);
    if (existsSync(source)) {
      const content = fileText(source);
      if (!content.includes(clause.sourceMarker ?? '')) errors.push(`traceability ${clause.id}: source marker missing ${clause.sourceMarker}`);
    }
    if (clause.status === 'active' && (typeof clause.sourceMarker !== 'string' || clause.sourceMarker.trim() === '')) {
      errors.push(`traceability ${clause.id}: active clause requires a non-empty sourceMarker`);
    }
    if (!Array.isArray(clause.evidenceBindings)) errors.push(`traceability ${clause.id}: evidenceBindings must be an array`);
    if (clause.verificationDisposition === 'automated' && clause.evidenceBindings?.length === 0) {
      errors.push(`traceability ${clause.id}: automated disposition requires direct evidence`);
    }
    for (const verifier of clause.evidenceBindings ?? []) {
      if (!verifier.path || !verifier.marker || verifier.kind !== 'automated') errors.push(`traceability ${clause.id}: malformed evidence binding`);
      else {
        if (!['conformance', 'characterization'].includes(verifier.role)) errors.push(`traceability ${clause.id}: invalid evidence role ${verifier.role}`);
        checkMarker(verifier.path, verifier.marker, clause.id);
      }
    }
    if (clause.verificationDisposition === 'manual' && typeof clause.manualProcedure !== 'string') errors.push(`traceability ${clause.id}: manualProcedure required`);
    if (clause.verificationDisposition === 'deferred-needs-decision' && typeof clause.needsDecision !== 'string') errors.push(`traceability ${clause.id}: needsDecision required`);
  }
  return clauseIds;
}
function discoverProductDefinitions() {
  const definitions = new Map();
  if (!existsSync(productRequirementsPath)) {
    errors.push('product requirements: missing docs/product-requirements.md');
    return definitions;
  }
  for (const line of fileText(productRequirementsPath).split(/\r?\n/u)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const first = cells[0] ?? '';
    const p = first.match(/^(P-\d{2})$/u);
    const q = first.match(/^(Q-\d{2})（決定(?:・更新)?）$/u);
    const id = p?.[1] ?? q?.[1];
    if (!id) continue;
    definitions.set(id, (definitions.get(id) ?? 0) + 1);
  }
  return definitions;
}

function discoverContractSemanticIds(manifest) {
  const owners = new Map();
  for (const entry of manifest?.contracts ?? []) {
    if (entry.status !== 'active' || !entry.path?.endsWith('.md')) continue;
    const path = join(root, entry.path);
    if (!existsSync(path)) continue;
    const content = fileText(path);
    const ids = [...content.matchAll(/<!--\s*clause:\s*([A-Z0-9-]+)\s*-->/gu)].map((match) => match[1]);
    if (ids.length === 0) errors.push(`${entry.path}: no clause IDs`);
    for (const id of ids) {
      const prior = owners.get(id);
      if (prior) errors.push(`semantic identity: duplicate inline clause ${id} in ${prior} and ${entry.path}`);
      else owners.set(id, entry.path);
    }
  }
  return owners;
}

const boundaryAxes = [
  'authority',
  'identity',
  'commit',
  'invalidation',
  'persistence',
  'publication',
  'receiptReconciliation',
];
const boundaryAxisSet = new Set(boundaryAxes);
const boundaryStates = new Set(['COVERED', 'NOT_APPLICABLE', 'MISSING', 'OWNER_DECISION_REQUIRED']);
const boundaryOperationIdPattern = /^OP-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const boundaryDecisionRefPattern = /^OD-[0-9]{3}$/u;
const boundaryNotApplicableReasons = new Map([
  ['invalidation', 'NO_INVALIDATION_SOURCE'],
  ['persistence', 'NO_PERSISTENCE_REQUIRED'],
  ['publication', 'NO_PUBLICATION_REQUIRED'],
  ['receiptReconciliation', 'NO_RECEIPT_PATH'],
]);

function uniqueStrings(values) {
  return Array.isArray(values)
    && values.every((value) => typeof value === 'string' && value.trim() !== '')
    && new Set(values).size === values.length;
}

function unresolvedOwnerDecisionIds(projectState) {
  const ids = new Set();
  const pending = Array.isArray(projectState?.pendingDecisions) ? projectState.pendingDecisions : [];
  const owner = Array.isArray(projectState?.ownerDecisions) ? projectState.ownerDecisions : [];
  const linkedIds = new Set(pending
    .filter((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      && entry.status === 'OWNER_REQUIRED' && typeof entry.ownerDecisionRef === 'string')
    .map((entry) => entry.ownerDecisionRef));
  for (const entry of owner) {
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      && typeof entry.id === 'string' && boundaryDecisionRefPattern.test(entry.id)
      && entry.status === 'OPEN' && linkedIds.has(entry.id)) ids.add(entry.id);
  }
  return ids;
}

function deriveBoundaryStatus(axes) {
  const states = boundaryAxes.map((axis) => axes[axis]?.state);
  if (states.includes('OWNER_DECISION_REQUIRED')) return 'OWNER_DECISION_REQUIRED';
  if (states.includes('MISSING')) return 'INCOMPLETE';
  return 'COMPLETE';
}

function validateBoundaryOperationRows(
  rows,
  contractSemanticIds,
  { labelPrefix = 'semantic map boundary operation', unresolvedDecisionIds = new Set() } = {},
) {
  const rowErrors = [];
  const derivedStatuses = new Map();
  if (!Array.isArray(rows)) {
    rowErrors.push(`${labelPrefix}: boundaryOperations must be an array`);
    return { errors: rowErrors, derivedStatuses };
  }
  const seenOperationIds = new Set();
  for (const [position, row] of rows.entries()) {
    const label = `${labelPrefix} #${position}`;
    const rowErrorStart = rowErrors.length;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      rowErrors.push(`${label}: expected object`);
      continue;
    }
    if (Object.keys(row).sort().join(',') !== 'axes,label,operationId') {
      rowErrors.push(`${label}: only operationId/label/axes are allowed`);
    }
    if (typeof row.operationId !== 'string' || !boundaryOperationIdPattern.test(row.operationId)) {
      rowErrors.push(`${label}: invalid stable operationId`);
    } else if (seenOperationIds.has(row.operationId)) {
      rowErrors.push(`${label}: duplicate operationId ${row.operationId}`);
    } else {
      seenOperationIds.add(row.operationId);
    }
    if (typeof row.label !== 'string' || row.label.trim() === '') rowErrors.push(`${label}: label is required`);
    if (row.axes === null || typeof row.axes !== 'object' || Array.isArray(row.axes)) {
      rowErrors.push(`${label}: axes must be an object`);
      continue;
    }
    const axisKeys = Object.keys(row.axes).sort();
    if (axisKeys.join(',') !== [...boundaryAxisSet].sort().join(',')) {
      rowErrors.push(`${label}: axes must contain exactly the seven boundary axes`);
      continue;
    }
    for (const axis of boundaryAxes) {
      const value = row.axes[axis];
      const axisLabel = `${label} ${axis}`;
      if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.state !== 'string') {
        rowErrors.push(`${axisLabel}: malformed axis state`);
        continue;
      }
      if (!boundaryStates.has(value.state)) {
        rowErrors.push(`${axisLabel}: unknown axis state ${value.state}`);
        continue;
      }
      if (value.state === 'COVERED') {
        if (Object.keys(value).sort().join(',') !== 'clauseRefs,state') rowErrors.push(`${axisLabel}: COVERED allows only state and clauseRefs`);
        if (!uniqueStrings(value.clauseRefs) || value.clauseRefs.length === 0) {
          rowErrors.push(`${axisLabel}: COVERED requires non-empty unique clauseRefs`);
        } else {
          for (const ref of value.clauseRefs) {
            if (!contractSemanticIds.has(ref)) rowErrors.push(`${axisLabel}: unresolved active clauseRef ${ref}`);
          }
        }
      } else if (value.state === 'NOT_APPLICABLE') {
        if (Object.keys(value).sort().join(',') !== 'reason,state') rowErrors.push(`${axisLabel}: NOT_APPLICABLE allows only state and reason`);
        const expectedReason = boundaryNotApplicableReasons.get(axis);
        if (expectedReason === undefined) {
          rowErrors.push(`${axisLabel}: core axes must be COVERED, MISSING, or OWNER_DECISION_REQUIRED`);
        } else if (value.reason !== expectedReason) {
          rowErrors.push(`${axisLabel}: NOT_APPLICABLE requires ${expectedReason}`);
        }
      } else if (value.state === 'MISSING') {
        if (Object.keys(value).sort().join(',') !== 'state') rowErrors.push(`${axisLabel}: MISSING carries no payload`);
      } else {
        if (Object.keys(value).sort().join(',') !== 'decisionRefs,state') rowErrors.push(`${axisLabel}: OWNER_DECISION_REQUIRED allows only state and decisionRefs`);
        if (!uniqueStrings(value.decisionRefs) || value.decisionRefs.length === 0) {
          rowErrors.push(`${axisLabel}: OWNER_DECISION_REQUIRED requires decisionRefs`);
        } else {
          for (const ref of value.decisionRefs) {
            if (!boundaryDecisionRefPattern.test(ref)) rowErrors.push(`${axisLabel}: invalid decision reference ${ref}`);
            else if (!unresolvedDecisionIds.has(ref)) rowErrors.push(`${axisLabel}: decision reference is not an unresolved current M1 owner decision ${ref}`);
          }
        }
      }
    }
    if (rowErrors.length === rowErrorStart) {
      derivedStatuses.set(row.operationId, deriveBoundaryStatus(row.axes));
    }
  }
  return { errors: rowErrors, derivedStatuses };
}

function checkBoundaryCalibration() {
  const fixtureClauseRefs = new Map([
    ['authority', 'FIXTURE-BOUNDARY-AUTHORITY'],
    ['identity', 'FIXTURE-BOUNDARY-IDENTITY'],
    ['commit', 'FIXTURE-BOUNDARY-COMMIT'],
    ['invalidation', 'FIXTURE-BOUNDARY-INVALIDATION'],
    ['persistence', 'FIXTURE-BOUNDARY-PERSISTENCE'],
    ['publication', 'FIXTURE-BOUNDARY-PUBLICATION'],
    ['receiptReconciliation', 'FIXTURE-BOUNDARY-RECEIPT-RECONCILIATION'],
  ]);
  const fixtureSemanticIds = new Set(fixtureClauseRefs.values());
  const completeAxes = () => Object.fromEntries(
    boundaryAxes.map((axis) => [axis, { state: 'COVERED', clauseRefs: [fixtureClauseRefs.get(axis)] }]),
  );
  const fixture = () => ({
    operationId: 'OP-non-authoritative-test-fixture',
    label: 'NON_AUTHORITATIVE_TEST_FIXTURE',
    axes: completeAxes(),
  });
  const validateFixture = (row, options = {}) => validateBoundaryOperationRows([row], fixtureSemanticIds, options);
  const calibrationErrors = [];
  const expectValidStatus = (name, row, expected) => {
    const result = validateFixture(row, { labelPrefix: `calibration ${name}` });
    if (result.errors.length > 0) calibrationErrors.push(`${name}: unexpected validation error ${result.errors.join('; ')}`);
    if (result.derivedStatuses.get(row.operationId) !== expected) calibrationErrors.push(`${name}: expected ${expected}`);
  };
  const expectRejected = (name, row) => {
    const result = validateFixture(row, { labelPrefix: `calibration ${name}` });
    if (result.errors.length === 0) calibrationErrors.push(`${name}: malformed fixture was accepted`);
  };
  const complete = fixture();
  expectValidStatus('complete', complete, 'COMPLETE');
  const identityMissing = fixture();
  identityMissing.axes.identity = { state: 'MISSING' };
  expectValidStatus('identity-missing', identityMissing, 'INCOMPLETE');
  const invalidationMissing = fixture();
  invalidationMissing.axes.invalidation = { state: 'MISSING' };
  expectValidStatus('invalidation-missing', invalidationMissing, 'INCOMPLETE');
  const unreasonedNotApplicable = fixture();
  unreasonedNotApplicable.axes.publication = { state: 'NOT_APPLICABLE' };
  expectRejected('unreasoned-not-applicable', unreasonedNotApplicable);
  const crossAxisNotApplicable = fixture();
  crossAxisNotApplicable.axes.persistence = { state: 'NOT_APPLICABLE', reason: 'NO_PUBLICATION_REQUIRED' };
  expectRejected('cross-axis-not-applicable', crossAxisNotApplicable);
  const authorityNotApplicable = fixture();
  authorityNotApplicable.axes.authority = { state: 'NOT_APPLICABLE', reason: 'NO_INVALIDATION_SOURCE' };
  expectRejected('authority-not-applicable', authorityNotApplicable);
  const identityNotApplicable = fixture();
  identityNotApplicable.axes.identity = { state: 'NOT_APPLICABLE', reason: 'NO_PERSISTENCE_REQUIRED' };
  expectRejected('identity-not-applicable', identityNotApplicable);
  const commitNotApplicable = fixture();
  commitNotApplicable.axes.commit = { state: 'NOT_APPLICABLE', reason: 'NO_PERSISTENCE_REQUIRED' };
  expectRejected('commit-not-applicable', commitNotApplicable);
  const validOptionalNotApplicable = fixture();
  validOptionalNotApplicable.axes.persistence = { state: 'NOT_APPLICABLE', reason: 'NO_PERSISTENCE_REQUIRED' };
  expectValidStatus('valid-persistence-not-applicable', validOptionalNotApplicable, 'COMPLETE');
  const decisionExtraction = unresolvedOwnerDecisionIds({
    pendingDecisions: [
      { id: 'P-001', status: 'OWNER_REQUIRED', ownerDecisionRef: 'OD-900' },
      { id: 'P-002', status: 'OWNER_REQUIRED', ownerDecisionRef: 'OD-901' },
      { id: 'P-003', status: 'PENDING_JUDGMENT', ownerDecisionRef: 'OD-902' },
      { id: 'OD-005', status: 'PENDING_JUDGMENT' },
      { id: 'P-004', status: 'OWNER_REQUIRED', ownerDecisionRef: 'OD-9' },
    ],
    ownerDecisions: [
      { id: 'OD-900', status: 'OPEN' },
      { id: 'OD-901', status: 'RESOLVED' },
      { id: 'OD-902', status: 'OPEN' },
      { id: 'OD-903', status: 'OPEN' },
      { id: 'OD-904', status: 'UNKNOWN' },
      { id: 'OD-9', status: 'OPEN' },
    ],
  });
  if ([...decisionExtraction].join(',') !== 'OD-900') {
    calibrationErrors.push(`owner-decision-extraction: expected only linked OPEN OD-900, got ${[...decisionExtraction].join(',') || '(none)'}`);
  }
  const ownerDecision = fixture();
  ownerDecision.axes.identity = { state: 'OWNER_DECISION_REQUIRED', decisionRefs: ['OD-900'] };
  ownerDecision.axes.invalidation = { state: 'MISSING' };
  const ownerDecisionResult = validateFixture(ownerDecision, {
    labelPrefix: 'calibration owner-decision-precedence',
    unresolvedDecisionIds: new Set(['OD-900']),
  });
  if (ownerDecisionResult.errors.length > 0) calibrationErrors.push(`owner-decision-precedence: unexpected validation error ${ownerDecisionResult.errors.join('; ')}`);
  if (ownerDecisionResult.derivedStatuses.get(ownerDecision.operationId) !== 'OWNER_DECISION_REQUIRED') {
    calibrationErrors.push('owner-decision-precedence: expected OWNER_DECISION_REQUIRED');
  }
  const sharedOwnerDecision = fixture();
  sharedOwnerDecision.axes.identity = { state: 'OWNER_DECISION_REQUIRED', decisionRefs: ['OD-900'] };
  sharedOwnerDecision.axes.invalidation = { state: 'OWNER_DECISION_REQUIRED', decisionRefs: ['OD-900'] };
  const sharedOwnerDecisionResult = validateFixture(sharedOwnerDecision, {
    labelPrefix: 'calibration shared-owner-decision',
    unresolvedDecisionIds: new Set(['OD-900']),
  });
  if (sharedOwnerDecisionResult.errors.length > 0) calibrationErrors.push(`shared-owner-decision: unexpected validation error ${sharedOwnerDecisionResult.errors.join('; ')}`);
  if (sharedOwnerDecisionResult.derivedStatuses.get(sharedOwnerDecision.operationId) !== 'OWNER_DECISION_REQUIRED') {
    calibrationErrors.push('shared-owner-decision: expected OWNER_DECISION_REQUIRED');
  }
  const unknownOwnerDecision = fixture();
  unknownOwnerDecision.axes.identity = { state: 'OWNER_DECISION_REQUIRED', decisionRefs: ['OD-901'] };
  const unknownOwnerDecisionResult = validateFixture(unknownOwnerDecision, {
    labelPrefix: 'calibration unknown-owner-decision',
    unresolvedDecisionIds: new Set(['OD-900']),
  });
  if (unknownOwnerDecisionResult.errors.length === 0) calibrationErrors.push('unknown-owner-decision: malformed fixture was accepted');
  const resolvedOwnerDecision = fixture();
  resolvedOwnerDecision.axes.identity = { state: 'OWNER_DECISION_REQUIRED', decisionRefs: ['OD-001'] };
  const resolvedOwnerDecisionResult = validateFixture(resolvedOwnerDecision, {
    labelPrefix: 'calibration resolved-owner-decision',
    unresolvedDecisionIds: new Set(['OD-900']),
  });
  if (resolvedOwnerDecisionResult.errors.length === 0) calibrationErrors.push('resolved-owner-decision: resolved M1 decision was accepted');
  const manualStatus = fixture();
  manualStatus.status = 'COMPLETE';
  manualStatus.axes.identity = { state: 'MISSING' };
  expectRejected('manual-status', manualStatus);
  const redundantSummary = fixture();
  redundantSummary.semanticRefs = ['FIXTURE-BOUNDARY-AUTHORITY'];
  expectRejected('redundant-semantic-refs', redundantSummary);
  const redundantOwnerRefs = fixture();
  redundantOwnerRefs.ownerDecisionRefs = [];
  expectRejected('redundant-owner-decision-refs', redundantOwnerRefs);
  for (const message of calibrationErrors) errors.push(`boundary calibration: ${message}`);
}

function checkSemanticMap(semanticMap, productDefinitions, contractSemanticIds, unresolvedDecisionIds) {
  if (semanticMap === null || typeof semanticMap !== 'object') {
    errors.push('semantic map: expected object');
    return;
  }
  if (Object.keys(semanticMap).sort().join(',') !== 'boundaryOperations,edges,schemaVersion') {
    errors.push('semantic map: only schemaVersion/edges/boundaryOperations are allowed');
  }
  if (semanticMap.schemaVersion !== 2) errors.push('semantic map: schemaVersion must be 2');
  const allowedTypes = new Set(['refines', 'constrainedBy']);
  const seen = new Set();
  const adjacency = new Map();
  const semanticExists = (id) => contractSemanticIds.has(id) || productDefinitions.has(id);
  if (!Array.isArray(semanticMap.edges)) {
    errors.push('semantic map: edges must be an array');
  } else {
    for (const [position, edge] of semanticMap.edges.entries()) {
      const label = `semantic map edge #${position}`;
      if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push(`${label}: expected object`);
        continue;
      }
      const keys = Object.keys(edge).sort();
      if (keys.join(',') !== 'from,to,type') errors.push(`${label}: only from/type/to are allowed (semantic prose is forbidden)`);
      if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !allowedTypes.has(edge.type)) {
        errors.push(`${label}: malformed edge`);
        continue;
      }
      if (edge.from === edge.to) errors.push(`${label}: self edge is forbidden`);
      const tuple = `${edge.from}\n${edge.type}\n${edge.to}`;
      if (seen.has(tuple)) errors.push(`${label}: duplicate edge ${edge.from} ${edge.type} ${edge.to}`);
      seen.add(tuple);
      for (const endpoint of [edge.from, edge.to]) {
        if (!semanticExists(endpoint)) errors.push(`${label}: unresolved semantic endpoint ${endpoint}`);
        if (/^(?:P|Q)-\d{2}$/u.test(endpoint) && productDefinitions.get(endpoint) !== 1) {
          errors.push(`${label}: product definition ${endpoint} must resolve exactly once`);
        }
      }
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      adjacency.get(edge.from).push(edge.to);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(node, trail) {
    if (visiting.has(node)) {
      errors.push(`semantic map: dependency cycle ${[...trail, node].join(' -> ')}`);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) visit(next, [...trail, node]);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of adjacency.keys()) visit(node, []);
  const boundaryResult = validateBoundaryOperationRows(semanticMap.boundaryOperations, contractSemanticIds, { unresolvedDecisionIds });
  for (const message of boundaryResult.errors) errors.push(message);
  checkBoundaryCalibration();
}

function checkLastVerifiedCommits(manifest, traceability) {
  function commitBlobHash(commit, path) {
    try {
      execFileSync('git', ['cat-file', '-e', `${commit}:${path}`], { cwd: root, stdio: 'ignore' });
      return execFileSync('git', ['rev-parse', `${commit}:${path}`], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  function workingTreeHash(path) {
    try {
      return execFileSync('git', ['hash-object', '--', path], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  for (const entry of manifest?.contracts ?? []) {
    if (entry.status !== 'generated') continue;
    if (typeof entry.lastVerifiedCommit !== 'string' || !/^[0-9a-f]{40}$/.test(entry.lastVerifiedCommit)) continue;
    const sha = entry.lastVerifiedCommit;
    try {
      execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' });
    } catch {
      errors.push(`manifest ${entry.id}: lastVerifiedCommit does not exist ${sha}`);
      continue;
    }
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' });
    } catch {
      errors.push(`manifest ${entry.id}: lastVerifiedCommit is not an ancestor of HEAD ${sha}`);
    }
    const clauseEvidence = (traceability?.clauses ?? [])
      .filter((clause) => clause.contractId === entry.id)
      .flatMap((clause) => (clause.evidenceBindings ?? []).map((verifier) => verifier.path));
    const paths = [...new Set([
      entry.path,
      ...(entry.status === 'active' ? [traceabilityRelativePath] : []),
      ...(entry.verifiedBy ?? []),
      ...clauseEvidence,
    ])].filter((path) => !['scripts/checks/check-docs.mjs', 'scripts/checks/generate-engine-api.mjs'].includes(path));
    for (const path of paths) {
      // This generated index is verified against current source by --check below.
      // Pinning its bytes to a historical commit makes every local API edit fail
      // even when regeneration is exact; authored contract/evidence hashes stay pinned.
      if (entry.id === 'GENERATED-ENGINE-API' && entry.status === 'generated' && path === 'docs/generated/engine-api.md') continue;
      const expectedHash = commitBlobHash(sha, path);
      const actualHash = workingTreeHash(path);
      if (expectedHash === null) {
        errors.push(`manifest ${entry.id}: verification evidence was not tracked at ${sha}: ${path}`);
      } else if (actualHash === null) {
        errors.push(`manifest ${entry.id}: verification evidence is missing from working tree: ${path}`);
      } else if (expectedHash !== actualHash) {
        errors.push(`manifest ${entry.id}: verification stale after ${sha}: ${path}`);
      }
    }
  }
}

function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function gitBlobHash(text) {
  const bytes = Buffer.byteLength(text, 'utf8');
  return createHash('sha1').update(`blob ${bytes}\0`, 'utf8').update(text, 'utf8').digest('hex');
}

function legacyItemKey(item) {
  const anchor = item?.sourceAnchor ?? {};
  return `${item?.sourcePath ?? ''}#L${anchor.lineStart ?? ''}-L${anchor.lineEnd ?? ''}:${item?.textHash ?? ''}`;
}

function checkLegacyInventory(inventory, validTargets) {
  if (inventory === null || typeof inventory !== 'object' || !Array.isArray(inventory.items)) {
    errors.push('legacy inventory: expected items array');
    return;
  }
  if (inventory.schemaVersion !== 2) errors.push('legacy inventory: schemaVersion must be 2');
  if (!Array.isArray(inventory.sources)) errors.push('legacy inventory: sources must be an array');

  const sourcePaths = new Set();
  for (const sourceEntry of inventory.sources ?? []) {
    if (sourceEntry === null || typeof sourceEntry !== 'object' || Array.isArray(sourceEntry)) {
      errors.push('legacy inventory: every source entry must be an object');
      continue;
    }
    if (typeof sourceEntry.path !== 'string' || typeof sourceEntry.blobSha !== 'string') {
      errors.push('legacy inventory: source entry requires path and blobSha');
      continue;
    }
    if (sourcePaths.has(sourceEntry.path)) errors.push(`legacy inventory: duplicate source ${sourceEntry.path}`);
    sourcePaths.add(sourceEntry.path);
    const source = join(root, sourceEntry.path);
    requireFile(source, `legacy inventory source ${sourceEntry.path}`);
    if (existsSync(source) && gitBlobHash(fileText(source)) !== sourceEntry.blobSha) {
      errors.push(`legacy inventory source ${sourceEntry.path}: blobSha mismatch`);
    }
  }

  const ids = new Set();
  const itemKeys = new Set();
  const anchors = new Set();
  for (const item of inventory.items) {
    for (const key of [
      'itemKey', 'legacyItemId', 'sourcePath', 'sourceAnchor', 'itemType', 'sourceText', 'textHash', 'summary',
      'suggestedDisposition', 'suggestedTargetIds', 'suggestedRationale',
    ]) {
      if (!(key in item)) errors.push(`legacy inventory ${item.legacyItemId ?? '<unknown>'}: missing ${key}`);
    }
    for (const judgeKey of ['disposition', 'targetIds', 'rationale', 'decisionRef', 'duplicateOfItemKey']) {
      if (judgeKey in item) errors.push(`legacy inventory ${item.legacyItemId ?? '<unknown>'}: judge field ${judgeKey} must live in overlay`);
    }
    if (typeof item.legacyItemId !== 'string') continue;
    if (ids.has(item.legacyItemId)) errors.push(`legacy inventory: duplicate id ${item.legacyItemId}`);
    ids.add(item.legacyItemId);
    if (typeof item.itemKey !== 'string' || item.itemKey !== legacyItemKey(item)) {
      errors.push(`legacy inventory ${item.legacyItemId}: itemKey mismatch`);
    } else if (itemKeys.has(item.itemKey)) {
      errors.push(`legacy inventory: duplicate itemKey ${item.itemKey}`);
    } else itemKeys.add(item.itemKey);

    const anchorKey = `${item.sourcePath}:${JSON.stringify(item.sourceAnchor)}`;
    if (anchors.has(anchorKey)) errors.push(`legacy inventory: duplicate source anchor ${anchorKey}`);
    anchors.add(anchorKey);
    if (!sourcePaths.has(item.sourcePath)) errors.push(`legacy inventory ${item.legacyItemId}: sourcePath is not declared in sources`);
    if (!LEGACY_SUGGESTED_DISPOSITIONS.has(item.suggestedDisposition)) {
      errors.push(`legacy inventory ${item.legacyItemId}: invalid suggestedDisposition ${item.suggestedDisposition}`);
    }

    const source = join(root, item.sourcePath ?? '');
    requireFile(source, `legacy inventory ${item.legacyItemId} source`);
    if (typeof item.sourceText !== 'string') errors.push(`legacy inventory ${item.legacyItemId}: sourceText required for hash proof`);
    else if (item.textHash !== hashText(item.sourceText)) errors.push(`legacy inventory ${item.legacyItemId}: textHash mismatch`);
    if (existsSync(source) && item.sourceAnchor && Number.isInteger(item.sourceAnchor.lineStart) && Number.isInteger(item.sourceAnchor.lineEnd)) {
      const sourceLines = fileText(source).split(/\r?\n/);
      const anchoredText = sourceLines.slice(item.sourceAnchor.lineStart - 1, item.sourceAnchor.lineEnd).join('\n');
      if (anchoredText !== item.sourceText) errors.push(`legacy inventory ${item.legacyItemId}: sourceAnchor text mismatch`);
    } else {
      errors.push(`legacy inventory ${item.legacyItemId}: sourceAnchor line range required`);
    }

    if (!Array.isArray(item.suggestedTargetIds)) {
      errors.push(`legacy inventory ${item.legacyItemId}: suggestedTargetIds must be an array`);
    } else {
      for (const target of item.suggestedTargetIds) {
        if (!validTargets.has(target)) errors.push(`legacy inventory ${item.legacyItemId}: unresolved suggested target ${target}`);
      }
    }
    if (typeof item.suggestedRationale !== 'string' || item.suggestedRationale.trim() === '') {
      errors.push(`legacy inventory ${item.legacyItemId}: suggestedRationale is required`);
    }
    if (['active-clause', 'active-acceptance'].includes(item.suggestedDisposition)) {
      if (!isActiveLegacySuggestion(item)) {
        errors.push(`legacy inventory ${item.legacyItemId}: active suggestion lacks explicit normative or numbered acceptance evidence`);
      }
      if (!Array.isArray(item.suggestedTargetIds) || item.suggestedTargetIds.length === 0) {
        errors.push(`legacy inventory ${item.legacyItemId}: active suggestion requires suggestedTargetIds`);
      }
    }
  }
}

function checkLegacyDecisions(decisions, inventory, validTargets, expectedBase) {
  if (decisions === null || typeof decisions !== 'object' || Array.isArray(decisions)) {
    errors.push('legacy decisions: expected object');
    return;
  }
  if (decisions.schemaVersion !== 1) errors.push('legacy decisions: schemaVersion must be 1');
  if (decisions.base !== expectedBase) errors.push(`legacy decisions: base must be ${expectedBase}`);
  if (!Array.isArray(decisions.decisions)) {
    errors.push('legacy decisions: decisions must be an array');
    return;
  }
  const baseItemKeys = new Set((inventory?.items ?? []).map((item) => item.itemKey));
  const seen = new Set();
  for (const decision of decisions.decisions) {
    if (seen.has(decision?.itemKey)) errors.push(`legacy decisions: duplicate decision for ${decision.itemKey}`);
    else if (typeof decision?.itemKey === 'string') seen.add(decision.itemKey);
    for (const issue of validateLegacyDecision(decision, { baseItemKeys, validTargets })) {
      errors.push(`legacy decisions ${issue}`);
    }
  }
}

function checkMigrationMap(migration) {
  if (migration === null || typeof migration !== 'object' || !Array.isArray(migration.sources)) return;
  const allowed = new Set(['active automated scenario', 'active manual scenario', 'periodic/online scenario', 'superseded', 'historical release evidence', 'status ledger material', 'unresolved conflict']);
  const counts = new Map();
  for (const entry of migration.sources) {
    const key = `${entry.source}\n${entry.heading}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!allowed.has(entry.classification)) errors.push(`migration map ${key}: invalid classification ${entry.classification}`);
    requireFile(join(root, entry.destination ?? ''), `migration map ${key}`);
  }
  for (const source of ['research/archive/document-reset-2026-08/original-acceptance.md', 'research/archive/document-reset-2026-08/original-engine-spec.md']) {
    const path = join(root, source);
    if (!existsSync(path)) continue;
    for (const heading of readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => /^#{1,6}\s/.test(line.trim())).map((line) => line.trim())) {
      const count = counts.get(`${source}\n${heading}`) ?? 0;
      if (count !== 1) errors.push(`migration map: ${source} ${heading} has ${count} destinations`);
    }
  }
}

function run() {
  requireFile(manifestPath, 'manifest');
  requireFile(scenarioPath, 'scenario registry');
  requireFile(migrationPath, 'migration map');
  requireFile(traceabilityPath, 'traceability registry');
  requireFile(productRequirementsPath, 'product requirements');
  requireFile(semanticMapPath, 'semantic map');
  requireFile(projectStatePath, 'project state');

  const manifest = readJson(manifestPath);
  checkManifest(manifest);

  const inventoryRelativePath = typeof manifest?.legacyInventory === 'string' ? manifest.legacyInventory : null;
  const decisionsRelativePath = typeof manifest?.legacyInventoryDecisions === 'string' ? manifest.legacyInventoryDecisions : null;
  const inventoryPath = inventoryRelativePath ? join(root, inventoryRelativePath) : null;
  const decisionsPath = decisionsRelativePath ? join(root, decisionsRelativePath) : null;
  if (inventoryPath) requireFile(inventoryPath, 'legacy contract inventory');
  if (decisionsPath) requireFile(decisionsPath, 'legacy contract decisions');

  const migration = readJson(migrationPath);
  const scenarios = readJson(scenarioPath);
  const traceability = readJson(traceabilityPath);
  const semanticMap = readJson(semanticMapPath);
  const projectState = readJson(projectStatePath);
  const inventory = inventoryPath && existsSync(inventoryPath) ? readJson(inventoryPath) : null;
  const decisions = decisionsPath && existsSync(decisionsPath) ? readJson(decisionsPath) : null;

  const productDefinitions = discoverProductDefinitions();
  const contractSemanticIds = discoverContractSemanticIds(manifest);
  const unresolvedDecisionIds = unresolvedOwnerDecisionIds(projectState);
  checkSemanticMap(semanticMap, productDefinitions, contractSemanticIds, unresolvedDecisionIds);
  const scenarioIds = new Set((scenarios?.scenarios ?? []).map((scenario) => scenario.id));
  const semanticTargets = new Set([...productDefinitions.keys(), ...contractSemanticIds.keys()]);
  const legacyValidTargets = new Set([...semanticTargets, ...scenarioIds]);
  checkTraceability(traceability, manifest, contractSemanticIds);
  checkScenarios(scenarios?.scenarios, migration, semanticTargets);
  checkMigrationMap(migration);
  checkLastVerifiedCommits(manifest, traceability);
  checkLegacyInventory(inventory, legacyValidTargets);
  if (decisionsRelativePath) checkLegacyDecisions(decisions, inventory, legacyValidTargets, inventoryRelativePath);

  for (const path of [
    join(root, 'README.md'), join(root, 'docs/README.md'), join(root, 'docs/acceptance.md'), join(root, 'docs/engine-spec.md'),
    join(root, 'docs/engine-state-ontology.md'),
    ...((manifest?.contracts ?? []).map((entry) => join(root, entry.path)).filter((path) => extname(path) === '.md')),
  ]) if (existsSync(path)) localLinks(path);

  for (const [script, label] of [
    ['scripts/checks/generate-engine-api.mjs', 'generated engine API'],
    ['scripts/checks/generate-legacy-inventory.mjs', 'legacy inventory'],
    ['scripts/checks/generate-migration-map.mjs', 'migration map'],
  ]) {
    const generated = execFileSync(process.execPath, [join(root, script), '--check'], { encoding: 'utf8' });
    if (generated.trim()) console.log(generated.trim());
    if (!generated.includes('PASS') && label !== 'generated engine API') {
      errors.push(`${label}: deterministic check did not report PASS`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else console.log('PASS: docs contracts, scenarios, migration map, legacy base/overlay, links, and generated assets');
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) run();
