import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function filesBelow(path: string): string[] {
  const absolute = join(ROOT, path);
  const output: string[] = [];
  for (const name of readdirSync(absolute)) {
    const candidate = join(absolute, name);
    if (statSync(candidate).isDirectory()) output.push(...filesBelow(relative(ROOT, candidate)));
    else output.push(candidate);
  }
  return output;
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('O4P-04A Personal Workbench architecture boundary', () => {
  it('keeps the pure model on the projection barrel and free of UI, state, transport, and ambient effects', () => {
    const files = filesBelow('src/online/workbench')
      .filter((path) => ['.ts', '.tsx'].includes(extname(path)))
      .filter((path) => !path.includes('__tests__'));
    const text = files.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(files.length).toBeGreaterThan(1);
    expect(text).toMatch(/from ['"]\.\.\/projection\/index['"]/);
    expect(text).not.toMatch(/from ['"][^'"]*(engine|store|components|room|protocol|headless|cloudflare)/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|Date\.now|Math\.random|console\.)\b/);
    expect(text).not.toMatch(/\b(React|document|window|HTMLElement)\b/);
  });

  it('keeps React on the public workbench barrel and does not couple production UI to Solo or Online internals', () => {
    const files = filesBelow('src/components/online')
      .filter((path) => ['.ts', '.tsx', '.css'].includes(extname(path)))
      .filter((path) => !path.includes('__tests__'));
    const text = files.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(files.some((path) => path.endsWith('PersonalWorkbench.tsx'))).toBe(true);
    expect(text).toMatch(/online\/workbench\/index/);
    expect(text).not.toMatch(/components\/game|gameStore|src\/store|online\/(cloudflare|protocol|room|headless)|engine\/core/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB)\b/);
  });

  it('provides only a dev fixture entry and leaves existing production entry points untouched', () => {
    expect(source('research/design/personal-workbench/index.html'))
      .toContain('/src/dev/personalWorkbench/main.tsx');
    expect(source('src/App.tsx')).not.toMatch(/PersonalWorkbench|personalWorkbench/);
    expect(source('src/main.tsx')).not.toMatch(/PersonalWorkbench|personalWorkbench/);
    expect(source('src/online/workbench/fixtures/o4p-04a-personal-workbench-v1.json'))
      .toContain('"kind": "online-participant-projection-v1"');
    expect(() => statSync(join(ROOT, 'src/online/index.ts'))).toThrow();
  });

  it('uses one adaptive tree, existing variables, and the three contract viewports', () => {
    const css = source('src/components/online/personalWorkbench.css');
    const component = source('src/components/online/PersonalWorkbench.tsx');
    expect(component.match(/data-testid="personal-workbench"/g)).toHaveLength(1);
    expect(css).toMatch(/@media[^{]*max-width:\s*600px/s);
    expect(css).toMatch(/@media[^{]*max-height:\s*500px/s);
    expect(css).toMatch(/var\(--(?:surface|text|line|space|radius|shadow|accent|gold)/);
    expect(css).toMatch(/button:focus-visible/);
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/https?:\/\//);
    expect(component).not.toMatch(/onDoubleClick|draggable=/);
  });
});
