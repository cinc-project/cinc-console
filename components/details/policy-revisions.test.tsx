import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { PolicyRevisions } from "./policy-revisions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const ok = async () => ({ ok: true as const });

const renderRevisions = () =>
  render(
    <PolicyRevisions
      org="acme"
      name="web-app"
      revisions={["1.0.0", "2.0.0"]}
      groups={{ "1.0.0": ["production"], "2.0.0": ["qa", "staging"] }}
      onDeleteRevision={ok}
      onDeletePolicy={ok}
    />,
  );

test("shows which groups pin each revision, linking to the group", () => {
  const { container } = renderRevisions();
  const row = container.querySelector("#revision-1\\.0\\.0") as HTMLElement;
  expect(within(row).getByRole("link", { name: "production" })).toHaveAttribute(
    "href",
    "/orgs/acme/policy_groups/production",
  );
  const newer = container.querySelector("#revision-2\\.0\\.0") as HTMLElement;
  expect(within(newer).getAllByRole("link").map((a) => a.textContent)).toEqual([
    "qa",
    "staging",
  ]);
});

test("warns that deleting a pinned revision affects its groups", async () => {
  renderRevisions();
  const row = screen.getByText("1.0.0").closest("li") as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("It is pinned in production");
});

test("has no axe violations", async () => {
  const { container } = renderRevisions();
  expect(await axe(container)).toHaveNoViolations();
});
