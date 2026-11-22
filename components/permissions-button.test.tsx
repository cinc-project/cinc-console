import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { PermissionsButton } from "./permissions-button";

const HREF = "/orgs/acme/permissions/users/anna";
const WHY = "You need grant permission on this user to view or change its permissions.";

test("links to the permissions page when allowed", async () => {
  const { container } = render(<PermissionsButton href={HREF} />);
  const link = screen.getByRole("link", { name: "Permissions" });
  expect(link).toHaveAttribute("href", HREF);
  expect(link).not.toHaveAttribute("aria-disabled");
  expect(await axe(container)).toHaveNoViolations();
});

test("denied: a disabled, focusable control that explains why", async () => {
  const user = userEvent.setup();
  const { container } = render(<PermissionsButton href={HREF} denied={WHY} />);
  const control = screen.getByRole("link", { name: "Permissions" });
  expect(control).toHaveAttribute("aria-disabled", "true");
  expect(control).not.toHaveAttribute("href");
  expect(container.querySelector("a")).toBeNull();
  expect(control).toHaveAccessibleDescription(WHY);
  expect(await axe(container)).toHaveNoViolations();

  await user.tab();
  expect(control).toHaveFocus();
  expect(screen.getByRole("tooltip")).toHaveTextContent(WHY);
  expect(control.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
  expect(await axe(container)).toHaveNoViolations();

  // Activating it goes nowhere.
  const before = window.location.href;
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  await user.click(control);
  expect(window.location.href).toBe(before);
  expect(control).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

test("denied: the tooltip shows on hover", async () => {
  const user = userEvent.setup();
  render(<PermissionsButton href={HREF} denied={WHY} />);
  await user.hover(screen.getByRole("link", { name: "Permissions" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent(WHY);
});
