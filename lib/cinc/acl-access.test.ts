// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "./errors";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { canViewAcl, permissionsDenied } from "./acl-access";
import { cincPath } from "./path";

const NODE = { kind: "nodes", name: "web01" } as const;

beforeEach(() => {
  req.mockReset();
});

test("reads the target's ACL as the user", async () => {
  req.mockResolvedValueOnce({});
  await canViewAcl("bob", "acme", NODE);
  expect(req).toHaveBeenCalledWith({
    user: "bob",
    org: "acme",
    method: "GET",
    path: cincPath`/nodes/web01/_acl`,
  });
});

test("a readable ACL allows the permissions page", async () => {
  req.mockResolvedValueOnce({});
  await expect(canViewAcl("bob", "acme", NODE)).resolves.toBe(true);
  await expect(permissionsDenied("bob", "acme", NODE)).resolves.toBeUndefined();
});

test("a 403 denies it and says what's missing on this object", async () => {
  req.mockRejectedValue(new CincError(403, {}));
  await expect(canViewAcl("bob", "acme", NODE)).resolves.toBe(false);
  await expect(permissionsDenied("bob", "acme", { kind: "users", name: "anna" })).resolves.toBe(
    "You need grant permission on this user to view or change its permissions.",
  );
  await expect(permissionsDenied("bob", "acme", { kind: "data", name: "secrets" })).resolves.toBe(
    "You need grant permission on this data bag to view or change its permissions.",
  );
  await expect(permissionsDenied("bob", "acme", { kind: "organization" })).resolves.toBe(
    "You need grant permission on this organization to view or change its permissions.",
  );
});

test.each([404, 500])("a %i leaves the button enabled", async (status) => {
  req.mockRejectedValueOnce(new CincError(status, {}));
  await expect(canViewAcl("bob", "acme", NODE)).resolves.toBe(true);
});

test("a network failure leaves the button enabled", async () => {
  req.mockRejectedValueOnce(new TypeError("fetch failed"));
  await expect(canViewAcl("bob", "acme", NODE)).resolves.toBe(true);
});
