import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = '2973e60942623d57e6af53a5e36cb488a26f56b7';
const CLOSURE_SHA = '2cf35e9dccc8fd3731fce8f018164940023030e4';
const LEDGER_PATH = 'research/cr-grounding/cr-backbone-ledger.json';
const IDS = ['O4P-08A', 'O4P-08B', 'O4P-08C', 'O4P-08D'] as const;
const DEPENDENCIES = ['O4P-07C', 'O4P-08A', 'O4P-08B', 'O4P-08C'] as const;
const REGISTRATION_EVIDENCE = [
  'research/cr-grounding/o4p-08-online-room-ux-two-player-roadmap.contract.draft.md',
  'research/cr-grounding/o4p-08-roadmap-registration-acceptance.draft.md',
  'research/cr-grounding/planned-sequence-batch-o4p-08.draft.md',
  'research/cr-grounding/o4p-08-roadmap-ledger-update.draft.json',
  'user-ruling:2026-08-23:online-room-ux-two-player-flexible-deck',
  'research/cr-grounding/archive/o4p-08-roadmap-registration-cold-audit-record-2026-08-23.md',
] as const;
const O4P08A_EVIDENCE = [
  ...REGISTRATION_EVIDENCE,
  'research/cr-grounding/o4p-08a-shared-membership-recovery-errors.contract.draft.md',
  'research/cr-grounding/o4p-08a-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-08a-implementation-brief.draft.md',
  'research/cr-grounding/o4p-08a-cold-audit-brief.draft.md',
  'research/cr-grounding/archive/o4p-08a-cold-audit-record-2026-08-24.md',
  'research/cr-grounding/archive/o4p-08a-completion-packet-2026-08-24.md',
  'src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts',
  'src/online/lobby/__tests__/review.o4p-08a-shared-membership.test.ts',
  'src/online/publicApp/review.o4p-08a-recovery-client.test.ts',
  'implementer:/root/o4p08a_implementer:gpt-5.6-luna:xhigh',
  'cold-audit:/root/o4p08a_cold_audit:0/0/0/0:semantic=2047804951b54e402827594df6f44cb0fe4456aba5f03bd37b0ff89e19cc631b',
  'guard-audit:/root/o4p08a_cold_audit:0/0/0/0:fingerprint=5ed88238d5d555fd111df533957650a1f67814f31ee404f6e7584f9816e6b9e3',
  'completion-audit:/root/o4p08a_completion_audit:0/0/0/0:O4P-08A-COMPLETION-COLD-AUDIT-OK',
  'product-commit:050090564a91f59669357c2e1ea2fee6e03fa3f1',
  'release-head:209cc9553789391d8a3acd32e0adbe676640dbe3:actions32652846197:full-check+forbidden+artifact+Pages=PASS',
  'pages-html-js-css:HTTP200:DvzndVuh/DB7TO263:last-modified=2026-08-23T17:02:25Z',
  'cloudflare:wrangler-4.125.0:deployment=16558e13-1855-4681-b0bf-139a877a1d46:version=ce347521-0b6a-4bb9-9634-cfbecfdc716c:active-100-percent:root=404',
  'production-api:shared-claim+same-seat-recovery+nonhost-secret-separation+invite-rotate+kick-revoke+admission-close+leave+host-close+correlation-id+secret-output=false=PASS',
] as const;
const O4P08B_EVIDENCE = [
  ...REGISTRATION_EVIDENCE,
  'research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md',
  'research/cr-grounding/o4p-08b-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-08b-prototype-implementation-brief.draft.md',
  'research/cr-grounding/o4p-08b-production-implementation-brief.draft.md',
  'research/cr-grounding/o4p-08b-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-08b-browser-evidence-2026-08-24.draft.md',
  'research/cr-grounding/archive/o4p-08b-cold-audit-record-2026-08-24.md',
  'research/cr-grounding/archive/o4p-08b-completion-packet-2026-08-24.md',
  'research/cr-grounding/o4p-08b-completion-cold-audit-brief-2026-08-24.draft.md',
  'src/online/publicApp/o4p08b.production.test.ts',
  'src/online/publicApp/review.o4p-08b-production-journey.test.ts',
  'src/test/architecture/review.o4p-08b-public-online-journey-boundary.test.ts',
  'cold-audit:/root/o4p08b_cold_audit:0/0/0/0:semantic=4cdaab94ff49290f50d993862ae65a25c79a6b67f94602fb7ca9b432cb29d363',
  'completion-audit:/root/o4p08b_cold_audit:0/0/0/0:O4P-08B-COMPLETION-COLD-AUDIT-OK',
  'semantic-head:da7f6c7354b591a98511b2fa685c9c3f0547146c',
  'release-head:63267987b17b09495eb773ad6b6f023863b78fc3:actions32665253749:full-check+forbidden+artifact+Pages=PASS',
  'pages-html-js-css:HTTP200:D_oRKqjq/B3eS80pY:last-modified=2026-08-23T20:56:34Z',
  'cloudflare:wrangler-4.125.0:version=31d3c58c-7d83-40ab-9e5b-a5d52229cba2:active-100-percent:root=404',
  'production-api:v3-exact+v4-open-closed+host-close+secret-projection=false=PASS',
  'production-browser:375x812+812x375+1440x900:room-id-input=0:overflow=0:console-error=0:PASS',
] as const;
const O4P08C_EVIDENCE = [
  ...REGISTRATION_EVIDENCE,
  'research/cr-grounding/o4p-08c-variable-roster-genesis.contract.draft.md',
  'research/cr-grounding/o4p-08c-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-08c-implementation-brief.draft.md',
  'research/cr-grounding/o4p-08c-cold-audit-brief.draft.md',
  'research/cr-grounding/archive/o4p-08c-cold-audit-record-2026-08-24.md',
  'research/cr-grounding/archive/o4p-08c-completion-packet-2026-08-24.md',
  'research/cr-grounding/o4p-08c-completion-cold-audit-brief-2026-08-24.draft.md',
  'src/online/room/variable.ts',
  'src/online/protocol/variable.ts',
  'src/online/protocol/variableCommand.ts',
  'src/online/projection/variable.ts',
  'src/online/genesis/variable.ts',
  'src/online/cloudflare/__tests__/review.o4p-08c-variable-runtime.test.ts',
  'src/online/genesis/__tests__/review.o4p-08c-variable-roster-genesis.test.ts',
  'src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts',
  'implementer:/root/o4p08c_implementer:gpt-5.6-luna:xhigh',
  'cold-audit:/root/o4p08c_final_cold_audit:0/0/0/0:semantic=c21aa8ddee8855c99c035fa2937834efdeb3054e2e4727b629057f3d993a3e0a',
  'completion-audit:/root/o4p08c_completion_audit:0/0/0/0:O4P-08C-COMPLETION-COLD-AUDIT-OK',
  'semantic-head:d1f6af7a8411df7b1f47ad0aa3a3e417f4df9fde',
  'release-head:ee6352ab03e4a89225fac1f1b2bee63ada4882b3:actions32675114117:full-check+forbidden+artifact+Pages=PASS',
  'full-check:core227/2093+dom352/2374+lint+build+verifiers=PASS',
  'pages-html-js-css:HTTP200:D_oRKqjq/B3eS80pY:last-modified=2026-08-24T00:05:55Z',
  'cloudflare:wrangler-4.125.0:version=a12016ac-c698-4984-ba79-e8eaa45e3662:root=404',
  'production-api:create=2/20+2/40+4/40+shared-invite-multi-use+room-full+guest-recovery-secret-free+invalid-config-reject=PASS',
] as const;
const O4P08D_EVIDENCE = [
  ...REGISTRATION_EVIDENCE,
  'research/cr-grounding/o4p-08d-two-player-surfaces-release.contract.draft.md',
  'research/cr-grounding/o4p-08d-acceptance-brief.draft.md',
  'research/cr-grounding/o4p-08d-implementation-brief.draft.md',
  'research/cr-grounding/o4p-08d-cold-audit-brief.draft.md',
  'research/cr-grounding/o4p-08d-browser-evidence-2026-08-24.draft.md',
  'src/online/projection/__tests__/review.o4p-08d-full-variable-surfaces.test.ts',
  'src/online/publicApp/review.o4p-08d-variable-public-client.test.ts',
  'src/test/architecture/review.o4p-08d-program-completion-boundary.test.ts',
  'src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx',
  'implementer:/root/o4p08d_implementer',
  'cold-audit:/root/o4p08d_cold_audit:0/0/0/0:semantic=361680e9159e85e487ca8af3071da3133630c3032d6c7f18a7349650c981f64d',
  'repair-audit:/root/o4p08d_cold_audit:0/0/0/0:responsive=5210099622302db55aa221df5dd4880c31073ed32eb7e4650ad350846de842ee',
  'repair-audit:/root/o4p08d_cold_audit:0/0/0/0:error-guidance=d346e49a9b635a90f9abd5440db6c8e2abd9a821ffba88973baeacdbb95d9fa1',
  'semantic-head:7e85e49af8a02a21ef8233dcf730b6aa29c6cd79',
  'release-head:c90c533d457e46f9d01a748c827c26b884a814db:actions32690626681:full-check+forbidden+artifact+Pages=PASS',
  'full-check:core227/2093+dom356/2401+lint+build+verifiers=PASS',
  'pages-html-js-css:HTTP200:BGLulJi3/B9TjsUJs:last-modified=2026-08-24T04:49:17Z',
  'cloudflare:wrangler-4.125.0:version=c11d3540-c571-4e37-82c1-2a1aa602f663:active-100-percent:root=404',
  'production-api:2p20-create+multi-claim+full+recover+flex-deck+ready+start+2p40-rotate+kick-revoke+4p40-create+invalid4p20+post-start-kick-reject+secret-output=false=PASS',
  'production-browser:375x812+812x375+1440x900:2p20-recover+exact2+4p40-fixed+actionable-error4lines+room-id-input=0+overflow=0+min-target44+console-error=0=PASS',
] as const;

type Entry = Record<string, unknown> & { id?: string; domainId?: string; status?: string };
type Ledger = {
  goalPolicy: Record<string, unknown> & { activeProgram?: { id?: string; domainIds?: string[] } };
  plannedSequence: Entry[];
  domains: Entry[];
  [key: string]: unknown;
};

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const parse = (raw: string): Ledger => JSON.parse(raw) as Ledger;
const withoutCollections = (ledger: Ledger): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...ledger };
  delete copy.goalPolicy;
  delete copy.plannedSequence;
  delete copy.domains;
  return copy;
};
const withoutActiveProgram = (policy: Ledger['goalPolicy']): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...policy };
  delete copy.activeProgram;
  return copy;
};
const shared = (entry: Entry): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...entry };
  delete copy.id;
  delete copy.domainId;
  delete copy.type;
  return copy;
};

describe('O4P-08 Online room UX and two-player roadmap registration', () => {
  it('appends one exact four-parent active program without rewriting history', () => {
    const before = parse(execFileSync('git', ['show', `${BASE_SHA}:${LEDGER_PATH}`], {
      cwd: ROOT,
      encoding: 'utf8',
    }));
    const after = parse(read(LEDGER_PATH));
    expect(withoutCollections(after)).toEqual(withoutCollections(before));
    expect(withoutActiveProgram(after.goalPolicy)).toEqual(withoutActiveProgram(before.goalPolicy));
    expect(after.goalPolicy.activeProgram).toMatchObject({
      id: 'O4P-09',
      domainIds: ['O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E', 'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J'],
    });
    expect(after.domains.slice(0, before.domains.length)).toEqual(before.domains);
    expect(after.plannedSequence.slice(0, before.plannedSequence.length)).toEqual(before.plannedSequence);
    expect(
      after.domains
        .filter((entry) => IDS.includes(entry.id as (typeof IDS)[number]))
        .map((entry) => entry.id),
    ).toEqual(IDS);
    expect(
      after.plannedSequence
        .filter((entry) => IDS.includes(entry.domainId as (typeof IDS)[number]))
        .map((entry) => entry.domainId),
    ).toEqual(IDS);
  });

  it('keeps both collections synchronized in A-to-D order', () => {
    const ledger = parse(read(LEDGER_PATH));
    for (const [index, id] of IDS.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, `${id} domains`).toHaveLength(1);
      expect(planned, `${id} planned`).toHaveLength(1);
      expect(shared(planned[0] ?? {}), id).toEqual(shared(domains[0] ?? {}));
      expect(domains[0], id).toMatchObject({
        crOrder: 1028 + index,
        status: 'shipped',
        dependsOn: [DEPENDENCIES[index]],
        lane: 'backbone',
        edhValue: 'high',
      });
      if (index === 0) {
        expect(domains[0]?.evidence).toEqual(O4P08A_EVIDENCE);
      } else if (index === 1) {
        expect(domains[0]?.evidence).toEqual(O4P08B_EVIDENCE);
      } else if (index === 2) {
        expect(domains[0]?.evidence).toEqual(O4P08C_EVIDENCE);
      } else {
        expect(domains[0]?.evidence).toEqual(O4P08D_EVIDENCE);
      }
    }
  });

  it('freezes the user-approved journey, moderation, recovery, and roster semantics', () => {
    const contract = read('research/cr-grounding/o4p-08-online-room-ux-two-player-roadmap.contract.draft.md');
    for (const term of [
      'one shared invitation link',
      'same-browser recovery record',
      'kick a non-host player only before start',
      'correlation ID',
      '`playerCount` is 2 or 4',
      'P3/P4 are absent',
      '40, 60, or 100 cards and zero commanders',
      'O4P-08D, not a protocol endpoint',
    ]) expect(contract).toContain(term);
    expect(contract).toContain('starting life is 20 or 40 for two-player');
    expect(contract).toContain('does not add deck-legality enforcement, accounts, matchmaking, bans, teams');
  });

  it('keeps O4P-08 shipped while projecting the registered O4P-09 successor', () => {
    const context = spawnSync('node', ['scripts/codex-context.mjs', '--domain', 'O4P-08A'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(context.error).toBeUndefined();
    expect(context.signal).toBeNull();
    expect(context.stderr).toBe('');
    const projection = JSON.parse(context.stdout) as {
      health?: { ok?: boolean; errors?: unknown[] };
      selection?: unknown;
      activeProgram?: unknown;
      loopState?: { status?: string };
    };
    expect(projection.health).toEqual({ ok: true, errors: [] });
    expect(projection.selection).toEqual({
      kind: 'selected', domainId: 'O4P-08A', reason: 'explicit-domain',
    });
    const liveLedger = parse(read(LEDGER_PATH));
    const o4p09Ids = [
      'O4P-09A', 'O4P-09B', 'O4P-09C', 'O4P-09C-UI', 'O4P-09D', 'O4P-09E',
      'O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J',
    ] as const;
    const nextDomainId = o4p09Ids.find((id) => (
      liveLedger.domains.find((entry) => entry.id === id)?.status !== 'shipped'
    )) ?? null;
    expect(projection.activeProgram).toMatchObject({
      id: 'O4P-09',
      domainIds: o4p09Ids,
      status: nextDomainId === null ? 'complete' : 'active',
      nextDomainId,
    });
    expect(context.status).toBe(projection.loopState?.status === 'current' ? 0 : 5);
  });

  it('freezes only Judge-owned registration and exact historical guards at closure', () => {
    const changed = execFileSync('git', ['diff', '--name-only', BASE_SHA, CLOSURE_SHA], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/u).filter(Boolean);
    const allowed = new Set([
      LEDGER_PATH,
      ...REGISTRATION_EVIDENCE.slice(0, 4),
      'research/cr-grounding/o4p-08-roadmap-registration-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-08-roadmap-registration-cold-audit-record-2026-08-23.md',
      'scripts/checks/verify-o4p-05d-production-release-closure.ts',
      'scripts/checks/verify-o4p-05c-release-gates.ts',
      'scripts/checks/verify-online-cloudflare-runtime-persistence.ts',
      'scripts/checks/verify-online-cloudflare-websocket-recovery.ts',
      'src/online/cloudflare/persistence.ts',
      'src/online/cloudflare/runtime.ts',
      'src/online/cloudflare/support.ts',
      'src/online/cloudflare/worker.ts',
      'src/online/cloudflare/__tests__/review.o4p-08a-membership-runtime.test.ts',
      'src/online/lobby/index.ts',
      'src/online/lobby/__tests__/review.o4p-08a-shared-membership.test.ts',
      'src/online/publicApp/index.ts',
      'src/online/publicApp/types.ts',
      'src/online/publicApp/v2.ts',
      'src/online/publicApp/recoveryV1.ts',
      'src/online/publicApp/review.o4p-08a-recovery-client.test.ts',
      'research/cr-grounding/o4p-08a-shared-membership-recovery-errors.contract.draft.md',
      'research/cr-grounding/o4p-08a-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-08a-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08a-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-08a-cold-audit-record-2026-08-24.md',
      'research/cr-grounding/archive/o4p-08a-completion-packet-2026-08-24.md',
      'research/cr-grounding/o4p-08a-completion-cold-audit-brief-2026-08-24.draft.md',
      'research/cr-grounding/o4p-08b-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-08b-browser-evidence-2026-08-24.draft.md',
      'research/cr-grounding/o4p-08b-cold-audit-brief.draft.md',
      'research/cr-grounding/archive/o4p-08b-cold-audit-record-2026-08-24.md',
      'research/cr-grounding/archive/o4p-08b-completion-packet-2026-08-24.md',
      'research/cr-grounding/o4p-08b-completion-cold-audit-brief-2026-08-24.draft.md',
      'research/cr-grounding/o4p-08b-production-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08b-prototype-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08b-public-online-journey.contract.draft.md',
      'research/design/online-lobby-prototype/index.html',
      'src/App.css',
      'src/App.tsx',
      'src/components/online/PublicOnlineApp.tsx',
      'src/components/online/__tests__/review.o4p-06e-public-online-app.test.tsx',
      'src/components/online/publicOnlineApp.css',
      'src/dev/onlineLobbyPrototype/main.tsx',
      'src/dev/onlineLobbyPrototype/onlineLobbyPrototype.css',
      'src/dev/onlineLobbyPrototype/onlineLobbyPrototype.test.tsx',
      'src/online/publicApp/o4p08b.production.test.ts',
      'src/online/publicApp/review.o4p-07b-public-online-v2.test.ts',
      'src/online/publicApp/review.o4p-08b-production-journey.test.ts',
      'src/test/architecture/review.o4p-08b-public-online-journey-boundary.test.ts',
      'research/cr-grounding/o4p-08c-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-08c-cold-audit-brief.draft.md',
      'research/cr-grounding/o4p-08c-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08c-variable-roster-genesis.contract.draft.md',
      'research/cr-grounding/archive/o4p-08c-cold-audit-record-2026-08-24.md',
      'research/cr-grounding/archive/o4p-08c-completion-packet-2026-08-24.md',
      'research/cr-grounding/o4p-08c-completion-cold-audit-brief-2026-08-24.draft.md',
      'src/online/cloudflare/index.ts',
      'src/online/cloudflare/types.ts',
      'src/online/cloudflare/security.ts',
      'src/online/cloudflare/__tests__/lobbyRuntimeV1.test.ts',
      'src/online/cloudflare/__tests__/review.o4p-08c-variable-runtime.test.ts',
      'src/online/cloudflare/__tests__/variableCreateV5.test.ts',
      'src/online/cloudflare/__tests__/variableRuntimeV4.test.ts',
      'src/online/genesis/index.ts',
      'src/online/genesis/variable.ts',
      'src/online/genesis/__tests__/review.o4p-08c-variable-roster-genesis.test.ts',
      'src/online/genesis/__tests__/variableGenesisV3.test.ts',
      'src/online/lobby/variable.ts',
      'src/online/projection/index.ts',
      'src/online/projection/variable.ts',
      'src/online/protocol/index.ts',
      'src/online/protocol/variable.ts',
      'src/online/protocol/variableCommand.ts',
      'src/online/room/index.ts',
      'src/online/room/variable.ts',
      'src/test/architecture/modeNeutralCoreBoundary.test.ts',
      'src/test/architecture/review.o4p-02b-four-seat-room-boundary.test.ts',
      'src/test/architecture/review.o4p-02c-in-memory-protocol-boundary.test.ts',
      'src/test/architecture/review.o4p-08c-variable-roster-boundary.test.ts',
      'research/cr-grounding/o4p-08d-acceptance-brief.draft.md',
      'research/cr-grounding/o4p-08d-browser-evidence-2026-08-24.draft.md',
      'research/cr-grounding/o4p-08d-cold-audit-brief.draft.md',
      'research/cr-grounding/o4p-08d-implementation-brief.draft.md',
      'research/cr-grounding/o4p-08d-two-player-surfaces-release.contract.draft.md',
      'src/online/browser/client.ts',
      'src/online/displayPairing/model.ts',
      'src/online/guidedActions/model.ts',
      'src/online/projection/__tests__/review.o4p-08d-full-variable-surfaces.test.ts',
      'src/online/projection/validation.ts',
      'src/online/publicApp/publicAppClientV3.test.ts',
      'src/online/publicApp/review.o4p-08d-variable-public-client.test.ts',
      'src/online/publicApp/v3.ts',
      'src/online/tableDisplay/model.ts',
      'src/online/workbench/model.ts',
      'src/test/architecture/review.o4p-06d-browser-websocket-recovery-boundary.test.ts',
      'src/test/architecture/review.o4p-07b-dynamic-catalog-boundary.test.ts',
      'src/test/architecture/review.o4p-08d-program-completion-boundary.test.ts',
      'src/test/architecture/review.o4p-05d-production-release-closure.test.ts',
      'src/test/architecture/review.o4p-06-roadmap-registration.test.ts',
      'src/test/architecture/review.gov-codex-56-program-orchestration.test.ts',
      'src/test/architecture/review.o4p-07-roadmap-registration.test.ts',
      'src/test/architecture/review.o4p-08-roadmap-registration.test.ts',
    ]);
    for (const path of changed) {
      expect(allowed.has(path), `unexpected changed path: ${path}`).toBe(true);
    }
    expect(
      execFileSync('git', ['show', `${CLOSURE_SHA}:package-lock.json`], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(
      execFileSync('git', ['show', `${CLOSURE_SHA}:wrangler.jsonc`], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:wrangler.jsonc`], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(() =>
      execFileSync('git', ['diff', '--check', BASE_SHA, CLOSURE_SHA], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });
});
