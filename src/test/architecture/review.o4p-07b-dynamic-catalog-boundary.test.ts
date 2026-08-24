import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function methodRegion(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing architecture region: ${start}`);
  return text.slice(startIndex, endIndex);
}

describe('O4P-07B fixed-catalog-free served path architecture', () => {
  it('keeps the dynamic genesis and v2 start path independent of raw text, Scryfall, and O4P-06 fixtures', () => {
    const genesis = source('src/online/genesis/index.ts');
    const persistence = source('src/online/cloudflare/persistence.ts');
    const start = methodRegion(persistence, 'startWithTableV2(', 'async submitDeckV2(');

    expect(genesis).not.toMatch(/bootstrap|catalogV1|fourDeckBootstrap|deckText|ScryfallResolver/);
    expect(start).toContain('buildDynamicRoomGenesisV2');
    expect(start).toContain('loadDeckSnapshotV2');
    expect(start).not.toMatch(/bootstrap|catalogV1|fourDeckBootstrap|deckText|ScryfallResolver/);
    expect(start).toContain('initializeDynamicRoomV2');
  });

  it('serves entries-only UI through the current controller while preserving the fixed catalog solely as a deferred fixture', () => {
    const app = source('src/App.tsx');
    const component = source('src/components/online/PublicOnlineApp.tsx');
    const types = source('src/online/publicApp/types.ts');
    const exports = source('src/online/publicApp/index.ts');
    const v2 = source('src/online/publicApp/v2.ts');

    expect(app).toMatch(/<PublicOnlineApp[\s\S]*?entries:\s*deck\.entries/);
    expect(app).toMatch(/onImportDeck=\{\(\) => setOnlineImportOpen\(true\)\}/);
    expect(app).toMatch(/<ImportScreen[\s\S]*?importOnly/);
    expect(component).toContain('createPublicOnlineControllerV3');
    expect(component).not.toContain('createPublicOnlineControllerV1');
    expect(types).toMatch(/PublicOnlineDeckOptionV2[\s\S]*?readonly entries:/);
    expect(methodRegion(types, 'export type PublicOnlineDeckOptionV2', 'export type PublicOnlineIssueV2'))
      .not.toContain('deckText');
    expect(exports).toContain('createPublicOnlineControllerV3');
    expect(v2).toContain("kind: 'online-forming-lobby-deck-submit-v2'");
    expect(v2).not.toMatch(/catalogV1|fourDeckBootstrapV1/);

    expect(source('src/online/bootstrap/catalog/catalogV1.ts')).toContain(
      'O4P06A_CARD_CATALOG_V1',
    );
  });
});
