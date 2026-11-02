// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const req = vi.fn();
vi.mock("./client", () => ({ cincRequest: (...a: unknown[]) => req(...a) }));

import { createClient, deleteClient } from "./clients";
import { cincPath } from "./path";

beforeEach(() => req.mockReset());

test("createClient POSTs the name with create_key and returns the private key", async () => {
  req.mockResolvedValueOnce({ chef_key: { private_key: "PEM-NEW" } });
  await expect(createClient("anna", "acme", "ci")).resolves.toEqual({
    name: "ci",
    privateKey: "PEM-NEW",
  });
  expect(req).toHaveBeenCalledWith({
    user: "anna",
    org: "acme",
    method: "POST",
    path: cincPath`/clients`,
    body: { name: "ci", create_key: true },
  });
});

test("createClient falls back to the legacy top-level private_key", async () => {
  req.mockResolvedValueOnce({ private_key: "PEM-OLD" });
  await expect(createClient("anna", "acme", "ci")).resolves.toMatchObject({
    privateKey: "PEM-OLD",
  });
});

test("createClient prefers chef_key over the legacy field", async () => {
  req.mockResolvedValueOnce({
    chef_key: { private_key: "PEM-NEW" },
    private_key: "PEM-OLD",
  });
  await expect(createClient("anna", "acme", "ci")).resolves.toMatchObject({
    privateKey: "PEM-NEW",
  });
});

test("createClient returns an empty key when the server sends none", async () => {
  req.mockResolvedValueOnce({});
  await expect(createClient("anna", "acme", "ci")).resolves.toMatchObject({
    privateKey: "",
  });
});

test("deleteClient DELETEs /clients/<name>", async () => {
  req.mockResolvedValueOnce({});
  await deleteClient("anna", "acme", "ci");
  expect(req).toHaveBeenCalledWith({
    user: "anna",
    org: "acme",
    method: "DELETE",
    path: cincPath`/clients/ci`,
  });
});

test("deleteClient rejects a name that would retarget the signed path", async () => {
  await expect(deleteClient("anna", "acme", "ci/_acl")).rejects.toThrow();
  expect(req).not.toHaveBeenCalled();
});
