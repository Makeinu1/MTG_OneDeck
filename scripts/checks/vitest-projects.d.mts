export const CORE_TEST_INCLUDE: readonly string[];
export const DOM_ENGINE_EXCLUDE: string;
export function isTestLikePath(path: string): boolean;
export function vitestProjectForPath(path: string): 'core' | 'dom' | null;
export function runVitestProjects(options?: {
  spawn?: (...args: any[]) => { status: number | null };
  extraArgs?: string[];
  write?: (line: string) => void;
}): { exitCode: number; results: Array<{ project: string; code: number | null; skipped: boolean }> };
