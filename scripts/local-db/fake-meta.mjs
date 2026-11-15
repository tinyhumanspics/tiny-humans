// Fake Meta Conversions API for local development. Never used on Vercel.
// .env.local: NEXT_PUBLIC_META_PIXEL_ID=123456789 META_CAPI_ACCESS_TOKEN=local META_GRAPH_BASE_URL=http://localhost:4848
// Every event the server sends is saved as JSON in scripts/local-db/.meta/ (one file per event). GET /_events lists them.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = process.env.FAKE_META_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".meta");
const PORT = Number(process.env.FAKE_META_PORT ?? 4848);
fs.mkdirSync(out, { recursive: true });
const events = [];

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === "GET" && url.pathname === "/_events") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(events));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method !== "POST" || !/^\/v\d+\.\d+\/\d+\/events$/.test(url.pathname)) {
        res.writeHead(404, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "unknown path", code: 803 } }));
      }
      const data = JSON.parse(body || "{}").data ?? [];
      for (const e of data) {
        events.push({ path: url.pathname, ...e });
        fs.writeFileSync(path.join(out, `${String(events.length).padStart(3, "0")}-${e.event_name}.json`), JSON.stringify({ path: url.pathname, ...e }, null, 2));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ events_received: data.length, fbtrace_id: "local" }));
    });
  })
  .listen(PORT, () => console.log(`fake Meta Conversions API on http://localhost:${PORT}`));
