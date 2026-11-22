import { expect, test } from "vitest";
import { toExpiration, fromExpiration, isPast } from "./key-expiry";

test("toExpiration maps no date to infinity and a date to UTC midnight with the Z", () => {
  expect(toExpiration(null)).toBe("infinity");
  expect(toExpiration("2030-01-31")).toBe("2030-01-31T00:00:00Z");
});

test("toExpiration rejects anything that isn't a calendar date", () => {
  expect(() => toExpiration("next tuesday")).toThrow();
  expect(() => toExpiration("2030-02-30")).toThrow();
});

test("fromExpiration reads infinity as no date and keeps the day of a timestamp", () => {
  expect(fromExpiration("infinity")).toBeNull();
  expect(fromExpiration("2030-01-31T00:00:00Z")).toBe("2030-01-31");
  expect(fromExpiration(undefined)).toBeNull();
});

test("isPast compares a date against now", () => {
  const now = Date.parse("2026-06-01T00:00:00Z");
  expect(isPast("2026-05-31", now)).toBe(true);
  expect(isPast("2026-06-02", now)).toBe(false);
  expect(isPast(null, now)).toBe(false);
});
