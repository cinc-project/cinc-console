// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";

const key = readFileSync(
  new URL("./__fixtures__/test_key.pem", import.meta.url),
  "utf8",
);

vi.mock("../config", () => ({
  getConfig: () => ({
    serverUrl: "https://s",
    webuiKey: key,
    sslNoVerify: false,
    chefVersion: "16.0.0",
  }),
}));

import { cincRequest } from "./client";
import { cincPath, type CincPath } from "./path";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("signs as webui key impersonating the user with web source", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const out = await cincRequest<{ ok: number }>({
    user: "alice",
    method: "GET",
    path: cincPath`/nodes`,
    org: "acme",
  });
  expect(out.ok).toBe(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://s/organizations/acme/nodes");
  const headers = init.headers as Record<string, string>;
  expect(headers["X-Ops-UserId"]).toBe("alice");
  expect(headers["X-Ops-Request-Source"]).toBe("web");
  expect(headers["X-Ops-Authorization-1"]).toBeTruthy();
});

test("throws CincError with status on non-2xx", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("denied", { status: 403 })),
  );
  await expect(
    cincRequest({ user: "u", method: "GET", path: cincPath`/nodes`, org: "acme" }),
  ).rejects.toMatchObject({ status: 403, forbidden: true });
});

test("refuses to sign a path a name has broken out of", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  // `/orgs/acme/nodes/web01%2F_acl` reaches an action as the name "web01/_acl".
  // Concatenated it is indistinguishable from the ACL endpoint acl.ts builds, so
  // cincPath has to reject it while it is still a name.
  const badName = "web01/_acl";
  expect(() => cincPath`/nodes/${badName}`).toThrow(/unsafe request path/);

  // A hostile org slug is the same problem one level up, and it is spliced in by
  // cincRequest itself rather than by the tag.
  await expect(
    cincRequest({ user: "u", method: "GET", path: cincPath`/nodes`, org: "acme/../other" }),
  ).rejects.toMatchObject({ name: "UnsafePathError" });

  // The impersonated user id is a request header as well as a path segment.
  const crlf = String.fromCharCode(13, 10);
  await expect(
    cincRequest({
      user: `u${crlf}X-Ops-UserId: pivotal`,
      method: "GET",
      path: cincPath`/nodes`,
      org: "acme",
    }),
  ).rejects.toMatchObject({ name: "UnsafePathError" });

  // Belt and braces: even if the brand were cast away, the assembled path is
  // re-checked before anything is signed.
  await expect(
    cincRequest({
      user: "u",
      method: "GET",
      path: "/nodes/%2e%2e%2fusers" as unknown as CincPath,
      org: "acme",
    }),
  ).rejects.toMatchObject({ name: "UnsafePathError" });

  expect(fetchMock).not.toHaveBeenCalled();
});

test("omits the org prefix for top-level paths", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await cincRequest({ user: "u", method: "POST", path: cincPath`/authenticate_user`, body: { username: "u" } });
  const [url] = fetchMock.mock.calls[0] as [string];
  expect(url).toBe("https://s/authenticate_user");
});
