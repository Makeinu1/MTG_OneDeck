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
export { PUBLIC_ONLINE_ERROR_V1 } from './types';
export type {
  PublicOnlineConnectionStateV1,
  PublicOnlineDeckOptionV1,
  PublicOnlineModeV1,
  PublicOnlineProjectionV1,
  PublicOnlineSnapshotV1,
  PublicOnlineValidationResultV1,
  PublicOnlineDeckOptionV2,
  PublicOnlineIssueV2,
  PublicOnlineErrorIssueV2,
  PublicOnlineSeatV2,
  PublicOnlineProjectionV2,
  PublicOnlineSnapshotV2,
  PublicOnlineControllerV2,
  PublicOnlinePlayerCountV3,
  PublicOnlineStartingLifeV3,
  PublicOnlineConfigurationV3,
  PublicOnlineSeatV3,
  PublicOnlineProjectionV3,
  PublicOnlineSnapshotV3,
  PublicOnlineControllerV3,
} from './types';
export { createPublicOnlineControllerV2, validatePublicOnlineProjectionV2 } from './v2';
export { createPublicOnlineControllerV3, validatePublicOnlineProjectionV3 } from './v3';
export {
  createPublicOnlineRecoveryStoreV1,
  parsePublicOnlineErrorV3,
  publicOnlineErrorMessageV3,
  readAndScrubPublicOnlineInviteFragmentV3,
  encodeOnlineSharedInviteCodeV3,
} from './recoveryV1';
export type {
  PublicOnlineRecoveryRecordV1,
  PublicOnlineStorageV1,
  PublicOnlineErrorV3,
  PublicOnlineErrorCodeV3,
} from './recoveryV1';
