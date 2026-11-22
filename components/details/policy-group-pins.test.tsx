import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { PolicyGroupPins } from "./policy-group-pins";
import { PolicyGroupNodes } from "./policy-group-nodes";
import type { ActionResult } from "@/lib/cinc/action";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const onRemovePolicy = vi.fn<(policy: string) => Promise<ActionResult>>();
const onDeleteGroup = vi.fn<() => Promise<ActionResult>>();

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  onRemovePolicy.mockReset().mockResolvedValue({ ok: true });
  onDeleteGroup.mockReset().mockResolvedValue({ ok: true });
});

const pins = [
  { policy: "database", revision: "1.0.0" },
  { policy: "web-app", revision: "2.0.0" },
];

const renderPins = (p = pins) =>
  render(
    <PolicyGroupPins
      org="acme"
      group="production"
      pins={p}
      onRemovePolicy={onRemovePolicy}
      onDeleteGroup={onDeleteGroup}
    />,
  );

test("links each pinned policy and its revision", () => {
  renderPins();
  expect(screen.getByRole("link", { name: "web-app" })).toHaveAttribute(
    "href",
    "/orgs/acme/policies/web-app",
  );
  expect(screen.getByRole("link", { name: "web-app revision 2.0.0" })).toHaveAttribute(
    "href",
    "/orgs/acme/policies/web-app#revision-2.0.0",
  );
});

test("removes one policy after confirming", async () => {
  renderPins();
  await userEvent.click(screen.getByRole("button", { name: "Remove web-app from production" }));
  const dialog = screen.getByRole("dialog", { name: /remove web-app from production/i });
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove from group" }));
  expect(onRemovePolicy).toHaveBeenCalledWith("web-app");
  expect(refresh).toHaveBeenCalled();
});

test("deletes the group after confirming and returns to the list", async () => {
  renderPins();
  await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
  const dialog = screen.getByRole("dialog", { name: /delete policy group production/i });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete group" }));
  expect(onDeleteGroup).toHaveBeenCalled();
  expect(push).toHaveBeenCalledWith("/orgs/acme/policy_groups");
});

test("explains a 403 instead of failing silently", async () => {
  onRemovePolicy.mockResolvedValueOnce({ error: "forbidden" });
  renderPins();
  await userEvent.click(screen.getByRole("button", { name: "Remove database from production" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove from group" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "You don't have permission to change this policy group.",
  );
});

test("says how to pin a policy when the group is empty", () => {
  renderPins([]);
  expect(screen.getByText(/no policies are pinned in this group/i)).toBeInTheDocument();
});

test("pins have no axe violations", async () => {
  const { container } = renderPins();
  expect(await axe(container)).toHaveNoViolations();
});

test("lists the group's nodes, capped, with the full count", () => {
  const nodes = Array.from({ length: 60 }, (_, i) => ({
    name: `web${String(i).padStart(2, "0")}`,
    policyName: "web-app",
  }));
  render(<PolicyGroupNodes org="acme" nodes={nodes} />);
  expect(screen.getByText("60 nodes, showing the first 50")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(50);
  expect(screen.getByRole("link", { name: "web00" })).toHaveAttribute(
    "href",
    "/orgs/acme/nodes/web00",
  );
});

test("shows the search error in place of the nodes", () => {
  render(<PolicyGroupNodes org="acme" nodes={[]} error="No permission." />);
  expect(screen.getByText("No permission.")).toBeInTheDocument();
});

test("nodes have no axe violations", async () => {
  const { container } = render(
    <PolicyGroupNodes org="acme" nodes={[{ name: "web01", policyName: "web-app" }]} />,
  );
  expect(await axe(container)).toHaveNoViolations();
});
