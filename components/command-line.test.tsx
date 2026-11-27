import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandLine } from "./command-line";

describe("CommandLine", () => {
  it("emphasizes UPPER_CASE placeholders only", () => {
    render(<CommandLine line="cinc node bootstrap HOST --ssh-user USER" />);
    expect(screen.getByText("HOST")).toHaveClass("font-semibold");
    expect(screen.getByText("USER")).toHaveClass("font-semibold");
    expect(screen.getByText(/cinc node bootstrap/)).not.toHaveClass("font-semibold");
  });
});
