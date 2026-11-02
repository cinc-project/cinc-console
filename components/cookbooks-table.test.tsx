import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { CookbooksTable } from "./cookbooks-table";

type Row = { name: string; latest: string | null; count: number };

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `cookbook${String(i).padStart(3, "0")}`,
    latest: "1.0.0",
    count: 1,
  }));

describe("CookbooksTable", () => {
  it("shows each cookbook's name, latest version, and version count", () => {
    render(
      <CookbooksTable
        basePath="/b"
        cookbooks={[
          { name: "nginx", latest: "1.2.0", count: 1 },
          { name: "apache2", latest: "5.1.0", count: 3 },
        ]}
      />,
    );

    const apache = screen.getByRole("row", { name: /apache2/ });
    expect(within(apache).getByRole("link", { name: "apache2" })).toHaveAttribute(
      "href",
      "/b/apache2",
    );
    expect(within(apache).getByText("5.1.0")).toBeInTheDocument();
    expect(within(apache).getByText("3")).toBeInTheDocument();
  });

  it("defaults to sorting by name ascending", () => {
    render(
      <CookbooksTable
        basePath="/b"
        cookbooks={[
          { name: "nginx", latest: "1.2.0", count: 1 },
          { name: "apache2", latest: "5.1.0", count: 3 },
          { name: "mysql", latest: "8.0.0", count: 2 },
        ]}
      />,
    );
    const names = screen.getAllByRole("link").map((a) => a.textContent);
    expect(names).toEqual(["apache2", "mysql", "nginx"]);
  });

  it("renders a dash when a cookbook has no versions", () => {
    render(
      <CookbooksTable
        basePath="/b"
        cookbooks={[{ name: "ghost", latest: null, count: 0 }]}
      />,
    );
    const ghost = screen.getByRole("row", { name: /ghost/ });
    expect(within(ghost).getByText("—")).toBeInTheDocument();
    expect(within(ghost).getByText("0")).toBeInTheDocument();
  });

  it("filters by name and updates the count", async () => {
    const user = userEvent.setup();
    render(<CookbooksTable basePath="/b" cookbooks={rows(120)} />);

    await user.type(screen.getByPlaceholderText(/filter cookbooks/i), "cookbook01");
    // cookbook010–cookbook019 = 10 matches.
    expect(screen.getByText("1–10 of 10 (120 total)")).toBeInTheDocument();
  });

  it("paginates large lists to 50 rows per page", async () => {
    const user = userEvent.setup();
    render(<CookbooksTable basePath="/b" cookbooks={rows(120)} />);

    expect(screen.getAllByRole("link")).toHaveLength(50);
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
  });

  it("invites the user to upload when the org has no cookbooks", () => {
    render(<CookbooksTable basePath="/b" cookbooks={[]} />);
    expect(screen.getByText(/no cookbooks in this organization/i)).toBeInTheDocument();
  });
});

it("has no axe violations", async () => {
  const { container } = render(<CookbooksTable basePath="/b" cookbooks={rows(3)} />);
  expect(await axe(container)).toHaveNoViolations();
});
