import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { ConfirmDialog } from "./confirm-dialog";

/** A trigger that opens the dialog, as the real callers do. */
function Harness({
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
}: {
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete node</button>
      <ConfirmDialog
        open={open}
        title="Delete web01?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      >
        This permanently deletes the node object.
      </ConfirmDialog>
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<Harness onConfirm={onConfirm} onCancel={onCancel} />);
  const trigger = screen.getByRole("button", { name: "Delete node" });
  await user.click(trigger);
  return { user, onConfirm, onCancel, trigger, ...utils };
}

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a modal dialog named by its title and described by its body", async () => {
    await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Delete web01?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "This permanently deletes the node object.",
    );
  });

  it("moves focus to the confirm button on open", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

  it("calls onConfirm and restores focus to the trigger", async () => {
    const { user, onConfirm, onCancel, trigger } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("calls onCancel from the Cancel button and restores focus", async () => {
    const { user, onConfirm, onCancel, trigger } = await openDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const { user, onCancel, trigger } = await openDialog();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    const { user } = await openDialog();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Delete" });

    await user.tab(); // last -> wraps to first
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true }); // first -> wraps to last
    expect(confirm).toHaveFocus();
  });

  it("has no axe violations when open", async () => {
    const { baseElement } = await openDialog();
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
