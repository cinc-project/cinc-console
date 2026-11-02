import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { loadConfig } from "./config";

const KEY_FILE = join(process.cwd(), "lib/cinc/__fixtures__/test_key.pem");

const tmp = mkdtempSync(join(tmpdir(), "cinc-config-test-"));
let tmpCount = 0;
function secretFile(content: string): string {
  const path = join(tmp, `secret-${tmpCount++}`);
  writeFileSync(path, content);
  return path;
}

const base = {
  CINC_SERVER_URL: "https://s",
  CINC_WEBUI_KEY: "PEM",
  SESSION_SECRET: "x".repeat(32),
};

test("error names every missing required value", () => {
  let msg = "";
  try {
    loadConfig({});
  } catch (e) {
    msg = (e as Error).message;
  }
  expect(msg).toContain("CINC_SERVER_URL");
  expect(msg).toContain("CINC_WEBUI_KEY");
  expect(msg).toContain("SESSION_SECRET");
});

test("parses a valid env with defaults", () => {
  const c = loadConfig(base);
  expect(c.serverUrl).toBe("https://s");
  expect(c.webuiKey).toBe("PEM");
  expect(c.sslNoVerify).toBe(false);
  expect(c.sessionTtlSeconds).toBe(28800);
  expect(c.chefVersion).toBe("16.0.0");
});

test("strips a trailing slash from the server url", () => {
  expect(loadConfig({ ...base, CINC_SERVER_URL: "https://s/" }).serverUrl).toBe(
    "https://s",
  );
});

test("rejects a too-short session secret", () => {
  expect(() => loadConfig({ ...base, SESSION_SECRET: "short" })).toThrow(
    /SESSION_SECRET/,
  );
});

test("reads the session secret from SESSION_SECRET_FILE", () => {
  const secret = "s".repeat(40);
  const c = loadConfig({
    ...base,
    SESSION_SECRET: undefined,
    SESSION_SECRET_FILE: secretFile(secret),
  });
  expect(c.sessionSecret).toBe(secret);
});

test("strips exactly one trailing newline from SESSION_SECRET_FILE", () => {
  const secret = "s".repeat(32);
  const env = { ...base, SESSION_SECRET: undefined };
  expect(
    loadConfig({ ...env, SESSION_SECRET_FILE: secretFile(`${secret}\n`) }).sessionSecret,
  ).toBe(secret);
  expect(
    loadConfig({ ...env, SESSION_SECRET_FILE: secretFile(`${secret}\r\n`) }).sessionSecret,
  ).toBe(secret);
  expect(
    loadConfig({ ...env, SESSION_SECRET_FILE: secretFile(`${secret}\n\n`) }).sessionSecret,
  ).toBe(`${secret}\n`);
});

test("inline SESSION_SECRET wins over SESSION_SECRET_FILE", () => {
  const c = loadConfig({
    ...base,
    SESSION_SECRET: "i".repeat(32),
    SESSION_SECRET_FILE: secretFile("f".repeat(32)),
  });
  expect(c.sessionSecret).toBe("i".repeat(32));
});

test("errors clearly when SESSION_SECRET_FILE is unreadable", () => {
  expect(() =>
    loadConfig({ ...base, SESSION_SECRET: undefined, SESSION_SECRET_FILE: "/no/such/secret" }),
  ).toThrow(/SESSION_SECRET_FILE could not read/);
});

test("rejects a too-short secret from SESSION_SECRET_FILE", () => {
  const env = { ...base, SESSION_SECRET: undefined };
  expect(() =>
    loadConfig({ ...env, SESSION_SECRET_FILE: secretFile("short\n") }),
  ).toThrow(/SESSION_SECRET: must be >= 32 chars/);
  // The stripped newline does not count towards the 32 chars.
  expect(() =>
    loadConfig({ ...env, SESSION_SECRET_FILE: secretFile(`${"s".repeat(31)}\n`) }),
  ).toThrow(/SESSION_SECRET: must be >= 32 chars/);
});

test("reads the webui key from CINC_WEBUI_KEY_FILE", () => {
  const c = loadConfig({
    CINC_SERVER_URL: "https://s",
    CINC_WEBUI_KEY_FILE: KEY_FILE,
    SESSION_SECRET: "x".repeat(32),
  });
  expect(c.webuiKey).toContain("BEGIN RSA PRIVATE KEY");
});

test("requires either CINC_WEBUI_KEY or CINC_WEBUI_KEY_FILE", () => {
  expect(() =>
    loadConfig({ CINC_SERVER_URL: "https://s", SESSION_SECRET: "x".repeat(32) }),
  ).toThrow(/CINC_WEBUI_KEY/);
});

test("errors clearly when the key file is unreadable", () => {
  expect(() =>
    loadConfig({ ...base, CINC_WEBUI_KEY: undefined, CINC_WEBUI_KEY_FILE: "/no/such.pem" }),
  ).toThrow(/CINC_WEBUI_KEY_FILE could not read/);
});

test("parses optional authActor for authenticate_user fallback", () => {
  const c = loadConfig({ ...base, CINC_AUTH_ACTOR: "pivotal" });
  expect(c.authActor).toBe("pivotal");
});

test("authActor is undefined when not provided", () => {
  const c = loadConfig(base);
  expect(c.authActor).toBeUndefined();
});

test("authMode defaults to local, with no ldap config", () => {
  const c = loadConfig(base);
  expect(c.authMode).toBe("local");
  expect(c.ldap).toBeUndefined();
});

test("AUTH_MODE=ldap without LDAP_URL/LDAP_BASE_DN names both missing values", () => {
  let msg = "";
  try {
    loadConfig({ ...base, AUTH_MODE: "ldap" });
  } catch (e) {
    msg = (e as Error).message;
  }
  expect(msg).toContain("LDAP_URL");
  expect(msg).toContain("LDAP_BASE_DN");
});

test("AUTH_MODE=ldap with url+baseDn and no bind account succeeds (anonymous search bind)", () => {
  const c = loadConfig({
    ...base,
    AUTH_MODE: "ldap",
    LDAP_URL: "ldaps://dc1.example.com:636",
    LDAP_BASE_DN: "dc=example,dc=com",
  });
  expect(c.authMode).toBe("ldap");
  expect(c.ldap).toMatchObject({
    url: "ldaps://dc1.example.com:636",
    baseDn: "dc=example,dc=com",
    bindDn: undefined,
    bindPassword: undefined,
    userFilter: "(uid={{username}})",
    searchTimeoutMs: 5000,
    tlsNoVerify: false,
  });
});

test("LDAP_BIND_DN without a password (or vice versa) is rejected", () => {
  expect(() =>
    loadConfig({
      ...base,
      AUTH_MODE: "ldap",
      LDAP_URL: "ldaps://dc1.example.com:636",
      LDAP_BASE_DN: "dc=example,dc=com",
      LDAP_BIND_DN: "cn=svc,dc=example,dc=com",
    }),
  ).toThrow(/LDAP_BIND_DN\/LDAP_BIND_PASSWORD/);
});

test("reads LDAP_BIND_PASSWORD from LDAP_BIND_PASSWORD_FILE", () => {
  const c = loadConfig({
    ...base,
    AUTH_MODE: "ldap",
    LDAP_URL: "ldaps://dc1.example.com:636",
    LDAP_BASE_DN: "dc=example,dc=com",
    LDAP_BIND_DN: "cn=svc,dc=example,dc=com",
    LDAP_BIND_PASSWORD_FILE: KEY_FILE,
  });
  expect(c.ldap?.bindPassword).toContain("BEGIN RSA PRIVATE KEY");
});

test("errors clearly when LDAP_BIND_PASSWORD_FILE is unreadable", () => {
  expect(() =>
    loadConfig({
      ...base,
      AUTH_MODE: "ldap",
      LDAP_URL: "ldaps://dc1.example.com:636",
      LDAP_BASE_DN: "dc=example,dc=com",
      LDAP_BIND_DN: "cn=svc,dc=example,dc=com",
      LDAP_BIND_PASSWORD_FILE: "/no/such.pem",
    }),
  ).toThrow(/LDAP_BIND_PASSWORD_FILE could not read/);
});

test("custom LDAP_USER_FILTER, LDAP_SEARCH_TIMEOUT_MS and LDAP_TLS_NO_VERIFY are honored", () => {
  const c = loadConfig({
    ...base,
    AUTH_MODE: "ldap",
    LDAP_URL: "ldaps://dc1.example.com:636",
    LDAP_BASE_DN: "dc=example,dc=com",
    LDAP_USER_FILTER: "(sAMAccountName={{username}})",
    LDAP_SEARCH_TIMEOUT_MS: "9000",
    LDAP_TLS_NO_VERIFY: "true",
  });
  expect(c.ldap).toMatchObject({
    userFilter: "(sAMAccountName={{username}})",
    searchTimeoutMs: 9000,
    tlsNoVerify: true,
  });
});
