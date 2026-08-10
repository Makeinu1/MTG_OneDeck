import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const REGISTRY_PATH = resolve(import.meta.dirname, 'validation-domains.json');
const IGNORED_DIRECTORIES = new Set(['.git', '.claude', '.tmp', 'coverage', 'dist', 'node_modules']);

function loadRegistry(root = DEFAULT_ROOT) {
  const registryPath = resolve(root, 'scripts/checks/validation-domains.json');
  const parsed = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (!Array.isArray(parsed.domains)) throw new Error('validation-domains.json must contain domains');
  return parsed.domains;
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(pattern) {
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += escapeRegExp(character);
    }
  }
  return new RegExp(`${expression}$`);
}

function matchesPattern(path, pattern) {
  return globToRegExp(pattern).test(path);
}

function walkFiles(root, current = root, relativeDirectory = '') {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, absolutePath, relativePath));
    else files.push(relativePath.replaceAll('\\', '/'));
  }
  return files;
}

function domainMap(domains) {
  return new Map(domains.map((domain) => [domain.id, domain]));
}

export function expandDomains(domainIds, domains) {
  const byId = domainMap(domains);
  const expanded = [];
  const visited = new Set();
  function visit(domainId) {
    if (visited.has(domainId)) return;
    const domain = byId.get(domainId);
    if (!domain) throw new Error(`Unknown domain ${domainId}`);
    visited.add(domainId);
    expanded.push(domainId);
    for (const dependency of domain.dependentDomains) visit(dependency);
  }
  for (const domainId of domainIds) visit(domainId);
  return expanded;
}

export function findDomain(domains, domainId) {
  const domain = domainMap(domains).get(domainId);
  if (!domain) throw new Error(`Unknown domain ${domainId}. Valid domains: ${domains.map((item) => item.id).join(', ')}`);
  return domain;
}

export function testFilesForDomain({ root = DEFAULT_ROOT, domain }) {
  const files = walkFiles(root).filter((path) => domain.testPatterns.some((pattern) => matchesPattern(path, pattern)));
  return files.sort();
}

function sourceMatches(files, domain) {
  return files.filter((file) => domain.sourcePatterns.some((pattern) => matchesPattern(file, pattern)));
}

export function resolveDomainSelection({ root = DEFAULT_ROOT, files = [] } = {}) {
  const domains = loadRegistry(root);
  const normalizedFiles = [...new Set(files.map((file) => normalizePath(file)))].sort();
  const initialIds = [];
  const matchedBy = {};
  const unknownFiles = [];

  for (const file of normalizedFiles) {
    const matches = domains.filter((domain) => domain.sourcePatterns.some((pattern) => matchesPattern(file, pattern)));
    if (matches.length === 0) {
      unknownFiles.push(file);
      continue;
    }
    matchedBy[file] = matches.map((domain) => domain.id);
    for (const domain of matches) if (!initialIds.includes(domain.id)) initialIds.push(domain.id);
  }

  const expandedIds = expandDomains(initialIds, domains);
  const fallback = unknownFiles.length > 0;
  const escalation = fallback || expandedIds.some((id) => findDomain(domains, id).escalationLevel === 'full') ? 'full' : 'targeted';
  const selectedIds = fallback ? ['release'] : expandedIds;
  const selectedDomains = selectedIds.map((id) => (id === 'release' ? null : findDomain(domains, id))).filter(Boolean);
  const contractIds = [...new Set(selectedDomains.flatMap((domain) => domain.relatedContractIds))].sort();
  const testFiles = selectedDomains.flatMap((domain) => testFilesForDomain({ root, domain }));
  const uniqueTestFiles = [...new Set(testFiles)].sort();

  return {
    files: normalizedFiles,
    matchedBy,
    unknownFiles,
    initialDomains: initialIds,
    expandedDomains: expandedIds,
    selectedDomains: selectedIds,
    contractIds,
    testFiles: uniqueTestFiles,
    testFilesByProject: {
      core: uniqueTestFiles.filter((file) => file.startsWith('src/engine/')),
      dom: uniqueTestFiles.filter((file) => !file.startsWith('src/engine/')),
    },
    escalation,
    reasons: fallback
      ? [`unknown path(s): ${unknownFiles.join(', ')}`, 'unknown changes require the full release check']
      : selectedDomains.map((domain) => `${domain.id}: ${domain.reason}`),
  };
}

export function resolveNamedDomain({ root = DEFAULT_ROOT, domainId }) {
  const domains = loadRegistry(root);
  const domain = findDomain(domains, domainId);
  const expandedIds = expandDomains([domain.id], domains);
  const expandedDomains = expandedIds.map((id) => findDomain(domains, id));
  const testFiles = [...new Set(expandedDomains.flatMap((item) => testFilesForDomain({ root, domain: item })))].sort();
  if (testFiles.length === 0) throw new Error(`Domain ${domain.id} resolved zero test files`);
  return {
    domain,
    expandedDomains: expandedIds,
    contractIds: [...new Set(expandedDomains.flatMap((item) => item.relatedContractIds))].sort(),
    testFiles,
    testFilesByProject: {
      core: testFiles.filter((file) => file.startsWith('src/engine/')),
      dom: testFiles.filter((file) => !file.startsWith('src/engine/')),
    },
    reasons: expandedDomains.map((item) => `${item.id}: ${item.reason}`),
  };
}

export function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export { DEFAULT_ROOT, REGISTRY_PATH, loadRegistry, walkFiles };
