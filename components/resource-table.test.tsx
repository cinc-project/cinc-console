import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { ResourceTable } from "./resource-table";

const names = (n: number) =>
  Array.from({ length: n }, (_, i) => `node${String(i).padStart(3, "0")}`);

describe("ResourceTable", () => {
  it("paginates large lists to 50 rows per page", async () => {
    const user = userEvent.setup();
    render(<ResourceTable title="Nodes" names={names(120)} basePath="/b" />);

    // First page: 50 rows, page 1 of 3, Prev disabled.
    expect(screen.getAllByRole("link")).toHaveLength(50);
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("101–120 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("filtering resets to the first page and updates the count", async () => {
    const user = userEvent.setup();
    render(<ResourceTable title="Nodes" names={names(120)} basePath="/b" />);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.type(screen.getByPlaceholderText(/filter nodes/i), "node01");
    // node010–node019 = 10 matches, back on page 1, total noted.
    expect(screen.getByText("1–10 of 10 (120 total)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("does not show pager when everything fits on one page", () => {
    render(<ResourceTable title="Nodes" names={names(5)} basePath="/b" />);
    expect(screen.getByText("1–5 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });
});

it("has no axe violations", async () => {
  const { container } = render(
    <ResourceTable title="Nodes" names={names(120)} basePath="/b" />,
  );
  expect(await axe(container)).toHaveNoViolations();
});

describe("empty state", () => {
  const empty = <section aria-label="empty">Nothing here yet</section>;

  it("replaces the table and filter when there are no objects", () => {
    render(<ResourceTable title="Roles" names={[]} basePath="/b" createHref="/b/new" empty={empty} />);
    expect(screen.getByRole("region", { name: "empty" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/filter/i)).not.toBeInTheDocument();
  });

  it("treats a list of only built-in objects as empty", () => {
    render(
      <ResourceTable title="Environments" names={["_default"]} basePath="/b" builtIn={["_default"]} empty={empty} />,
    );
    expect(screen.getByRole("region", { name: "empty" })).toBeInTheDocument();
  });

  it("shows the list as soon as there is one object of the user's own", () => {
    render(
      <ResourceTable
        title="Environments"
        names={["_default", "prod"]}
        basePath="/b"
        builtIn={["_default"]}
        empty={empty}
      />,
    );
    expect(screen.queryByRole("region", { name: "empty" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /prod/ })).toBeInTheDocument();
  });
});
