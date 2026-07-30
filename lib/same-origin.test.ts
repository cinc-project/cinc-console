// @vitest-environment node
import { expect, test } from "vitest";
import { isCrossSite } from "./same-origin";

function req(headers: Record<string, string>): Request {
  return new Request("https://console.test/api/auth/login", {
    method: "POST",
    headers,
  });
}

test("a same-origin fetch from our own login form passes", () => {
  expect(
    isCrossSite(
      req({
        host: "console.test",
        origin: "https://console.test",
        "sec-fetch-site": "same-origin",
      }),
    ),
  ).toBe(false);
});

test("a browser navigation with no initiator passes", () => {
  expect(isCrossSite(req({ host: "console.test", "sec-fetch-site": "none" }))).toBe(false);
});

test("an attacker's cross-site form post is rejected", () => {
  // The login-CSRF shape: a text/plain form on evil.com, no preflight, no cookie
  // needed — the response's Set-Cookie is what the attacker is after.
  expect(
    isCrossSite(
      req({
        host: "console.test",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      }),
    ),
  ).toBe(true);
});

test("a sibling subdomain is not trusted", () => {
  expect(isCrossSite(req({ host: "console.test", "sec-fetch-site": "same-site" }))).toBe(
    true,
  );
});

test("Origin is compared to Host when Sec-Fetch-Site is absent", () => {
  expect(isCrossSite(req({ host: "console.test", origin: "https://console.test" }))).toBe(
    false,
  );
  expect(isCrossSite(req({ host: "console.test", origin: "https://evil.example" }))).toBe(
    true,
  );
});

test("Origin is compared to the proxy's forwarded host when present", () => {
  expect(
    isCrossSite(
      req({
        host: "10.0.0.7:3000",
        "x-forwarded-host": "console.test",
        origin: "https://console.test",
      }),
    ),
  ).toBe(false);
});

test("an unparseable Origin is treated as hostile", () => {
  expect(isCrossSite(req({ host: "console.test", origin: "not a url" }))).toBe(true);
});

test("a non-browser client (no Origin, no Sec-Fetch-Site) passes", () => {
  // curl and friends can't be victims of CSRF; the session cookie still gates them.
  expect(isCrossSite(req({ host: "console.test" }))).toBe(false);
});
