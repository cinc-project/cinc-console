import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { RunListEditor } from "./run-list-editor";

function Harness({
  initial = [],
  roles = ["base", "media-server", "monitoring"],
  cookbooks = ["apt", "nginx"],
  onChange = () => {},
}: {
  initial?: string[];
  roles?: string[] | null;
  cookbooks?: string[] | null;
  onChange?: (v: string[]) => void;
}) {
  const [entries, setEntries] = useState(initial);
  return (
    <RunListEditor
      entries={entries}
      onChange={(v) => {
        setEntries(v);
        onChange(v);
      }}
      roles={roles}
      cookbooks={cookbooks}
    />
  );
}

const items = () =>
  within(screen.getByRole("list", { name: /Run list/ }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

describe("RunListEditor", () => {
  it("lists entries in order and reorders and removes them", async () => {
    render(<Harness initial={["role[base]", "recipe[apt]", "role[monitoring]"]} />);
    expect(items()[0]).toContain("base");
    expect(screen.getByRole("button", { name: "Move role[base] up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move role[monitoring] down" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Move role[base] down" }));
    expect(items()[0]).toContain("apt");
    expect(items()[1]).toContain("base");

    await userEvent.click(screen.getByRole("button", { name: "Remove recipe[apt]" }));
    expect(items()).toHaveLength(2);
  });

  it("suggests roles and cookbooks as you type, skipping what's already there", async () => {
    render(<Harness initial={["role[base]"]} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "m");
    const suggestions = screen.getByRole("group", { name: "Suggestions" });
    expect(within(suggestions).getByRole("button", { name: /role\[media-server\]/ })).toBeInTheDocument();
    expect(within(suggestions).getByRole("button", { name: /role\[monitoring\]/ })).toBeInTheDocument();
    expect(within(suggestions).queryByRole("button", { name: /role\[base\]/ })).toBeNull();

    await userEvent.click(within(suggestions).getByRole("button", { name: /role\[media-server\]/ }));
    expect(items()[1]).toContain("media-server");
    expect(screen.getByLabelText("Add a role or recipe")).toHaveValue("");
  });

  it("offers cookbooks as their default recipe", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "ngi");
    expect(screen.getByRole("button", { name: /recipe\[nginx\]/ })).toBeInTheDocument();
  });

  it("adds a typed run-list entry, pins and namespaces included, with Enter", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "recipe[[apt::default@1.2.3]{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["recipe[apt::default@1.2.3]"]);
  });

  it("still takes typed entries when the role and cookbook lists couldn't load", async () => {
    render(<Harness roles={null} cookbooks={null} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "role[[base]{Enter}");
    expect(items()[0]).toContain("base");
  });

  it("explains an entry it can't add", async () => {
    render(<Harness roles={null} cookbooks={null} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "nope{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("role[NAME] or recipe[COOKBOOK]");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("says what an empty run list means", () => {
    render(<Harness />);
    expect(screen.getByText(/runs nothing/)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Harness initial={["role[base]", "recipe[apt]"]} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "m");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("says how to add an entry when nothing matches", async () => {
    render(<Harness initial={["role[base]"]} />);
    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "ba");
    expect(screen.getByText(/No role or cookbook matches/)).toBeInTheDocument();
  });
});
