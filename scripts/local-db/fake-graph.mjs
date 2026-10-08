// Fake Microsoft Graph for local development (calendar only). Never used on Vercel.
// .env.local: MICROSOFT_TENANT_ID=local MICROSOFT_CLIENT_ID=local MICROSOFT_CLIENT_SECRET=local
//             MICROSOFT_GRAPH_BASE_URL=http://localhost:4545/v1.0 MICROSOFT_LOGIN_BASE_URL=http://localhost:4545
// Events live in memory. GET /_events lists them; touch scripts/local-db/.graph-down to simulate an outage.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FAKE_GRAPH_PORT ?? 4545);
const events = new Map();
// Graph local time (Windows "Eastern Standard Time") -> UTC ISO, good enough for tests around now (handles EDT/EST).
const toUtc = (dt, tz) => {
  if (/UTC/i.test(tz)) return new Date(dt + "Z");
  const guess = new Date(dt + "Z");
  const ny = new Date(guess.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (utc - ny));
};
const send = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(data === undefined ? "" : JSON.stringify(data));
};

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (fs.existsSync(path.join(here, ".graph-down"))) return send(res, 503, { error: { code: "ServiceUnavailable", message: "simulated outage" } });
    if (url.pathname.endsWith("/oauth2/v2.0/token")) return send(res, 200, { access_token: "local-token", expires_in: 3600 });
    if (url.pathname === "/_events") return send(res, 200, [...events.values()]);
    const m = url.pathname.match(/^\/v1\.0\/users\/[^/]+\/(calendarView|events)(?:\/([^/]+))?$/);
    if (!m) return send(res, 404, { error: { code: "NotFound", message: url.pathname } });
    const [, kind, id] = m;
    if (kind === "calendarView") {
      const from = new Date(url.searchParams.get("startDateTime"));
      const to = new Date(url.searchParams.get("endDateTime"));
      const value = [...events.values()]
        .filter((e) => e.startUtc < to && e.endUtc > from)
        .map((e) => ({ id: e.id, showAs: "busy", isCancelled: false, start: { dateTime: e.startUtc.toISOString().slice(0, 19), timeZone: "UTC" }, end: { dateTime: e.endUtc.toISOString().slice(0, 19), timeZone: "UTC" } }));
      return send(res, 200, { value });
    }
    if (req.method === "POST" && !id) {
      const b = JSON.parse(body || "{}");
      const existing = [...events.values()].find((e) => e.transactionId && e.transactionId === b.transactionId);
      if (existing) return send(res, 201, { id: existing.id });
      const e = { id: randomUUID(), subject: b.subject, location: b.location?.displayName, transactionId: b.transactionId, startUtc: toUtc(b.start.dateTime, b.start.timeZone), endUtc: toUtc(b.end.dateTime, b.end.timeZone), body: b.body?.content };
      events.set(e.id, e);
      return send(res, 201, { id: e.id });
    }
    if (req.method === "PATCH" && id && events.has(id)) {
      const b = JSON.parse(body || "{}");
      const e = events.get(decodeURIComponent(id));
      if (b.start) e.startUtc = toUtc(b.start.dateTime, b.start.timeZone);
      if (b.end) e.endUtc = toUtc(b.end.dateTime, b.end.timeZone);
      if (b.body) e.body = b.body.content;
      return send(res, 200, { id: e.id });
    }
    if (req.method === "DELETE" && id) {
      events.delete(decodeURIComponent(id));
      return send(res, 204);
    }
    return send(res, 404, { error: { code: "ErrorItemNotFound", message: "not found" } });
  })
  .listen(PORT, () => console.log(`fake Graph on http://localhost:${PORT}`));
