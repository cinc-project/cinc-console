import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupMembersEditor } from "./group-members-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const onSave = vi.fn<(json: string) => Promise<{ ok: true }>>(async () => ({ ok: true }));
beforeEach(() => onSave.mockClear());

const data = {
  groupname: "admins",
  users: ["alice"],
  clients: [],
  groups: [],
  actors: ["alice"],
};

const enterEdit = () =>
  userEvent.click(screen.getByRole("button", { name: /edit members/i }));

test("is view-only until Edit is chosen", () => {
  render(<GroupMembersEditor data={data} onSave={onSave} />);
  expect(screen.queryByLabelText("Add to Users")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit members/i })).toBeInTheDocument();
});

test("adds a user and saves, preserving other fields", async () => {
  render(<GroupMembersEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.type(screen.getByLabelText("Add to Users"), "bob");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Add" })[0], // Users is first
  );
  await userEvent.click(screen.getByRole("button", { name: "Save members" }));

  const saved = JSON.parse(onSave.mock.calls[0][0]);
  expect(saved.users).toEqual(["alice", "bob"]);
  expect(saved.groupname).toBe("admins"); // untouched
});

test("removes a member", async () => {
  render(<GroupMembersEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(
    screen.getByRole("button", { name: "Remove alice from Users" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Save members" }));
  expect(JSON.parse(onSave.mock.calls[0][0]).users).toEqual([]);
});

test("Cancel reverts without saving", async () => {
  render(<GroupMembersEditor data={data} onSave={onSave} />);
  await enterEdit();
  await userEvent.click(
    screen.getByRole("button", { name: "Remove alice from Users" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: /edit members/i })).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
