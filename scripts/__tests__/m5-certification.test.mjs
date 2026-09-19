import { describe, expect, it } from 'vitest';

import { certifyM5, validateM5ProgramState } from '../checks/m5-certification.mjs';

describe('M5.6 clean baseline certification', () => {
  it('certifies the repository only when the M5.0-M5.5 control plane is closed', () => {
    const report = certifyM5();
    expect(report).toMatchObject({
      ok: true,
      summary: {
        completedM5Gates: 6,
        unresolvedLifecycleCount: 0,
      },
    });
  });
  it('does not freeze Project State at the M6-PLAN handoff after M5 completed', () => {
    const project = {
      program: {
        completedMilestones: [
          'M5.0 — Asset Model / Derived Census Foundation',
          'M5.1 — Lifecycle / Retention / Retirement',
          'M5.2 — Repository Reconciliation / Cleanup',
          'M5.3 — Drift / Hygiene Detection',
          'M5.4 — Recovery / Reconciliation Protocol',
          'M5.5 — Adversarial / Destructive Audit',
          'M5.6 — Clean Baseline Certification',
          'M5 — Audit / Hygiene / Recovery',
        ],
        activeMilestone: 'M6.4 — Later Closed Execution Loop Phase',
        nextGate: 'M6.5 — Later Gate',
        prohibitedScope: [],
      },
    };

    expect(validateM5ProgramState(project)).toEqual([]);
  });

});
