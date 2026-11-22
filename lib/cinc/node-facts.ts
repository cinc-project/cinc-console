// Pure extraction of the human-relevant facts from a node object: identity,
// client, configuration, and the hardware/OS details Ohai reports under
// `automatic`. No I/O and no `server-only` import, so the node detail pages
// (server) and tests share one tolerant reader. Every field degrades to null /
// empty when Ohai didn't report it (a node that never converged has no
// `automatic` at all; Windows and macOS report a different shape than Linux).

import { platformLabel } from "@/lib/platform-name";
import {
  hasEmptyRunList,
  isDefaultEnvironment,
  isMissing,
  isRecent,
  type FleetNode,
} from "./fleet";

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function rec(v: unknown): Rec {
  return isRec(v) ? v : {};
}
function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export type Filesystem = {
  mount: string;
  device: string | null;
  fsType: string | null;
  kbSize: number;
  kbUsed: number | null;
  /** 0–100, from Ohai's percent_used or computed from used/size. */
  percentUsed: number | null;
};

export type NetAddress = { address: string; family: string; prefixlen: string | null };

export type NetInterface = {
  name: string;
  state: string | null;
  /** inet / inet6 addresses only; the MAC is split out. */
  addresses: NetAddress[];
  mac: string | null;
  isDefault: boolean;
};

export type NodeFacts = {
  environment: string | null;
  runList: string[];
  policyName: string | null;
  policyGroup: string | null;
  tags: string[];

  platform: string | null;
  platformVersion: string | null;
  platformFamily: string | null;
  kernelName: string | null;
  kernelRelease: string | null;
  arch: string | null;

  hostname: string | null;
  fqdn: string | null;
  ipaddress: string | null;
  uptimeSeconds: number | null;
  /** ohai_time: unix seconds of the last check-in, or null if never. */
  ohaiTime: number | null;
  clientVersion: string | null;

  virtualization: { system: string | null; role: string | null } | null;
  hardware: { manufacturer: string | null; product: string | null; biosVersion: string | null } | null;
  cpu: {
    model: string | null;
    sockets: number | null;
    cores: number | null;
    threads: number | null;
    mhz: number | null;
  } | null;
  memory: { totalKb: number; usedKb: number | null } | null;
  swap: { totalKb: number; usedKb: number | null } | null;
  filesystems: Filesystem[];
  interfaces: NetInterface[];
  defaultGateway: string | null;

  /** What the client applied on its last run (Chef writes these to automatic). */
  appliedRecipes: string[];
  appliedRoles: string[];
  /** cookbook name -> version resolved on the last run. */
  cookbookVersions: Record<string, string>;
};

/** "16303424kB" / "16303424" / 16303424 -> kilobytes; null if unparseable. */
export function parseKb(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // Ohai data is client-supplied: cap the length and trim first, so the
  // pattern below has exactly one way to match (no adjacent \s* to backtrack
  // between, which was quadratic on long runs of whitespace).
  if (typeof v !== "string" || v.length > 64) return null;
  const m = /^(\d+(?:\.\d+)?) ?([kmg]b?|b)?$/i.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("m")) return n * 1024;
  if (unit.startsWith("g")) return n * 1024 * 1024;
  return n;
}

/** Kilobytes as a short binary size: "512 MB", "16 GB", "10.9 TB". */
export function formatKb(kb: number): string {
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = kb;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = v >= 100 || Number.isInteger(v) ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/** Uptime seconds as "17 days 16 h", "5 h 3 min", "42 min". */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} ${d === 1 ? "day" : "days"} ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// Kernel/virtual filesystems that say nothing about the machine's storage.
const PSEUDO_FS = new Set([
  "autofs", "binfmt_misc", "bpf", "cgroup", "cgroup2", "configfs", "debugfs",
  "devpts", "devtmpfs", "efivarfs", "fuse.lxcfs", "fusectl", "hugetlbfs",
  "mqueue", "nsfs", "overlay", "proc", "pstore", "ramfs", "rpc_pipefs",
  "securityfs", "selinuxfs", "squashfs", "sysfs", "tmpfs", "tracefs",
  "nfsd", "devfs", "fdescfs", "linprocfs",
]);

function filesystems(fs: Rec): Filesystem[] {
  // Ohai >= 14 reports `filesystem.by_mountpoint`; older Ohai keyed the map by
  // device with a `mount` field on each entry.
  const byMount: Array<{ mount: string; v: Rec }> = isRec(fs.by_mountpoint)
    ? Object.entries(fs.by_mountpoint).map(([mount, v]) => ({ mount, v: rec(v) }))
    : Object.entries(fs).flatMap(([device, raw]) => {
        const v = rec(raw);
        return typeof v.mount === "string" ? [{ mount: v.mount, v: { ...v, devices: [device] } }] : [];
      });

  const out: Filesystem[] = [];
  for (const { mount, v } of byMount) {
    const fsType = str(v.fs_type);
    const kbSize = num(v.kb_size);
    if (!kbSize || (fsType && PSEUDO_FS.has(fsType))) continue;
    const kbUsed = num(v.kb_used);
    const pct = typeof v.percent_used === "string" ? num(v.percent_used.replace("%", "")) : num(v.percent_used);
    const devices = strList(v.devices);
    out.push({
      mount,
      device: devices[0] ?? null,
      fsType,
      kbSize,
      kbUsed,
      percentUsed: pct ?? (kbUsed !== null ? Math.round((kbUsed / kbSize) * 100) : null),
    });
  }
  return out.sort((a, b) => a.mount.localeCompare(b.mount));
}

function interfaces(net: Rec): NetInterface[] {
  const def = str(net.default_interface);
  const out: NetInterface[] = [];
  for (const [name, raw] of Object.entries(rec(net.interfaces))) {
    const iface = rec(raw);
    if (name === "lo" || str(iface.encapsulation) === "Loopback") continue;
    const addresses: NetAddress[] = [];
    let mac: string | null = null;
    for (const [address, info] of Object.entries(rec(iface.addresses))) {
      const family = str(rec(info).family);
      if (family === "lladdr") mac = address;
      else if (family === "inet" || family === "inet6")
        addresses.push({ address, family, prefixlen: str(rec(info).prefixlen) });
    }
    // Container veth pairs carry no addresses and bury the real NICs.
    if (name.startsWith("veth") && addresses.length === 0) continue;
    out.push({ name, state: str(iface.state), addresses, mac, isDefault: name === def });
  }
  return out.sort((a, b) =>
    a.isDefault !== b.isDefault ? (a.isDefault ? -1 : 1) : a.name.localeCompare(b.name),
  );
}

function cpu(c: Rec): NodeFacts["cpu"] {
  if (Object.keys(c).length === 0) return null;
  const first = rec(c["0"]);
  return {
    model: str(c.model_name) ?? str(first.model_name),
    sockets: num(c.real),
    cores: num(c.cores),
    threads: num(c.total),
    mhz: num(c.mhz) ?? num(first.mhz),
  };
}

function usage(total: unknown, used: unknown, free: unknown) {
  const totalKb = parseKb(total);
  if (!totalKb) return null;
  const usedKb = parseKb(used);
  const freeKb = parseKb(free);
  return {
    totalKb,
    usedKb: usedKb ?? (freeKb !== null ? Math.max(0, totalKb - freeKb) : null),
  };
}

/** Read the facts the node pages show. Never throws on a malformed object. */
export function nodeFacts(data: unknown): NodeFacts {
  const node = rec(data);
  const auto = rec(node.automatic);
  const normal = rec(node.normal);
  const kernel = rec(auto.kernel);
  const mem = rec(auto.memory);
  const virt = rec(auto.virtualization);
  const dmi = rec(auto.dmi);
  const net = rec(auto.network);

  const cookbookVersions: Record<string, string> = {};
  for (const [cb, info] of Object.entries(rec(auto.cookbooks))) {
    const v = str(rec(info).version);
    if (v) cookbookVersions[cb] = v;
  }

  return {
    environment: str(node.chef_environment),
    runList: strList(node.run_list),
    policyName: str(node.policy_name),
    policyGroup: str(node.policy_group),
    tags: strList(normal.tags),

    platform: str(auto.platform),
    platformVersion: str(auto.platform_version),
    platformFamily: str(auto.platform_family),
    kernelName: str(kernel.name),
    kernelRelease: str(kernel.release),
    arch: str(kernel.machine),

    hostname: str(auto.hostname),
    fqdn: str(auto.fqdn),
    ipaddress: str(auto.ipaddress),
    uptimeSeconds: num(auto.uptime_seconds),
    ohaiTime: num(auto.ohai_time),
    clientVersion: str(rec(rec(auto.chef_packages).chef).version),

    virtualization: isRec(auto.virtualization)
      ? { system: str(virt.system), role: str(virt.role) }
      : null,
    hardware: isRec(auto.dmi)
      ? {
          manufacturer: str(rec(dmi.system).manufacturer),
          product: str(rec(dmi.system).product_name),
          biosVersion: str(rec(dmi.bios).version),
        }
      : null,
    cpu: cpu(rec(auto.cpu)),
    memory: usage(mem.total, null, mem.available ?? mem.free),
    swap: usage(rec(mem.swap).total, null, rec(mem.swap).free),
    filesystems: filesystems(rec(auto.filesystem)),
    interfaces: interfaces(net),
    defaultGateway: str(net.default_gateway),

    appliedRecipes: strList(auto.recipes),
    appliedRoles: strList(auto.roles),
    cookbookVersions,
  };
}

// Container runtimes Ohai reports as a virtualization "system".
const CONTAINER_SYSTEMS = new Set(["docker", "lxc", "lxd", "podman", "openvz", "nspawn", "linux-vserver", "wsl"]);

/**
 * "Virtual machine (kvm)", "Container (docker)", "Physical", or null when Ohai
 * didn't report virtualization at all (absence is not proof of bare metal).
 */
export function machineKind(facts: NodeFacts): string | null {
  const v = facts.virtualization;
  if (!v) return null;
  if (v.role === "guest" && v.system) {
    return CONTAINER_SYSTEMS.has(v.system)
      ? `Container (${v.system})`
      : `Virtual machine (${v.system})`;
  }
  if (v.role === "host" && v.system) return `Physical (${v.system} host)`;
  return "Physical";
}

/** "Debian 13" style display name for the OS; null if Ohai never reported one. */
export function osName(facts: NodeFacts): string | null {
  return platformLabel(facts.platform, facts.platformVersion);
}

export type CheckIn = "recent" | "ok" | "missing" | "never";

function asFleetNode(facts: NodeFacts): FleetNode {
  return {
    name: "",
    ohaiTime: facts.ohaiTime,
    runList: facts.runList,
    policyName: facts.policyName,
    policyGroup: facts.policyGroup,
    chefVersion: facts.clientVersion,
    environment: facts.environment,
    platform: facts.platform,
    platformVersion: facts.platformVersion,
  };
}

/** Check-in standing, using the same thresholds as the fleet dashboard. */
export function checkIn(facts: NodeFacts, nowMs: number): CheckIn {
  const node = asFleetNode(facts);
  if (facts.ohaiTime === null) return "never";
  if (isMissing(node, nowMs)) return "missing";
  if (isRecent(node, nowMs)) return "recent";
  return "ok";
}

/** Why a node is unconfigured (the dashboard's rule); both false = configured. */
export function unconfigured(facts: NodeFacts): { emptyRunList: boolean; defaultEnv: boolean } {
  const node = asFleetNode(facts);
  return { emptyRunList: hasEmptyRunList(node), defaultEnv: isDefaultEnvironment(node) };
}

/** "users::sysadmins" -> "users"; "recipe[ntp@1.0]" -> "ntp". */
export function cookbookOf(recipe: string): string {
  const inner = /^recipe\[(.+)\]$/.exec(recipe)?.[1] ?? recipe;
  return inner.split("::")[0].split("@")[0];
}
