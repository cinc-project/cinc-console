// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "bob" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { respondToInvite } = vi.hoisted(() => ({ respondToInvite: vi.fn() }));
vi.mock("@/lib/cinc/invitations", () => ({ respondToInvite }));

import { acceptInvite, declineInvite } from "./actions";

beforeEach(() => respondToInvite.mockReset());

test("acceptInvite answers the invitation as the signed-in user", async () => {
  respondToInvite.mockResolvedValueOnce({});
  await expect(acceptInvite("bob-beta")).resolves.toEqual({ ok: true });
  expect(respondToInvite).toHaveBeenCalledWith("bob", "bob-beta", "accept");
});

test("declineInvite rejects it", async () => {
  respondToInvite.mockResolvedValueOnce({});
  await expect(declineInvite("bob-beta")).resolves.toEqual({ ok: true });
  expect(respondToInvite).toHaveBeenCalledWith("bob", "bob-beta", "reject");
});

test("acceptInvite reports a withdrawn invitation", async () => {
  respondToInvite.mockRejectedValueOnce(new CincError(404, "gone"));
  await expect(acceptInvite("bob-beta")).resolves.toEqual({ error: "not found" });
});
