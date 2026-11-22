import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import { Breadcrumbs } from "./breadcrumbs";

const setPath = (p: string) =>
  vi.mocked(usePathnameMock).mockReturnValue(p);

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathnameMock() }));

test("renders nothing on the org home", () => {
  setPath("/orgs/acme");
  const { container } = render(<Breadcrumbs />);
  expect(container).toBeEmptyDOMElement();
});

test("maps the section slug to its label and marks the last crumb current", () => {
  setPath("/orgs/acme/data_bags/secrets/api_key");
  render(<Breadcrumbs />);
  const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
  // org + section + bag are links; the item is the current page
  expect(screen.getByRole("link", { name: "acme" })).toHaveAttribute(
    "href",
    "/orgs/acme",
  );
  expect(screen.getByRole("link", { name: "Data Bags" })).toHaveAttribute(
    "href",
    "/orgs/acme/data_bags",
  );
  expect(screen.getByRole("link", { name: "secrets" })).toHaveAttribute(
    "href",
    "/orgs/acme/data_bags/secrets",
  );
  const current = nav.querySelector('[aria-current="page"]');
  expect(current?.textContent).toBe("api_key");
});

test("labels node tab segments and links the node itself", () => {
  setPath("/orgs/acme/nodes/web01/run-list");
  render(<Breadcrumbs />);
  expect(screen.getByRole("link", { name: "web01" })).toHaveAttribute(
    "href",
    "/orgs/acme/nodes/web01",
  );
  const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Run list & tags");
});

test("does not link the structural 'groups' segment under members", () => {
  setPath("/orgs/acme/members/groups/admins");
  render(<Breadcrumbs />);
  expect(screen.queryByRole("link", { name: "groups" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
});

test("has no axe violations", async () => {
  setPath("/orgs/acme/data_bags/secrets/api_key");
  const { container } = render(<Breadcrumbs />);
  expect(await axe(container)).toHaveNoViolations();
});

test("does not link the structural 'users' segment under members", () => {
  setPath("/orgs/acme/members/users/bob");
  render(<Breadcrumbs />);
  expect(screen.queryByRole("link", { name: "users" })).not.toBeInTheDocument();
  expect(screen.getByText("users")).toBeInTheDocument();
});

test("does not link the kind under permissions, but links the overview", () => {
  setPath("/orgs/acme/permissions/containers/nodes");
  render(<Breadcrumbs />);
  expect(screen.getByRole("link", { name: "Permissions" })).toHaveAttribute("href", "/orgs/acme/permissions");
  expect(screen.queryByRole("link", { name: "containers" })).not.toBeInTheDocument();
});
