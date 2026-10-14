// CSS order-tie scanner (Phase 8). Finds every element property set by two equal-specificity rules from different
// stylesheets (CSS modules or globals.css) with different values, where no more specific rule wins. Their winner then
// depends only on Turbopack's CSS chunk order, which moving files can change (Oct 12-13: the footer copyright margin,
// the bundle-card button margin). Expect 0; resolve a tie by making the intended winner explicit (more specific
// selector) or by removing the losing declaration, keeping what production shows today.
// Read-only (loads pages, reads CSSOM, submits nothing; Meta Pixel + Vercel Analytics requests are blocked).
// Usage: node scripts/css-ties.mjs <baseURL> [out.json]   e.g. node scripts/css-ties.mjs http://localhost:3100
import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [, , BASE = "http://localhost:3000", OUT] = process.argv;
const PAGES = ["/", "/bundles", "/book?bundle=little-moments", "/about", "/home-sweet-home", "/privacy", "/terms", "/review",
  "/cancel", "/reschedule", "/backdrop", "/pay/status", "/admin", "/no-such-page", "/es", "/es/bundles"];
const VIEWPORTS = [["phone", devices["iPhone 14"]], ["desktop", { viewport: { width: 1440, height: 900 } }]];
const scan = () => {
  const spec = (sel) => {
    let s = sel.replace(/::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter)\b/g, () => " PSEUDOEL ");
    let a = 0, b = 0, c = 0;
    s = s.replace(/:where\([^()]*\)/g, "");
    s = s.replace(/:(is|not|has)\(([^()]*)\)/g, (m, f, inner) => { const x = inner.split(",").map((t) => specRaw(t)).sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]).pop(); a += x[0]; b += x[1]; c += x[2]; return ""; });
    const r = specRaw(s); return [a + r[0], b + r[1], c + r[2] + (sel.match(/::?(before|after|placeholder|selection|marker|backdrop)/g) || []).length];
  };
  const specRaw = (s) => {
    s = s.replace(/PSEUDOEL/g, "");
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const cls = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length + (s.match(/:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
    const types = (s.replace(/\[[^\]]*\]/g, "").replace(/[.#:][\w-]+(\([^)]*\))?/g, "").match(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g) || []).length;
    return [ids, cls, types];
  };
  const source = (sel, sheetIdx) => { const m = sel.match(/\.([A-Za-z0-9_-]{6})_[A-Za-z]/); return m ? `module:${m[1]}` : `global@${sheetIdx}`; };
  const rules = [];
  let order = 0;
  const walk = (list, sheetIdx, active) => {
    for (const r of list) {
      if (r instanceof CSSStyleRule) rules.push({ r, sheetIdx, active, order: order++ });
      else if (r instanceof CSSMediaRule) walk(r.cssRules, sheetIdx, active && matchMedia(r.conditionText).matches);
      else if (r instanceof CSSSupportsRule) walk(r.cssRules, sheetIdx, active && CSS.supports(r.conditionText));
      else if (r.cssRules) walk(r.cssRules, sheetIdx, active);
    }
  };
  [...document.styleSheets].forEach((sh, i) => { try { walk(sh.cssRules, i, true); } catch {} });
  const ties = [];
  const els = document.querySelectorAll("body *");
  for (const el of els) {
    for (const pseudo of ["", "::before", "::after"]) {
      const decl = new Map(); // prop -> [{value, imp, spec, src, sel}]
      for (const { r, sheetIdx, active } of rules) {
        if (!active) continue;
        for (const sel of r.selectorText.split(/,(?![^()]*\))/)) {
          const hasPseudo = /::?(before|after)\b/.test(sel);
          const wantPseudo = pseudo !== "";
          if (hasPseudo !== wantPseudo) continue;
          if (wantPseudo && !sel.includes(pseudo.slice(1))) continue;
          const base = sel.replace(/::?(before|after)\b/g, "").trim() || "*";
          let ok = false; try { ok = el.matches(base); } catch { ok = false; }
          if (!ok) continue;
          const sp = spec(sel);
          for (let k = 0; k < r.style.length; k++) {
            const prop = r.style[k];
            const arr = decl.get(prop) || []; arr.push({ value: r.style.getPropertyValue(prop), imp: r.style.getPropertyPriority(prop) === "important" ? 1 : 0, sp, src: source(sel, sheetIdx), sel: sel.trim().slice(0, 140) }); decl.set(prop, arr);
          }
        }
      }
      for (const [prop, arr] of decl) {
        const cmp = (x, y) => x.imp - y.imp || x.sp[0] - y.sp[0] || x.sp[1] - y.sp[1] || x.sp[2] - y.sp[2];
        const top = arr.reduce((m, x) => (cmp(x, m) > 0 ? x : m), arr[0]);
        const best = arr.filter((x) => cmp(x, top) === 0);
        const srcs = new Set(best.map((x) => x.src));
        const vals = new Set(best.map((x) => x.value));
        if (srcs.size > 1 && vals.size > 1) {
          const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
          ties.push({ el: `${el.tagName.toLowerCase()}${pseudo}.${cls.trim().split(/\s+/).join(".")}`, prop, winner: getComputedStyle(el, pseudo || null).getPropertyValue(prop), rules: best.map((x) => `${x.sel} {${prop}: ${x.value}${x.imp ? " !important" : ""}} [${x.src}]`) });
        }
      }
    }
  }
  return ties;
};
const browser = await chromium.launch();
const all = {};
for (const [vp, opts] of VIEWPORTS) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: "reduce" });
  await ctx.route(/facebook\.(net|com)|\/_vercel\/(insights|speed-insights)/, (r) => r.abort());
  const page = await ctx.newPage();
  for (const p of PAGES) {
    const res = await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const ties = await page.evaluate(scan);
    for (const t of ties) {
      const key = `${t.el} | ${t.prop}`;
      all[key] ??= { ...t, where: [] };
      all[key].where.push(`${vp}${p}`);
    }
    process.stderr.write(`${vp} ${p} ${res.status()} ties=${ties.length}\n`);
  }
  await ctx.close();
}
await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(Object.values(all), null, 1));
for (const t of Object.values(all)) console.log(`${t.el} | ${t.prop} | now ${t.winner}\n  ${t.rules.join("\n  ")}\n  on ${t.where.join(", ")}`);
console.log(`${Object.keys(all).length} distinct element|property ties`);
process.exitCode = Object.keys(all).length ? 1 : 0;
