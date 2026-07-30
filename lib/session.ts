import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { getConfig } from "./config";

export type SessionData = {
  username?: string;
  displayName?: string;
  loginAt?: number;
};

/**
 * Whether to mark the session cookie Secure.
 *
 * This is deliberately NOT derived from the request. `X-Forwarded-Proto` and
 * `Referer` are attacker-supplied unless every path to the app strips them, so
 * letting them decide would let a request talk the app out of the Secure flag —
 * and a session cookie without Secure is one plaintext request away from being
 * sniffed. So: on in production, off in development, and only an explicit
 * operator opt-out (`SESSION_COOKIE_SECURE=false`, for a deliberate plain-HTTP
 * deployment) can change it.
 */
export function cookieSecure(): boolean {
  return getConfig().cookieSecure ?? process.env.NODE_ENV === "production";
}

export function buildSessionOptions(isSecure: boolean = cookieSecure()): SessionOptions {
  const cfg = getConfig();

  return {
    password: cfg.sessionSecret,
    cookieName: "cinc_console",
    ttl: cfg.sessionTtlSeconds,
    cookieOptions: {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // Built lazily (not at module load) so `next build` doesn't require runtime
  // config to be present when route modules are imported.
  return getIronSession<SessionData>(await cookies(), buildSessionOptions());
}

export class Unauthorized extends Error {
  constructor() {
    super("not authenticated");
    this.name = "Unauthorized";
  }
}

/** Returns the logged-in username or throws Unauthorized. */
export async function requireUser(): Promise<string> {
  const s = await getSession();
  if (!s.username) throw new Unauthorized();
  return s.username;
}
