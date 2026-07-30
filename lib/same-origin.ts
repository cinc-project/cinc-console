/**
 * Cross-site request rejection for the auth route handlers.
 *
 * The session cookie is SameSite=Lax, which stops a cross-site POST from
 * *carrying* it — but nothing stops a cross-site POST from *obtaining* one.
 * `Request.json()` ignores Content-Type, so a plain
 * `<form enctype="text/plain">` on an attacker's page can deliver a JSON body to
 * /api/auth/login with no CORS preflight, and the browser stores the Set-Cookie
 * it gets back: login CSRF, which drops a victim into the attacker's account on
 * a console where they may then create objects or paste secrets.
 *
 * Both signals we check are set by the browser and unforgeable from page script:
 * `Sec-Fetch-Site` (all current browsers) and `Origin` (sent on any POST). A
 * request carrying neither is not a browser-initiated cross-site request — it's
 * curl or a script — so it passes; the session cookie remains the only thing
 * that grants access.
 */

/** Hosts we consider ours: the Host header, or the proxy's forwarded host. */
function expectedHosts(h: Headers): string[] {
  return [h.get("x-forwarded-host"), h.get("host")]
    .flatMap((v) => (v ? v.split(",") : []))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the request demonstrably came from another site. `same-site` counts
 * as cross-site here: a sibling subdomain is a different trust boundary than
 * this console, and its own forms never need to post here.
 */
export function isCrossSite(req: Request): boolean {
  const h = req.headers;

  const site = h.get("sec-fetch-site")?.trim().toLowerCase();
  if (site) return site !== "same-origin" && site !== "none";

  const origin = h.get("origin");
  if (origin && origin !== "null") {
    try {
      return !expectedHosts(h).includes(new URL(origin).host.toLowerCase());
    } catch {
      return true; // unparseable Origin — treat as hostile
    }
  }

  return false;
}
