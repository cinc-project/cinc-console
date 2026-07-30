import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/cinc/auth";
import { getSession, cookieSecure } from "@/lib/session";
import { isCrossSite } from "@/lib/same-origin";
import { log } from "@/lib/log";

export async function POST(req: NextRequest) {
  // Login CSRF guard: a cross-site POST can't send our SameSite=Lax cookie, but
  // it can still *acquire* one and log a victim into the attacker's account.
  if (isCrossSite(req)) {
    log.warn("login.cross_site_blocked", { origin: req.headers.get("origin") ?? "" });
    return NextResponse.json({ error: "cross-site request" }, { status: 403 });
  }
  // `req.json()` parses any body regardless of Content-Type, which is what makes
  // the `enctype="text/plain"` form trick possible. Requiring JSON costs the real
  // client nothing (it already sends it) and removes the simple-request path.
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "expected application/json" }, { status: 415 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return NextResponse.json({ error: "missing credentials" }, { status: 400 });
  }

  const authUser = await authenticateUser(username, password);
  if (!authUser) {
    log.warn("login.failed", { user: username });
    return NextResponse.json(
      { error: "invalid username or password" },
      { status: 401 },
    );
  }

  const session = await getSession();
  session.username = username;
  session.displayName = authUser.display_name || username;
  session.loginAt = Date.now();

  try {
    await session.save();
  } catch (err) {
    log.error("login.session-save-failed", { user: username, error: String(err) });
    return NextResponse.json(
      { error: "session creation failed" },
      { status: 500 },
    );
  }

  // Next.js will attach cookies mutated during this request to the response.
  log.info("login.success", { user: username, secure: cookieSecure() });
  return NextResponse.json({ ok: true });
}
