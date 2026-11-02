import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/palette-search", () => ({
  searchOrgObjects: vi.fn(async () => [
    { kind: "nodes", label: "Node", name: "web01" },
  ]),
}));

beforeEach(() => push.mockClear());

const orgs = [
  { name: "acme" },
  { name: "beta", full_name: "Beta Inc" },
];

test("opens from the trigger and lists the org's sections", async () => {
  render(<CommandPalette org="acme" orgs={orgs} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Nodes/ })).toBeInTheDocument();
  // current org is excluded; other orgs are offered as switch targets
  expect(screen.getByRole("option", { name: /Switch to Beta Inc/ })).toBeInTheDocument();
});

test("filters as you type and navigates on Enter", async () => {
  render(<CommandPalette org="acme" orgs={orgs} />);
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "role");
  expect(screen.getByRole("option", { name: /Roles/ })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Nodes/ })).not.toBeInTheDocument();
  await userEvent.keyboard("{Enter}");
  expect(push).toHaveBeenCalledWith("/orgs/acme/roles");
});

test("arrow keys move the active option and Enter runs it", async () => {
  render(<CommandPalette org="acme" orgs={orgs} />);
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  await userEvent.keyboard("{ArrowDown}{Enter}"); // first -> second section = Roles
  expect(push).toHaveBeenCalledWith("/orgs/acme/roles");
});

test("jumps to an object by name once you type", async () => {
  render(<CommandPalette org="acme" orgs={orgs} />);
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  await userEvent.type(screen.getByRole("combobox"), "web01");
  const option = await screen.findByRole("option", { name: /web01/ });
  expect(option).toBeInTheDocument();
  await userEvent.keyboard("{Enter}");
  expect(push).toHaveBeenCalledWith("/orgs/acme/nodes/web01");
});

test("Escape closes without navigating", async () => {
  render(<CommandPalette org="acme" orgs={orgs} />);
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test("has no axe violations when open", async () => {
  const { baseElement } = render(<CommandPalette org="acme" orgs={orgs} />);
  await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
  expect(await axe(baseElement)).toHaveNoViolations();
});
