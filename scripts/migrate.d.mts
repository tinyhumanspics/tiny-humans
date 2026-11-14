// Types for scripts/migrate.mjs (plain JS so Vercel's build can run it with node; tests import it).
export interface Entry { tag: string; when: number; hash: string; sql: string }
export interface Plan { last: number; record: Entry[]; apply: Entry[]; blocked: { tag: string; parts: string[] }[] }
export const BASELINE_TAG: string;
export const DESTRUCTIVE_MARKER: RegExp;
export function stripComments(sql: string): string;
export function destructiveParts(sql: string): string[];
export function createdObjects(sql: string): { tables: string[]; columns: [string, string][] };
export function statements(sql: string): string[];
export function plan(input: { entries: Entry[]; applied: { hash?: string; created_at: string | number | null }[]; baselineTag?: string }): Plan;
export function missingObjects(record: Entry[], existing: { table_name: string; column_name: string }[]): string[];
export function decide(env: Record<string, string | undefined>, args?: string[], cwd?: string): { run: true; local: boolean } | { run: false; why: string };
export function transactionQueries(p: Plan): string[];
export function readEntries(dir: string): Entry[];
