import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('O4P-03A configuration', () => {
  it('declares exactly the Worker and SQLite Durable Object without deployment authority', () => {
    const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8')) as Record<string, unknown>;
    expect(config).toEqual({
      main: 'src/online/cloudflare/worker.ts',
      compatibility_date: '2026-08-13',
      durable_objects: {
        bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }],
      },
      exports: {
        OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' },
      },
    });
    expect(config).not.toHaveProperty('migrations');
    expect(JSON.stringify(config)).not.toMatch(/account|route|secret|token|hostname|remote/i);
  });
});
