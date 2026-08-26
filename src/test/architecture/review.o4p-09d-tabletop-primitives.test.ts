import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');
const readTree = (relative: string): string => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return '';
  return fs.readdirSync(absolute, { recursive: true })
    .map(String)
    .filter((file) => /\.(?:ts|tsx)$/u.test(file))
    .map((file) => read(path.join(relative, file)))
    .join('\n');
};

describe('O4P-09D safe tabletop primitive architecture', () => {
  it('freezes the closed vocabulary and the hidden-information successor gate', () => {
    const contract = read('research/cr-grounding/o4p-09d-tabletop-primitives.contract.draft.md');
    for (const term of [
      'Structured Manual', 'Freeform Manual', 'Move', 'Shuffle', 'Random/Reorder',
      'Draw', 'Tap/Untap', 'Add/Remove Counter', 'Adjust', 'Create', 'Controller',
      'Attach/Detach', 'Mark/Clear Damage', 'Temporary Note', 'Manual Stack',
      'Manual Resolve',
    ]) expect(contract).toContain(term);
    expect(contract).toMatch(/Look.*Reveal.*Choose/su);
    expect(contract).toContain('O4P-09E');
    expect(contract).toContain('No client may submit a seed');
  });

  it('keeps one Core reducer and explicit manual provenance for the finite algebra', () => {
    const core = [
      read('src/engine/core/tabletop/commandV1.ts'),
      read('src/engine/core/tabletop/operationsV1.ts'),
      read('src/engine/core/closure/applyCommandV1.ts'),
      read('src/engine/core/closure/domainEventV1.ts'),
    ].join('\n');
    expect(core).toMatch(/manualMode|manual-mode/u);
    for (const kind of [
      'table-draw', 'table-zone-move', 'table-shuffle', 'table-reorder',
      'table-tap', 'table-mana-adjust', 'table-counter-adjust',
      'table-life-adjust', 'table-token-create', 'table-controller-change',
      'table-attach', 'table-damage-mark', 'table-note-set', 'table-note-clear',
      'table-stack-entry', 'table-manual-resolve',
    ]) expect(core).toContain(kind);
    expect(core).not.toMatch(/JSON\.parse\([^)]*payload|Object\.assign\([^)]*root/iu);
  });

  it('keeps client tabletop intent free of entropy and arbitrary mutation fields', () => {
    const publicTypes = read('src/online/tabletopManual/types.ts');
    expect(publicTypes).toMatch(/structured.*freeform|freeform.*structured/su);
    expect(publicTypes).not.toMatch(/beforeOrder|afterOrder|randomSeed|entropy|permutation|statePatch|propertyPath/u);
    const manual = readTree('src/online/tabletopManual');
    expect(manual).toContain('online-tabletop-intent-envelope-v1');
    expect(manual).toMatch(/server|Server/u);
    expect(manual).toMatch(/Look|look/u);
    expect(manual).toMatch(/Reveal|reveal/u);
    expect(manual).toMatch(/Choose|choose/u);
  });

  it('routes the production player journey through GameScreen without a surface fork', () => {
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const panel = read('src/components/online/OnlineTabletopManual.tsx');
    expect(app).toContain('GameScreen');
    expect(app).toContain('OnlineTabletopManual');
    expect(panel).toContain('Structured Manual');
    expect(panel).toContain('Freeform Manual');
    expect(panel).not.toMatch(/applyCoreCommand|handleOnlineVariableCommand|useReducer/iu);
    const files = fs.readdirSync(path.join(root, 'src/components'), { recursive: true }).map(String);
    expect(files.filter((file) => /Online(GameScreen|Board|Hand|Stack)/u.test(file))).toEqual([]);
  });

  it('binds randomness and persistence on the authoritative runtime side', () => {
    const runtimeEntry = read('src/online/cloudflare/runtime.ts');
    const persistence = read('src/online/cloudflare/persistence.ts');
    const publicController = read('src/online/publicApp/v3.ts');
    const runtime = [runtimeEntry, persistence, readTree('src/online/application'), readTree('src/online/tabletopManual')].join('\n');
    expect(runtime).toContain('online-tabletop-intent-envelope-v1');
    expect(runtime).toMatch(/random-zone-order|table-shuffle/u);
    expect(runtime).toMatch(/duplicate|idempoten/iu);
    expect(runtime).toMatch(/projectOnline|projection/u);
    expect(runtimeEntry).toContain('validateOnlineTabletopIntentEnvelopeV1');
    expect(runtimeEntry).toContain('bindOnlineTabletopIntentOnServerV1');
    expect(persistence).toContain('commitVariableAcceptedV2');
    expect(publicController).not.toMatch(/bindOnlineTabletopIntentToCoreCommandV1|createCoreCommandV1/u);
  });
});
