import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface WorkflowStep {
  readonly fields: Map<string, string>;
}

interface WorkflowJob {
  readonly fields: Map<string, string>;
  readonly steps: WorkflowStep[];
}

interface ParsedWorkflow {
  readonly jobs: Map<string, WorkflowJob>;
}

function parseScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function parseWorkflow(text: string): ParsedWorkflow {
  const jobs = new Map<string, WorkflowJob>();
  let inJobs = false;
  let currentJob: WorkflowJob | null = null;
  let currentStep: WorkflowStep | null = null;
  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '' || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (indent === 0 && line === 'jobs:') {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (indent === 2 && line.endsWith(':')) {
      const job: WorkflowJob = { fields: new Map(), steps: [] };
      jobs.set(line.slice(0, -1), job);
      currentJob = job;
      currentStep = null;
      continue;
    }
    if (currentJob === null) continue;
    if (indent === 4 && line === 'steps:') {
      currentStep = null;
      continue;
    }
    if (indent === 4) {
      const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (field !== null) currentJob.fields.set(field[1], parseScalar(field[2]));
      currentStep = null;
      continue;
    }
    if (indent === 6 && line.startsWith('- ')) {
      const step: WorkflowStep = { fields: new Map() };
      currentJob.steps.push(step);
      currentStep = step;
      const field = line.slice(2).match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (field !== null) step.fields.set(field[1], parseScalar(field[2]));
      continue;
    }
    if (indent > 6 && currentStep !== null) {
      const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (field !== null) currentStep.fields.set(field[1], parseScalar(field[2]));
    }
  }
  return { jobs };
}

function workflowText(): string {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  return readFileSync(resolve(repositoryRoot, '.github/workflows/deploy-pages.yml'), 'utf8');
}

function stepLabel(step: WorkflowStep): string {
  return step.fields.get('run') ?? step.fields.get('uses') ?? '';
}

describe('GitHub Pages verification gates', () => {
  it('keeps push-main and workflow_dispatch triggers', () => {
    const text = workflowText();
    expect(text).toMatch(/branches:\s*\[main\]/);
    expect(text).toMatch(/^\s*workflow_dispatch:\s*$/m);
  });

  it('identifies build and deploy jobs and enforces the gated step order', () => {
    const text = workflowText();
    const workflow = parseWorkflow(text);
    const build = workflow.jobs.get('build');
    const deploy = workflow.jobs.get('deploy');
    expect(build).toBeDefined();
    expect(deploy).toBeDefined();
    if (build === undefined || deploy === undefined) return;

    const labels = build.steps.map(stepLabel);
    expect(labels[0]).toMatch(/^actions\/checkout@/);
    expect(labels[1]).toMatch(/^actions\/setup-node@/);
    expect(labels[2]).toBe('npm ci');
    expect(labels[3]).toBe('npm run check -- --build-base=/MTG_OneDeck/');
    expect(labels[4]).toBe("npm run check:forbidden -- --diff ${{ github.event.before || 'HEAD^' }} --policy governance-reset");
    expect(labels[5]).toMatch(/^actions\/configure-pages@/);
    expect(labels[6]).toMatch(/^actions\/upload-pages-artifact@/);
    expect(labels).toHaveLength(7);

    const checkIndex = labels.indexOf('npm run check -- --build-base=/MTG_OneDeck/');
    const forbiddenIndex = labels.indexOf("npm run check:forbidden -- --diff ${{ github.event.before || 'HEAD^' }} --policy governance-reset");
    const uploadIndex = labels.findIndex((label) => label.startsWith('actions/upload-pages-artifact@'));
    expect(checkIndex).toBeGreaterThanOrEqual(0);
    expect(forbiddenIndex).toBeGreaterThan(checkIndex);
    expect(uploadIndex).toBeGreaterThan(forbiddenIndex);
    expect(deploy.fields.get('needs')).toBe('build');
    expect(deploy.steps.some((step) => step.fields.has('uses'))).toBe(true);
  });

  it('does not duplicate direct lint/test or ignore gate failures', () => {
    const text = workflowText();
    expect(text).not.toMatch(/^\s*- run: npm run lint\s*$/m);
    expect(text).not.toMatch(/^\s*- run: npm test\s*$/m);
    expect(text).not.toMatch(/^\s*continue-on-error:\s*true\s*$/m);
    expect(text).not.toMatch(/^\s*if:\s*always\(\)\s*$/m);
  });
});
