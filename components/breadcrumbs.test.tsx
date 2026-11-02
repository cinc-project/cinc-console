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
