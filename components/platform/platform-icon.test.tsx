import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PlatformIcon, glyphFor } from "./platform-icon";

describe("glyphFor", () => {
  it.each([
    ["Ubuntu", "ubuntu"],
    ["ubuntu", "ubuntu"],
    ["debian", "debian"],
    ["raspbian", "raspberrypi"],
    ["devuan", "devuan"],
    ["linuxmint", "linuxmint"],
    ["kali", "kali"],
    ["zorin", "zorin"],
    ["Red Hat Enterprise Linux", "redhat"],
    ["rhel", "redhat"],
    ["centos", "centos"],
    ["CentOS Linux", "centos"],
    ["rocky", "rocky"],
    ["Rocky Linux", "rocky"],
    ["almalinux", "almalinux"],
    ["AlmaLinux", "almalinux"],
    ["amazon", "amazon"],
    ["Amazon Linux", "amazon"],
    ["amzn", "amazon"],
    ["fedora", "fedora"],
    ["oracle", "oracle"],
    ["opensuseleap", "opensuse"],
    ["opensuse-tumbleweed", "opensuse"],
    ["gentoo", "gentoo"],
    ["nixos", "nixos"],
    ["void", "void"],
    ["flatcar", "flatcar"],
    ["windows", "windows"],
    ["mac_os_x", "apple"],
    ["darwin", "apple"],
    ["alpine", "alpine"],
    ["arch", "arch"],
    ["manjaro", "manjaro"],
    ["endeavouros", "endeavouros"],
    ["nexus", "cisco"],
    ["nexus_centos", "cisco"],
    ["ios_xr", "cisco"],
    ["scientific", "generic"],
    ["plan9", "generic"],
    ["suse", "generic"],
  ])("maps %s to the %s glyph", (platform, expected) => {
    expect(glyphFor(platform)).toBe(expected);
  });
});

describe("PlatformIcon", () => {
  function glyphOf(node: HTMLElement) {
    return node.querySelector("svg")?.getAttribute("data-platform-glyph");
  }

  it("renders the matching glyph and labels it with the branded name", () => {
    const { container } = render(<PlatformIcon platform="mac_os_x" />);
    expect(glyphOf(container)).toBe("apple");
    expect(container.querySelector("svg")).toHaveAttribute("aria-label", "macOS");
  });

  it("falls back to the generic glyph for empty or non-string input", () => {
    const { container: a } = render(<PlatformIcon platform="" />);
    expect(glyphOf(a)).toBe("generic");
    expect(a.querySelector("svg")).toHaveAttribute("aria-label", "unknown platform");

    const { container: b } = render(<PlatformIcon platform={undefined} />);
    expect(glyphOf(b)).toBe("generic");
  });

  it("gives each knocked-out glyph its own mask so icons on one page don't share one", () => {
    const { container } = render(
      <>
        <PlatformIcon platform="fedora" />
        <PlatformIcon platform="fedora" />
      </>,
    );
    const masks = [...container.querySelectorAll("mask")];
    expect(masks).toHaveLength(2);
    expect(masks[0].id).not.toBe(masks[1].id);
    const groups = [...container.querySelectorAll("g[mask]")];
    expect(groups.map((g) => g.getAttribute("mask"))).toEqual(masks.map((m) => `url(#${m.id})`));
  });
});
