// @vitest-environment node
import { expect, test } from "vitest";
import { CincError, isCincError } from "./errors";

test("carries status and body with a default message", () => {
  const e = new CincError(500, { error: ["boom"] });
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("CincError");
  expect(e.status).toBe(500);
  expect(e.body).toEqual({ error: ["boom"] });
  expect(e.message).toBe("cinc server returned 500");
});

test("keeps an explicit message", () => {
  expect(new CincError(400, null, "bad run list").message).toBe("bad run list");
});

test.each([
  [403, { forbidden: true, notFound: false, conflict: false }],
  [404, { forbidden: false, notFound: true, conflict: false }],
  [409, { forbidden: false, notFound: false, conflict: true }],
  [500, { forbidden: false, notFound: false, conflict: false }],
])("status %i flags", (status, flags) => {
  const e = new CincError(status, null);
  expect({
    forbidden: e.forbidden,
    notFound: e.notFound,
    conflict: e.conflict,
  }).toEqual(flags);
});

test("isCincError distinguishes CincError from other errors", () => {
  expect(isCincError(new CincError(404, null))).toBe(true);
  expect(isCincError(new Error("nope"))).toBe(false);
  expect(isCincError({ status: 404 })).toBe(false);
  expect(isCincError(undefined)).toBe(false);
});
