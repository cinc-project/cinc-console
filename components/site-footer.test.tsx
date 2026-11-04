import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("shows the copyright and license on every page", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "© 2026 Tim Smith & Cinc Project",
    );
    expect(
      screen.getByRole("link", { name: "Apache License 2.0" }),
    ).toBeInTheDocument();
  });

  it("links to cinc.sh", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "cinc.sh" })).toHaveAttribute(
      "href",
      "https://cinc.sh/",
    );
  });

  it("omits the version when none is passed (the signed-out login page)", () => {
    render(<SiteFooter />);
    expect(screen.queryByText(/cinc-console v/)).not.toBeInTheDocument();
  });

  it("links the version to its release when signed in", () => {
    render(<SiteFooter version="0.7.1" />);
    expect(
      screen.getByRole("link", { name: "cinc-console v0.7.1" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/cinc-project/cinc-console/releases/tag/v0.7.1",
    );
  });
});
