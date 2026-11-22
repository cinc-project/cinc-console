// @vitest-environment node
import { describe, expect, it } from "vitest";
import { platformLabel, platformName } from "./platform-name";

describe("platformName", () => {
  it.each([
    ["mac_os_x", "macOS"],
    ["redhat", "Red Hat Enterprise Linux"],
    ["opensuseleap", "openSUSE Leap"],
    ["amazon", "Amazon Linux"],
    ["windows", "Windows"],
    ["dragonflybsd", "DragonFly BSD"],
    ["solaris2", "Solaris"],
    ["bigip", "F5 BIG-IP"],
  ])("brands %s as %s", (raw, friendly) => {
    expect(platformName(raw)).toBe(friendly);
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    expect(platformName(" Ubuntu ")).toBe("Ubuntu");
    expect(platformName("openEuler")).toBe("openEuler");
  });

  it("falls back to the raw Ohai value for unknown platforms", () => {
    expect(platformName("plan9")).toBe("plan9");
  });
});

describe("platformLabel", () => {
  it("appends the version when Ohai reported one", () => {
    expect(platformLabel("mac_os_x", "27.2")).toBe("macOS 27.2");
    expect(platformLabel("debian", null)).toBe("Debian");
    expect(platformLabel("plan9", "4")).toBe("plan9 4");
  });

  it("is null when Ohai never reported a platform", () => {
    expect(platformLabel(null, "13")).toBeNull();
    expect(platformLabel("", null)).toBeNull();
  });
});
