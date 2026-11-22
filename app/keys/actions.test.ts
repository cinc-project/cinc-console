// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { keys, loadKeys } = vi.hoisted(() => ({
  keys: { create: vi.fn(), update: vi.fn(), regenerate: vi.fn(), remove: vi.fn() },
  loadKeys: vi.fn(),
}));
vi.mock("@/lib/cinc/keys", () => ({ keys, loadKeys }));

import { createKey, updateKey, regenerateKey, deleteKey } from "./actions";

const ME = { kind: "user", name: "alice" } as const;
const CLIENT = { kind: "client", org: "acme", name: "web01" } as const;

beforeEach(() => {
  for (const f of Object.values(keys)) f.mockReset();
  loadKeys.mockReset();
});

describe("createKey", () => {
  test("generates a pair and returns the private key once", async () => {
    keys.create.mockResolvedValueOnce({ privateKey: "SECRET" });
    await expect(createKey(ME, { name: "ci", expires: null })).resolves.toEqual({
      ok: true,
      privateKey: "SECRET",
    });
    expect(keys.create).toHaveBeenCalledWith("alice", ME, {
      name: "ci",
      publicKey: undefined,
      expirationDate: "infinity",
    });
  });

  test("stores a pasted public key with an expiry day", async () => {
    keys.create.mockResolvedValueOnce({ privateKey: undefined });
    await expect(
      createKey(CLIENT, { name: "k1", publicKey: "  PEM \n", expires: "2030-01-31" }),
    ).resolves.toEqual({ ok: true, privateKey: undefined });
    expect(keys.create).toHaveBeenCalledWith("alice", CLIENT, {
      name: "k1",
      publicKey: "PEM",
      expirationDate: "2030-01-31T00:00:00Z",
    });
  });

  test("rejects a bad name or date without calling the server", async () => {
    await expect(createKey(ME, { name: "my key", expires: null })).resolves.toEqual({
      error: "invalid name",
    });
    await expect(createKey(ME, { name: "k", expires: "soon" })).resolves.toEqual({
      error: "invalid date",
    });
    expect(keys.create).not.toHaveBeenCalled();
  });

  test("rejects an owner that isn't a user or a client", async () => {
    await expect(
      createKey({ kind: "node", name: "x" } as never, { name: "k", expires: null }),
    ).resolves.toEqual({ error: "invalid owner" });
  });

  test("passes the server's reason through when it rejects the key", async () => {
    keys.create.mockRejectedValueOnce(
      new CincError(400, { error: ["Invalid public key"] }),
    );
    await expect(
      createKey(ME, { name: "k", publicKey: "junk", expires: null }),
    ).resolves.toEqual({ error: "The server rejected this: Invalid public key" });
  });

  test("reports a duplicate name", async () => {
    keys.create.mockRejectedValueOnce(new CincError(409, "conflict"));
    await expect(createKey(ME, { name: "default", expires: null })).resolves.toEqual({
      error: "already exists",
    });
  });
});

describe("lockout guard", () => {
  const rows = (...r: Array<[string, boolean, string | null]>) =>
    r.map(([name, expired, expires]) => ({ name, expired, expires }));

  test("refuses to delete a user's last active key", async () => {
    loadKeys.mockResolvedValueOnce(rows(["default", false, null], ["old", true, "2020-01-01"]));
    await expect(deleteKey(ME, "default")).resolves.toEqual({ error: "last key" });
    expect(keys.remove).not.toHaveBeenCalled();
  });

  test("allows it when another active key remains", async () => {
    loadKeys.mockResolvedValueOnce(rows(["default", false, null], ["laptop", false, null]));
    keys.remove.mockResolvedValueOnce({});
    await expect(deleteKey(ME, "default")).resolves.toEqual({ ok: true });
  });

  test("refuses to expire a user's last active key", async () => {
    loadKeys.mockResolvedValueOnce(rows(["default", false, null]));
    await expect(updateKey(ME, "default", { expires: "2001-01-01" })).resolves.toEqual({
      error: "last key",
    });
    expect(keys.update).not.toHaveBeenCalled();
  });

  test("doesn't apply to client keys, which the console never signs with", async () => {
    keys.remove.mockResolvedValueOnce({});
    await expect(deleteKey(CLIENT, "default")).resolves.toEqual({ ok: true });
    expect(loadKeys).not.toHaveBeenCalled();
  });
});

test("updateKey renames and changes the expiry in one request", async () => {
  loadKeys.mockResolvedValueOnce([]);
  keys.update.mockResolvedValueOnce({});
  await expect(
    updateKey(CLIENT, "old", { name: "new", expires: null }),
  ).resolves.toEqual({ ok: true });
  expect(keys.update).toHaveBeenCalledWith("alice", CLIENT, "old", {
    name: "new",
    expiration_date: "infinity",
  });
});

test("updateKey with nothing to change makes no request", async () => {
  await expect(updateKey(CLIENT, "k", {})).resolves.toEqual({ ok: true });
  expect(keys.update).not.toHaveBeenCalled();
});

test("regenerateKey returns the new private key", async () => {
  keys.regenerate.mockResolvedValueOnce("NEW");
  await expect(regenerateKey(CLIENT, "default")).resolves.toEqual({
    ok: true,
    privateKey: "NEW",
  });
});
