// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import { CincError } from "@/lib/cinc/errors";

const { session } = vi.hoisted(() => ({
  session: { displayName: "", save: vi.fn() },
}));
vi.mock("@/lib/session", () => ({
  requireUser: async () => "anna",
  getSession: async () => session,
}));

const { getUser, putUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
  putUser: vi.fn(),
}));
vi.mock("@/lib/cinc/users", () => ({ getUser, putUser }));

import { saveProfile, changePassword, type ProfileDetails } from "./actions";

beforeEach(() => {
  getUser.mockReset();
  putUser.mockReset();
  session.save.mockReset();
  session.displayName = "";
  getUser.mockResolvedValue({ username: "anna", email: "old@x", public_key: "K" });
});

test("saveProfile merges edits onto the current record", async () => {
  putUser.mockResolvedValueOnce({});
  await expect(saveProfile({ email: "new@x" })).resolves.toEqual({ ok: true });
  expect(putUser).toHaveBeenCalledWith("anna", {
    username: "anna",
    email: "new@x",
    public_key: "K",
  });
});

test("changePassword merges a password onto the current record", async () => {
  putUser.mockResolvedValueOnce({});
  await expect(changePassword("s3cret!")).resolves.toEqual({ ok: true });
  expect(putUser).toHaveBeenCalledWith("anna", {
    username: "anna",
    email: "old@x",
    public_key: "K",
    password: "s3cret!",
  });
});

test("changePassword rejects a short password without calling the server", async () => {
  await expect(changePassword("123")).resolves.toEqual({
    error: "password must be at least 6 characters",
  });
  expect(putUser).not.toHaveBeenCalled();
});

test("saveProfile maps a 403 to forbidden", async () => {
  putUser.mockRejectedValueOnce(new CincError(403, "no"));
  await expect(saveProfile({ email: "x@y" })).resolves.toEqual({
    error: "forbidden",
  });
});

test("saveProfile syncs the session display name when it changes", async () => {
  putUser.mockResolvedValueOnce({});
  await saveProfile({ display_name: "Anna B" });
  expect(session.displayName).toBe("Anna B");
  expect(session.save).toHaveBeenCalled();
});

test("saveProfile writes only the fields the form owns", async () => {
  // A Server Action is a public endpoint and its parameter type is erased at
  // runtime, so a caller can hand us any object. None of these may ride along to
  // a PUT /users signed with the webui key.
  putUser.mockResolvedValueOnce({});
  await saveProfile({
    display_name: "Anna B",
    password: "hunter2",
    public_key: "ATTACKER",
    recovery_authentication_enabled: true,
    external_authentication_uid: "admin",
  } as ProfileDetails);

  expect(putUser).toHaveBeenCalledWith("anna", {
    username: "anna",
    email: "old@x",
    public_key: "K", // the record's own value, not the caller's
    display_name: "Anna B",
  });
});

test("saveProfile ignores non-string values for its own fields", async () => {
  putUser.mockResolvedValueOnce({});
  await saveProfile({ email: { toString: 1 } } as unknown as ProfileDetails);
  expect(putUser).toHaveBeenCalledWith("anna", {
    username: "anna",
    email: "old@x",
    public_key: "K",
  });
});

test("changePassword rejects a non-string password", async () => {
  // `(123456).length < 6` is false, so a bare length check would let this reach
  // the server as a numeric password.
  await expect(changePassword(123456 as unknown as string)).resolves.toEqual({
    error: "password must be at least 6 characters",
  });
  expect(putUser).not.toHaveBeenCalled();
});
