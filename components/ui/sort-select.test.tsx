import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortSelect, type SortOption } from "./sort-select";

const OPTIONS: SortOption[] = [
  { label: "Name, A–Z", sort: { key: "name", dir: "asc" } },
  { label: "Last check-in, newest", sort: { key: "lastSeen", dir: "desc" } },
];

describe("SortSelect", () => {
  it("is a labelled native select that reports key and direction together", async () => {
    const onChange = vi.fn();
    render(<SortSelect options={OPTIONS} value={OPTIONS[0].sort} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Sort by" });
    await userEvent.selectOptions(select, "Last check-in, newest");
    expect(onChange).toHaveBeenCalledWith({ key: "lastSeen", dir: "desc" });
  });

  it("shows 'Custom' rather than a wrong label for a sort it doesn't list", () => {
    render(
      <SortSelect options={OPTIONS} value={{ key: "client", dir: "desc" }} onChange={() => {}} />,
    );
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveDisplayValue("Custom");
  });
});
