import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { FormDialog } from "./form-dialog";

function Harness({ onSubmit = vi.fn() }: { onSubmit?: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)}>Set password…</button>
      {open && (
        <FormDialog
          title="Set password"
          submitLabel="Set password"
          canSubmit={value !== ""}
          onSubmit={() => {
            onSubmit(value);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        >
          <label htmlFor="pw">New password</label>
          <input id="pw" value={value} onChange={(e) => setValue(e.target.value)} />
        </FormDialog>
      )}
    </>
  );
}

describe("FormDialog", () => {
  it("focuses the first field and is named by its title", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Set password…" }));
    expect(screen.getByRole("dialog", { name: "Set password" })).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveFocus();
  });

  it("submits with Enter only once it can, then restores focus", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const opener = screen.getByRole("button", { name: "Set password…" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("New password"), "secret1{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("secret1");
    expect(opener).toHaveFocus();
  });

  it("cancels on Escape", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Set password…" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Set password…" }));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
