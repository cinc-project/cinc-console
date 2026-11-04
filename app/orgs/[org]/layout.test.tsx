// @vitest-environment node
import { expect, test, vi, beforeEach } from "vitest";
import pkg from "@/package.json";

vi.mock("@/lib/guard", () => ({
  currentSession: async () => ({ username: "alice", displayName: "Alice" }),
}));

const { listUserOrgs } = vi.hoisted(() => ({ listUserOrgs: vi.fn() }));
vi.mock("@/lib/cinc/orgs", () => ({ listUserOrgs }));

// notFound() throws in Next; mirror that with a recognizable sentinel.
const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));

// Mock the shell so importing the layout doesn't pull a client component into
// the node env; we assert on the element the layout builds, not its render.
vi.mock("@/components/app-shell", () => ({ AppShell: () => null }));

import OrgLayout from "./layout";

const render = (org: string) =>
  OrgLayout({ children: null, params: Promise.resolve({ org }) });

beforeEach(() => listUserOrgs.mockReset());

test("renders the shell for an org the user belongs to", async () => {
  listUserOrgs.mockResolvedValueOnce([{ name: "acme" }, { name: "beta" }]);
  const el = await render("acme");
  expect(el.props.org).toBe("acme");
  expect(el.props.orgs).toEqual([{ name: "acme" }, { name: "beta" }]);
  // The signed-in footer shows the console version from package.json.
  expect(el.props.version).toBe(pkg.version);
});

test("404s a bogus org that the user does not belong to", async () => {
  listUserOrgs.mockResolvedValueOnce([{ name: "acme" }]);
  await expect(render("fsdfdfsd")).rejects.toBe(NOT_FOUND);
});

test("degrades (no 404) when the orgs listing itself fails", async () => {
  listUserOrgs.mockRejectedValueOnce(new Error("transient"));
  const el = await render("acme");
  expect(el.props.org).toBe("acme");
  expect(el.props.orgs).toEqual([{ name: "acme" }]);
});
