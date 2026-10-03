import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunListEditor } from "./run-list-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const onSave = vi.fn<(json: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
beforeEach(() => onSave.mockClear());

const data = { name: "web01", run_list: ["recipe[a]", "recipe[b]"] };

const enterEdit = () =>
  userEvent.click(screen.getByRole("button", { name: /edit run list/i }));

test("is view-only until you choose to edit (no controls shown)", () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  expect(
    screen.queryByRole("button", { name: "Save run list" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("New run list entry")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /edit run list/i }),
  ).toBeInTheDocument();
});

test("adds an entry and saves the new run list", async () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByLabelText("New run list entry"));
  await userEvent.paste("role[web]"); // paste: type() treats "[" as special
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await userEvent.click(screen.getByRole("button", { name: "Save run list" }));

  const saved = JSON.parse(onSave.mock.calls[0][0]);
  expect(saved.run_list).toEqual(["recipe[a]", "recipe[b]", "role[web]"]);
  expect(saved.name).toBe("web01");
});

test("removes an individual entry", async () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "Remove recipe[a]" }));
  await userEvent.click(screen.getByRole("button", { name: "Save run list" }));
  expect(JSON.parse(onSave.mock.calls[0][0]).run_list).toEqual(["recipe[b]"]);
});

test("reorders entries with the move controls", async () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "Move recipe[b] up" }));
  await userEvent.click(screen.getByRole("button", { name: "Save run list" }));
  expect(JSON.parse(onSave.mock.calls[0][0]).run_list).toEqual([
    "recipe[b]",
    "recipe[a]",
  ]);
});

test("Cancel reverts pending changes and exits edit mode", async () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "Remove recipe[a]" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(
    screen.getByRole("button", { name: /edit run list/i }),
  ).toBeInTheDocument();
  expect(screen.getByText("recipe[a]")).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});

test("Save is disabled until there are changes", async () => {
  render(<RunListEditor data={data} onSave={onSave} />);
  await enterEdit();
  expect(screen.getByRole("button", { name: "Save run list" })).toBeDisabled();
});
