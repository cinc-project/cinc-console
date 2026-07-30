// @vitest-environment node
import { expect, test } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function req(path: string, opts: { session?: boolean } = {}) {
  const r = new NextRequest(new URL(`https://console.test${path}`));
  if (opts.session) r.cookies.set("cinc_console", "x");
  return r;
}

const location = (res: Response) => res.headers.get("location");

test("unauthenticated request redirects to /login with a from param", () => {
  const res = proxy(req("/orgs/acme/nodes/web01"));
  const url = new URL(location(res)!);
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("from")).toBe("/orgs/acme/nodes/web01");
});

test("does not add a from param for the root", () => {
  const url = new URL(location(proxy(req("/")))!);
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.has("from")).toBe(false);
});

test("authenticated user on /login is sent to a safe from target", () => {
  const res = proxy(req("/login?from=/orgs/acme/roles", { session: true }));
  expect(new URL(location(res)!).pathname).toBe("/orgs/acme/roles");
});

test("an off-site from is ignored (no open redirect)", () => {
  const res = proxy(req("/login?from=//evil.com", { session: true }));
  expect(new URL(location(res)!).pathname).toBe("/orgs");
});

test("a backslash-prefixed from is ignored (browsers treat /\\ as //)", () => {
  const res = proxy(req("/login?from=/%5Cevil.com", { session: true }));
  expect(new URL(location(res)!).host).toBe("console.test");
  expect(new URL(location(res)!).pathname).toBe("/orgs");
});

test("an authenticated request passes through", () => {
  const res = proxy(req("/orgs/acme/nodes", { session: true }));
  expect(location(res)).toBeNull();
});

test("a passed-through response carries a nonce CSP that locks the page down", () => {
  const csp = proxy(req("/orgs/acme/nodes", { session: true })).headers.get(
    "content-security-policy",
  )!;
  expect(csp).toMatch(/script-src [^;]*'nonce-[^']+' 'strict-dynamic'/);
  // No framing, no <base> hijack, no plugin content, no off-site form posts.
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  // Production must not need eval; that's a dev-only React affordance.
  expect(csp).not.toContain("unsafe-eval");
});

test("each request gets its own nonce", () => {
  const nonceOf = (res: Response) =>
    res.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1];
  const a = nonceOf(proxy(req("/orgs/acme/nodes", { session: true })));
  const b = nonceOf(proxy(req("/orgs/acme/nodes", { session: true })));
  expect(a).not.toBe(b);
});
