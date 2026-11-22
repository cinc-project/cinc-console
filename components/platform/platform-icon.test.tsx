import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PlatformIcon, glyphFor } from "./platform-icon";

describe("glyphFor", () => {
  it.each([
    ["Ubuntu", "ubuntu"],
    ["ubuntu", "ubuntu"],
    ["debian", "debian"],
    ["raspbian", "debian"],
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
    ["fedora", "redhat"],
    ["windows", "windows"],
    ["mac_os_x", "apple"],
    ["darwin", "apple"],
    ["alpine", "alpine"],
    ["arch", "arch"],
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
});
