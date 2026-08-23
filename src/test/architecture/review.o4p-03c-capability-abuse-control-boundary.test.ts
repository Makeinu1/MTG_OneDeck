import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cloudflareRoot = resolve(repositoryRoot, 'src/online/cloudflare');
const baseSha = 'a6f4c539a977e38a6891c31fb99acf4fddfee428';

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function normalized(path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') paths.push(...productionFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) paths.push(path);
  }
  return paths.sort();
}

function moduleSpecifiers(text: string): readonly string[] {
  return [...text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2] ?? '');
}

describe('O4P-03C architecture boundary', () => {
  it('adds exactly one production security module without dependency, version, or config drift', () => {
    expect(productionFiles(cloudflareRoot).map(normalized)).toEqual([
      'src/online/cloudflare/codec.ts',
      'src/online/cloudflare/facts.ts',
      'src/online/cloudflare/index.ts',
      'src/online/cloudflare/outbox.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/scryfallResolver.ts',
      'src/online/cloudflare/security.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/types.ts',
      'src/online/cloudflare/websocket.ts',
      'src/online/cloudflare/worker.ts',
    ]);
    for (const path of [
      'research/cr-grounding/o4p-03c-capability-abuse-control.contract.draft.md',
      'research/cr-grounding/o4p-03c-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-03c-implementation-brief.draft.md',
      'research/cr-grounding/o4p-03c-correction-3-judge-surgery.draft.md',
      'src/online/cloudflare/__tests__/review.o4p-03c-capability-abuse-control.test.ts',
      'src/test/architecture/review.o4p-03c-capability-abuse-control-boundary.test.ts',
    ]) expect(existsSync(resolve(repositoryRoot, path)), path).toBe(true);
    const before = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], { cwd: repositoryRoot, encoding: 'utf8' })) as Record<string, unknown>;
    const after = JSON.parse(source('package.json')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(source('package-lock.json')).not.toMatch(/@cloudflare|wrangler|miniflare|workerd/i);
  });

  it('keeps lower imports one-way and production free of runtime-only authority', () => {
    const allowed = new Set(['../protocol/index', '../projection/index', '../room/index', '../room/validationSupport', '../lobby/index', '../deckSubmission/index', '../genesis/index', '../../engine/core/index']);
    for (const path of productionFiles(cloudflareRoot)) {
      const text = readFileSync(path, 'utf8');
      if (normalized(path) === 'src/online/cloudflare/facts.ts') {
        expect(text).toMatch(/console\.log\(JSON\.stringify\(fact\)\)/);
      } else {
        expect(text, normalized(path)).not.toMatch(/react|react-dom|zustand|indexeddb|localstorage|console\.|node:|setTimeout|setInterval|setAlarm|addEventListener\s*\(|\.accept\s*\(/i);
      }
      for (const specifier of moduleSpecifiers(text)) {
        const local = specifier.startsWith('./') && !specifier.includes('..');
        expect(local || allowed.has(specifier), `${normalized(path)} -> ${specifier}`).toBe(true);
      }
    }
    for (const root of ['src/engine', 'src/online/room', 'src/online/protocol', 'src/online/projection', 'src/online/deckSubmission', 'src/online/genesis', 'src/online/headless', 'src/store']) {
      for (const path of productionFiles(resolve(repositoryRoot, root))) {
        expect(readFileSync(path, 'utf8'), normalized(path)).not.toMatch(/online\/cloudflare|\.\.\/cloudflare/);
      }
    }
  });

  it('freezes the exact separate schema, limits, SQL tables, rotation route, and hibernation fields', () => {
    const security = source('src/online/cloudflare/security.ts');
    const runtime = source('src/online/cloudflare/runtime.ts');
    const support = source('src/online/cloudflare/support.ts');
    const types = source('src/online/cloudflare/types.ts');
    expect(types).toMatch(/ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1\s*=\s*1/);
    for (const [name, value] of [
      ['ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1', '1'],
      ['ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1', '43_200_000'],
      ['ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1', '30_000'],
      ['ONLINE_CLOUDFLARE_MAX_ATTACHED_SOCKETS_V1', '16'],
      ['ONLINE_CLOUDFLARE_WEBSOCKET_MESSAGE_WINDOW_MS_V1', '10_000'],
      ['ONLINE_CLOUDFLARE_MAX_WEBSOCKET_MESSAGES_PER_WINDOW_V1', '32'],
      ['ONLINE_CLOUDFLARE_MALFORMED_MESSAGE_WINDOW_MS_V1', '60_000'],
      ['ONLINE_CLOUDFLARE_MAX_MALFORMED_MESSAGES_PER_WINDOW_V1', '8'],
      ['ONLINE_CLOUDFLARE_HTTP_BEARER_WINDOW_MS_V1', '10_000'],
      ['ONLINE_CLOUDFLARE_MAX_HTTP_BEARER_ACTIONS_PER_WINDOW_V1', '32'],
      ['ONLINE_CLOUDFLARE_ROTATION_WINDOW_MS_V1', '60_000'],
      ['ONLINE_CLOUDFLARE_MAX_ROTATIONS_PER_WINDOW_V1', '4'],
      ['ONLINE_CLOUDFLARE_MAX_SERIALIZED_WEBSOCKET_FRAME_BYTES_V1', '65_536'],
      ['ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1', '256'],
      ['ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1', '256'],
    ]) expect(security).toMatch(new RegExp(`${name}\\s*=\\s*${value}`));
    for (const table of ['online_security_state', 'online_capability_grant', 'online_controller_lease', 'online_security_audit']) {
      expect(security).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}[^\u0060]+STRICT`));
    }
    expect(security).toMatch(/UPDATE online_security_state[\s\S]*RETURNING singleton/);
    expect(security).toMatch(/UPDATE online_capability_grant[\s\S]*RETURNING participant_id/);
    expect(security).toMatch(/DELETE FROM online_controller_lease[\s\S]*RETURNING participant_id/);
    expect(security).toMatch(/grant_count INTEGER NOT NULL/);
    expect(security).toMatch(/retired_tokens_json TEXT NOT NULL/);
    expect(support).toMatch(/'room' \| 'lobby' \| 'commands' \| 'capabilities' \| 'websocket'/);
    expect(runtime).toMatch(/route\.action === 'capabilities' && request\.method === 'POST'/);
    for (const field of ['connectionId', 'capabilityGeneration', 'capabilityExpiresAt', 'messageWindowStartedAt', 'messageCount', 'malformedWindowStartedAt', 'malformedCount']) {
      expect(types).toContain(`readonly ${field}`);
    }
  });

  it('keeps the barrel closed and never publishes token-bearing internals or duplicate policy aliases', () => {
    const barrel = source('src/online/cloudflare/index.ts');
    const websocket = source('src/online/cloudflare/websocket.ts');
    expect(barrel).not.toMatch(/export\s+\*/);
    expect(barrel).not.toMatch(/OnlineCloudflareSecurityRepository|OnlineCloudflareSecurityError|securityTablesForTests|protocolCapability|currentToken|rawGrant|AuditRow|GrantRow|LeaseRow/);
    expect(barrel).not.toMatch(/MAX_SOCKET_COUNT|WEBSOCKET_MESSAGE_LIMIT|HTTP_ACTION_LIMIT|ROTATION_LIMIT|MAX_SOCKETS|MAX_FRAME_BYTES|MAX_AUDIT_V1/);
    for (const name of [
      'ONLINE_CLOUDFLARE_SECURITY_SCHEMA_VERSION_V1',
      'ONLINE_CLOUDFLARE_CAPABILITY_LIFETIME_MS_V1',
      'ONLINE_CLOUDFLARE_CONTROLLER_LEASE_LIFETIME_MS_V1',
      'ONLINE_CLOUDFLARE_MAX_SECURITY_AUDIT_FACTS_V1',
      'ONLINE_CLOUDFLARE_MAX_RETIRED_CAPABILITIES_PER_GRANT_V1',
      'createOnlineCloudflareCapabilityRotationResponseV1',
      'isOnlineCloudflareSecurityCapabilityV1',
      'isOnlineCloudflareSecurityClockV1',
    ]) expect(barrel).toContain(name);
    expect(websocket).not.toMatch(/participantCapability|observerCapability|seatCapability|receiptDigest|coreRoot|currentToken/);
  });

  it('contains only the exact O4P-03D successor deployment metadata and no secret or external-abuse authority', () => {
    const config = JSON.parse(source('wrangler.jsonc')) as Record<string, unknown>;
    expect(config).toEqual({
      name: 'mtg-onedeck-online',
      main: 'src/online/cloudflare/worker.ts',
      compatibility_date: '2026-08-13',
      workers_dev: true,
      observability: { enabled: true, head_sampling_rate: 1 },
      version_metadata: { binding: 'CF_VERSION_METADATA' },
      durable_objects: { bindings: [{ name: 'ONLINE_ROOMS', class_name: 'OnlineRoomDurableObject' }] },
      exports: { OnlineRoomDurableObject: { type: 'durable-object', storage: 'sqlite' } },
    });
    const production = productionFiles(cloudflareRoot).map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(production).not.toMatch(/accountId|apiToken|workers\.dev|customDomain|migrationTag|point.?in.?time|structuredLog|dashboard|alert|waf|captcha|banParticipant|kickParticipant/i);
  });
});
