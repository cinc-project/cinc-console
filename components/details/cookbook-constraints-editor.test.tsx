import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookbookConstraintsEditor } from "./cookbook-constraints-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const onSave = vi.fn<(json: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
beforeEach(() => onSave.mockClear());

const data = {
  name: "production",
  cookbook_versions: { nginx: ">= 1.0.0" },
};

const enterEdit = () =>
  userEvent.click(screen.getByRole("button", { name: /edit cookbook constraints/i }));

test("is view-only until Edit is chosen", () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  expect(screen.queryByLabelText("Operator")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /edit cookbook constraints/i }),
  ).toBeInTheDocument();
});

test("parses the existing constraint into name, operator, and version", async () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  await enterEdit();
  expect(screen.getByLabelText("Cookbook")).toHaveValue("nginx");
  expect(screen.getByLabelText("Operator")).toHaveValue(">=");
  expect(screen.getByLabelText("Version")).toHaveValue("1.0.0");
});

test("blocks save on an invalid version", async () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  await enterEdit();
  const version = screen.getByLabelText("Version");
  await userEvent.clear(version);
  await userEvent.type(version, "not-a-version");
  expect(screen.getByRole("button", { name: "Save constraints" })).toBeDisabled();
});

test("shows an inline error and marks the field invalid for trailing junk", async () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  await enterEdit();
  const version = screen.getByLabelText("Version");
  await userEvent.clear(version);
  await userEvent.type(version, "0.0.0sdfsad");
  expect(version).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("alert")).toHaveTextContent(/version like/i);
  expect(screen.getByRole("button", { name: "Save constraints" })).toBeDisabled();
});

test("rejects a bare major version (Chef requires at least x.y)", async () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  await enterEdit();
  const version = screen.getByLabelText("Version");
  await userEvent.clear(version);
  await userEvent.type(version, "1");
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save constraints" })).toBeDisabled();
});

test("adds a constraint via the operator dropdown and saves it as a string", async () => {
  render(<CookbookConstraintsEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "+ Add constraint" }));
  const cookbooks = screen.getAllByLabelText("Cookbook");
  await userEvent.type(cookbooks[1], "apache2");
  await userEvent.selectOptions(screen.getAllByLabelText("Operator")[1], "~>");
  await userEvent.type(screen.getAllByLabelText("Version")[1], "2.1");
  await userEvent.click(screen.getByRole("button", { name: "Save constraints" }));

  const saved = JSON.parse(onSave.mock.calls[0][0]);
  expect(saved.cookbook_versions).toEqual({
    nginx: ">= 1.0.0",
    apache2: "~> 2.1",
  });
});
