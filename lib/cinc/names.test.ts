import { expect, test } from "vitest";
import { nameError } from "./names";

test("accepts valid names for each kind", () => {
  expect(nameError("data_bag", "secrets-prod.v2")).toBeNull();
  expect(nameError("data_bag_item", "api.key_1")).toBeNull();
  expect(nameError("environment", "production_1")).toBeNull();
  expect(nameError("role", "web-server")).toBeNull();
  expect(nameError("node", "web01.example.com")).toBeNull();
  expect(nameError("client", "ci-runner_1")).toBeNull();
});

test("returns null for empty input (handled by the required/disabled state)", () => {
  expect(nameError("role", "")).toBeNull();
  expect(nameError("role", "   ")).toBeNull();
});

test("rejects characters Chef disallows", () => {
  // spaces, slashes, and punctuation are never allowed
  expect(nameError("data_bag", "my bag")).not.toBeNull();
  expect(nameError("role", "web/server")).not.toBeNull();
  expect(nameError("data_bag", "bang!")).not.toBeNull();
});

test("roles and environments reject dots (stricter than data bags)", () => {
  expect(nameError("environment", "prod.v2")).not.toBeNull();
  expect(nameError("role", "web.server")).not.toBeNull();
  // but data bags and nodes allow dots
  expect(nameError("data_bag", "prod.v2")).toBeNull();
  expect(nameError("node", "web01.local")).toBeNull();
});

test("nodes allow colons; data bags and roles do not", () => {
  expect(nameError("node", "rack:01")).toBeNull();
  expect(nameError("data_bag", "rack:01")).not.toBeNull();
  expect(nameError("role", "rack:01")).not.toBeNull();
});

test("rejects reserved data bag names", () => {
  for (const r of ["node", "role", "environment", "client"]) {
    expect(nameError("data_bag", r)).not.toBeNull();
  }
});

test("rejects the reserved _default environment", () => {
  expect(nameError("environment", "_default")).not.toBeNull();
  // _default is fine as a role or data bag name
  expect(nameError("role", "_default")).toBeNull();
});

test("key names allow colons and dots, like the server", () => {
  expect(nameError("key", "laptop:2026.11")).toBeNull();
  expect(nameError("key", "my key")).toBe("Use only letters, numbers, and . : _ -.");
});
