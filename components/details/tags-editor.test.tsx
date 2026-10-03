import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagsEditor } from "./tags-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const onSave = vi.fn<(json: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
beforeEach(() => onSave.mockClear());

const data = { name: "web", normal: { tags: ["prod"], other: 1 }, run_list: [] };

const enterEdit = () =>
  userEvent.click(screen.getByRole("button", { name: /edit tags/i }));

test("is view-only until Edit is chosen", () => {
  render(<TagsEditor data={data} onSave={onSave} />);
  expect(screen.queryByLabelText("New tag")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit tags/i })).toBeInTheDocument();
});

test("adds a tag and saves it under normal.tags, preserving siblings", async () => {
  render(<TagsEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.type(screen.getByLabelText("New tag"), "frontend");
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await userEvent.click(screen.getByRole("button", { name: "Save tags" }));

  const saved = JSON.parse(onSave.mock.calls[0][0]);
  expect(saved.normal.tags).toEqual(["prod", "frontend"]);
  expect(saved.normal.other).toBe(1); // sibling keys preserved
});

test("removes a tag", async () => {
  render(<TagsEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "Remove tag prod" }));
  await userEvent.click(screen.getByRole("button", { name: "Save tags" }));
  expect(JSON.parse(onSave.mock.calls[0][0]).normal.tags).toEqual([]);
});

test("Cancel reverts without saving", async () => {
  render(<TagsEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(screen.getByRole("button", { name: "Remove tag prod" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: /edit tags/i })).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
