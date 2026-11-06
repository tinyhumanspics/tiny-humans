const DAYS = [7, 30, 90] as const;

/** /api/admin/unfinished?days=7|30|90 (default 7) and ?source=<label> for the step counts. */
export function periodOf(url: URL): { days: number; source: string | null } {
  const days = Number(url.searchParams.get("days"));
  const source = url.searchParams.get("source")?.trim().slice(0, 80) || null;
  return { days: DAYS.find((d) => d === days) ?? 7, source };
}
