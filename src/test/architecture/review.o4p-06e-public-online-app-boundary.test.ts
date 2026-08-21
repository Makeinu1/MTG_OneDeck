import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://mtg-onedeck-online.makeinu1.workers.dev';
const SENSITIVE_PRODUCT = [
  'src/components/online/PublicOnlineApp.tsx',
  'src/online/publicApp/index.ts',
  'src/online/publicApp/client.ts',
  'src/online/publicApp/types.ts',
] as const;

function source(path: string): string {
  expect(existsSync(path), `missing ${path}`).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('O4P-06E public Online App boundary review', () => {
  it('integrates one fixed endpoint without credential URL, persistence, or logging paths', () => {
    const joined = SENSITIVE_PRODUCT.map(source).join('\n');
    expect(joined.match(new RegExp(ORIGIN.replaceAll('.', '\\.'), 'g'))).toHaveLength(1);
    expect(joined).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|history\.(?:pushState|replaceState)|URLSearchParams|location\.(?:search|hash)|console\.|sendBeacon/);
    expect(joined).not.toMatch(/(?:seat|invite|participant|observer|table)Capability[^\n]{0,120}(?:pathname|searchParams|hash|localStorage|sessionStorage)/i);
    expect(joined).not.toMatch(/wss?:[^\n]{0,160}(?:capability|invite)/i);
  });

  it('keeps App as a thin Solo-default composition root', () => {
    const app = source('src/App.tsx');
    expect(app).toMatch(/PublicOnlineApp/);
    expect(app).toMatch(/onlineMode/);
    expect(app).toMatch(/data-testid="open-online-mode"/);
    expect(app).not.toMatch(/fetch\s*\(|new\s+WebSocket|online-forming-lobby|workers\.dev/);
    expect(app).toMatch(/SavedDeckLibrary/);
    expect(app).toMatch(/ImportScreen/);
    expect(app).toMatch(/GameScreen/);
  });

  it('uses only public Online barrels and leaves shipped semantic layers untouched', () => {
    const component = source('src/components/online/PublicOnlineApp.tsx');
    expect(component).not.toMatch(/\.\.\/\.\.\/online\/(?:cloudflare|protocol|projection|browser|workbench|tableDisplay|displayPairing|guidedActions)\/(?!index)/);
    expect(component).not.toMatch(/\.\.\/\.\.\/engine|\.\.\/\.\.\/store|components\/game/);

    const publicAppFiles = [
      'src/online/publicApp/index.ts',
      'src/online/publicApp/client.ts',
      'src/online/publicApp/types.ts',
    ].filter(existsSync).map(source).join('\n');
    expect(publicAppFiles).not.toMatch(/\.\.\/(?:cloudflare|protocol|projection|browser|workbench|tableDisplay|displayPairing|guidedActions)\/(?!index)/);
    expect(publicAppFiles).not.toMatch(/\.\.\/\.\.\/engine\/core\/(?!index)/);
  });

  it('keeps the Table extension additive and the frozen legacy start visible', () => {
    const runtime = source('src/online/cloudflare/runtime.ts');
    const persistence = source('src/online/cloudflare/persistence.ts');
    const worker = source('src/online/cloudflare/worker.ts');
    const lobby = source('src/online/lobby/index.ts');
    expect(runtime).toMatch(/online-forming-lobby-start-v1/);
    expect(runtime).toMatch(/online-forming-lobby-start-with-table-v1/);
    expect(worker).toMatch(/tableParticipantId/);
    expect(worker).toMatch(/tableCapability/);
    expect(lobby).toMatch(/startOnlineFormingLobbyWithTableV1/);
    expect(runtime).not.toMatch(/observerAuthorizations\s*:\s*\[\s*\]/);
    expect(runtime.match(/initializeRoomAndTransitionLobby/g)).toHaveLength(2);
    expect(runtime).not.toMatch(/repository\.initialize\([^\n]+\)[\s\S]{0,160}repository\.persistLobby/);
    expect(persistence).toMatch(/initializeRoomAndTransitionLobby[\s\S]+transactionSync/);
  });
});
