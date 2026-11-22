// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";
import { CincError } from "@/lib/cinc/errors";

vi.mock("@/lib/session", () => ({ requireUser: async () => "alice" }));

const { get, update, create, remove } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/cinc/resource", () => ({
  makeResource: () => ({ get, update, create, remove }),
}));

const { getClient, deleteClient } = vi.hoisted(() => ({
  getClient: vi.fn(),
  deleteClient: vi.fn(),
}));
vi.mock("@/lib/cinc/readonly", () => ({ clients: { get: getClient } }));
vi.mock("@/lib/cinc/clients", () => ({ deleteClient }));

import { saveNode, createNode, deleteNode, setNodeEnvironment } from "./actions";

beforeEach(() => {
  getClient.mockReset();
  deleteClient.mockReset();
  get.mockReset();
  update.mockReset();
  create.mockReset();
  remove.mockReset();
});

test("saveNode translates 403 into a forbidden result", async () => {
  update.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(saveNode("acme", "web01", '{"name":"web01"}')).resolves.toEqual({
    error: "forbidden",
  });
});

test("saveNode rejects invalid JSON without calling the server", async () => {
  await expect(saveNode("acme", "web01", "{not json")).resolves.toEqual({
    error: "invalid JSON",
  });
  expect(update).not.toHaveBeenCalled();
});

test("saveNode saves valid JSON", async () => {
  update.mockResolvedValueOnce({});
  await expect(saveNode("acme", "web01", '{"name":"web01"}')).resolves.toEqual({
    ok: true,
  });
  expect(update).toHaveBeenCalledWith("alice", "acme", "web01", { name: "web01" });
});

test("createNode injects the name", async () => {
  create.mockResolvedValueOnce({});
  await createNode("acme", "web02", '{"run_list":[]}');
  expect(create).toHaveBeenCalledWith("alice", "acme", {
    run_list: [],
    name: "web02",
  });
});

test("deleteNode removes by name", async () => {
  remove.mockResolvedValueOnce({});
  await expect(deleteNode("acme", "web01")).resolves.toEqual({ ok: true });
  expect(remove).toHaveBeenCalledWith("alice", "acme", "web01");
});

test("deleteNode revalidates the nodes list so the deleted node disappears", async () => {
  remove.mockResolvedValueOnce({});
  await deleteNode("acme", "web01");
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/nodes", "layout");
});

test("a failed mutation does not revalidate", async () => {
  vi.mocked(revalidatePath).mockClear();
  remove.mockRejectedValueOnce(new CincError(403, "denied"));
  await deleteNode("acme", "web01");
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("setNodeEnvironment changes only chef_environment on the fresh node", async () => {
  get.mockResolvedValueOnce({ name: "web01", chef_environment: "_default", normal: { a: 1 } });
  update.mockResolvedValueOnce({});
  await expect(setNodeEnvironment("acme", "web01", "production")).resolves.toEqual({ ok: true });
  expect(update).toHaveBeenCalledWith("alice", "acme", "web01", {
    name: "web01",
    chef_environment: "production",
    normal: { a: 1 },
  });
});

test.each([["prod.v2"], [""], [42], [{ name: "x" }]])(
  "setNodeEnvironment rejects %j without calling the server",
  async (env) => {
    await expect(setNodeEnvironment("acme", "web01", env)).resolves.toEqual({
      error: "invalid environment",
    });
    expect(get).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  },
);

test("setNodeEnvironment translates 403 into forbidden", async () => {
  get.mockResolvedValueOnce({ name: "web01" });
  update.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(setNodeEnvironment("acme", "web01", "production")).resolves.toEqual({
    error: "forbidden",
  });
});

test("deleteNode leaves the client alone unless asked", async () => {
  remove.mockResolvedValueOnce({});
  await expect(deleteNode("acme", "web01")).resolves.toEqual({ ok: true });
  expect(getClient).not.toHaveBeenCalled();
  expect(deleteClient).not.toHaveBeenCalled();
});

test.each([["true"], [1], [{}], [false]])(
  "deleteNode treats alsoDeleteClient %j as node only",
  async (flag) => {
    remove.mockResolvedValueOnce({});
    await expect(deleteNode("acme", "web01", flag)).resolves.toEqual({ ok: true });
    expect(deleteClient).not.toHaveBeenCalled();
  },
);

test("deleteNode deletes the node, then its client, and revalidates both lists", async () => {
  vi.mocked(revalidatePath).mockClear();
  const order: string[] = [];
  remove.mockImplementationOnce(async () => void order.push("node"));
  getClient.mockResolvedValueOnce({ name: "web01", validator: false });
  deleteClient.mockImplementationOnce(async () => void order.push("client"));
  await expect(deleteNode("acme", "web01", true)).resolves.toEqual({ ok: true });
  expect(order).toEqual(["node", "client"]);
  expect(deleteClient).toHaveBeenCalledWith("alice", "acme", "web01");
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/nodes", "layout");
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/clients", "layout");
});

test("deleteNode does not touch the client when the node delete fails", async () => {
  remove.mockRejectedValueOnce(new CincError(403, "denied"));
  await expect(deleteNode("acme", "web01", true)).resolves.toEqual({ error: "forbidden" });
  expect(getClient).not.toHaveBeenCalled();
  expect(deleteClient).not.toHaveBeenCalled();
});

test("a forbidden client delete reports the node deleted and the client kept", async () => {
  vi.mocked(revalidatePath).mockClear();
  remove.mockResolvedValueOnce({});
  getClient.mockResolvedValueOnce({ name: "web01" });
  deleteClient.mockRejectedValueOnce(new CincError(403, "denied"));
  const res = await deleteNode("acme", "web01", true);
  expect(res).toMatchObject({ clientKept: "forbidden" });
  expect("error" in res && res.error).toMatch(
    /Node web01 was deleted, but client web01 wasn't: you don't have permission/,
  );
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/nodes", "layout");
  expect(revalidatePath).toHaveBeenCalledWith("/orgs/acme/clients", "layout");
});

test("a server error on the client delete is reported as such", async () => {
  remove.mockResolvedValueOnce({});
  getClient.mockResolvedValueOnce({ name: "web01" });
  deleteClient.mockRejectedValueOnce(new CincError(500, "boom"));
  const res = await deleteNode("acme", "web01", true);
  expect(res).toMatchObject({ clientKept: "error" });
  expect("error" in res && res.error).toMatch(/the Cinc server returned an error/);
});

test("a client that is already gone counts as deleted", async () => {
  remove.mockResolvedValueOnce({});
  getClient.mockRejectedValueOnce(new CincError(404, "not found"));
  await expect(deleteNode("acme", "web01", true)).resolves.toEqual({ ok: true });
  expect(deleteClient).not.toHaveBeenCalled();
});

test("a client deleted between the check and the delete counts as deleted", async () => {
  remove.mockResolvedValueOnce({});
  getClient.mockResolvedValueOnce({ name: "web01" });
  deleteClient.mockRejectedValueOnce(new CincError(404, "not found"));
  await expect(deleteNode("acme", "web01", true)).resolves.toEqual({ ok: true });
});

test("deleteNode never deletes a validator client", async () => {
  remove.mockResolvedValueOnce({});
  getClient.mockResolvedValueOnce({ name: "acme-validator", validator: true });
  const res = await deleteNode("acme", "acme-validator", true);
  expect(res).toMatchObject({ clientKept: "validator" });
  expect(deleteClient).not.toHaveBeenCalled();
});
