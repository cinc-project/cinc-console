import { expect, test } from "vitest";
import { pickProfileFields, newUserError } from "./user-fields";

test("pickProfileFields keeps only the editable string fields", () => {
  expect(
    pickProfileFields({
      display_name: "Dave",
      email: "d@example.com",
      password: "sneaky",
      admin: true,
      first_name: 5,
    } as never),
  ).toEqual({ display_name: "Dave", email: "d@example.com" });
});

const ok = { username: "dave", display_name: "Dave", email: "d@example.com", password: "secret1" };

test("newUserError accepts a complete user", () => {
  expect(newUserError(ok, { needsPassword: true })).toBeNull();
});

test("newUserError applies the server's rules", () => {
  expect(newUserError({ ...ok, username: "Dave" }, { needsPassword: true })).toBe("invalid username");
  expect(newUserError({ ...ok, display_name: " " }, { needsPassword: true })).toBe("display name required");
  expect(newUserError({ ...ok, email: "nope" }, { needsPassword: true })).toBe("invalid email");
  expect(newUserError({ ...ok, password: "short" }, { needsPassword: true })).toBe("password too short");
  // LDAP users have no Cinc password.
  expect(newUserError({ ...ok, password: undefined }, { needsPassword: false })).toBeNull();
});
