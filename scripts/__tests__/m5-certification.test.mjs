import { describe, expect, it } from 'vitest';

import { certifyM5 } from '../checks/m5-certification.mjs';

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
});
