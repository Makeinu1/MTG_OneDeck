export const CORE_MANUAL_CORRECTION_WARNING_CODE_V1 = 'MANUAL_CORRECTION_APPLIED' as const;

export type CoreCorrectionReasonV1 = string;
export type CoreCorrectionValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;

export function validateCoreCorrectionReasonV1(reason: unknown): readonly CoreCorrectionValidationIssueV1[] {
  if (typeof reason !== 'string') return Object.freeze([{ code: 'INVALID_REASON', path: '/reason', message: 'Reason must be a string' }]);
  if (reason.trim().length === 0) return Object.freeze([{ code: 'INVALID_REASON', path: '/reason', message: 'Reason must not be empty or whitespace-only' }]);
  return Object.freeze([]);
}

export function createCoreCorrectionWarningV1(reason: CoreCorrectionReasonV1): Readonly<{ readonly code: typeof CORE_MANUAL_CORRECTION_WARNING_CODE_V1; readonly path: '/reason'; readonly message: string }> {
  void reason;
  return Object.freeze({ code: CORE_MANUAL_CORRECTION_WARNING_CODE_V1, path: '/reason', message: 'Manual correction applied' });
}
