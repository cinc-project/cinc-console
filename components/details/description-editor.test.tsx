import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DescriptionEditor } from "./description-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const onSave = vi.fn<(json: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
beforeEach(() => onSave.mockClear());

const data = { name: "web", description: "old", run_list: ["recipe[a]"] };

test("is view-only until Edit is chosen", () => {
  render(<DescriptionEditor data={data} onSave={onSave} />);
  expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit description/i })).toBeInTheDocument();
});

test("edits the description and saves, preserving other fields", async () => {
  render(<DescriptionEditor data={data} onSave={onSave} />);
  await userEvent.click(screen.getByRole("button", { name: /edit description/i }));
  const field = screen.getByLabelText("Description");
  await userEvent.clear(field);
  await userEvent.type(field, "new text");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  const saved = JSON.parse(onSave.mock.calls[0][0]);
  expect(saved.description).toBe("new text");
  expect(saved.run_list).toEqual(["recipe[a]"]); // untouched
});

test("Cancel reverts and exits without saving", async () => {
  render(<DescriptionEditor data={data} onSave={onSave} />);
  await userEvent.click(screen.getByRole("button", { name: /edit description/i }));
  await userEvent.type(screen.getByLabelText("Description"), " more");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: /edit description/i })).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
