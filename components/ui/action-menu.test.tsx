import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { ActionMenu } from "./action-menu";

function setup(onDelete = vi.fn()) {
  render(
    <>
      <ActionMenu
        label="Actions for key default"
        items={[
          { label: "Edit", hint: "Rename or change expiry", onSelect: vi.fn() },
          "separator",
          { label: "Delete", danger: true, onSelect: onDelete },
        ]}
      />
      <button>elsewhere</button>
    </>,
  );
  return screen.getByRole("button", { name: "Actions for key default" });
}

describe("ActionMenu", () => {
  it("opens on click, focuses the first item and reports its state", async () => {
    const trigger = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Edit/ })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("runs the chosen item with focus back on the trigger", async () => {
    const onDelete = vi.fn(() => expect(document.activeElement).toBe(trigger));
    const trigger = setup(onDelete);
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("closes when focus tabs out of it", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await userEvent.tab(); // Delete
    await userEvent.tab(); // out
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("has no axe violations when open", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
