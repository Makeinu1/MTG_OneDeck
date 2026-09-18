#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isActiveLegacyItem } from './legacy-inventory-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = join(root, 'docs/contracts/manifest.json');
const scenarioPath = join(root, 'docs/acceptance/scenarios.json');
const migrationPath = join(root, 'research/archive/document-reset-2026-08/migration-map.json');
const traceabilityPath = join(root, 'docs/contracts/traceability.json');
const traceabilityRelativePath = relative(root, traceabilityPath);
const productRequirementsPath = join(root, 'docs/product-requirements.md');
const semanticMapPath = join(root, 'docs/contracts/semantic-map.json');
const inventoryPath = join(root, 'research/archive/document-reset-2026-08/legacy-contract-inventory.json');
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
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const byId = new Map();
  const authorities = new Map();
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      errors.push('manifest: every contract entry must be an object');
      continue;
    }
    for (const key of ['id', 'status', 'path', 'authorityFor', 'owner', 'dependsOn', 'supersedes', 'verifiedBy', 'lastVerifiedCommit']) {
      if (!(key in entry)) errors.push(`manifest ${entry.id ?? '<unknown>'}: missing ${key}`);
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
    for (const verifier of entry.verifiedBy ?? []) requireFile(join(root, verifier), `manifest ${entry.id} verifiedBy`);
    if (typeof entry.lastVerifiedCommit !== 'string' || !/^[0-9a-f]{40}$/.test(entry.lastVerifiedCommit)) errors.push(`manifest ${entry.id}: invalid lastVerifiedCommit`);
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
    for (const path of scenario.automatedBy ?? []) requireFile(join(root, path), `scenario ${scenario.id} automatedBy`);
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
    for (const key of ['id', 'contractId', 'status', 'sourcePath', 'sourceMarker', 'verificationDisposition', 'verifiedBy']) {
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
    if (!['automated', 'acceptance', 'manual', 'deferred-needs-decision'].includes(clause.verificationDisposition)) {
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
    if (!Array.isArray(clause.verifiedBy) || clause.verifiedBy.length === 0) errors.push(`traceability ${clause.id}: no verification evidence`);
    for (const verifier of clause.verifiedBy ?? []) {
      if (!verifier.path || !verifier.marker || !verifier.kind) errors.push(`traceability ${clause.id}: malformed verifiedBy entry`);
      else checkMarker(verifier.path, verifier.marker, clause.id);
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

function checkSemanticMap(semanticMap, productDefinitions, contractSemanticIds) {
  if (semanticMap === null || typeof semanticMap !== 'object') {
    errors.push('semantic map: expected object');
    return;
  }
  if (semanticMap.schemaVersion !== 1) errors.push('semantic map: schemaVersion must be 1');
  if (!Array.isArray(semanticMap.edges)) {
    errors.push('semantic map: edges must be an array');
    return;
  }
  const allowedTypes = new Set(['refines', 'constrainedBy']);
  const seen = new Set();
  const adjacency = new Map();
  const semanticExists = (id) => contractSemanticIds.has(id) || productDefinitions.has(id);
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
      .flatMap((clause) => (clause.verifiedBy ?? []).map((verifier) => verifier.path));
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

function checkLegacyInventory(inventory, clauseIds, scenarioIds) {
  if (inventory === null || typeof inventory !== 'object' || !Array.isArray(inventory.items)) {
    errors.push('legacy inventory: expected items array');
    return;
  }
  const dispositions = new Set(['active-clause', 'active-acceptance', 'covered-by', 'archived-historical', 'duplicate-of', 'obsolete-by-explicit-decision', 'deferred-needs-decision']);
  const ids = new Set();
  const anchors = new Set();
  const validTargets = new Set([...clauseIds, ...scenarioIds]);
  for (const item of inventory.items) {
    for (const key of ['legacyItemId', 'sourcePath', 'sourceAnchor', 'itemType', 'textHash', 'summary', 'disposition', 'targetIds', 'rationale']) {
      if (!(key in item)) errors.push(`legacy inventory ${item.legacyItemId ?? '<unknown>'}: missing ${key}`);
    }
    if (typeof item.legacyItemId !== 'string') continue;
    if (ids.has(item.legacyItemId)) errors.push(`legacy inventory: duplicate id ${item.legacyItemId}`);
    ids.add(item.legacyItemId);
    const anchorKey = `${item.sourcePath}:${JSON.stringify(item.sourceAnchor)}`;
    if (anchors.has(anchorKey)) errors.push(`legacy inventory: duplicate source anchor ${anchorKey}`);
    anchors.add(anchorKey);
    if (!dispositions.has(item.disposition)) errors.push(`legacy inventory ${item.legacyItemId}: invalid disposition ${item.disposition}`);
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
    if (item.disposition === 'deferred-needs-decision' && typeof item.rationale !== 'string') errors.push(`legacy inventory ${item.legacyItemId}: deferred rationale required`);
    if (item.disposition === 'archived-historical' && typeof item.rationale !== 'string') errors.push(`legacy inventory ${item.legacyItemId}: historical rationale required`);
    if (item.disposition === 'duplicate-of' && (!Array.isArray(item.targetIds) || item.targetIds.length !== 1 || !ids.has(item.targetIds[0]))) errors.push(`legacy inventory ${item.legacyItemId}: duplicate-of target must exist`);
    if (['active-clause', 'active-acceptance', 'covered-by'].includes(item.disposition)) {
      if (!isActiveLegacyItem(item)) errors.push(`legacy inventory ${item.legacyItemId}: active disposition lacks explicit normative or numbered acceptance evidence`);
      if (!Array.isArray(item.targetIds) || item.targetIds.length === 0) errors.push(`legacy inventory ${item.legacyItemId}: targetIds required`);
      for (const target of item.targetIds ?? []) if (!validTargets.has(target)) errors.push(`legacy inventory ${item.legacyItemId}: unresolved target ${target}`);
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
  requireFile(inventoryPath, 'legacy contract inventory');
  const manifest = readJson(manifestPath);
  const migration = readJson(migrationPath);
  const scenarios = readJson(scenarioPath);
  const traceability = readJson(traceabilityPath);
  const semanticMap = readJson(semanticMapPath);
  const inventory = readJson(inventoryPath);
  checkManifest(manifest);
  const productDefinitions = discoverProductDefinitions();
  const contractSemanticIds = discoverContractSemanticIds(manifest);
  checkSemanticMap(semanticMap, productDefinitions, contractSemanticIds);
  const scenarioIds = new Set((scenarios?.scenarios ?? []).map((scenario) => scenario.id));
  const semanticTargets = new Set([...productDefinitions.keys(), ...contractSemanticIds.keys()]);
  checkTraceability(traceability, manifest, contractSemanticIds);
  checkScenarios(scenarios?.scenarios, migration, semanticTargets);
  checkMigrationMap(migration);
  checkLastVerifiedCommits(manifest, traceability);
  checkLegacyInventory(inventory, new Set([...contractSemanticIds.keys(), ...productDefinitions.keys()]), scenarioIds);
  for (const path of [
    join(root, 'README.md'), join(root, 'docs/README.md'), join(root, 'docs/acceptance.md'), join(root, 'docs/engine-spec.md'),
    join(root, 'docs/engine-state-ontology.md'),
    ...((manifest?.contracts ?? []).map((entry) => join(root, entry.path)).filter((path) => extname(path) === '.md')),
  ]) if (existsSync(path)) localLinks(path);
  const generated = execFileSync(process.execPath, [join(root, 'scripts/checks/generate-engine-api.mjs'), '--check'], { encoding: 'utf8' });
  if (generated.trim()) console.log(generated.trim());
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    process.exitCode = 1;
  } else console.log(`PASS: docs contracts, scenarios, migration map, links, and generated API`);
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) run();
