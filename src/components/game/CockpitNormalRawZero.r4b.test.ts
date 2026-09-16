import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (path: string) => readFileSync(path, 'utf8');
it('keeps resolution-only raw mutation controls out of Normal UI', () => {
  const session = read('src/components/game/CockpitSessionScreen.tsx');
  const selection = read('src/components/game/CockpitSelectionTools.tsx');
  expect(session).toContain('マナの調整（Resolution）');
  expect(session).toContain('<div hidden={!table.resolution}>\n              <CockpitTokenTools');
  expect(session).toContain('<div hidden={!table.resolution}>\n            <CockpitCardTools');
  expect(session).toContain('キーワードを付与・解除（Resolution）');
  expect(session).toContain("type: 'emptyMana'");
  expect(selection).toContain("type: 'shuffle'");
  expect(selection).toContain("type: 'randomDiscard'");
  expect(selection).toContain('setProliferate');
  expect((session.match(/hidden={!table\.resolution}/g) ?? []).length).toBeGreaterThanOrEqual(7);
  expect((selection.match(/hidden={!table\.resolution}/g) ?? []).length).toBeGreaterThanOrEqual(4);
});
