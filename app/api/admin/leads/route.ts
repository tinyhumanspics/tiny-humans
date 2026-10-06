import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getLead, isLeadFilter, listLeads } from "@/lib/leads/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Owner only. GET ?status=all|confirmed|cancelled|…&offset=0  or  ?reference=TH-… */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet, so there are no leads to show." }, { status: 503 });
  const url = new URL(req.url);
  try {
    const reference = url.searchParams.get("reference");
    if (reference) {
      const lead = await getLead(reference);
      return lead ? NextResponse.json({ lead }) : NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    const status = url.searchParams.get("status") ?? "all";
    if (!isLeadFilter(status)) return NextResponse.json({ error: "Unknown filter." }, { status: 400 });
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    return NextResponse.json(await listLeads(status, 50, offset), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("admin.leads", "Could not load leads", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load leads. Please try again." }, { status: 500 });
  }
}
