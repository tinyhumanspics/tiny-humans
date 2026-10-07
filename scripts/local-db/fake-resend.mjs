// Fake Resend API for local development. Never used on Vercel.
// .env.local: RESEND_API_KEY=re_local RESEND_BASE_URL=http://localhost:4646
// Every email is saved as JSON in scripts/local-db/.emails/ (HTML, text, subject, idempotency key).
// Addresses containing "fail@" are rejected (422), to test failure handling.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = process.env.FAKE_RESEND_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".emails");
const PORT = Number(process.env.FAKE_RESEND_PORT ?? 4646);
fs.mkdirSync(out, { recursive: true });
let n = fs.readdirSync(out).length;
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method !== "POST" || req.url !== "/emails") return res.writeHead(404).end();
      const email = JSON.parse(body);
      if (JSON.stringify(email.to).includes("fail@")) {
        res.writeHead(422, { "content-type": "application/json" });
        return res.end(JSON.stringify({ statusCode: 422, name: "validation_error", message: "fake failure" }));
      }
      n++;
      fs.writeFileSync(path.join(out, `${String(n).padStart(3, "0")}.json`), JSON.stringify({ idempotencyKey: req.headers["idempotency-key"] ?? null, ...email }, null, 1));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `fake-${n}` }));
    });
  })
  .listen(PORT, () => console.log(`fake Resend on http://localhost:${PORT} → ${out}`));
