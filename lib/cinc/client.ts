// Server-only transport for the cinc server.
//
// Every request is signed with the webui key while impersonating the
// logged-in user (X-Ops-UserId + X-Ops-Request-Source: web), so the server
// enforces that user's real ACLs. This module must never be imported into a
// Client Component — it holds the webui key.
import "server-only";
import { Agent, setGlobalDispatcher } from "undici";
import { getConfig } from "../config";
import { signHeaders } from "./signing";
import { CincError } from "./errors";
import {
  assertSafePath,
  assertSafeSegment,
  isUnsafePathError,
  type CincPath,
} from "./path";
import { log } from "../log";

let dispatcherReady = false;

function ensureTls() {
  if (dispatcherReady) return;
  const { caCert, sslNoVerify } = getConfig();
  if (sslNoVerify || caCert) {
    setGlobalDispatcher(
      new Agent({ connect: { rejectUnauthorized: !sslNoVerify, ca: caCert } }),
    );
  }
  dispatcherReady = true;
}

/** ISO-8601 UTC with no fractional seconds, e.g. 2024-01-01T00:00:00Z. */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

/**
 * Current unix milliseconds. Indirecting through a helper keeps the impure
 * `Date.now()` out of Server Component render bodies (the react-hooks/purity
 * lint rule) while reading as exactly what it is at call sites.
 */
export function nowMs(): number {
  return Date.now();
}

export type CincRequestOptions = {
  user: string;
  method: string;
  /**
   * Built with the `cincPath` tagged template, which vets each interpolated name
   * as a single path segment. The type is branded, so a plain string won't
   * compile — see path.ts for why concatenating first is not good enough.
   */
  path: CincPath;
  body?: unknown;
  /** When set, the path is prefixed with /organizations/<org>. */
  org?: string;
  /**
   * Query parameters appended to the request URL. Kept SEPARATE from `path`
   * because Chef's v1.3 signing canonicalizes the path only — the query string
   * is never signed. Folding it into `path` would sign bytes the server can't
   * reproduce and every request would 401. Used by partial search (`?q=...`).
   */
  query?: Record<string, string | number>;
};

export async function cincRequest<T>(opts: CincRequestOptions): Promise<T> {
  ensureTls();
  const { serverUrl, webuiKey, chefVersion } = getConfig();
  const fullPath = opts.org
    ? `/organizations/${opts.org}${opts.path}`
    : opts.path;
  // `path` is already vetted segment-by-segment by its `cincPath` tag. The two
  // values spliced in here are not, so vet them the same way BEFORE signing: the
  // org slug is a path segment (and comes straight from a route param, where Next
  // decodes `%2F` into a real separator), and the impersonated user id also lands
  // in a request header, where a CR/LF would be header injection. See path.ts.
  try {
    assertSafeSegment(opts.user, "user");
    if (opts.org !== undefined) assertSafeSegment(opts.org, "org");
    assertSafePath(fullPath);
  } catch (e) {
    if (isUnsafePathError(e)) {
      log.warn("cinc.unsafe_path", {
        user: opts.user,
        org: opts.org,
        method: opts.method,
        path: fullPath,
        detail: e.detail,
      });
    }
    throw e;
  }
  const bodyStr = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const headers: Record<string, string> = {
    ...signHeaders(
      {
        method: opts.method,
        path: fullPath,
        body: bodyStr,
        userId: opts.user,
        timestamp: nowIso(),
      },
      webuiKey,
    ),
    "X-Ops-Request-Source": "web",
    "X-Chef-Version": chefVersion,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  // Query string lives on the URL only, never in the signed `fullPath` above.
  const qs = opts.query
    ? "?" +
      new URLSearchParams(
        Object.entries(opts.query).map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";

  const res = await fetch(serverUrl + fullPath + qs, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : bodyStr,
  });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    // Audit trail of denied/failed server calls. Identifiers only — never the
    // body (data bag items hold secrets) or headers (they carry the signature).
    log[res.status >= 500 ? "error" : "warn"]("cinc.request_failed", {
      user: opts.user,
      org: opts.org,
      method: opts.method,
      path: fullPath,
      status: res.status,
    });
    throw new CincError(res.status, parsed ?? text);
  }
  return parsed as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}
