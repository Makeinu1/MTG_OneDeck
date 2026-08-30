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

describe('O4P-09E secret-safe visibility and decision architecture', () => {
  it('pins CR semantics, finite intent, bounded closure, and successor exclusions', () => {
    const contract = read('research/cr-grounding/o4p-09e-visibility-decisions.contract.draft.md');
    for (const term of [
      'CR 400.2', 'CR 401.2', 'CR 402.3', 'CR 406.3-406.4', 'CR 608.2d',
      'CR 701.20a-d', 'CR 701.20e', 'CR 101.4a',
      '`look`', '`reveal`', '`choose`', '`next-command`', '`end-of-turn`',
      '`source-bound`', '`choice-bound`',
      '`criteriaKey` is intentionally opaque', 'reject every non-empty `qualified` selection',
      'server-owned `mayFailToFind` is true', 'visible Freeform Manual boundary',
    ]) expect(contract).toContain(term);
    expect(contract).toContain('another player\'s hand/library');
    for (const successor of ['O4P-09F', 'O4P-09G', 'O4P-09H', 'O4P-09I', 'O4P-09J']) {
      expect(contract).toContain(successor);
    }
  });

  it('keeps visibility mutation and automatic closure in the sole Core reducer', () => {
    const core = [
      read('src/engine/core/rules/visibilityGrantV1.ts'),
      read('src/engine/core/rules/visibilityGrantOperationsV1.ts'),
      read('src/engine/core/closure/commandV1.ts'),
      read('src/engine/core/closure/applyCommandV1.ts'),
      read('src/engine/core/closure/domainEventV1.ts'),
    ].join('\n');
    expect(core).toContain('openCoreVisibilityGrantV1');
    expect(core).toContain('pruneCoreVisibilityGrantsV1');
    expect(core).toMatch(/visibility-(?:open|grant)/u);
    expect(core).toMatch(/visibility-(?:closed|close)/u);
    expect(core).toMatch(/next-command/u);
    expect(core).toMatch(/until-search-completes|choice-bound|search-session/u);
    expect(core).toMatch(/snapshotDigest|snapshot-digest|prefixDigest/u);
    expect(core).toMatch(/until-end-of-turn/u);
    expect(core).toMatch(/while-source-exists/u);
    expect(core).toContain('core-search-completion-result-v1');
    expect(core).toMatch(/completionResult[\s\S]*revealFound/u);
    expect(core).not.toMatch(/setTimeout|Date\.now|Math\.random|window\.(?:addEventListener|removeEventListener|dispatchEvent|location|document|localStorage|sessionStorage|setTimeout|clearTimeout|requestAnimationFrame)|document\.(?:addEventListener|removeEventListener|querySelector|getElementById|createElement)/u);
  });

  it('uses one high-level wire while preserving the D hidden-information rejection', () => {
    const e = readTree('src/online/visibilityDecisions');
    const eProduct = [
      read('src/online/visibilityDecisions/types.ts'),
      read('src/online/visibilityDecisions/validation.ts'),
      read('src/online/visibilityDecisions/binding.ts'),
    ].join('\n');
    const d = read('src/online/tabletopManual/binding.ts');
    expect(e).toContain('online-visibility-intent-v1');
    for (const kind of ['look', 'reveal', 'choose']) expect(e).toContain(kind);
    expect(e).toContain('sourceHandle');
    expect(e).toContain('searchSessionId');
    expect(e).toMatch(/validateOnlineVisibility/u);
    expect(e).toMatch(/bindOnlineVisibility/u);
    for (const kind of ['look', 'reveal', 'choose']) {
      expect(d).toMatch(new RegExp(`case '${kind}'[\\s\\S]{0,160}(?:throw|unavailable)`, 'u'));
    }
    expect(eProduct).not.toMatch(/participantCapability|seatCapability|inviteCode|rawCore|statePatch/u);
  });

  it('makes delegated choice the only actor-seat exception', () => {
    const protocol = read('src/online/protocol/variableCommand.ts');
    const server = readTree('src/online/visibilityDecisions');
    expect(protocol).toMatch(/search-complete/u);
    expect(protocol).toMatch(/decisionMakerPlayerId/u);
    expect(protocol).toMatch(/selectorPlayerId/u);
    expect(server).toMatch(/rulesActorPlayerId/u);
    expect(server).toMatch(/selectorPlayerId/u);
    expect(server).toMatch(/search-session/u);
    expect(server).toMatch(/visibilityGrantKeyV1\(state\.revision \+ 1, actor, envelope\.commandId\)/u);
    expect(protocol).toMatch(/completionForAcceptedSearch/u);
    expect(read('src/online/protocol/variable.ts')).toMatch(/completion[\s\S]*selectedCount[\s\S]*revealFound/u);
    const search = read('src/engine/core/rules/searchSessionOperationsV1.ts');
    const binding = read('src/online/visibilityDecisions/binding.ts');
    expect(search).toContain("criteria.kind === 'qualified'");
    expect(search).toContain('criteria.mayFailToFind !== true');
    expect(binding).toContain("session.criteria.kind === 'qualified'");
    expect(binding).toContain('session.criteria.mayFailToFind !== true');
  });

  it('projects exact viewers without exporting raw authority records', () => {
    const projection = [
      read('src/online/projection/project.ts'),
      read('src/online/projection/types.ts'),
      read('src/online/projection/validation.ts'),
    ].join('\n');
    const variableProjection = read('src/online/projection/variable.ts');
    expect(projection).toMatch(/visibilityGrants/u);
    expect(projection).toMatch(/effectiveForPlayerIds/u);
    expect(projection).toMatch(/searchSessions/u);
    expect(`${projection}\n${variableProjection}`).toMatch(/searchResults/u);
    expect(`${projection}\n${variableProjection}`).toMatch(/selectedCount/u);
    expect(`${projection}\n${variableProjection}`).toMatch(/revealFound/u);
    expect(projection).toMatch(/look|reveal/u);
    expect(read('src/online/projection/project.ts')).toMatch(
      /if \(ctx\.playerId === null\) return Object\.freeze\(\[\]\)/u,
    );
    expect(projection).not.toMatch(/participantCapability|seatCapability|inviteCode/u);
    const acceptance = read('research/cr-grounding/o4p-09e-acceptance-brief.draft.md');
    expect(acceptance).toMatch(/secret leak 0/iu);
    expect(acceptance).toContain('unchanged');
  });

  it('routes the production journey through the existing GameScreen only', () => {
    const app = read('src/components/online/PublicOnlineApp.tsx');
    const panel = read('src/components/online/OnlineVisibilityDecisions.tsx');
    const appModel = read('src/online/publicApp/v3.ts');
    const componentTree = readTree('src/components');
    expect(app).toContain('<GameScreen');
    expect(app).toContain('<OnlineVisibilityDecisions');
    expect(panel).toContain('見る');
    expect(panel).toContain('公開する');
    expect(panel).toContain('選ぶ');
    expect(panel).toMatch(/data-testid/u);
    expect(appModel).toContain('visibilitySubmitIssue');
    expect(appModel).toContain('OUTBOX_FULL');
    expect(appModel).toContain('code: `CLIENT_${code}`');
    expect(componentTree).not.toMatch(/(?:function|const|class)\s+Online(?:GameScreen|Board|Hand|Stack)\b/u);
  });

  it('keeps protocol details and client Core mutation outside the player panel', () => {
    const panel = read('src/components/online/OnlineVisibilityDecisions.tsx');
    expect(panel).not.toMatch(/WebSocket|participantCapability|seatCapability|roomId|applyCoreCommand|CoreCommand/u);
    const client = read('src/online/browser/client.ts');
    expect(client).toMatch(/submitVisibility/u);
    expect(client).not.toMatch(/applyCoreCommandV1/u);
  });

  it('keeps accepted-command retry identity participant-scoped across migration', () => {
    const persistence = read('src/online/cloudflare/persistence.ts');
    expect(persistence).toContain('UNIQUE (participant_id, command_id)');
    expect(persistence).not.toMatch(/command_id TEXT NOT NULL UNIQUE/u);
    expect(persistence).toContain('Journal migration verification failed');
    expect(persistence).toContain('Journal migration final verification failed');
    expect(persistence).toContain("entry.participant_id === participantId && entry.command_id === commandId");
  });
});
