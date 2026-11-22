// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "anna" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { setPermission } = vi.hoisted(() => ({ setPermission: vi.fn() }));
vi.mock("@/lib/cinc/acl", () => ({ setPermission }));

import { savePermission } from "./actions";

const NODES = { kind: "containers", name: "nodes" } as const;

beforeEach(() => {
  setPermission.mockReset();
});

test("saves one permission with trimmed, de-duplicated names", async () => {
  setPermission.mockResolvedValueOnce({});
  await expect(
    savePermission("acme", NODES, "create", { actors: [" ci ", "ci", ""], groups: ["admins", "ops"] }),
  ).resolves.toEqual({ ok: true });
  expect(setPermission).toHaveBeenCalledWith("anna", "acme", NODES, "create", {
    actors: ["ci"],
    groups: ["admins", "ops"],
  });
});

test("rejects an unknown target or permission before calling the server", async () => {
  await expect(
    savePermission("acme", { kind: "sandboxes", name: "x" } as never, "read", { actors: [], groups: [] }),
  ).resolves.toEqual({ error: "invalid target" });
  await expect(
    savePermission("acme", NODES, "own" as never, { actors: [], groups: [] }),
  ).resolves.toEqual({ error: "invalid target" });
  await expect(
    savePermission("acme", { kind: "organization" }, "read", { actors: "bob", groups: [] } as never),
  ).resolves.toEqual({ error: "invalid target" });
  expect(setPermission).not.toHaveBeenCalled();
});

test("explains the server refusing to take admins out of grant", async () => {
  setPermission.mockRejectedValueOnce(
    new CincError(403, { error: ["Admin group cannot be removed from the Grant ACE"] }),
  );
  await expect(
    savePermission("acme", NODES, "grant", { actors: [], groups: [] }),
  ).resolves.toEqual({ error: "admins grant" });
});

test("other refusals are forbidden, and the server's 400 reason passes through", async () => {
  setPermission.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(savePermission("acme", NODES, "read", { actors: [], groups: [] })).resolves.toEqual({
    error: "forbidden",
  });
  setPermission.mockRejectedValueOnce(new CincError(400, { error: ["group 'nope' does not exist"] }));
  await expect(
    savePermission("acme", NODES, "read", { actors: [], groups: ["nope"] }),
  ).resolves.toEqual({ error: "The server rejected this: group 'nope' does not exist" });
});
