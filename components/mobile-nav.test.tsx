import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";

const nav = vi.hoisted(() => ({ pathname: "/orgs/acme" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { MobileNav } from "./mobile-nav";

beforeEach(() => {
  nav.pathname = "/orgs/acme";
});

const open = () => userEvent.click(screen.getByRole("button", { name: "Menu" }));

describe("MobileNav", () => {
  it("starts closed, with a Menu button that says so", () => {
    render(<MobileNav org="acme" displayName="Tim Smith" />);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a drawer with every section, the user, and sign out", async () => {
    render(<MobileNav org="acme" displayName="Tim Smith" />);
    await open();
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    const links = within(drawer).getByRole("navigation", { name: "Primary" });
    expect(within(links).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(links).getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      "/orgs/acme/clients",
    );
    expect(within(drawer).getByRole("link", { name: "Tim Smith" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("moves focus in on open and back to the Menu button on Escape", async () => {
    render(<MobileNav org="acme" displayName="Tim Smith" />);
    await open();
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
  });

  it("keeps Tab inside the drawer", async () => {
    render(<MobileNav org="acme" displayName="Tim Smith" />);
    await open();
    const drawer = screen.getByRole("dialog");
    await userEvent.tab({ shift: true }); // from the first item, wraps to the last
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toHaveFocus();
  });

  it("closes itself after navigating", async () => {
    const { rerender } = render(<MobileNav org="acme" displayName="Tim Smith" />);
    await open();
    nav.pathname = "/orgs/acme/nodes";
    rerender(<MobileNav org="acme" displayName="Tim Smith" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no axe violations when open", async () => {
    const { container } = render(<MobileNav org="acme" displayName="Tim Smith" />);
    await open();
    expect(await axe(container)).toHaveNoViolations();
  });
});
