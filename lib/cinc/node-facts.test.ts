// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  nodeFacts,
  parseKb,
  formatKb,
  formatUptime,
  machineKind,
  osName,
  checkIn,
  unconfigured,
  cookbookOf,
} from "./node-facts";

// Trimmed from a real Debian 13 node's Ohai output.
const LINUX = {
  name: "timnas",
  chef_environment: "_default",
  run_list: [],
  normal: { tags: [] },
  automatic: {
    platform: "debian",
    platform_version: "13",
    platform_family: "debian",
    kernel: { name: "Linux", release: "6.12.48-amd64", machine: "x86_64" },
    hostname: "timnas",
    fqdn: "timnas.localdomain",
    ipaddress: "172.16.1.50",
    uptime_seconds: 1533389,
    ohai_time: 1794900000.123,
    chef_packages: { chef: { version: "18.8.54" }, ohai: { version: "18.1.29" } },
    virtualization: { systems: {} },
    dmi: { system: { manufacturer: "ASRock", product_name: "N100DC-ITX" }, bios: { version: "1.30" } },
    cpu: { "0": { model_name: "Intel(R) N100", mhz: "3400.000" }, total: 4, real: 1, cores: 4 },
    memory: { total: "16303424kB", available: "9381232kB", swap: { total: "4194300kB", free: "4194300kB" } },
    filesystem: {
      by_mountpoint: {
        "/": { kb_size: "245107000", kb_used: "56000000", percent_used: "23%", fs_type: "ext4", devices: ["/dev/nvme0n1p2"] },
        "/run": { kb_size: "1630340", kb_used: "1000", fs_type: "tmpfs", devices: ["tmpfs"] },
        "/proc": { fs_type: "proc", devices: ["proc"] },
      },
    },
    network: {
      default_interface: "enp1s0",
      default_gateway: "172.16.1.1",
      interfaces: {
        lo: { encapsulation: "Loopback", addresses: { "127.0.0.1": { family: "inet" } } },
        docker0: { state: "up", addresses: { "172.17.0.1": { family: "inet", prefixlen: "16" } } },
        enp1s0: {
          state: "up",
          addresses: {
            "172.16.1.50": { family: "inet", prefixlen: "24" },
            "A8:C1:04:2E:91:B0": { family: "lladdr" },
          },
        },
        veth12ab: { state: "up", addresses: { "AA:AA:AA:AA:AA:AA": { family: "lladdr" } } },
      },
    },
    recipes: ["users::sysadmins", "ntp"],
    roles: ["base"],
    cookbooks: { users: { version: "8.1.2" }, ntp: { version: "5.2.0" } },
  },
};

describe("nodeFacts", () => {
  const f = nodeFacts(LINUX);

  it("reads identity, client, and check-in", () => {
    expect(f.platform).toBe("debian");
    expect(f.kernelRelease).toBe("6.12.48-amd64");
    expect(f.arch).toBe("x86_64");
    expect(f.clientVersion).toBe("18.8.54");
    expect(f.ohaiTime).toBeCloseTo(1794900000.123);
    expect(f.environment).toBe("_default");
  });

  it("reads hardware", () => {
    expect(f.cpu).toEqual({ model: "Intel(R) N100", sockets: 1, cores: 4, threads: 4, mhz: 3400 });
    expect(f.memory).toEqual({ totalKb: 16303424, usedKb: 16303424 - 9381232 });
    expect(f.swap).toEqual({ totalKb: 4194300, usedKb: 0 });
    expect(f.hardware).toEqual({ manufacturer: "ASRock", product: "N100DC-ITX", biosVersion: "1.30" });
  });

  it("keeps real filesystems and drops pseudo ones", () => {
    expect(f.filesystems).toEqual([
      { mount: "/", device: "/dev/nvme0n1p2", fsType: "ext4", kbSize: 245107000, kbUsed: 56000000, percentUsed: 23 },
    ]);
  });

  it("reads the legacy device-keyed filesystem shape", () => {
    const legacy = nodeFacts({
      automatic: { filesystem: { "/dev/sda1": { mount: "/", kb_size: "1000", kb_used: "250", fs_type: "xfs" } } },
    });
    expect(legacy.filesystems).toEqual([
      { mount: "/", device: "/dev/sda1", fsType: "xfs", kbSize: 1000, kbUsed: 250, percentUsed: 25 },
    ]);
  });

  it("lists interfaces default-first, without loopback or bare veths", () => {
    expect(f.interfaces.map((i) => i.name)).toEqual(["enp1s0", "docker0"]);
    expect(f.interfaces[0]).toEqual({
      name: "enp1s0",
      state: "up",
      addresses: [{ address: "172.16.1.50", family: "inet", prefixlen: "24" }],
      mac: "A8:C1:04:2E:91:B0",
      isDefault: true,
    });
    expect(f.defaultGateway).toBe("172.16.1.1");
  });

  it("reads what the last run applied", () => {
    expect(f.appliedRecipes).toEqual(["users::sysadmins", "ntp"]);
    expect(f.appliedRoles).toEqual(["base"]);
    expect(f.cookbookVersions).toEqual({ users: "8.1.2", ntp: "5.2.0" });
  });

  it("degrades to empty facts for a node that never converged", () => {
    const empty = nodeFacts({ name: "fresh", chef_environment: "_default", run_list: [] });
    expect(empty.platform).toBeNull();
    expect(empty.cpu).toBeNull();
    expect(empty.memory).toBeNull();
    expect(empty.virtualization).toBeNull();
    expect(empty.filesystems).toEqual([]);
    expect(empty.interfaces).toEqual([]);
  });

  it("does not throw on garbage", () => {
    expect(() => nodeFacts("oops")).not.toThrow();
    expect(() => nodeFacts({ automatic: { cpu: "x", memory: 5, network: [] } })).not.toThrow();
  });
});

describe("formatting", () => {
  it("parses Ohai sizes", () => {
    expect(parseKb("16303424kB")).toBe(16303424);
    expect(parseKb("2048")).toBe(2048);
    expect(parseKb("4MB")).toBe(4096);
    expect(parseKb("lots")).toBeNull();
    expect(parseKb(" 512 MB ")).toBe(512 * 1024);
    expect(parseKb("1kb")).toBe(1);
  });

  it("rejects pathological input quickly", () => {
    const evil = `1${" ".repeat(50_000)}x`;
    const start = performance.now();
    expect(parseKb(evil)).toBeNull();
    expect(parseKb(`1${" ".repeat(40)}x`)).toBeNull();
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("formats kilobytes", () => {
    expect(formatKb(16303424)).toBe("15.5 GB");
    expect(formatKb(512 * 1024)).toBe("512 MB");
    expect(formatKb(245107000)).toBe("234 GB");
  });

  it("formats uptime", () => {
    expect(formatUptime(1533389)).toBe("17 days 17 h");
    expect(formatUptime(86400 + 60)).toBe("1 day 0 h");
    expect(formatUptime(3 * 3600 + 120)).toBe("3 h 2 min");
    expect(formatUptime(59)).toBe("0 min");
  });
});

describe("machineKind", () => {
  const kind = (virtualization: unknown) => machineKind(nodeFacts({ automatic: { virtualization } }));
  it("classifies guests, containers, hosts, and bare metal", () => {
    expect(kind({ system: "kvm", role: "guest" })).toBe("Virtual machine (kvm)");
    expect(kind({ system: "docker", role: "guest" })).toBe("Container (docker)");
    expect(kind({ system: "kvm", role: "host" })).toBe("Physical (kvm host)");
    expect(kind({ systems: {} })).toBe("Physical");
  });
  it("doesn't guess when Ohai reported nothing", () => {
    expect(machineKind(nodeFacts({}))).toBeNull();
  });
});

describe("osName", () => {
  it("prettifies known platforms", () => {
    expect(osName(nodeFacts(LINUX))).toBe("Debian 13");
    expect(osName(nodeFacts({ automatic: { platform: "mac_os_x", platform_version: "14.5" } }))).toBe("macOS 14.5");
    expect(osName(nodeFacts({ automatic: { platform: "plan9" } }))).toBe("plan9");
    expect(osName(nodeFacts({}))).toBeNull();
  });
});

describe("checkIn", () => {
  const at = (ohai_time: number | undefined) => nodeFacts({ automatic: { ohai_time } });
  const NOW = 1_800_000_000_000;
  it("uses the dashboard thresholds", () => {
    expect(checkIn(at(NOW / 1000 - 600), NOW)).toBe("recent");
    expect(checkIn(at(NOW / 1000 - 3 * 3600), NOW)).toBe("ok");
    expect(checkIn(at(NOW / 1000 - 13 * 3600), NOW)).toBe("missing");
    expect(checkIn(at(undefined), NOW)).toBe("never");
  });
});

describe("unconfigured", () => {
  it("flags an empty run list and _default", () => {
    expect(unconfigured(nodeFacts(LINUX))).toEqual({ emptyRunList: true, defaultEnv: true });
  });
  it("exempts policyfile nodes", () => {
    const policy = nodeFacts({ chef_environment: "_default", run_list: [], policy_name: "web", policy_group: "prod" });
    expect(unconfigured(policy)).toEqual({ emptyRunList: false, defaultEnv: false });
  });
});

describe("cookbookOf", () => {
  it("strips recipe syntax", () => {
    expect(cookbookOf("users::sysadmins")).toBe("users");
    expect(cookbookOf("recipe[ntp@1.0.0]")).toBe("ntp");
    expect(cookbookOf("ntp")).toBe("ntp");
  });
});
