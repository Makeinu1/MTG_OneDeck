import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { collectChangedFiles } from './change-detector.mjs';
import { DEFAULT_ROOT, resolveDomainSelection } from './validation-domain-resolver.mjs';

const PRODUCT_PATH = 'docs/product-requirements.md';
const MANIFEST_PATH = 'docs/contracts/manifest.json';
const SEMANTIC_MAP_PATH = 'docs/contracts/semantic-map.json';
const TRACEABILITY_PATH = 'docs/contracts/traceability.json';
const SCENARIOS_PATH = 'docs/acceptance/scenarios.json';
const PRODUCT_ID = /^(?:P|Q)-\d{2}$/u;
const CLAUSE_MARKER = /<!--\s*clause:\s*([A-Z0-9-]+)\s*-->/gu;
const TEST_PATH = /(?:^|\/)(?:__tests__\/.*|[^/]+\.test)\.(?:mjs|js|jsx|ts|tsx)$/u;

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readAtRef(cwd, ref, path) {
  try {
    return git(cwd, ['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

function parseJson(text, label) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function parseProduct(text) {
  const definitions = new Map();
  if (text === null) return { definitions, nonDefinition: '' };
  const kept = [];
  for (const line of text.split(/\r?\n/u)) {
    if (!line.startsWith('|')) {
      kept.push(line);
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const first = cells[0] ?? '';
    const p = first.match(/^(P-\d{2})$/u);
    const q = first.match(/^(Q-\d{2})（決定(?:・更新)?）$/u);
    const id = p?.[1] ?? q?.[1];
    if (id) definitions.set(id, line.trim());
    else kept.push(line);
  }
  return { definitions, nonDefinition: kept.join('\n').trim() };
}

function parseClauses(text) {
  const clauses = new Map();
  if (text === null) return { clauses, prefix: '' };
  const matches = [...text.matchAll(CLAUSE_MARKER)];
  if (matches.length === 0) return { clauses, prefix: text.trim() };
  const prefix = text.slice(0, matches[0].index).trim();
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    clauses.set(current[1], text.slice(current.index, next?.index ?? text.length).trim());
  }
  return { clauses, prefix };
}

function activeManifestEntries(manifest) {
  return new Map((manifest?.contracts ?? [])
    .filter((entry) => entry?.status === 'active' && typeof entry.path === 'string' && entry.path.endsWith('.md'))
    .map((entry) => [entry.id, {
      id: entry.id,
      status: entry.status,
      path: entry.path,
      authorityFor: Array.isArray(entry.authorityFor) ? [...entry.authorityFor].sort() : [],
    }]));
}

function scenarioMap(registry) {
  return new Map((registry?.scenarios ?? []).filter(Boolean).map((scenario) => [scenario.id, scenario]));
}

function traceabilityMap(registry) {
  return new Map((registry?.clauses ?? []).filter(Boolean).map((clause) => [clause.id, clause]));
}

function edgeKey(edge) {
  return `${edge.from}\n${edge.type}\n${edge.to}`;
}

function addReason(reasons, id, reason) {
  if (typeof id !== 'string' || id.length === 0) return;
  if (!reasons.has(id)) reasons.set(id, new Set());
  reasons.get(id).add(reason);
}

function addScenarioReason(reasons, id, reason) {
  if (typeof id !== 'string' || id.length === 0) return;
  if (!reasons.has(id)) reasons.set(id, new Set());
  reasons.get(id).add(reason);
}

function reverseDependencyClosure(seedReasons, edges) {
  const reasons = new Map([...seedReasons.entries()].map(([id, values]) => [id, new Set(values)]));
  const reverse = new Map();
  for (const edge of edges) {
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to).push(edge.from);
  }
  const queue = [...reasons.keys()].sort();
  for (let index = 0; index < queue.length; index += 1) {
    const target = queue[index];
    for (const dependent of (reverse.get(target) ?? []).sort()) {
      const wasKnown = reasons.has(dependent);
      addReason(reasons, dependent, `dependency:${target}`);
      if (!wasKnown) queue.push(dependent);
    }
  }
  return reasons;
}

function bindingMaps(traceability, scenarios) {
  const semanticToBindings = new Map();
  const evidencePathToSemantics = new Map();
  for (const clause of traceability?.clauses ?? []) {
    const bindings = Array.isArray(clause.evidenceBindings) ? clause.evidenceBindings : [];
    semanticToBindings.set(clause.id, bindings);
    for (const binding of bindings) {
      if (!evidencePathToSemantics.has(binding.path)) evidencePathToSemantics.set(binding.path, new Set());
      evidencePathToSemantics.get(binding.path).add(clause.id);
    }
  }

  const semanticToScenarios = new Map();
  const evidencePathToScenarios = new Map();
  for (const scenario of scenarios?.scenarios ?? []) {
    for (const semanticId of scenario.verifies ?? []) {
      if (!semanticToScenarios.has(semanticId)) semanticToScenarios.set(semanticId, new Set());
      semanticToScenarios.get(semanticId).add(scenario.id);
    }
    for (const path of scenario.automatedBy ?? []) {
      if (!evidencePathToScenarios.has(path)) evidencePathToScenarios.set(path, new Set());
      evidencePathToScenarios.get(path).add(scenario.id);
    }
  }
  return { semanticToBindings, evidencePathToSemantics, semanticToScenarios, evidencePathToScenarios };
}

function compareProduct(baseText, headText, reasons) {
  const base = parseProduct(baseText);
  const head = parseProduct(headText);
  const ids = new Set([...base.definitions.keys(), ...head.definitions.keys()]);
  for (const id of ids) {
    if (base.definitions.get(id) !== head.definitions.get(id)) addReason(reasons, id, `product-definition:${id}`);
  }
  if (base.nonDefinition !== head.nonDefinition) {
    for (const id of ids) addReason(reasons, id, 'product-unattributed-prose');
  }
}

function compareContract(baseText, headText, path, reasons) {
  const base = parseClauses(baseText);
  const head = parseClauses(headText);
  const ids = new Set([...base.clauses.keys(), ...head.clauses.keys()]);
  for (const id of ids) {
    if (base.clauses.get(id) !== head.clauses.get(id)) addReason(reasons, id, `contract-clause:${path}`);
  }
  if (base.prefix !== head.prefix) {
    for (const id of ids) addReason(reasons, id, `contract-unattributed-prose:${path}`);
  }
}

function compareManifest(baseManifest, headManifest, cwd, base, head, reasons) {
  const baseEntries = activeManifestEntries(baseManifest);
  const headEntries = activeManifestEntries(headManifest);
  const ids = new Set([...baseEntries.keys(), ...headEntries.keys()]);
  for (const id of ids) {
    const before = baseEntries.get(id);
    const after = headEntries.get(id);
    if (stableJson(before) === stableJson(after)) continue;
    const paths = new Set([before?.path, after?.path].filter(Boolean));
    for (const path of paths) {
      const parsedBase = parseClauses(readAtRef(cwd, base, path));
      const parsedHead = parseClauses(readAtRef(cwd, head, path));
      for (const semanticId of new Set([...parsedBase.clauses.keys(), ...parsedHead.clauses.keys()])) {
        addReason(reasons, semanticId, `manifest-owner:${id}`);
      }
    }
  }
}

function compareSemanticMap(baseMap, headMap, reasons) {
  const baseEdges = new Map((baseMap?.edges ?? []).map((edge) => [edgeKey(edge), edge]));
  const headEdges = new Map((headMap?.edges ?? []).map((edge) => [edgeKey(edge), edge]));
  for (const key of new Set([...baseEdges.keys(), ...headEdges.keys()])) {
    if (baseEdges.has(key) && headEdges.has(key)) continue;
    const edge = headEdges.get(key) ?? baseEdges.get(key);
    addReason(reasons, edge.from, `semantic-edge:${edge.type}:${edge.to}`);
    addReason(reasons, edge.to, `semantic-edge:${edge.type}:${edge.from}`);
  }
}

function scenarioChangeDetails(baseScenarios, headScenarios) {
  const before = scenarioMap(baseScenarios);
  const after = scenarioMap(headScenarios);
  const details = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const prior = before.get(id);
    const next = after.get(id);
    if (stableJson(prior) === stableJson(next)) continue;

    const semanticRefs = [...new Set([...(prior?.verifies ?? []), ...(next?.verifies ?? [])])].sort();
    if (!prior) {
      details.push({ id, kind: 'added', semanticRefs, requiresExecution: false, reasons: ['acceptance-added'] });
      continue;
    }
    if (!next) {
      details.push({ id, kind: 'removed', semanticRefs, requiresExecution: false, reasons: ['acceptance-removed'] });
      continue;
    }

    const reasons = [];
    if (stableJson(prior.verifies ?? []) !== stableJson(next.verifies ?? [])) reasons.push('verification-claim-changed');
    const executionProjection = (scenario) => ({
      status: scenario.status,
      manualOnly: scenario.manualOnly,
      automatedBy: scenario.automatedBy ?? [],
      preconditions: scenario.preconditions ?? [],
      steps: scenario.steps ?? [],
      oracle: scenario.oracle,
    });
    if (stableJson(executionProjection(prior)) !== stableJson(executionProjection(next))) {
      reasons.push('acceptance-execution-contract-changed');
    }
    if (reasons.length === 0) reasons.push('acceptance-metadata-changed');
    details.push({
      id,
      kind: 'modified',
      semanticRefs,
      requiresExecution: reasons.some((reason) => reason !== 'acceptance-metadata-changed'),
      reasons,
    });
  }
  return details.sort((a, b) => a.id.localeCompare(b.id));
}

function directBindingChangeDetails(baseTrace, headTrace) {
  const before = traceabilityMap(baseTrace);
  const after = traceabilityMap(headTrace);
  const details = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const prior = before.get(id);
    const next = after.get(id);
    if (stableJson(prior) === stableJson(next)) continue;
    if (!prior) {
      details.push({ id, kind: 'added', weakensOrInvalidates: false });
      continue;
    }
    if (!next) {
      details.push({ id, kind: 'removed', weakensOrInvalidates: true });
      continue;
    }
    const projection = (clause) => ({
      verificationDisposition: clause.verificationDisposition,
      evidenceBindings: clause.evidenceBindings ?? [],
      manualProcedure: clause.manualProcedure ?? null,
      needsDecision: clause.needsDecision ?? null,
    });
    details.push({
      id,
      kind: 'modified',
      weakensOrInvalidates: stableJson(projection(prior)) !== stableJson(projection(next)),
    });
  }
  return details.sort((a, b) => a.id.localeCompare(b.id));
}

function sortedReasons(map) {
  return Object.fromEntries([...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, reasons]) => [id, [...reasons].sort()]));
}

function testProject(path) {
  return path.startsWith('src/engine/') ? 'core' : 'dom';
}

export function buildVerificationPlan({
  cwd = DEFAULT_ROOT,
  base,
  head = 'HEAD',
} = {}) {
  if (!base) throw new Error('semantic verification requires explicit base');
  if (!head) throw new Error('semantic verification requires explicit head');

  const changes = collectChangedFiles({ cwd, base, head });
  const baseRef = changes.base;
  const headRef = changes.head;
  const files = changes.files;

  const baseManifest = parseJson(readAtRef(cwd, baseRef, MANIFEST_PATH), `${MANIFEST_PATH}@base`) ?? { contracts: [] };
  const headManifest = parseJson(readAtRef(cwd, headRef, MANIFEST_PATH), `${MANIFEST_PATH}@head`) ?? { contracts: [] };
  const baseMap = parseJson(readAtRef(cwd, baseRef, SEMANTIC_MAP_PATH), `${SEMANTIC_MAP_PATH}@base`) ?? { edges: [] };
  const headMap = parseJson(readAtRef(cwd, headRef, SEMANTIC_MAP_PATH), `${SEMANTIC_MAP_PATH}@head`) ?? { edges: [] };
  const baseTrace = parseJson(readAtRef(cwd, baseRef, TRACEABILITY_PATH), `${TRACEABILITY_PATH}@base`) ?? { clauses: [] };
  const headTrace = parseJson(readAtRef(cwd, headRef, TRACEABILITY_PATH), `${TRACEABILITY_PATH}@head`) ?? { clauses: [] };
  const baseScenarios = parseJson(readAtRef(cwd, baseRef, SCENARIOS_PATH), `${SCENARIOS_PATH}@base`) ?? { scenarios: [] };
  const headScenarios = parseJson(readAtRef(cwd, headRef, SCENARIOS_PATH), `${SCENARIOS_PATH}@head`) ?? { scenarios: [] };

  const directReasons = new Map();
  const scenarioReasons = new Map();

  if (files.includes(PRODUCT_PATH)) {
    compareProduct(readAtRef(cwd, baseRef, PRODUCT_PATH), readAtRef(cwd, headRef, PRODUCT_PATH), directReasons);
  }

  const activePaths = new Set([
    ...[...activeManifestEntries(baseManifest).values()].map((entry) => entry.path),
    ...[...activeManifestEntries(headManifest).values()].map((entry) => entry.path),
  ]);
  for (const path of [...activePaths].sort()) {
    if (!files.includes(path)) continue;
    compareContract(readAtRef(cwd, baseRef, path), readAtRef(cwd, headRef, path), path, directReasons);
  }

  if (files.includes(MANIFEST_PATH)) compareManifest(baseManifest, headManifest, cwd, baseRef, headRef, directReasons);
  if (files.includes(SEMANTIC_MAP_PATH)) compareSemanticMap(baseMap, headMap, directReasons);

  const scenarioChanges = files.includes(SCENARIOS_PATH)
    ? scenarioChangeDetails(baseScenarios, headScenarios)
    : [];
  for (const change of scenarioChanges) {
    for (const reason of change.reasons) addScenarioReason(scenarioReasons, change.id, reason);
    if (change.kind === 'removed' || change.requiresExecution || change.reasons.includes('verification-claim-changed')) {
      for (const semanticId of change.semanticRefs) {
        addReason(directReasons, semanticId, `acceptance-spec:${change.id}:${change.reasons.join('+')}`);
      }
    }
  }

  const directBindingChanges = files.includes(TRACEABILITY_PATH)
    ? directBindingChangeDetails(baseTrace, headTrace)
    : [];
  for (const change of directBindingChanges) {
    if (change.weakensOrInvalidates) addReason(directReasons, change.id, `direct-binding:${change.kind}`);
  }

  const maps = bindingMaps(headTrace, headScenarios);
  const baseMaps = bindingMaps(baseTrace, baseScenarios);

  for (const path of files) {
    const semanticIds = new Set([
      ...(maps.evidencePathToSemantics.get(path) ?? []),
      ...(baseMaps.evidencePathToSemantics.get(path) ?? []),
    ]);
    for (const id of semanticIds) addReason(directReasons, id, `evidence-path:${path}`);

    const scenarioIds = new Set([
      ...(maps.evidencePathToScenarios.get(path) ?? []),
      ...(baseMaps.evidencePathToScenarios.get(path) ?? []),
    ]);
    for (const id of scenarioIds) addScenarioReason(scenarioReasons, id, `scenario-evidence-path:${path}`);
  }

  const implementationFiles = files.filter((path) => path.startsWith('src/') && !TEST_PATH.test(path));
  let domainSelection = {
    files: [],
    selectedDomains: [],
    testFiles: [],
    unknownFiles: [],
    escalation: 'targeted',
    reasons: [],
  };
  if (implementationFiles.length > 0) {
    domainSelection = resolveDomainSelection({ root: cwd, files: implementationFiles });
    for (const test of domainSelection.testFiles) {
      for (const id of maps.evidencePathToSemantics.get(test) ?? []) addReason(directReasons, id, `validation-domain-test:${test}`);
      for (const id of maps.evidencePathToScenarios.get(test) ?? []) addScenarioReason(scenarioReasons, id, `validation-domain-test:${test}`);
    }
  }

  const edgeUnion = new Map([
    ...(baseMap.edges ?? []).map((edge) => [edgeKey(edge), edge]),
    ...(headMap.edges ?? []).map((edge) => [edgeKey(edge), edge]),
  ]);
  const impactReasons = reverseDependencyClosure(directReasons, [...edgeUnion.values()]);

  const headScenarioMap = scenarioMap(headScenarios);
  for (const scenario of headScenarioMap.values()) {
    if ((scenario.verifies ?? []).some((id) => impactReasons.has(id))) {
      addScenarioReason(scenarioReasons, scenario.id, 'verifies-impacted-semantic');
    }
  }

  const impactedSemantics = [...impactReasons.keys()].sort();
  const impactedScenarios = [...scenarioReasons.keys()].filter((id) => headScenarioMap.has(id)).sort();
  const executionScenarios = impactedScenarios.filter((id) => {
    const reasons = scenarioReasons.get(id) ?? new Set();
    return [...reasons].some((reason) =>
      reason !== 'acceptance-added' && reason !== 'acceptance-metadata-changed');
  });

  const directEvidence = [];
  const characterizationOnly = [];
  const unbound = [];
  for (const id of impactedSemantics) {
    const bindings = maps.semanticToBindings.get(id) ?? [];
    const scenarios = maps.semanticToScenarios.get(id) ?? new Set();
    if (bindings.length === 0 && scenarios.size === 0) unbound.push(id);
    if (bindings.length > 0 && !bindings.some((binding) => binding.role === 'conformance') && scenarios.size === 0) {
      characterizationOnly.push(id);
    }
    for (const binding of bindings) directEvidence.push({ semanticId: id, ...binding });
  }

  const scenarioEvidence = [];
  const manualRequired = [];
  const deferredScenarios = [];
  for (const id of executionScenarios) {
    const scenario = headScenarioMap.get(id);
    if (scenario.status === 'deferred') deferredScenarios.push(id);
    if (scenario.manualOnly) manualRequired.push(id);
    for (const path of scenario.automatedBy ?? []) scenarioEvidence.push({ scenarioId: id, path });
  }

  const headTraceMap = traceabilityMap(headTrace);
  const deferredSemantics = impactedSemantics.filter((id) => headTraceMap.get(id)?.verificationDisposition === 'deferred-needs-decision');

  const requiredTests = [...new Set([
    ...directEvidence.map((binding) => binding.path),
    ...scenarioEvidence.map((binding) => binding.path),
    ...domainSelection.testFiles,
  ].filter((path) => TEST_PATH.test(path)))].sort();

  const testsByProject = {
    core: requiredTests.filter((path) => testProject(path) === 'core'),
    dom: requiredTests.filter((path) => testProject(path) === 'dom'),
  };

  const unknownImplementationCoverage = implementationFiles.length > 0
    && (domainSelection.unknownFiles.length > 0
      || (impactReasons.size === 0 && scenarioReasons.size === 0));

  const blockers = {
    manualRequired: [...new Set(manualRequired)].sort(),
    deferredScenarios: [...new Set(deferredScenarios)].sort(),
    deferredSemantics: [...new Set(deferredSemantics)].sort(),
    unbound: [...new Set(unbound)].sort(),
    characterizationOnly: [...new Set(characterizationOnly)].sort(),
    unknownCoverage: unknownImplementationCoverage ? [...domainSelection.unknownFiles].sort() : [],
  };

  const hasBlockingObligation = Object.values(blockers).some((items) => items.length > 0);
  const coverage = unknownImplementationCoverage
    ? 'UNKNOWN_COVERAGE'
    : hasBlockingObligation ? 'PARTIAL' : 'VERIFIED_WITHIN_DECLARED_COVERAGE';

  return {
    schemaVersion: 1,
    base: baseRef,
    head: headRef,
    changedFiles: files,
    semanticImpact: sortedReasons(impactReasons),
    verificationSpecChanges: {
      scenarios: scenarioChanges,
      directBindings: directBindingChanges,
    },
    scenarioImpact: sortedReasons(scenarioReasons),
    executionScenarioImpact: executionScenarios,
    evidence: {
      direct: directEvidence.sort((a, b) => `${a.semanticId}:${a.path}`.localeCompare(`${b.semanticId}:${b.path}`)),
      scenario: scenarioEvidence.sort((a, b) => `${a.scenarioId}:${a.path}`.localeCompare(`${b.scenarioId}:${b.path}`)),
    },
    domainSelection: {
      implementationFiles,
      selectedDomains: domainSelection.selectedDomains,
      escalation: domainSelection.escalation,
      unknownFiles: domainSelection.unknownFiles,
      reasons: domainSelection.reasons,
    },
    requiredTests,
    testsByProject,
    blockers,
    coverage,
    verificationSpecFreshness: scenarioChanges.length > 0 || directBindingChanges.length > 0 ? 'CHANGED' : 'UNCHANGED',
    semanticVerdict: 'NOT_COMPUTED',
  };
}

export function readCurrentVerificationState(root = DEFAULT_ROOT) {
  const manifest = JSON.parse(readFileSync(resolve(root, MANIFEST_PATH), 'utf8'));
  const semanticMap = JSON.parse(readFileSync(resolve(root, SEMANTIC_MAP_PATH), 'utf8'));
  const traceability = JSON.parse(readFileSync(resolve(root, TRACEABILITY_PATH), 'utf8'));
  const scenarios = JSON.parse(readFileSync(resolve(root, SCENARIOS_PATH), 'utf8'));
  return { manifest, semanticMap, traceability, scenarios };
}

export function verificationConstants() {
  return {
    PRODUCT_PATH,
    MANIFEST_PATH,
    SEMANTIC_MAP_PATH,
    TRACEABILITY_PATH,
    SCENARIOS_PATH,
  };
}

export { directBindingChangeDetails, parseProduct, parseClauses, scenarioChangeDetails, stableJson };
