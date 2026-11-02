import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { ObjectEditor } from "./object-editor";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
}));

beforeEach(() => {
  nav.push.mockClear();
  nav.refresh.mockClear();
});

describe("ObjectEditor", () => {
  const json = JSON.stringify({ run_list: ["recipe[x]"] }, null, 2);

  it("shows the curated details view first and toggles to JSON", async () => {
    const user = userEvent.setup();
    render(
      <ObjectEditor
        name="node1"
        initialJson={json}
        details={<p>Curated view</p>}
        backHref="/back"
        onSave={vi.fn()}
      />,
    );

    // Details view is shown by default; no Save and no textarea yet.
    expect(screen.getByText("Curated view")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    // Switch to the JSON escape hatch: textarea and Save appear.
    await user.click(screen.getByRole("button", { name: "Edit JSON" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByText("Curated view")).not.toBeInTheDocument();
  });

  it("labels the toggle 'View JSON' for read-only objects and hides Save", async () => {
    const user = userEvent.setup();
    render(
      <ObjectEditor
        name="cb"
        initialJson={json}
        details={<p>Curated view</p>}
        backHref="/back"
        readOnly
      />,
    );

    await user.click(screen.getByRole("button", { name: "View JSON" }));
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("renders a title icon to the left of the name when provided", () => {
    render(
      <ObjectEditor
        name="web01"
        titleIcon={<span data-testid="title-icon">icon</span>}
        initialJson={json}
        details={<p>Curated view</p>}
        backHref="/back"
      />,
    );
    expect(screen.getByTestId("title-icon")).toBeInTheDocument();
  });

  it("falls back to JSON-only when no details view is provided", () => {
    render(
      <ObjectEditor name="x" initialJson={json} backHref="/back" onSave={vi.fn()} />,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    // No details/JSON view toggle when there's no curated details view.
    expect(
      screen.queryByRole("button", { name: /view details|view json|edit json/i }),
    ).not.toBeInTheDocument();
  });

  it("offers Duplicate only when onDuplicate is provided", () => {
    const { rerender } = render(
      <ObjectEditor name="web" initialJson={json} backHref="/back" onSave={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Duplicate" }),
    ).not.toBeInTheDocument();

    rerender(
      <ObjectEditor
        name="web"
        initialJson={json}
        backHref="/back"
        onSave={vi.fn()}
        onDuplicate={vi.fn()}
        nameKind="role"
      />,
    );
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
  });

  it("duplicates with the new name and the source JSON, then navigates", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ObjectEditor
        name="web"
        initialJson={json}
        backHref="/orgs/acme/roles"
        onSave={vi.fn()}
        onDuplicate={onDuplicate}
        nameKind="role"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/name/i), "web-copy");
    await user.click(dialog.getByRole("button", { name: "Duplicate" }));

    // Copies the saved object verbatim; the action injects the new name.
    expect(onDuplicate).toHaveBeenCalledWith("web-copy", json);
    expect(nav.push).toHaveBeenCalledWith("/orgs/acme/roles/web-copy");
  });

  it("keeps the dialog open and shows an error when duplicate fails", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn().mockResolvedValue({ error: "name already exists" });
    render(
      <ObjectEditor
        name="web"
        initialJson={json}
        backHref="/orgs/acme/roles"
        onDuplicate={onDuplicate}
        nameKind="role"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/name/i), "web-copy");
    await user.click(dialog.getByRole("button", { name: "Duplicate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "name already exists",
    );
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

it("has no axe violations in the details, JSON and duplicate-dialog states", async () => {
  const user = userEvent.setup();
  const { baseElement } = render(
    <ObjectEditor
      name="web"
      initialJson={JSON.stringify({ run_list: [] }, null, 2)}
      details={<p>Curated view</p>}
      backHref="/back"
      onSave={vi.fn()}
      onDuplicate={vi.fn()}
      nameKind="role"
    />,
  );
  expect(await axe(baseElement)).toHaveNoViolations();
  await user.click(screen.getByRole("button", { name: "Edit JSON" }));
  expect(await axe(baseElement)).toHaveNoViolations();
  await user.click(screen.getByRole("button", { name: "Duplicate" }));
  expect(await axe(baseElement)).toHaveNoViolations();
});
