// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { getOsSupport, osProduct, parseOsSupport } from "./os-lifecycle";

const NOW = Date.parse("2026-11-17T00:00:00Z");

// Trimmed real endoflife.date responses.
const DEBIAN = [
  { cycle: "13", eol: "2030-06-30" },
  { cycle: "12", eol: "2028-06-30" },
  { cycle: "10", eol: "2024-06-30" },
];
const UBUNTU = [
  { cycle: "24.04", eol: "2029-05-31" },
  { cycle: "24.10", eol: "2025-07-10" },
];
const ALPINE = [{ cycle: "3.2", eol: "2016-05-01" }, { cycle: "3.24", eol: "2028-06-01" }];

describe("parseOsSupport", () => {
  it("matches a major cycle against a point release", () => {
    expect(parseOsSupport(DEBIAN, "13.1", NOW)).toEqual({ status: "supported", until: "2030-06-30" });
    expect(parseOsSupport(DEBIAN, "13", NOW)).toEqual({ status: "supported", until: "2030-06-30" });
  });

  it("reports EOL once the date has passed", () => {
    expect(parseOsSupport(DEBIAN, "10.13", NOW)).toEqual({ status: "eol", since: "2024-06-30" });
    expect(parseOsSupport(UBUNTU, "24.10", NOW)).toEqual({ status: "eol", since: "2025-07-10" });
  });

  it("prefers the longest cycle on a dot boundary", () => {
    expect(parseOsSupport(ALPINE, "3.24.4", NOW)).toEqual({ status: "supported", until: "2028-06-01" });
  });

  it("does not match a cycle that is only a string prefix", () => {
    expect(parseOsSupport(DEBIAN, "130", NOW)).toEqual({ status: "unknown" });
  });

  it("handles boolean eol", () => {
    expect(parseOsSupport([{ cycle: "27", eol: false }], "27.2", NOW)).toEqual({ status: "supported", until: null });
    expect(parseOsSupport([{ cycle: "9", eol: true }], "9", NOW)).toEqual({ status: "eol", since: null });
  });
});

describe("osProduct", () => {
  it("maps Ohai platforms and rejects unknown ones", () => {
    expect(osProduct("redhat")).toBe("rhel");
    expect(osProduct("mac_os_x")).toBe("macos");
    expect(osProduct("windows")).toBeNull();
    expect(osProduct("../../etc")).toBeNull();
    expect(osProduct(null)).toBeNull();
  });
});

describe("getOsSupport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the mapped product", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(DEBIAN), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getOsSupport("debian", "13", NOW)).resolves.toEqual({ status: "supported", until: "2030-06-30" });
    expect(fetchMock).toHaveBeenCalledWith("https://endoflife.date/api/debian.json", expect.anything());
  });

  it("makes no request for an unmapped platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getOsSupport("windows", "10.0.20348", NOW)).resolves.toEqual({ status: "unknown" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to unknown on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new DOMException("timed out", "TimeoutError"))));
    await expect(getOsSupport("debian", "13", NOW)).resolves.toEqual({ status: "unknown" });
  });
});
