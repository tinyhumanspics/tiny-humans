// Fake Stripe API (Checkout Sessions only) for local development. Never used on Vercel.
// .env.local: STRIPE_SECRET_KEY=rk_test_local STRIPE_API_BASE=http://localhost:4747 STRIPE_WEBHOOK_SECRET=whsec_local
// POST /_pay/<session id> marks a session paid and sends a signed checkout.session.completed webhook to
// FAKE_STRIPE_WEBHOOK_URL (default http://localhost:3000/api/stripe/webhook); add ?nohook=1 to skip the webhook (a
// missed delivery). GET /_sessions lists sessions. GET /v1/checkout/sessions lists them (customer_details[email], status).
import http from "node:http";
import { createHmac } from "node:crypto";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 4747);
const WEBHOOK_URL = process.env.FAKE_STRIPE_WEBHOOK_URL ?? "http://localhost:3000/api/stripe/webhook";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local";
const sessions = new Map();
const byKey = new Map();
let n = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

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
        const f = new URLSearchParams(body);
        const id = `cs_test_${++n}`;
        const metadata = Object.fromEntries([...f].filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v]));
        const s = {
          id,
          object: "checkout.session",
          url: `http://localhost:${PORT}/pay/${id}`,
          status: "open",
          payment_status: "unpaid",
          amount_total: [0, 1, 2].reduce((sum, i) => sum + Number(f.get(`line_items[${i}][price_data][unit_amount]`) ?? 0) * Number(f.get(`line_items[${i}][quantity]`) ?? 1), 0),
          line_items: [0, 1, 2].filter((i) => f.get(`line_items[${i}][price_data][unit_amount]`)).map((i) => ({ name: f.get(`line_items[${i}][price_data][product_data][name]`), amount: Number(f.get(`line_items[${i}][price_data][unit_amount]`)) })),
          currency: f.get("line_items[0][price_data][currency]"),
          customer_email: f.get("customer_email"),
          client_reference_id: f.get("client_reference_id"),
          product_name: f.get("line_items[0][price_data][product_data][name]"),
          metadata,
          success_url: f.get("success_url"),
          cancel_url: f.get("cancel_url"),
          payment_intent: null,
          expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
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
      const pay = url.pathname.match(/^\/_pay\/([^/]+)$/);
      if (req.method === "POST" && pay && sessions.has(pay[1])) {
        const s = Object.assign(sessions.get(pay[1]), { status: "complete", payment_status: "paid", payment_intent: `pi_test_${pay[1]}`, customer_details: { email: sessions.get(pay[1]).customer_email } });
        if (url.searchParams.get("nohook")) return send(res, 200, { session: s, webhookStatus: "skipped" });
        const payload = JSON.stringify({ id: `evt_${Date.now()}`, type: "checkout.session.completed", data: { object: s } });
        const t = Math.floor(Date.now() / 1000);
        const sig = createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex");
        const hook = await fetch(WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` }, body: payload }).catch((e) => ({ status: String(e) }));
        return send(res, 200, { session: s, webhookStatus: hook.status });
      }
      if (url.pathname === "/_sessions") return send(res, 200, [...sessions.values()]);
      send(res, 404, { error: { message: "not found" } });
    });
  })
  .listen(PORT, () => console.log(`fake Stripe on http://localhost:${PORT} (webhooks → ${WEBHOOK_URL})`));
