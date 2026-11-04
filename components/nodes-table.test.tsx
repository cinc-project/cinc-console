import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { NodesTable } from "./nodes-table";
import type { NodeSummary } from "@/lib/cinc/fleet";

function node(over: Partial<NodeSummary>): NodeSummary {
  return {
    name: "n",
    status: "ok",
    missing: false,
    unconfigured: false,
    lastCheckIn: 1_700_000_000,
    chefVersion: "19.3.15",
    clientStatus: "current",
    emptyRunList: false,
    defaultEnv: false,
    recent: true,
    environment: "production",
    platform: "ubuntu",
    platformVersion: "24.04",
    ...over,
  };
}

const many = (n: number): NodeSummary[] =>
  Array.from({ length: n }, (_, i) => node({ name: `node${String(i).padStart(3, "0")}` }));

const base = {
  basePath: "/orgs/acme/nodes",
  createHref: "/orgs/acme/nodes/new",
  generatedAt: 1_700_000_000_000,
};

describe("NodesTable", () => {
  it("shows each node's name, last check-in, and client version with its chip", () => {
    render(
      <NodesTable
        {...base}
        nodes={[
          node({ name: "web1", chefVersion: "15.1.0", clientStatus: "eol" }),
          node({ name: "db1", lastCheckIn: null, chefVersion: null, clientStatus: "unknown" }),
        ]}
      />,
    );

    const web = screen.getByRole("row", { name: /web1/ });
    expect(within(web).getByRole("link", { name: "web1" })).toHaveAttribute(
      "href",
      "/orgs/acme/nodes/web1",
    );
    expect(within(web).getByText("15.1.0")).toBeInTheDocument();
    expect(within(web).getByText(/EOL/)).toBeInTheDocument();

    // A node that has never checked in reads "never" and shows a dash for version.
    const db = screen.getByRole("row", { name: /db1/ });
    expect(within(db).getByText("never")).toBeInTheDocument();
    expect(within(db).getByText("—")).toBeInTheDocument();
  });

  it("defaults to sorting by name ascending", () => {
    render(
      <NodesTable
        {...base}
        nodes={[node({ name: "web" }), node({ name: "app" }), node({ name: "db" })]}
      />,
    );
    // Scope to the table so the header's "New" link doesn't count.
    const table = screen.getByRole("table");
    const names = within(table)
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(names).toEqual(["app", "db", "web"]);
  });

  it("filters by name and updates the count", async () => {
    const user = userEvent.setup();
    render(<NodesTable {...base} nodes={many(120)} />);

    await user.type(screen.getByPlaceholderText(/filter nodes/i), "node01");
    expect(screen.getByText("1–10 of 10 (120 total)")).toBeInTheDocument();
  });

  it("paginates large lists to 50 rows per page", async () => {
    const user = userEvent.setup();
    render(<NodesTable {...base} nodes={many(120)} />);

    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
  });

  it("shows a bootstrap call to action when the org has no nodes", () => {
    render(<NodesTable {...base} nodes={[]} />);
    expect(screen.getByRole("heading", { name: "No nodes yet" })).toBeInTheDocument();
    expect(screen.getByText(/cinc node bootstrap/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Or create a node record by hand" }),
    ).toHaveAttribute("href", "/orgs/acme/nodes/new");
  });

  it("has no axe violations when empty", async () => {
    const { container } = render(<NodesTable {...base} nodes={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

it("has no axe violations", async () => {
  const { container } = render(
    <NodesTable
      {...base}
      nodes={[
        node({ name: "web1", chefVersion: "15.1.0", clientStatus: "eol" }),
        node({ name: "db1", lastCheckIn: null, chefVersion: null, clientStatus: "unknown" }),
        node({ name: "app1", status: "missing", missing: true }),
      ]}
    />,
  );
  expect(await axe(container)).toHaveNoViolations();
});
