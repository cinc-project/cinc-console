import { expect, test, vi } from "vitest";

const { config } = vi.hoisted(() => ({
  config: {
    sessionSecret: "x".repeat(32),
    sessionTtlSeconds: 100,
    cookieSecure: undefined as boolean | undefined,
  },
}));

vi.mock("./config", () => ({ getConfig: () => config }));

import { buildSessionOptions, cookieSecure } from "./session";

function withNodeEnv(value: string, fn: () => void) {
  const original = process.env.NODE_ENV;
  try {
    // @ts-expect-error NODE_ENV is typed read-only, but the runtime allows it.
    process.env.NODE_ENV = value;
    fn();
  } finally {
    // @ts-expect-error see above
    process.env.NODE_ENV = original;
  }
}

test("session cookie is httpOnly, lax, and ttl-bound", () => {
  const o = buildSessionOptions();
  expect(o.cookieName).toBe("cinc_console");
  expect(o.ttl).toBe(100);
  expect(o.cookieOptions?.httpOnly).toBe(true);
  expect(o.cookieOptions?.sameSite).toBe("lax");
});

test("session cookie is insecure in dev, secure in production", () => {
  config.cookieSecure = undefined;
  withNodeEnv("development", () =>
    expect(buildSessionOptions().cookieOptions?.secure).toBe(false),
  );
  withNodeEnv("production", () =>
    expect(buildSessionOptions().cookieOptions?.secure).toBe(true),
  );
});

test("only explicit config can drop Secure in production", () => {
  // Never a request header: X-Forwarded-Proto and Referer are attacker-supplied
  // unless every path into the app strips them, and a session cookie without
  // Secure is one plaintext request away from being sniffed.
  withNodeEnv("production", () => {
    config.cookieSecure = false;
    expect(cookieSecure()).toBe(false);
    config.cookieSecure = true;
    expect(cookieSecure()).toBe(true);
    config.cookieSecure = undefined;
    expect(cookieSecure()).toBe(true);
  });
});

test("session cookie secure flag can be overridden per call", () => {
  expect(buildSessionOptions(false).cookieOptions?.secure).toBe(false);
  expect(buildSessionOptions(true).cookieOptions?.secure).toBe(true);
});
