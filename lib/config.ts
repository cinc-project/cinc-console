import { readFileSync } from "node:fs";
import { z } from "zod";

const schema = z.object({
  CINC_SERVER_URL: z.string().url(),
  // Provide the webui key inline OR via a file path (CINC_WEBUI_KEY_FILE).
  CINC_WEBUI_KEY: z.string().min(1).optional(),
  CINC_WEBUI_KEY_FILE: z.string().optional(),
  SESSION_SECRET: z.string().min(32, "must be >= 32 chars"),
  CINC_CA_CERT: z.string().optional(),
  CINC_CA_CERT_FILE: z.string().optional(),
  CINC_SSL_NO_VERIFY: z.enum(["true", "false"]).optional(),
  SESSION_TTL_SECONDS: z.coerce.number().optional(),
  // Secure flag on the session cookie. Unset means "on in production" — set it
  // to false only for a deliberate plain-HTTP deployment.
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  CHEF_VERSION: z.string().optional(),
  // Optional actor for POST /authenticate_user fallback when impersonated user gets 403
  CINC_AUTH_ACTOR: z.string().optional(),
});

export type Config = {
  serverUrl: string;
  webuiKey: string;
  sessionSecret: string;
  caCert?: string;
  sslNoVerify: boolean;
  sessionTtlSeconds: number;
  /** undefined = decide from NODE_ENV; see lib/session.ts. */
  cookieSecure?: boolean;
  chefVersion: string;
  authActor?: string;
};

function readPem(path: string, label: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(
      `Invalid cinc-console configuration — ${label} could not read ${path}: ${(e as Error).message}`,
    );
  }
}

/** Parse and validate the runtime configuration, failing fast and loud. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const r = schema.safeParse(env);
  const issues = r.success
    ? []
    : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

  // The webui key may be inline (CINC_WEBUI_KEY) or a file (CINC_WEBUI_KEY_FILE).
  let webuiKey = env.CINC_WEBUI_KEY;
  if (!webuiKey && env.CINC_WEBUI_KEY_FILE) {
    webuiKey = readPem(env.CINC_WEBUI_KEY_FILE, "CINC_WEBUI_KEY_FILE");
  }
  if (!webuiKey) {
    issues.push("CINC_WEBUI_KEY: set CINC_WEBUI_KEY or CINC_WEBUI_KEY_FILE");
  }

  let caCert = env.CINC_CA_CERT;
  if (!caCert && env.CINC_CA_CERT_FILE) {
    caCert = readPem(env.CINC_CA_CERT_FILE, "CINC_CA_CERT_FILE");
  }

  if (!r.success || issues.length) {
    throw new Error(`Invalid cinc-console configuration — ${issues.join("; ")}`);
  }
  const e = r.data;
  return {
    serverUrl: e.CINC_SERVER_URL.replace(/\/$/, ""),
    webuiKey: webuiKey!,
    sessionSecret: e.SESSION_SECRET,
    caCert,
    sslNoVerify: e.CINC_SSL_NO_VERIFY === "true",
    sessionTtlSeconds: e.SESSION_TTL_SECONDS ?? 28800,
    cookieSecure:
      e.SESSION_COOKIE_SECURE === undefined
        ? undefined
        : e.SESSION_COOKIE_SECURE === "true",
    chefVersion: e.CHEF_VERSION ?? "16.0.0",
    authActor: e.CINC_AUTH_ACTOR,
  };
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (!cached) cached = loadConfig(process.env);
  return cached;
}

/** Test-only: drop the memoized config. */
export function resetConfigCache(): void {
  cached = null;
}
