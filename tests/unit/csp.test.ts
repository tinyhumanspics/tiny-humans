import { describe, expect, test } from "vitest";
import { contentSecurityPolicy, cspViolations } from "@/lib/security/csp";

describe("content security policy", () => {
  test("production policy limits sources without development or preview extras", () => {
    const policy = contentSecurityPolicy();
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'", "report-uri /api/csp-report", "report-to csp"]) {
      expect(policy).toContain(directive);
    }
    expect(policy).toContain("https://connect.facebook.net");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("vercel.live");
  });

  test("development allows eval for React's error stacks; previews allow Vercel's toolbar", () => {
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ preview: true })).toContain("https://vercel.live");
  });
});

describe("CSP reports", () => {
  test("legacy reports keep the page path but never its query (manage links carry tokens)", () => {
    const [violation] = cspViolations({
      "csp-report": {
        "document-uri": "https://www.tinyhumans.photography/cancel?t=SECRET-TOKEN-VALUE",
        "violated-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?session=abc",
        "source-file": "https://www.tinyhumans.photography/_next/static/chunks/app.js?v=1",
        disposition: "report",
      },
    });
    expect(violation).toEqual({
      directive: "script-src-elem",
      blocked: "https://evil.example/x.js",
      page: "/cancel",
      source: "https://www.tinyhumans.photography/_next/static/chunks/app.js",
      disposition: "report",
    });
    expect(JSON.stringify(violation)).not.toContain("SECRET");
  });

  test("Reporting API batches are read, other report types and extension noise are dropped", () => {
    const violations = cspViolations([
      { type: "csp-violation", body: { documentURL: "https://www.tinyhumans.photography/", effectiveDirective: "img-src", blockedURL: "https://cdn.example/a.png", disposition: "report" } },
      { type: "csp-violation", body: { documentURL: "https://www.tinyhumans.photography/", effectiveDirective: "script-src-elem", blockedURL: "chrome-extension://abc/inject.js" } },
      { type: "deprecation", body: { message: "x" } },
    ]);
    expect(violations).toEqual([{ directive: "img-src", blocked: "https://cdn.example/a.png", page: "/", source: "", disposition: "report" }]);
  });

  test("inline keywords pass through and garbage yields nothing", () => {
    expect(cspViolations({ "csp-report": { "blocked-uri": "inline", "effective-directive": "script-src-elem", "document-uri": "https://www.tinyhumans.photography/about" } })[0]).toMatchObject({ blocked: "inline", page: "/about" });
    expect(cspViolations(null)).toEqual([]);
    expect(cspViolations("nope")).toEqual([]);
    expect(cspViolations({ other: 1 })).toEqual([]);
  });
});
