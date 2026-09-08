export const PUBLIC_ONLINE_ENDPOINT_V1 = 'https://mtg-onedeck-online.makeinu1.workers.dev' as const;
export const PUBLIC_ONLINE_LOCAL_ENDPOINT_V1 = 'http://127.0.0.1:8787' as const;

export type PublicOnlineRuntimeRealmV1 = 'production' | 'local-rehearsal';

export function resolvePublicOnlineRuntimeRealmV1(): PublicOnlineRuntimeRealmV1 {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const loopback = hostname === '127.0.0.1' || hostname === 'localhost';
  const localMode = import.meta.env.MODE === 'local-rehearsal';
  const localFlag = import.meta.env.VITE_ONLINE_LOCAL_REHEARSAL === '1';
  if (localMode !== localFlag) throw new Error('online rehearsal build signal mismatch');
  if (localMode && !loopback) throw new Error('online rehearsal origin mismatch');
  return localMode ? 'local-rehearsal' : 'production';
}

export function resolvePublicOnlineEndpointV1(): string {
  return resolvePublicOnlineRuntimeRealmV1() === 'local-rehearsal'
    ? PUBLIC_ONLINE_LOCAL_ENDPOINT_V1
    : PUBLIC_ONLINE_ENDPOINT_V1;
}
