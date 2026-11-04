import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { CommandSnippet } from "./command-snippet";

const COMMANDS = {
  cinc: ["cinc cookbook upload COOKBOOK"],
  knife: ["knife cookbook upload COOKBOOK"],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("CommandSnippet", () => {
  it("defaults to Cinc CLI", () => {
    render(<CommandSnippet commands={COMMANDS} />);
    expect(screen.getByRole("tab", { name: "Cinc CLI" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("cinc cookbook upload COOKBOOK");
  });

  it("switches to knife and remembers the choice", async () => {
    render(<CommandSnippet commands={COMMANDS} />);
    await userEvent.click(screen.getByRole("tab", { name: "knife" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("knife cookbook upload COOKBOOK");
    expect(window.localStorage.getItem("cinc-console.cli-tool")).toBe("knife");
  });

  it("flips every snippet on the page together", async () => {
    render(
      <>
        <CommandSnippet commands={COMMANDS} />
        <CommandSnippet commands={{ cinc: ["cinc policy install"], knife: ["chef install"] }} />
      </>,
    );
    await userEvent.click(screen.getAllByRole("tab", { name: "knife" })[0]);
    const panels = screen.getAllByRole("tabpanel");
    expect(panels[0]).toHaveTextContent("knife cookbook upload");
    expect(panels[1]).toHaveTextContent("chef install");
  });

  it("follows the tabs keyboard pattern", async () => {
    render(<CommandSnippet commands={COMMANDS} />);
    const cinc = screen.getByRole("tab", { name: "Cinc CLI" });
    const knife = screen.getByRole("tab", { name: "knife" });
    expect(knife).toHaveAttribute("tabindex", "-1");
    cinc.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(knife).toHaveFocus();
    expect(knife).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}"); // wraps
    expect(cinc).toHaveFocus();
  });

  it("copies just the commands, without prompts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <CommandSnippet commands={{ cinc: ["cinc policy install", "cinc policy push GROUP"], knife: ["x"] }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy command" }));
    expect(writeText).toHaveBeenCalledWith("cinc policy install\ncinc policy push GROUP");
  });

  it("shows the selected tool's note", async () => {
    render(<CommandSnippet commands={COMMANDS} notes={{ knife: "knife note" }} />);
    expect(screen.queryByText("knife note")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "knife" }));
    expect(screen.getByText("knife note")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<CommandSnippet commands={COMMANDS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
