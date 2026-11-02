import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { CreateObjectForm } from "./create-object-form";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

beforeEach(() => {
  nav.push.mockClear();
  nav.refresh.mockClear();
});

describe("CreateObjectForm", () => {
  it("disables Create until a valid name is entered", async () => {
    const user = userEvent.setup();
    render(
      <CreateObjectForm kind="role" onCreate={vi.fn()} backHref="/orgs/acme/roles" />,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), "web");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("rejects an invalid role name", async () => {
    const user = userEvent.setup();
    render(
      <CreateObjectForm kind="role" onCreate={vi.fn()} backHref="/orgs/acme/roles" />,
    );
    await user.type(screen.getByLabelText("Name"), "bad.name");
    expect(screen.getByRole("alert")).toHaveTextContent(/no dots/i);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("creates a role from the curated fields with the name as the only source", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ ok: true });
    render(
      <CreateObjectForm
        kind="role"
        onCreate={onCreate}
        backHref="/orgs/acme/roles"
      />,
    );

    await user.type(screen.getByLabelText("Name"), "web");
    await user.type(screen.getByLabelText("Description"), "Frontend tier");
    await user.click(screen.getByLabelText("New run list entry"));
    await user.paste("recipe[nginx]");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const [name, json] = onCreate.mock.calls[0];
    expect(name).toBe("web");
    const body = JSON.parse(json);
    // The name lives only in the Name field — never duplicated in the body.
    expect(body.name).toBeUndefined();
    expect(body.description).toBe("Frontend tier");
    expect(body.run_list).toEqual(["recipe[nginx]"]);
    expect(body.json_class).toBe("Chef::Role");
    expect(nav.push).toHaveBeenCalledWith("/orgs/acme/roles/web");
  });

  it("round-trips through the JSON escape hatch and gates on its validity", async () => {
    const user = userEvent.setup();
    render(
      <CreateObjectForm kind="role" onCreate={vi.fn()} backHref="/orgs/acme/roles" />,
    );
    await user.type(screen.getByLabelText("Name"), "web");
    await user.click(screen.getByRole("button", { name: "Edit as JSON" }));

    const editor = screen.getByLabelText("JSON editor") as HTMLTextAreaElement;
    expect(editor.value).toContain("Chef::Role");

    await user.clear(editor);
    await user.click(editor);
    await user.paste("{ not json"); // paste: type() treats "{" as a key macro
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit as form" })).toBeDisabled();
  });

  it("blocks Create on an invalid environment constraint", async () => {
    const user = userEvent.setup();
    render(
      <CreateObjectForm
        kind="environment"
        onCreate={vi.fn()}
        backHref="/orgs/acme/environments"
      />,
    );
    await user.type(screen.getByLabelText("Name"), "prod");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "+ Add constraint" }));
    await user.type(screen.getByLabelText("Cookbook"), "nginx");
    await user.type(screen.getByLabelText("Version"), "nope");
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("surfaces a server error and does not navigate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ error: "forbidden" });
    render(
      <CreateObjectForm
        kind="role"
        onCreate={onCreate}
        backHref="/orgs/acme/roles"
      />,
    );
    await user.type(screen.getByLabelText("Name"), "web");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission/i);
    expect(nav.push).not.toHaveBeenCalled();
  });
});

it("has no axe violations", async () => {
  const { container } = render(
    <CreateObjectForm kind="role" onCreate={vi.fn()} backHref="/orgs/acme/roles" />,
  );
  expect(await axe(container)).toHaveNoViolations();
});
