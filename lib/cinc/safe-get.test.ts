// @vitest-environment node
import { expect, test } from "vitest";
import { safeGet, explainRead } from "./safe-get";
import { CincError } from "./errors";

test("safeGet returns data on success", async () => {
  expect(await safeGet(async () => ({ a: 1 }))).toEqual({ data: { a: 1 } });
});

test("safeGet maps 403 to forbidden", async () => {
  const r = await safeGet(async () => {
    throw new CincError(403, {});
  });
  expect(r).toEqual({ error: "forbidden" });
});

test("safeGet maps 404 to not found", async () => {
  const r = await safeGet(async () => {
    throw new CincError(404, {});
  });
  expect(r).toEqual({ error: "not found" });
});

test("safeGet reports other statuses generically", async () => {
  const r = await safeGet(async () => {
    throw new CincError(502, {});
  });
  expect(r).toEqual({ error: "server error (502)" });
});

test("safeGet rethrows non-CincError so it isn't masked as a read error", async () => {
  await expect(
    safeGet(async () => {
      throw new Error("transport down");
    }),
  ).rejects.toThrow("transport down");
});

test("explainRead expands known errors into actionable guidance", () => {
  expect(explainRead("forbidden")).toMatch(/permission/i);
  expect(explainRead("not found")).toMatch(/no longer exists|don't have access/i);
  expect(explainRead("server error (502)")).toMatch(/502[\s\S]*transient/i);
  // unknown strings pass through unchanged
  expect(explainRead("something odd")).toBe("something odd");
});
