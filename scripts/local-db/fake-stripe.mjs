// Fake Stripe API (Checkout Sessions + refunds) for local development. Never used on Vercel.
// .env.local: STRIPE_SECRET_KEY=rk_test_local STRIPE_API_BASE=http://localhost:4747 STRIPE_WEBHOOK_SECRET=whsec_local
// POST /_pay/<session id> marks a session paid and sends a signed checkout.session.completed webhook to
// FAKE_STRIPE_WEBHOOK_URL (default http://localhost:3000/api/stripe/webhook); add ?nohook=1 to skip the webhook (a
// missed delivery). POST /_expire/<session id> expires an open session (as when its expires_at passes) and sends
// checkout.session.expired (?nohook=1 skips it). POST /_refunds/fail makes the next refund fail; GET /_refunds lists
// refunds. POST /_checkout/fail makes the next Checkout Session request fail (Stripe down). GET /_sessions lists sessions. GET /v1/checkout/sessions lists them (customer_details[email], status).
import http from "node:http";
import { createHmac } from "node:crypto";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 4747);
const WEBHOOK_URL = process.env.FAKE_STRIPE_WEBHOOK_URL ?? "http://localhost:3000/api/stripe/webhook";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local";
const sessions = new Map();
const byKey = new Map();
const refunds = [];
const refundKeys = new Map();
let failNextRefund = false;
let failNextCheckout = false;
let n = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function webhook(type, object) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex");
  const hook = await fetch(WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` }, body: payload }).catch((e) => ({ status: String(e) }));
  return hook.status;
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (!/^Bearer (sk|rk)_/.test(req.headers.authorization ?? "") && url.pathname.startsWith("/v1/")) return send(res, 401, { error: { type: "invalid_request_error", message: "No API key" } });
      if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
        const key = req.headers["idempotency-key"];
        if (key && byKey.has(key)) return send(res, 200, sessions.get(byKey.get(key)));
        if (failNextCheckout) {
          failNextCheckout = false;
          return send(res, 500, { error: { type: "api_error", message: "Stripe is having trouble (fake)" } });
        }
        const f = new URLSearchParams(body);
        const expiresAt = f.get("expires_at") ? Number(f.get("expires_at")) : Math.floor(Date.now() / 1000) + 24 * 3600;
        const life = expiresAt - Date.now() / 1000;
        if (life < 30 * 60 - 5 || life > 24 * 3600 + 5) return send(res, 400, { error: { type: "invalid_request_error", code: "parameter_invalid_integer", message: "expires_at must be 30 minutes to 24 hours from now" } });
        const id = `cs_test_${++n}`;
        const metadata = Object.fromEntries([...f].filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v]));
        const s = {
          id,
          object: "checkout.session",
          url: `http://localhost:${PORT}/pay/${id}`,
          status: "open",
          payment_status: "unpaid",
          amount_total: [0, 1, 2].reduce((sum, i) => sum + Number(f.get(`line_items[${i}][price_data][unit_amount]`) ?? 0) * Number(f.get(`line_items[${i}][quantity]`) ?? 1), 0),
          line_items: [0, 1, 2].filter((i) => f.get(`line_items[${i}][price_data][unit_amount]`)).map((i) => ({ name: f.get(`line_items[${i}][price_data][product_data][name]`), description: f.get(`line_items[${i}][price_data][product_data][description]`), amount: Number(f.get(`line_items[${i}][price_data][unit_amount]`)) })),
          currency: f.get("line_items[0][price_data][currency]"),
          customer_email: f.get("customer_email"),
          client_reference_id: f.get("client_reference_id"),
          product_name: f.get("line_items[0][price_data][product_data][name]"),
          submit_message: f.get("custom_text[submit][message]"),
          metadata,
          success_url: f.get("success_url"),
          cancel_url: f.get("cancel_url"),
          payment_intent: null,
          expires_at: expiresAt,
        };
        sessions.set(id, s);
        if (key) byKey.set(key, id);
        return send(res, 200, s);
      }
      if (req.method === "GET" && url.pathname === "/v1/checkout/sessions") {
        const email = url.searchParams.get("customer_details[email]");
        const status = url.searchParams.get("status");
        const data = [...sessions.values()].reverse().filter((x) => (!email || x.customer_details?.email === email) && (!status || x.status === status));
        return send(res, 200, { object: "list", data: data.slice(0, Number(url.searchParams.get("limit") ?? 10)), has_more: false });
      }
      const get = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
      if (req.method === "GET" && get) return sessions.has(get[1]) ? send(res, 200, sessions.get(get[1])) : send(res, 404, { error: { code: "resource_missing", message: "No such session" } });
      const expire = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)\/expire$/);
      if (req.method === "POST" && expire) {
        const s = sessions.get(expire[1]);
        if (!s) return send(res, 404, { error: { code: "resource_missing", message: "No such session" } });
        if (s.status !== "open") return send(res, 400, { error: { type: "invalid_request_error", message: `Only open sessions can be expired (this one is ${s.status})` } });
        s.status = "expired";
        return send(res, 200, s);
      }
      if (req.method === "POST" && url.pathname === "/v1/refunds") {
        const key = req.headers["idempotency-key"];
        if (key && refundKeys.has(key)) return send(res, 200, refundKeys.get(key));
        const f = new URLSearchParams(body);
        const pi = f.get("payment_intent");
        const paid = [...sessions.values()].find((x) => x.payment_intent === pi);
        if (!paid) return send(res, 400, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such payment_intent" } });
        if (failNextRefund) {
          failNextRefund = false;
          return send(res, 400, { error: { type: "invalid_request_error", code: "charge_already_refunded", message: "Charge has already been refunded." } });
        }
        const r = { id: `re_test_${refunds.length + 1}`, object: "refund", amount: Number(f.get("amount") ?? paid.amount_total), payment_intent: pi, status: "succeeded", reason: f.get("reason"), metadata: { booking_reference: f.get("metadata[booking_reference]") } };
        refunds.push(r);
        if (key) refundKeys.set(key, r);
        return send(res, 200, r);
      }
      const pay = url.pathname.match(/^\/_pay\/([^/]+)$/);
      if (req.method === "POST" && pay && sessions.has(pay[1])) {
        const s0 = sessions.get(pay[1]);
        if (s0.status !== "open") return send(res, 400, { error: { message: `Session is ${s0.status}` } });
        const s = Object.assign(s0, { status: "complete", payment_status: "paid", payment_intent: `pi_test_${pay[1]}`, customer_details: { email: s0.customer_email } });
        if (url.searchParams.get("nohook")) return send(res, 200, { session: s, webhookStatus: "skipped" });
        return send(res, 200, { session: s, webhookStatus: await webhook("checkout.session.completed", s) });
      }
      const exp = url.pathname.match(/^\/_expire\/([^/]+)$/);
      if (req.method === "POST" && exp && sessions.has(exp[1])) {
        const s = sessions.get(exp[1]);
        if (s.status !== "open") return send(res, 400, { error: { message: `Session is ${s.status}` } });
        s.status = "expired";
        if (url.searchParams.get("nohook")) return send(res, 200, { session: s, webhookStatus: "skipped" });
        return send(res, 200, { session: s, webhookStatus: await webhook("checkout.session.expired", s) });
      }
      if (req.method === "POST" && url.pathname === "/_checkout/fail") {
        failNextCheckout = true;
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/_refunds/fail") {
        failNextRefund = true;
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/_refunds") return send(res, 200, refunds);
      if (url.pathname === "/_sessions") return send(res, 200, [...sessions.values()]);
      send(res, 404, { error: { message: "not found" } });
    });
  })
  .listen(PORT, () => console.log(`fake Stripe on http://localhost:${PORT} (webhooks → ${WEBHOOK_URL})`));
