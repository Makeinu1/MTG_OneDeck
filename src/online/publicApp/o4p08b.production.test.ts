import { describe, expect, it } from 'vitest';
import { encodeOnlineSharedInviteCodeV3, parsePublicOnlineErrorV3, publicOnlineErrorMessageV3, readAndScrubPublicOnlineInviteFragmentV3 } from './index';

describe('O4P-08B production public journey helpers', () => {
  it('preserves structured retryability, cause, and correlation', () => {
    const parsed = parsePublicOnlineErrorV3({ kind: 'online-public-error-v3', schemaVersion: 3, code: 'SERVICE_UNAVAILABLE', retryable: true, correlationId: 'corr-o4p08b' });
    expect(parsed).not.toBeNull();
    expect(publicOnlineErrorMessageV3(parsed!)).toMatchObject({ retryable: true, correlationId: 'corr-o4p08b' });
  });
  it('scrubs a shared invite fragment before returning the typed code', () => {
    const code = encodeOnlineSharedInviteCodeV3('room-o4p08b-test', `admission_${'a'.repeat(40)}`);
    const history = { state: null, replaceState: (_state: unknown, _title: string, url: string) => { expect(url).not.toContain('online-invite'); } };
    const result = readAndScrubPublicOnlineInviteFragmentV3({ href: `https://example.test/app#online-invite=${encodeURIComponent(code)}`, hash: `#online-invite=${encodeURIComponent(code)}` }, history);
    expect(result?.roomId).toBe('room-o4p08b-test');
  });
});
