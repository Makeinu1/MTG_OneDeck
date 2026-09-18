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

  test('self-selects changed runnable tests without weakening domain selection', () => {
    for (const path of [
      'src/engine/__tests__/combat.test.ts',
      'src/engine/__tests__/review.cr309-dungeons.test.ts',
      'src/engine/core/closure/__tests__/canonicalV1.test.ts',
      'src/engine/grammar/__tests__/manaShortcut.test.ts',
    ]) {
      const selection = resolveDomainSelection({ root: DEFAULT_ROOT, files: [path] });
      expect(selection.escalation).toBe('targeted');
      expect(selection.selfSelectedTestFiles).toContain(path);
      expect(selection.unrunnableChangedTestFiles).toEqual([]);
      expect(selection.testFilesByProject.core).toContain(path);
      expect(selection.reasons).toContain(`changed-test-self-selection:${path}`);
    }

    const combined = resolveDomainSelection({
      root: DEFAULT_ROOT,
      files: ['src/engine/priority.ts', 'src/engine/__tests__/combat.test.ts'],
    });
    expect(combined.initialDomains).toContain('engine-turn');
    expect(combined.testFiles).toContain('src/engine/__tests__/priority.test.ts');
    expect(combined.testFiles).toContain('src/engine/__tests__/combat.test.ts');
    expect(new Set(combined.testFiles).size).toBe(combined.testFiles.length);
  });

  test('fails closed for deleted, renamed-old, or unsupported test-like paths', () => {
    const deleted = resolveDomainSelection({
      root: DEFAULT_ROOT,
      files: ['src/engine/__tests__/deleted.test.ts'],
    });
    expect(deleted.unknownFiles).toEqual([]);
    expect(deleted.unrunnableChangedTestFiles).toEqual(['src/engine/__tests__/deleted.test.ts']);
    expect(deleted.escalation).toBe('full');
    expect(deleted.reasons).toContain('changed-test-unrunnable:src/engine/__tests__/deleted.test.ts');

    const renamed = resolveDomainSelection({
      root: DEFAULT_ROOT,
      files: ['src/engine/__tests__/old-combat.test.ts', 'src/engine/__tests__/combat.test.ts'],
    });
    expect(renamed.selfSelectedTestFiles).toContain('src/engine/__tests__/combat.test.ts');
    expect(renamed.unrunnableChangedTestFiles).toContain('src/engine/__tests__/old-combat.test.ts');
    expect(renamed.escalation).toBe('full');

    const unsupported = resolveDomainSelection({
      root: DEFAULT_ROOT,
      files: ['src/engine/__tests__/future.test.py'],
    });
    expect(unsupported.unrunnableChangedTestFiles).toEqual(['src/engine/__tests__/future.test.py']);
    expect(unsupported.escalation).toBe('full');
  });

  test('self-selects non-engine runnable tests while preserving full unknown fallback', () => {
    const path = 'src/online/publicApp/publicAppClientV1.test.ts';
    const selection = resolveDomainSelection({ root: DEFAULT_ROOT, files: [path] });
    expect(selection.selfSelectedTestFiles).toEqual([path]);
    expect(selection.testFilesByProject.dom).toContain(path);
    expect(selection.unknownFiles).toEqual([path]);
    expect(selection.escalation).toBe('full');
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
