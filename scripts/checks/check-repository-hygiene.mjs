#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const REGISTRY_PATH = 'scripts/checks/repository-hygiene.json';
const EVIDENCE_REGISTRY_PATH = 'scripts/evidence/registry.json';
const JOURNEY_REGISTRY_PATH = 'scripts/journeys/registry.json';
const PACKAGE_PATH = 'package.json';

function readJson(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function fileText(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function walk(root, directory) {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  const result = [];
  for (const name of readdirSync(absolute)) {
    const path = join(absolute, name);
    const rel = relative(root, path).replaceAll('\\', '/');
    if (statSync(path).isDirectory()) result.push(...walk(root, rel));
    else result.push(rel);
  }
  return result.sort();
}

function stem(path) {
  const name = basename(path);
  return name.slice(0, name.length - extname(name).length);
}

export function detectWriteCapable(content) {
  return /\b(?:contents|pages|id-token|actions|pull-requests):\s*write\b/u.test(content)
    || /cloudflare\/wrangler-action@/u.test(content)
    || /actions\/deploy-pages@/u.test(content)
    || /\bgit\s+push\b/u.test(content);
}

export function discoverWorkflows(root = DEFAULT_ROOT) {
  return walk(root, '.github/workflows').filter((path) => /\.ya?ml$/u.test(path)).sort();
}

export function discoverEvidenceAssets(root = DEFAULT_ROOT) {
  return walk(root, 'scripts/online')
    .filter((path) => /(?:evidence|journey|uat)/iu.test(basename(path)))
    .filter((path) => /\.(?:mjs|js|ts|tsx)$/u.test(path))
    .sort();
}

export function historicalAuthorizationNeedsMarker(content, phrases) {
  return phrases.some((phrase) => content.includes(phrase));
}

function hasExactLine(content, marker) {
  return content.split(/\r?\n/u).some((line) => line.trim() === marker);
}

function exactSetErrors(label, actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return [
    ...[...actualSet].filter((item) => !expectedSet.has(item)).map((item) => label + ': unclassified ' + item),
    ...[...expectedSet].filter((item) => !actualSet.has(item)).map((item) => label + ': registered but missing ' + item),
  ];
}

function consumerMentions(root, consumer, asset) {
  if (!existsSync(resolve(root, consumer))) return false;
  const content = fileText(root, consumer);
  return content.includes(asset) || content.includes(stem(asset));
}

function workflowJobExists(content, job) {
  if (!job) return false;
  return content.split(/\r?\n/u).some((line) => line === '  ' + job + ':');
}

function workflowPathRefs(content) {
  return [...content.matchAll(/\.github\/(?:workflows\/[A-Za-z0-9._/-]+\.ya?ml|[A-Za-z0-9._/-]+\.(?:marker|patch))/gu)]
    .map((match) => match[0]);
}

export function validateRepositoryHygiene({ root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const registry = readJson(root, REGISTRY_PATH);
  if (registry.schemaVersion !== 1 || registry.status !== 'CURRENT_REPOSITORY_HYGIENE') {
    errors.push('registry: invalid schemaVersion/status');
  }

  const workflowEntries = Array.isArray(registry.workflows) ? registry.workflows : [];
  errors.push(...exactSetErrors('workflow', discoverWorkflows(root), workflowEntries.map((entry) => entry.path)));
  for (const entry of workflowEntries) {
    const absolute = resolve(root, entry.path);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, 'utf8');
    const detected = detectWriteCapable(content);
    if (detected !== entry.writeCapable) {
      errors.push('workflow ' + entry.path + ': writeCapable registry=' + entry.writeCapable + ' detected=' + detected);
    }
    if (!entry.owner || !entry.purpose) errors.push('workflow ' + entry.path + ': owner/purpose required');
    for (const ref of workflowPathRefs(content)) {
      if (!existsSync(resolve(root, ref))) errors.push('workflow ' + entry.path + ': dangling workflow reference ' + ref);
    }
  }

  for (const provenance of registry.retainedProvenance ?? []) {
    if (!provenance.id || !provenance.reason) errors.push('retained provenance: id/reason required');
    if (provenance.lifecycle !== 'HISTORICAL_PROVENANCE') {
      errors.push('retained provenance ' + provenance.id + ': lifecycle must be HISTORICAL_PROVENANCE');
    }
    if (!Array.isArray(provenance.paths) || provenance.paths.length === 0) {
      errors.push('retained provenance ' + provenance.id + ': paths required');
      continue;
    }
    const retainedPaths = new Set(provenance.paths);
    for (const path of provenance.paths) {
      if (!existsSync(resolve(root, path))) errors.push('retained provenance ' + provenance.id + ': missing ' + path);
    }
    for (const [path, markers] of Object.entries(provenance.requiredMarkers ?? {})) {
      if (!retainedPaths.has(path)) {
        errors.push('retained provenance ' + provenance.id + ': marker path is not retained ' + path);
        continue;
      }
      if (!Array.isArray(markers) || markers.length === 0) {
        errors.push('retained provenance ' + provenance.id + ': requiredMarkers must be non-empty for ' + path);
        continue;
      }
      if (!existsSync(resolve(root, path))) continue;
      const content = fileText(root, path);
      for (const marker of markers) {
        if (!hasExactLine(content, marker)) {
          errors.push('retained provenance ' + provenance.id + ': ' + path + ' lacks ' + marker);
        }
      }
    }
  }

  for (const guard of registry.inheritedGuards ?? []) {
    if (!guard.id || !guard.owner || !guard.guarantee) errors.push('inherited guard: id/owner/guarantee required');
    for (const path of guard.paths ?? []) {
      if (!existsSync(resolve(root, path))) errors.push('inherited guard ' + guard.id + ': missing ' + path);
    }
  }

  for (const surface of registry.compatibilitySurfaces ?? []) {
    if (surface.lifecycle !== 'COMPATIBILITY') errors.push('compatibility ' + surface.id + ': lifecycle must remain COMPATIBILITY');
    if (!surface.id || !surface.retirementPrecondition) errors.push('compatibility: id/retirementPrecondition required');
    for (const path of surface.paths ?? []) {
      if (!existsSync(resolve(root, path))) errors.push('compatibility ' + surface.id + ': missing retained path ' + path);
    }
  }

  const architecture = registry.architectureGuard ?? {};
  if (!architecture.root || !existsSync(resolve(root, architecture.root))) {
    errors.push('architecture guard: root missing');
  }
  if (!architecture.validationDomainPath || !existsSync(resolve(root, architecture.validationDomainPath))) {
    errors.push('architecture guard: validation domain file missing');
  } else if (!fileText(root, architecture.validationDomainPath).includes(architecture.requiredPattern ?? '')) {
    errors.push('architecture guard: validation-domain ownership pattern missing ' + architecture.requiredPattern);
  }

  const auth = registry.historicalAuthorization ?? {};
  const marker = auth.requiredMarker ?? 'NON-REPLAYABLE';
  for (const path of auth.paths ?? []) {
    if (!existsSync(resolve(root, path))) errors.push('historical authorization: missing ' + path);
    else if (!fileText(root, path).includes(marker)) errors.push('historical authorization: ' + path + ' lacks ' + marker);
  }
  const markdown = [...walk(root, 'docs'), ...walk(root, 'research')].filter((path) => path.endsWith('.md'));
  for (const path of markdown) {
    const content = fileText(root, path);
    if (historicalAuthorizationNeedsMarker(content, auth.discoveryPhrases ?? []) && !content.includes(marker)) {
      errors.push('historical authorization: discovered replayable-looking record ' + path);
    }
  }

  const evidenceEntries = Array.isArray(registry.evidenceAssets) ? registry.evidenceAssets : [];
  errors.push(...exactSetErrors('evidence', discoverEvidenceAssets(root), evidenceEntries.map((entry) => entry.path)));
  for (const entry of evidenceEntries) {
    if (!existsSync(resolve(root, entry.path))) continue;
    if (!entry.owner || !entry.reason || !entry.lifecycle) {
      errors.push('evidence ' + entry.path + ': lifecycle/owner/reason required');
    }
    if (!Array.isArray(entry.consumers)) errors.push('evidence ' + entry.path + ': consumers must be an array');
    if (entry.lifecycle !== 'HISTORICAL' && (entry.consumers?.length ?? 0) === 0) {
      errors.push('evidence ' + entry.path + ': active/shared asset requires a consumer');
    }
    for (const consumer of entry.consumers ?? []) {
      if (!existsSync(resolve(root, consumer))) errors.push('evidence ' + entry.path + ': missing consumer ' + consumer);
      else if (!consumerMentions(root, consumer, entry.path)) errors.push('evidence ' + entry.path + ': consumer ' + consumer + ' no longer references asset');
    }
  }

  const evidenceRegistry = readJson(root, EVIDENCE_REGISTRY_PATH);
  for (const contract of evidenceRegistry.contracts ?? []) {
    const executorPaths = [contract.executor?.script, contract.executor?.harness].filter(Boolean);
    for (const path of executorPaths) {
      if (!existsSync(resolve(root, path))) errors.push('evidence contract ' + contract.id + ': missing executor ' + path);
    }
    const workflow = contract.executionPath?.workflow;
    if (!workflow || !existsSync(resolve(root, workflow))) {
      errors.push('evidence contract ' + contract.id + ': missing workflow ' + (workflow ?? '<none>'));
      continue;
    }
    const content = fileText(root, workflow);
    if (!workflowJobExists(content, contract.executionPath?.job ?? '')) {
      errors.push('evidence contract ' + contract.id + ': workflow job missing ' + contract.executionPath?.job);
    }
    if (contract.executionPath?.artifact && !content.includes(contract.executionPath.artifact)) {
      errors.push('evidence contract ' + contract.id + ': artifact not owned by workflow');
    }
    for (const path of executorPaths) {
      if (!content.includes(basename(path))) errors.push('evidence contract ' + contract.id + ': workflow does not execute/reference ' + path);
    }
  }

  const duplicatePurposes = new Map();
  for (const entry of workflowEntries) {
    const key = String(entry.owner) + '\0' + String(entry.purpose);
    const prior = duplicatePurposes.get(key);
    if (prior) errors.push('workflow duplicate-gate purpose: ' + prior + ' and ' + entry.path);
    else duplicatePurposes.set(key, entry.path);
  }

  const pkg = readJson(root, PACKAGE_PATH);
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (typeof command !== 'string') continue;
    const localRefs = [...command.matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9._/-]+\.(?:mjs|js|ts|tsx))(?:\s|$)/gu)]
      .map((match) => match[1]);
    for (const path of localRefs) {
      if (!existsSync(resolve(root, path))) errors.push('execution-orphan package script ' + name + ': missing ' + path);
    }
  }

  for (const entry of workflowEntries) {
    if (!existsSync(resolve(root, entry.path))) continue;
    const content = fileText(root, entry.path);
    const localRefs = [...content.matchAll(/(?:^|[\s"'=])(scripts\/[A-Za-z0-9._/-]+\.(?:mjs|js|ts|tsx))(?:[\s"'$]|$)/gmu)]
      .map((match) => match[1]);
    for (const path of localRefs) {
      if (!existsSync(resolve(root, path))) errors.push('execution-orphan workflow ' + entry.path + ': missing ' + path);
    }
  }

  const journeys = readJson(root, JOURNEY_REGISTRY_PATH);
  for (const journey of journeys.journeys ?? []) {
    for (const path of [journey.designSource, journey.acceptanceSource]) {
      if (!existsSync(resolve(root, path))) errors.push('journey ' + journey.id + ': missing source ' + path);
    }
    for (const stage of journey.localStages ?? []) {
      for (const path of stage.files ?? []) {
        if (!existsSync(resolve(root, path))) errors.push('journey ' + journey.id + ': missing local evidence ' + path);
      }
    }
    const script = journey.liveStage?.script;
    if (script && typeof pkg.scripts?.[script] !== 'string') {
      errors.push('journey ' + journey.id + ': unresolved package script ' + script);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    workflowCount: workflowEntries.length,
    evidenceCount: evidenceEntries.length,
  };
}

export function runRepositoryHygiene(options = {}) {
  const report = validateRepositoryHygiene(options);
  if (!report.ok) {
    for (const error of report.errors) console.error('FAIL: ' + error);
    return 1;
  }
  console.log('repository-hygiene: PASS (' + report.workflowCount + ' workflows, ' + report.evidenceCount + ' evidence assets)');
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runRepositoryHygiene();
}
