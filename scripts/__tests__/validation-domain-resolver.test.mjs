import { describe, expect, test } from 'vitest';

import {
  DEFAULT_ROOT,
  loadRegistry,
  resolveDomainSelection,
  resolveNamedDomain,
} from '../checks/validation-domain-resolver.mjs';

describe('validation domain resolver', () => {
  test('uses the machine-readable registry and expands dependencies', () => {
    const selection = resolveDomainSelection({
      root: DEFAULT_ROOT,
      files: ['src/engine/priority.ts'],
    });
    expect(selection.initialDomains).toContain('engine-turn');
    expect(selection.expandedDomains).toEqual(expect.arrayContaining(['engine-turn', 'engine-stack', 'store']));
    expect(selection.contractIds).toContain('CONTRACT-ENGINE-TURN');
    expect(selection.testFiles.length).toBeGreaterThan(1);
    expect(new Set(selection.testFiles).size).toBe(selection.testFiles.length);
  });

  test('escalates unknown and shared configuration paths', () => {
    const unknown = resolveDomainSelection({ root: DEFAULT_ROOT, files: ['vendor/new-tool.mjs'] });
    expect(unknown.unknownFiles).toEqual(['vendor/new-tool.mjs']);
    expect(unknown.selectedDomains).toEqual(['release']);
    expect(unknown.escalation).toBe('full');

    const config = resolveDomainSelection({ root: DEFAULT_ROOT, files: ['package.json'] });
    expect(config.initialDomains).toContain('build-tooling');
    expect(config.escalation).toBe('full');
  });

  test('named domain selection rejects zero coverage and returns unique files', () => {
    const domains = loadRegistry(DEFAULT_ROOT);
    expect(domains.map((domain) => domain.id)).toContain('engine-mana');
    const selection = resolveNamedDomain({ root: DEFAULT_ROOT, domainId: 'engine-mana' });
    expect(selection.testFiles.length).toBeGreaterThan(1);
    expect(new Set(selection.testFiles).size).toBe(selection.testFiles.length);
    expect(selection.testFilesByProject.dom.length).toBeGreaterThan(0);
  });

  test('unknown named domains fail', () => {
    expect(() => resolveNamedDomain({ root: DEFAULT_ROOT, domainId: 'not-a-domain' })).toThrow('Unknown domain');
  });
});
