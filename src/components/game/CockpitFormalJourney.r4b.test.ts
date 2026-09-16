import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (path: string) => readFileSync(path, 'utf8');
it('keeps retired editors out and routes Commander-to-command through its Formal operation', () => {
  const screen = read('src/components/game/CockpitSessionScreen.tsx');
  const cardTools = read('src/components/game/CockpitCardTools.tsx');
  expect(screen).toContain("type: 'commander.moveToCommand'");
  expect(screen).toContain('objectId: objectIdOf(card)');
  expect(screen).toContain('mixedCommanderCommandMove');
  expect(cardTools).not.toContain("type: 'commanderCount'");
  expect(cardTools).not.toContain("type: 'token.edit'");
  expect(cardTools).toContain("type: 'visibility'");
});
