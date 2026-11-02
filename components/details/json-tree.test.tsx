import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { JsonTree } from "./json-tree";

describe("JsonTree", () => {
  const data = {
    platform: "ubuntu",
    uptime_seconds: 84231,
    kernel: { name: "Linux", release: "5.15" },
  };

  it("shows top-level fields with highlighted, JSON-styled values", () => {
    const { container } = render(<JsonTree value={data} />);
    const span = (text: string) =>
      Array.from(container.querySelectorAll("span")).find(
        (s) => s.textContent === text,
      );
    expect(span('"platform"')?.className).toBe("text-link"); // key
    expect(span('"ubuntu"')?.className).toBe("text-success"); // string value
    expect(span("84231")?.className).toBe("text-warn"); // number value
  });

  it("collapses nested objects by default and expands on click", async () => {
    const user = userEvent.setup();
    render(<JsonTree value={data} />);

    // nested object is collapsed: placeholder shown, children absent
    expect(screen.getByText(/^\{…\}$/)).toBeInTheDocument();
    expect(screen.queryByText('"Linux"')).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /kernel/i }));
    expect(screen.getByText('"Linux"')).toBeInTheDocument();
  });

  it("renders an empty object placeholder", () => {
    render(<JsonTree value={{}} />);
    expect(screen.getByText("{}")).toBeInTheDocument();
  });
});

it("has no axe violations", async () => {
  const { container } = render(
    <JsonTree value={{ platform: "ubuntu", kernel: { name: "Linux" }, tags: ["a"] }} />,
  );
  expect(await axe(container)).toHaveNoViolations();
});
