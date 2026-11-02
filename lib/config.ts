import { readFileSync } from "node:fs";
import { z } from "zod";

const schema = z.object({
  CINC_SERVER_URL: z.string().url(),
  // Provide the webui key inline OR via a file path (CINC_WEBUI_KEY_FILE).
  CINC_WEBUI_KEY: z.string().min(1).optional(),
  CINC_WEBUI_KEY_FILE: z.string().optional(),
  // Provide the session secret inline OR via a file path (SESSION_SECRET_FILE).
  // Its >= 32 chars rule is checked on the resolved value in loadConfig.
  SESSION_SECRET: z.string().optional(),
  SESSION_SECRET_FILE: z.string().optional(),
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

  // How login credentials are verified. "local" (default) asks the Cinc
  // server's own /authenticate_user; "ldap" binds against an external
  // directory instead (see lib/ldap/client.ts). Either way, the submitted
  // username must already exist as a Cinc/Chef user object — impersonation
  // (X-Ops-UserId) is keyed by that username regardless of how it was proven.
  AUTH_MODE: z.enum(["local", "ldap"]).optional(),
  LDAP_URL: z.string().optional(),
  LDAP_BASE_DN: z.string().optional(),
  // Service-account bind for the search phase. Optional as a *pair* — some
  // directories permit an anonymous search bind — but set both or neither.
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_BIND_PASSWORD_FILE: z.string().optional(),
  // {{username}} is substituted with the escaped, submitted username — never
  // sprintf'd — so escaping only ever touches untrusted input.
  LDAP_USER_FILTER: z.string().optional(),
  LDAP_SEARCH_TIMEOUT_MS: z.coerce.number().optional(),
  LDAP_TLS_NO_VERIFY: z.enum(["true", "false"]).optional(),
  // Separate from CINC_CA_CERT: the directory and the Cinc server are
  // commonly different PKI trust roots.
  LDAP_CA_CERT: z.string().optional(),
  LDAP_CA_CERT_FILE: z.string().optional(),
});

export type LdapConfig = {
  url: string;
  baseDn: string;
  bindDn?: string;
  bindPassword?: string;
  userFilter: string;
  searchTimeoutMs: number;
  tlsNoVerify: boolean;
  caCert?: string;
};

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
  authMode: "local" | "ldap";
  /** Present only when authMode === "ldap". */
  ldap?: LdapConfig;
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

  // The session secret may be inline (SESSION_SECRET) or a file
  // (SESSION_SECRET_FILE). A file loses one trailing newline, since
  // `echo secret > file` adds one.
  let sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret && env.SESSION_SECRET_FILE) {
    sessionSecret = readPem(env.SESSION_SECRET_FILE, "SESSION_SECRET_FILE").replace(/\r?\n$/, "");
  }
  if (!sessionSecret) {
    issues.push("SESSION_SECRET: set SESSION_SECRET or SESSION_SECRET_FILE");
  } else if (sessionSecret.length < 32) {
    issues.push("SESSION_SECRET: must be >= 32 chars");
  }

  let caCert = env.CINC_CA_CERT;
  if (!caCert && env.CINC_CA_CERT_FILE) {
    caCert = readPem(env.CINC_CA_CERT_FILE, "CINC_CA_CERT_FILE");
  }

  const authMode = env.AUTH_MODE === "ldap" ? "ldap" : "local";
  let ldapCaCert = env.LDAP_CA_CERT;
  let ldapBindPassword = env.LDAP_BIND_PASSWORD;
  if (authMode === "ldap") {
    if (!env.LDAP_URL) issues.push("LDAP_URL: required when AUTH_MODE=ldap");
    if (!env.LDAP_BASE_DN) issues.push("LDAP_BASE_DN: required when AUTH_MODE=ldap");

    if (!ldapCaCert && env.LDAP_CA_CERT_FILE) {
      ldapCaCert = readPem(env.LDAP_CA_CERT_FILE, "LDAP_CA_CERT_FILE");
    }

    if (!ldapBindPassword && env.LDAP_BIND_PASSWORD_FILE) {
      ldapBindPassword = readPem(env.LDAP_BIND_PASSWORD_FILE, "LDAP_BIND_PASSWORD_FILE");
    }
    const hasBindDn = !!env.LDAP_BIND_DN;
    const hasBindPassword = !!ldapBindPassword;
    if (hasBindDn !== hasBindPassword) {
      issues.push("LDAP_BIND_DN/LDAP_BIND_PASSWORD: set both or neither (anonymous search bind is allowed)");
    }
  }

  if (!r.success || issues.length) {
    throw new Error(`Invalid cinc-console configuration — ${issues.join("; ")}`);
  }
  const e = r.data;
  return {
    serverUrl: e.CINC_SERVER_URL.replace(/\/$/, ""),
    webuiKey: webuiKey!,
    sessionSecret: sessionSecret!,
    caCert,
    sslNoVerify: e.CINC_SSL_NO_VERIFY === "true",
    sessionTtlSeconds: e.SESSION_TTL_SECONDS ?? 28800,
    cookieSecure:
      e.SESSION_COOKIE_SECURE === undefined
        ? undefined
        : e.SESSION_COOKIE_SECURE === "true",
    chefVersion: e.CHEF_VERSION ?? "16.0.0",
    authActor: e.CINC_AUTH_ACTOR,
    authMode,
    ldap:
      authMode === "ldap"
        ? {
            url: e.LDAP_URL!,
            baseDn: e.LDAP_BASE_DN!,
            bindDn: e.LDAP_BIND_DN,
            bindPassword: ldapBindPassword,
            userFilter: e.LDAP_USER_FILTER ?? "(uid={{username}})",
            searchTimeoutMs: e.LDAP_SEARCH_TIMEOUT_MS ?? 5000,
            tlsNoVerify: e.LDAP_TLS_NO_VERIFY === "true",
            caCert: ldapCaCert,
          }
        : undefined,
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
