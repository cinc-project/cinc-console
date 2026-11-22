// Friendly, vendor-branded display names for Ohai's `automatic.platform`.
// Pure and free of `server-only`, so the fleet table (a client component) and
// the node pages (server) share one table.
//
// Ohai's raw values come from its platform plugins: on modern Linux the
// /etc/os-release `ID`, remapped for a few distros (rhel -> redhat,
// amzn -> amazon, ol -> oracle, opensuse-leap -> opensuseleap, sles ->
// suse, ...); `uname -s` lowercased on the BSDs; fixed strings elsewhere
// (mac_os_x, windows, aix, solaris2). Anything not listed here is shown as
// Ohai reported it.

const NAMES: Record<string, string> = {
  // Debian family
  debian: "Debian",
  ubuntu: "Ubuntu",
  linuxmint: "Linux Mint",
  raspbian: "Raspberry Pi OS",
  kali: "Kali Linux",
  pop: "Pop!_OS",
  cumulus: "Cumulus Linux",
  devuan: "Devuan",
  elementary: "elementary OS",
  zorin: "Zorin OS",
  deepin: "deepin",
  parrot: "Parrot OS",

  // RHEL family
  redhat: "Red Hat Enterprise Linux",
  centos: "CentOS",
  almalinux: "AlmaLinux",
  rocky: "Rocky Linux",
  oracle: "Oracle Linux",
  scientific: "Scientific Linux",
  cloudlinux: "CloudLinux",
  alibabalinux: "Alibaba Cloud Linux",
  eurolinux: "EuroLinux",
  miraclelinux: "MIRACLE LINUX",
  virtuozzo: "Virtuozzo",
  parallels: "Parallels Server",
  clearos: "ClearOS",
  sangoma: "Sangoma Linux",
  xenserver: "XenServer",
  "xcp-ng": "XCP-ng",
  ibm_powerkvm: "IBM PowerKVM",
  nexus_centos: "Cisco Nexus (CentOS)",
  bigip: "F5 BIG-IP",

  // Fedora family and other RPM distros
  fedora: "Fedora",
  amazon: "Amazon Linux",
  arista_eos: "Arista EOS",
  openeuler: "openEuler",
  mariner: "CBL-Mariner",
  azurelinux: "Azure Linux",
  photon: "Photon OS",
  mageia: "Mageia",
  mandriva: "Mandriva",

  // SUSE family
  suse: "SUSE Linux Enterprise",
  sled: "SUSE Linux Enterprise Desktop",
  "sle-micro": "SUSE Linux Enterprise Micro",
  "sl-micro": "SUSE Linux Micro",
  opensuse: "openSUSE",
  opensuseleap: "openSUSE Leap",
  "opensuse-tumbleweed": "openSUSE Tumbleweed",
  "opensuse-microos": "openSUSE MicroOS",

  // Other Linux
  arch: "Arch Linux",
  manjaro: "Manjaro",
  endeavouros: "EndeavourOS",
  alpine: "Alpine Linux",
  gentoo: "Gentoo",
  slackware: "Slackware",
  exherbo: "Exherbo",
  clearlinux: "Clear Linux",
  nixos: "NixOS",
  void: "Void Linux",
  flatcar: "Flatcar Container Linux",
  bottlerocket: "Bottlerocket",
  wrlinux: "Wind River Linux",
  nexus: "Cisco NX-OS",
  ios_xr: "Cisco IOS XR",

  // BSD and Unix
  freebsd: "FreeBSD",
  openbsd: "OpenBSD",
  netbsd: "NetBSD",
  dragonflybsd: "DragonFly BSD",
  aix: "AIX",
  solaris2: "Solaris",
  smartos: "SmartOS",
  omnios: "OmniOS",
  openindiana: "OpenIndiana",

  // Desktop and server OSes
  mac_os_x: "macOS",
  windows: "Windows",
};

/** Branded name for an Ohai platform, or the raw value if we don't know it. */
export function platformName(platform: string): string {
  return NAMES[platform.trim().toLowerCase()] ?? platform;
}

/**
 * "macOS 27.2" style label: branded name plus Ohai's platform_version. Null
 * when Ohai never reported a platform.
 */
export function platformLabel(
  platform: string | null,
  version: string | null,
): string | null {
  if (!platform) return null;
  const name = platformName(platform);
  return version ? `${name} ${version}` : name;
}
