export const DEFAULT_TEST_INCLUDE: string[];
export const CORE_TEST_INCLUDE: string[];
export const TEST_EXCLUDE: string[];
export const DOM_ENGINE_EXCLUDE: string;
export const TEST_FILE_SUFFIXES: readonly string[];
export function isTestLikePath(path: string): boolean;
export function vitestProjectForPath(path: string): 'core' | 'dom' | null;
export function partitionVitestTestFiles(paths: string[]): { core: string[]; dom: string[] };
export function runVitestProjects(options?: {
  spawn?: (...args: any[]) => { status: number | null };
  extraArgs?: string[];
  write?: (line: string) => void;
}): { exitCode: number; results: Array<{ project: string; code: number | null; skipped: boolean }> };
