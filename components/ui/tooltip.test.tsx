import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { Tooltip } from "./tooltip";

function Subject() {
  return (
    <Tooltip content="Why it's off">
      {(id) => (
        <button type="button" aria-describedby={id}>
          Trigger
        </button>
      )}
    </Tooltip>
  );
}

test("describes its trigger even while hidden", async () => {
  const { container } = render(<Subject />);
  const trigger = screen.getByRole("button", { name: "Trigger" });
  expect(trigger).toHaveAccessibleDescription("Why it's off");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

test("shows on focus and Escape hides it without moving focus", async () => {
  const user = userEvent.setup();
  const { container } = render(<Subject />);
  await user.tab();
  const trigger = screen.getByRole("button", { name: "Trigger" });
  expect(trigger).toHaveFocus();
  expect(screen.getByRole("tooltip")).toHaveTextContent("Why it's off");
  expect(await axe(container)).toHaveNoViolations();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();

  // Focusing again brings it back.
  await user.tab();
  await user.tab({ shift: true });
  expect(screen.getByRole("tooltip")).toBeVisible();
});

test("shows on hover and stays while the pointer is on the tooltip", async () => {
  const user = userEvent.setup();
  render(<Subject />);
  await user.hover(screen.getByRole("button", { name: "Trigger" }));
  const tip = screen.getByRole("tooltip");
  await user.hover(tip);
  expect(screen.getByRole("tooltip")).toBeVisible();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

  await user.unhover(tip);
  await user.hover(screen.getByRole("button", { name: "Trigger" }));
  expect(screen.getByRole("tooltip")).toBeVisible();
});

test("hides when the pointer leaves", async () => {
  const user = userEvent.setup();
  render(<Subject />);
  const trigger = screen.getByRole("button", { name: "Trigger" });
  await user.hover(trigger);
  expect(screen.getByRole("tooltip")).toBeVisible();
  await user.unhover(trigger);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
