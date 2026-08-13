import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { OnlineCloudflareSqlStorage } from '../types';

type Row = Record<string, unknown>;

function input(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) return value;
  throw new TypeError('Unsupported SQLite binding');
}

function cursor<T extends Row>(rows: readonly T[]): Readonly<{ toArray(): T[] }> {
  return { toArray: () => rows.map((row) => ({ ...row })) };
}

export class ReviewSqliteStorage implements OnlineCloudflareSqlStorage {
  readonly database = new DatabaseSync(':memory:');
  readonly queries: Array<Readonly<{ readonly query: string; readonly bindings: readonly unknown[] }>> = [];
  transactionCount = 0;
  failExecWhen: ((query: string, bindings: readonly unknown[]) => boolean) | null = null;

  readonly sql = {
    exec: <T extends Row>(query: string, ...bindings: readonly unknown[]) => {
      this.queries.push(Object.freeze({ query, bindings: Object.freeze([...bindings]) }));
      if (this.failExecWhen?.(query, bindings) === true) throw new Error('forced review SQL failure');
      if (/^\s*CREATE\s+TABLE\b/i.test(query) && bindings.length === 0) {
        this.database.exec(query);
        return cursor<T>([]);
      }
      const statement = this.database.prepare(query);
      const values = bindings.map(input);
      if (/^\s*(?:SELECT|PRAGMA)\b/i.test(query) || /\bRETURNING\b/i.test(query)) {
        return cursor(statement.all(...values) as T[]);
      }
      statement.run(...values);
      return cursor<T>([]);
    },
  };

  transactionSync<T>(callback: () => T): T {
    this.transactionCount += 1;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.database.exec('COMMIT');
      return result;
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  all<T extends Row>(query: string, ...bindings: readonly SQLInputValue[]): T[] {
    return this.database.prepare(query).all(...bindings) as T[];
  }

  run(query: string, ...bindings: readonly SQLInputValue[]): void {
    this.database.prepare(query).run(...bindings);
  }

  close(): void {
    this.database.close();
  }
}
