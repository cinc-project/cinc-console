// Next.js 16 Proxy (formerly "middleware"). Two jobs:
//
//  1. A presence check on the session cookie that gates the app. The real
//     authorization is the cinc server's ACLs; this only keeps unauthenticated
//     users out of the UI shell.
//  2. A per-request Content-Security-Policy nonce. This is a privileged console
//     that renders server-authored JSON (node attributes, data bag items), so the
//     value of a strict CSP is containment: even if some future sink injected
//     markup, a nonce + 'strict-dynamic' policy leaves an attacker no way to run
//     script, load one, reframe the page, or post a form off-site.
import { NextRequest, NextResponse } from "next/server";
import { isInternalPath } from "./lib/safe-redirect";

/**
 * Build the CSP for one request. Next.js reads the nonce back out of this header
 * during SSR and stamps it onto every script tag it emits, so the nonce must be
 * fresh per request and the page must render dynamically (pinned in app/layout).
 *
 * Dev needs 'unsafe-eval' (React rebuilds server stacks with eval) and the HMR
 * socket; production needs neither. There is deliberately no
 * `upgrade-insecure-requests`: a plain-HTTP deployment is supported, and HSTS
 * (next.config.ts) is the right tool when TLS is in play.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline *style attributes* can't carry a nonce, and next/image emits them.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const hasSession = request.cookies.has("cinc_console");
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  if (!hasSession && !isAuthPage) {
    // Remember where they were headed so login can send them back (e.g. after
    // the session cookie expires mid-session).
    const url = new URL("/login", request.url);
    const from = request.nextUrl.pathname + request.nextUrl.search;
    if (from !== "/") url.searchParams.set("from", from);
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL(safeFrom(request) ?? "/orgs", request.url));
  }

  // The nonce travels on the *request* headers — that's the channel Next.js
  // reads it from while rendering — and on the response for the browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * The `from` query param, but only when it's an internal absolute path — guards
 * against an open redirect (`//evil.com`, `https://…`).
 */
function safeFrom(request: NextRequest): string | null {
  const from = request.nextUrl.searchParams.get("from");
  return isInternalPath(from) ? from : null;
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets
  // (including public images like the login logo, which must load while
  // unauthenticated).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp)).*)",
  ],
};
