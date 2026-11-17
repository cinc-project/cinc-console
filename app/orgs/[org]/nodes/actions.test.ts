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

import { saveNode, createNode, deleteNode, setNodeEnvironment } from "./actions";

beforeEach(() => {
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
