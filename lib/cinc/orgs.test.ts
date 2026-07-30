// @vitest-environment node
import { expect, test, vi } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { listUserOrgs } from "./orgs";
import { cincPath } from "./path";

test("maps organization sub-objects", async () => {
  req.mockResolvedValueOnce([
    { organization: { name: "acme", full_name: "Acme Inc" } },
    { organization: { name: "beta" } },
  ]);
  await expect(listUserOrgs("alice")).resolves.toEqual([
    { name: "acme", full_name: "Acme Inc" },
    { name: "beta", full_name: undefined },
  ]);
  expect(req).toHaveBeenCalledWith({
    user: "alice",
    method: "GET",
    path: cincPath`/users/alice/organizations`,
  });
});
