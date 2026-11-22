import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { NodeDeleteButton } from "./node-delete-button";
import { ClientKeptNotice } from "./client-kept-notice";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});

async function openDialog(pairedClient: "deletable" | "forbidden" | null, onDelete = vi.fn()) {
  onDelete.mockResolvedValue({ ok: true });
  const utils = render(
    <NodeDeleteButton
      name="web01"
      listHref="/orgs/acme/nodes"
      pairedClient={pairedClient}
      onDelete={onDelete}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  return { ...utils, onDelete };
}

/** The dialog's own Delete, not the button that opened it. */
const confirmDelete = () =>
  userEvent.click(
    within(screen.getByRole("dialog", { name: "Delete web01?" })).getByRole("button", {
      name: "Delete",
    }),
  );

describe("NodeDeleteButton", () => {
  it("offers to delete the matching client, checked by default", async () => {
    const { onDelete } = await openDialog("deletable");
    const box = screen.getByRole("checkbox", { name: "Also delete client web01" });
    expect(box).toBeChecked();
    await confirmDelete();
    expect(onDelete).toHaveBeenCalledWith(true);
    expect(push).toHaveBeenCalledWith("/orgs/acme/nodes");
  });

  it("deletes only the node when the box is unchecked from the keyboard", async () => {
    const { onDelete } = await openDialog("deletable");
    screen.getByRole("checkbox", { name: "Also delete client web01" }).focus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await confirmDelete();
    expect(onDelete).toHaveBeenCalledWith(false);
  });

  it("shows no option when there is no matching client", async () => {
    const { onDelete } = await openDialog(null);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await confirmDelete();
    expect(onDelete).toHaveBeenCalledWith(false);
  });

  it("explains why a client it can't see isn't offered", async () => {
    await openDialog("forbidden");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/don't have permission to view it/)).toBeInTheDocument();
  });

  it("sends a partial failure to the list with its reason", async () => {
    const onDelete = vi.fn();
    await openDialog("deletable", onDelete);
    onDelete.mockResolvedValueOnce({ error: "…", clientKept: "forbidden" });
    await confirmDelete();
    expect(push).toHaveBeenCalledWith("/orgs/acme/nodes?deleted=web01&client_kept=forbidden");
  });

  it("has no axe violations with the option shown", async () => {
    const { container } = await openDialog("deletable");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ClientKeptNotice", () => {
  it("says the node was deleted, the client wasn't, and why", () => {
    render(<ClientKeptNotice org="acme" deleted="web01" reason="forbidden" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Node web01 was deleted, but client web01 wasn't: you don't have permission to delete it.",
    );
    expect(screen.getByRole("link", { name: "View client web01" })).toHaveAttribute(
      "href",
      "/orgs/acme/clients/web01",
    );
  });

  it.each([
    ["web01", "bogus"],
    ["web01", undefined],
    ["not a name!", "forbidden"],
    [["web01"], "forbidden"],
  ])("renders nothing for deleted=%j reason=%j", (deleted, reason) => {
    const { container } = render(
      <ClientKeptNotice org="acme" deleted={deleted} reason={reason} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ClientKeptNotice org="acme" deleted="web01" reason="error" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
