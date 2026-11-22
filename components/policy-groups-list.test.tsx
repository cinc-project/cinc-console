import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "@/test/axe";
import { PolicyGroupsList } from "./policy-groups-list";

const SHA = "3f2a9c1b7e5d4c3b2a1908f7e6d5c4b3a29180f7e6d5c4b3a29180f7e6d5c4b3";

const groups = [
  {
    name: "production",
    policies: [
      { policy: "database", revision: "1.0.0" },
      { policy: "web-app", revision: SHA },
    ],
  },
  { name: "sandbox", policies: [] },
];

test("lists each group with its pinned policies and revisions", () => {
  render(<PolicyGroupsList org="acme" groups={groups} />);

  const prod = screen.getByRole("row", { name: /production/ });
  expect(within(prod).getByRole("link", { name: "production" })).toHaveAttribute(
    "href",
    "/orgs/acme/policy_groups/production",
  );
  expect(within(prod).getByRole("link", { name: "web-app" })).toHaveAttribute(
    "href",
    "/orgs/acme/policies/web-app",
  );
  // The revision link reads the full id, though only a prefix is shown.
  const rev = within(prod).getByRole("link", { name: `web-app revision ${SHA}` });
  expect(rev).toHaveAttribute(
    "href",
    `/orgs/acme/policies/web-app#revision-${SHA}`,
  );
  expect(within(rev).getByText(`${SHA.slice(0, 10)}…`)).toBeInTheDocument();

  const sandbox = screen.getByRole("row", { name: /sandbox/ });
  expect(within(sandbox).getByText("No policies")).toBeInTheDocument();
});

test("explains how groups are created when there are none", () => {
  render(<PolicyGroupsList org="acme" groups={[]} />);
  expect(screen.getByRole("heading", { name: "No policy groups yet" })).toBeInTheDocument();
  expect(screen.getByText(/cinc policy push/)).toBeInTheDocument();
});

test("has no axe violations", async () => {
  const { container } = render(<PolicyGroupsList org="acme" groups={groups} />);
  expect(await axe(container)).toHaveNoViolations();
});

test("has no axe violations when empty", async () => {
  const { container } = render(<PolicyGroupsList org="acme" groups={[]} />);
  expect(await axe(container)).toHaveNoViolations();
});
