// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { listMyInvites, respondToInvite } from "./invitations";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("listMyInvites reads the user's own association requests", async () => {
  req.mockResolvedValueOnce([{ id: "bob-beta", orgname: "beta" }]);
  await expect(listMyInvites("bob")).resolves.toEqual([
    { id: "bob-beta", orgname: "beta" },
  ]);
  expect(req).toHaveBeenCalledWith({
    user: "bob",
    method: "GET",
    path: cincPath`/users/bob/association_requests`,
  });
});

test("respondToInvite PUTs the response to the invite", async () => {
  req.mockResolvedValueOnce({ organization: { name: "beta" } });
  await respondToInvite("bob", "bob-beta", "accept");
  expect(req).toHaveBeenCalledWith({
    user: "bob",
    method: "PUT",
    path: cincPath`/users/bob/association_requests/bob-beta`,
    body: { response: "accept" },
  });
});
