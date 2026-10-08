// Fake Resend API for local development. Never used on Vercel.
// .env.local: RESEND_API_KEY=re_local RESEND_BASE_URL=http://localhost:4646
// Every email is saved as JSON in scripts/local-db/.emails/ (HTML, text, subject, idempotency key).
// Addresses containing "fail@" are rejected (422), to test failure handling.
// Delivery webhooks (like Resend's, Svix-signed): set FAKE_RESEND_WEBHOOK_URL (e.g. http://localhost:3000/api/resend/webhook)
// and FAKE_RESEND_WEBHOOK_SECRET (= the app's RESEND_WEBHOOK_SECRET, "whsec_<base64>"). Then an address containing
// "bounce@" gets email.bounced, "spam@" email.complained and "blocked@" email.suppressed, a moment after sending.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = process.env.FAKE_RESEND_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".emails");
const PORT = Number(process.env.FAKE_RESEND_PORT ?? 4646);
fs.mkdirSync(out, { recursive: true });
const HOOK_URL = process.env.FAKE_RESEND_WEBHOOK_URL;
const HOOK_SECRET = process.env.FAKE_RESEND_WEBHOOK_SECRET ?? "";

/** Sends a Svix-signed webhook like Resend's; resolves to the HTTP status (or the error). */
async function sendHook(type, email, id, extra = {}) {
  const payload = JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: { email_id: id, from: email.from, to: [email.to].flat(), subject: email.subject, tags: Object.fromEntries((email.tags ?? []).map((t) => [t.name, t.value])), ...extra },
  });
  const msgId = `msg_${crypto.randomBytes(8).toString("hex")}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", Buffer.from(HOOK_SECRET.replace(/^whsec_/, ""), "base64")).update(`${msgId}.${ts}.${payload}`).digest("base64");
  const res = await fetch(HOOK_URL, { method: "POST", headers: { "content-type": "application/json", "svix-id": msgId, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }, body: payload }).catch((e) => ({ status: String(e) }));
  console.log(`webhook ${type} → ${res.status}`);
  return res.status;
}
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
      const to = JSON.stringify(email.to);
      if (HOOK_URL && HOOK_SECRET) {
        const id = `fake-${n}`;
        if (to.includes("bounce@")) setTimeout(() => sendHook("email.bounced", email, id, { bounce: { type: "Permanent", subType: "General", message: "550 5.1.1 mailbox unavailable" } }), 300);
        if (to.includes("spam@")) setTimeout(() => sendHook("email.complained", email, id), 300);
        if (to.includes("blocked@")) setTimeout(() => sendHook("email.suppressed", email, id, { suppressed: { type: "OnAccountSuppressionList", message: "on the suppression list" } }), 300);
      }
    });
  })
  .listen(PORT, () => console.log(`fake Resend on http://localhost:${PORT} → ${out}`));
