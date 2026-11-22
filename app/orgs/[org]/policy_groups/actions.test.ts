// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));

const { deletePolicyGroup, removePolicyFromGroup } = vi.hoisted(() => ({
  deletePolicyGroup: vi.fn(),
  removePolicyFromGroup: vi.fn(),
}));
vi.mock("@/lib/cinc/policy-groups", () => ({ deletePolicyGroup, removePolicyFromGroup }));

import { deletePolicyGroupAction, removePolicyFromGroupAction } from "./actions";

beforeEach(() => {
  deletePolicyGroup.mockReset();
  removePolicyFromGroup.mockReset();
  vi.mocked(revalidatePath).mockClear();
});

test("removes a policy from a group and revalidates the groups", async () => {
  removePolicyFromGroup.mockResolvedValueOnce(undefined);
  await expect(
    removePolicyFromGroupAction("acme", "production", "web-app"),
  ).resolves.toEqual({ ok: true });
  expect(removePolicyFromGroup).toHaveBeenCalledWith("alice", "acme", "production", "web-app");
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/policy_groups", "layout");
});

test("deletes a whole group", async () => {
  deletePolicyGroup.mockResolvedValueOnce(undefined);
  await expect(deletePolicyGroupAction("acme", "production")).resolves.toEqual({ ok: true });
  expect(deletePolicyGroup).toHaveBeenCalledWith("alice", "acme", "production");
});

test("maps 403 to forbidden and does not revalidate", async () => {
  removePolicyFromGroup.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(
    removePolicyFromGroupAction("acme", "production", "web-app"),
  ).resolves.toEqual({ error: "forbidden" });
  deletePolicyGroup.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(deletePolicyGroupAction("acme", "production")).resolves.toEqual({
    error: "forbidden",
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});
