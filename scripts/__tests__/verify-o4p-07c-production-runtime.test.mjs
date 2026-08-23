import { lstatSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyO4P07CProductionRuntime } from '../checks/verify-o4p-07c-production-runtime.ts';

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'o4p-07c-runtime-'));
  mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
  writeFileSync(join(root, 'main.tsx'), "import './safe.ts';\n");
  writeFileSync(join(root, 'worker.ts'), "export { value } from './safe.ts';\n");
  writeFileSync(join(root, 'safe.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'dist', 'index.html'), '<script type="module" src="/assets/main.js"></script>');
  writeFileSync(join(root, 'dist', 'assets', 'main.js'), 'const value = 1;');
  return root;
}

describe('O4P-07C production runtime verifier', () => {
  it('accepts a clean value-import graph and Pages artifact set', () => {
    const root = fixtureRoot();
    const result = verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'] });
    expect(result.graph.files).toHaveLength(3);
    expect(result.pages.files).toEqual(['assets/main.js']);
    expect(result.worker).toBeNull();
  });

  it('rejects a fixed catalog path in the production graph', () => {
    const root = fixtureRoot();
    writeFileSync(join(root, 'main.tsx'), "import './catalogV1.ts';\n");
    writeFileSync(join(root, 'catalogV1.ts'), 'export const value = 1;');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/fixed-runtime marker|catalogV1/i);
  });

  it('traverses static template dynamic imports and rejects unresolved dynamic forms', () => {
    const template = fixtureRoot();
    writeFileSync(join(template, 'main.tsx'), 'import(`./bridge.ts`);\n');
    writeFileSync(join(template, 'bridge.ts'), "import './catalogV1.ts';\n");
    writeFileSync(join(template, 'catalogV1.ts'), 'export const value = 1;\n');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: template, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/fixed-runtime marker|catalogV1/i);

    const dynamic = fixtureRoot();
    writeFileSync(join(dynamic, 'main.tsx'), "const target = './safe.ts'; import(target);\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: dynamic, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported dynamic import specifier/i);

    const required = fixtureRoot();
    writeFileSync(join(required, 'main.tsx'), "require('./safe.ts');\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: required, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported require call/i);
  });

  it('fails closed for unresolved and ambiguous relative imports', () => {
    const unresolved = fixtureRoot();
    writeFileSync(join(unresolved, 'main.tsx'), "import './missing.ts';\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: unresolved, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unresolved relative import/i);

    const ambiguous = fixtureRoot();
    mkdirSync(join(ambiguous, 'shared'), { recursive: true });
    writeFileSync(join(ambiguous, 'main.tsx'), "import './shared';\n");
    writeFileSync(join(ambiguous, 'shared.ts'), 'export const value = 1;');
    writeFileSync(join(ambiguous, 'shared', 'index.ts'), 'export const value = 1;');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: ambiguous, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/ambiguous relative import/i);

    const extensionless = fixtureRoot();
    writeFileSync(join(extensionless, 'main.tsx'), "import './shared';\n");
    writeFileSync(join(extensionless, 'shared'), 'export const value = 1;');
    writeFileSync(join(extensionless, 'shared.ts'), 'export const value = 1;');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: extensionless, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/ambiguous relative import/i);

    const stylesheet = fixtureRoot();
    writeFileSync(join(stylesheet, 'main.tsx'), "import './shared';\n");
    writeFileSync(join(stylesheet, 'shared.ts'), 'export const value = 1;');
    writeFileSync(join(stylesheet, 'shared.css'), '.value { color: red; }');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: stylesheet, sourceRoots: ['main.tsx', 'worker.ts'] })).not.toThrow();

    const outside = fixtureRoot();
    writeFileSync(join(outside, '..', 'o4p-07c-outside.ts'), 'export const value = 1;');
    writeFileSync(join(outside, 'main.tsx'), "import '../o4p-07c-outside.ts';\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: outside, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/outside repository/i);

    const linked = fixtureRoot();
    const linkedTarget = mkdtempSync(join(tmpdir(), 'o4p-07c-linked-'));
    writeFileSync(join(linkedTarget, 'outside.ts'), 'export const value = 1;');
    symlinkSync(linkedTarget, join(linked, 'linked'));
    writeFileSync(join(linked, 'main.tsx'), "import './linked/outside.ts';\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: linked, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/symlink|outside repository/i);

    for (const specifier of ['/tmp/o4p-07c-absolute.ts', 'file:///tmp/o4p-07c-absolute.ts', 'https://example.invalid/o4p-07c.ts']) {
      const absoluteImport = fixtureRoot();
      writeFileSync(join(absoluteImport, 'main.tsx'), `import '${specifier}';\n`);
      expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: absoluteImport, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported absolute import/i);
    }

    const importMetaGlob = fixtureRoot();
    writeFileSync(join(importMetaGlob, 'main.tsx'), "const modules = import.meta.glob('../o4p-07c-outside.ts', { eager: true });\nvoid modules;\n");
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: importMetaGlob, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported import\.meta loader call/i);

    for (const source of [
      "new Worker(new URL('../o4p-worker-out.ts', import.meta.url), { type: 'module' });",
      "new SharedWorker(new URL('../o4p-shared-out.ts', import.meta.url));",
      "navigator.serviceWorker.register(new URL('../o4p-service-worker-out.ts', import.meta.url));",
      "importScripts('../o4p-import-scripts-out.js');",
      "CSS.paintWorklet.addModule(new URL('../o4p-worklet-out.ts', import.meta.url));",
      "navigator.serviceWorker['register'](new URL('../o4p-service-worker-element-out.ts', import.meta.url));",
      "navigator['serviceWorker'].register(new URL('../o4p-service-worker-chain-out.ts', import.meta.url));",
      "new globalThis['Worker'](new URL('../o4p-worker-element-out.ts', import.meta.url));",
      "self['importScripts']('../o4p-import-scripts-element-out.js');",
      "audioWorklet['addModule'](new URL('../o4p-worklet-element-out.ts', import.meta.url));",
      "globalThis.Worker(new URL('../o4p-worker-property-out.ts', import.meta.url));",
      "self.importScripts('../o4p-import-scripts-property-out.js');",
    ]) {
      const browserLoader = fixtureRoot();
      writeFileSync(join(browserLoader, 'main.tsx'), `${source}\n`);
      expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: browserLoader, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported browser code loader/i);
    }
  });

  it('rejects missing Pages output and forbidden emitted markers', () => {
    const missing = fixtureRoot();
    writeFileSync(join(missing, 'dist', 'index.html'), '<!-- no javascript -->');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: missing, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/missing executable Pages module script reference/i);

    const stale = fixtureRoot();
    writeFileSync(join(stale, 'dist', 'index.html'), '<script type="module" src="/assets/missing.js"></script>');
    writeFileSync(join(stale, 'dist', 'assets', 'stale.js'), 'const stale = true;');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: stale, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/missing Pages referenced script/i);

    const forbidden = fixtureRoot();
    writeFileSync(join(forbidden, 'dist', 'assets', 'main.js'), 'o4p-06a-four-deck-card-catalog-v1');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: forbidden, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/forbidden artifact marker/i);
  });

  it('rejects commented, inert-type, template-only, and noscript-only references', () => {
    for (const html of [
      '<!-- <script type="module" src="/assets/main.js"></script> -->',
      '<script type="application/json" src="/assets/main.js"></script>',
      '<template><script type="module" src="/assets/main.js"></script></template>',
      '<noscript><script type="module" src="/assets/main.js"></script></noscript>',
    ]) {
      const root = fixtureRoot();
      writeFileSync(join(root, 'dist', 'index.html'), html);
      expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/missing executable Pages module script reference|unsupported Pages script element|unsupported Pages noscript element/i);
    }
  });

  it('rejects base-element and absolute script source substitution', () => {
    const based = fixtureRoot();
    writeFileSync(join(based, 'dist', 'index.html'), '<base href="https://evil.test/"><script type="module" src="assets/main.js"></script>');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: based, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported Pages base element/i);

    const absolute = fixtureRoot();
    writeFileSync(join(absolute, 'dist', 'index.html'), '<script type="module" src="https://pages-artifact.invalid/assets/main.js"></script>');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: absolute, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/absolute Pages script source/i);
  });

  it('accepts canonical default and Pages-base paths but rejects URL substitutions and unquoted src', () => {
    const pagesBase = fixtureRoot();
    writeFileSync(join(pagesBase, 'dist', 'index.html'), '<script type="module" src="/MTG_OneDeck/assets/main.js"></script>');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: pagesBase, sourceRoots: ['main.tsx', 'worker.ts'] })).not.toThrow();

    for (const src of [
      '/evil/assets/main.js',
      '/%2Fassets/main.js',
      '/assets/main.js?cache=1',
      '/assets/main.js#fragment',
      '/assets/../assets/main.js',
      '/assets/main%2Ejs',
    ]) {
      const root = fixtureRoot();
      writeFileSync(join(root, 'dist', 'index.html'), `<script type="module" src="${src}"></script>`);
      expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/outside assets|invalid Pages script (source|output)/i);
    }

    const unquoted = fixtureRoot();
    writeFileSync(join(unquoted, 'dist', 'index.html'), '<script type=module src=/assets/main.js></script>');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: unquoted, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unquoted Pages script source/i);
  });

  it('rejects a symlinked Pages artifact root', () => {
    const root = fixtureRoot();
    const target = join(root, 'real-dist');
    mkdirSync(join(target, 'assets'), { recursive: true });
    writeFileSync(join(target, 'index.html'), '<script type="module" src="/assets/main.js"></script>');
    writeFileSync(join(target, 'assets', 'main.js'), 'const value = 1;');
    symlinkSync(target, join(root, 'dist-link'));
    expect(lstatSync(join(root, 'dist-link')).isSymbolicLink()).toBe(true);
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, pagesDist: 'dist-link', sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/artifact (root is not a directory|symlink)|symlink/i);
  });

  it('rejects every executable script that is not a local module entry', () => {
    for (const html of [
      '<script type="module" src="/assets/main.js"></script><script src="https://evil.test/side-channel.js"></script>',
      '<script type="module" src="/assets/main.js"></script><script>window.evil = true;</script>',
      '<script type="module" src="/assets/main.js"></script><script type="module">window.evil = true;</script>',
      '<script type="module" src="/assets/main.js"></script><script type="module" src=" https://pages-artifact.invalid/assets/main.js"></script>',
    ]) {
      const root = fixtureRoot();
      writeFileSync(join(root, 'dist', 'index.html'), html);
      expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'] })).toThrow(/unsupported Pages script element|missing Pages script source|invalid Pages script source whitespace/i);
    }
  });

  it('scans an explicit Worker dry-run bundle and rejects legacy success handlers', () => {
    const root = fixtureRoot();
    writeFileSync(join(root, 'worker-bundle.js'), 'online-forming-lobby-started-v1');
    expect(() => verifyO4P07CProductionRuntime({ repositoryRoot: root, sourceRoots: ['main.tsx', 'worker.ts'], workerBundle: 'worker-bundle.js' })).toThrow(/forbidden Worker bundle marker/i);
  });
});
