import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CheckInStatus } from "./check-in-status";

afterEach(() => vi.useRealTimers());

describe("CheckInStatus", () => {
  it("shows a registered node as in its first run", async () => {
    render(<CheckInStatus org="acme" name="web01" check={async () => ({ state: "registered" })} />);
    expect(await screen.findByText(/registered, first run in progress/)).toBeInTheDocument();
  });

  it("polls right away, then backs off from 5s by 1.5x", async () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => ({ state: "waiting" as const }));
    render(<CheckInStatus org="acme" name="web01" check={check} />);
    await act(async () => {});
    expect(check).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(check).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTime(7_000));
    expect(check).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTime(500));
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("gives up after 30 minutes", async () => {
    vi.useFakeTimers();
    const check = vi.fn(async () => ({ state: "waiting" as const }));
    render(<CheckInStatus org="acme" name="web01" check={check} />);
    await act(async () => vi.advanceTimersByTime(31 * 60_000));
    expect(screen.getByText(/Still waiting/)).toBeInTheDocument();
  });
});
