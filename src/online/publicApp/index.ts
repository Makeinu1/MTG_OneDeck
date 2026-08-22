export const PUBLIC_ONLINE_ENDPOINT_V1 = 'https://mtg-onedeck-online.makeinu1.workers.dev' as const;
export { PUBLIC_ONLINE_ERROR_V1 } from './types';
export type {
  PublicOnlineConnectionStateV1,
  PublicOnlineControllerV1,
  PublicOnlineDeckOptionV1,
  PublicOnlineModeV1,
  PublicOnlineProjectionV1,
  PublicOnlineSnapshotV1,
  PublicOnlineValidationResultV1,
  PublicOnlineDeckOptionV2,
  PublicOnlineIssueV2,
  PublicOnlineSeatV2,
  PublicOnlineProjectionV2,
  PublicOnlineSnapshotV2,
  PublicOnlineControllerV2,
} from './types';
export { createPublicOnlineControllerV1, validatePublicOnlineProjectionV1 } from './client';
export { createPublicOnlineControllerV2, validatePublicOnlineProjectionV2 } from './v2';
