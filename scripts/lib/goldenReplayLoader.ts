import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  parseGoldenReplayCase,
  type GoldenReplayCase,
} from '../../src/engine/goldenReplay.ts';

export async function loadGoldenReplayCases(directory: string): Promise<GoldenReplayCase[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith('.json'))
    .sort();
  const cases: GoldenReplayCase[] = [];

  for (const filename of filenames) {
    const path = join(directory, filename);
    const source = await readFile(path, 'utf8');
    const payload = JSON.parse(source) as unknown;
    cases.push(parseGoldenReplayCase(payload, path));
  }

  return cases;
}
