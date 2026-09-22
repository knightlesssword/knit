import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState, Loading, ProgressBar } from "./states";

describe("state primitives", () => {
  it("announces loading via status role", () => {
    render(<Loading label="loading knit" />);
    expect(screen.getByRole("status")).toHaveTextContent("loading knit");
  });

  it("renders an intentional empty state", () => {
    render(<EmptyState title="nothing here yet" body="create your first project" />);
    expect(screen.getByRole("heading", { name: "nothing here yet" })).toBeInTheDocument();
    expect(screen.getByText("create your first project")).toBeInTheDocument();
  });

  it("announces errors via alert role", () => {
    render(<ErrorState message="server is down" />);
    expect(screen.getByRole("alert")).toHaveTextContent("server is down");
  });

  it("shows progress with an accessible value", () => {
    render(<ProgressBar value={0.6} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });

  it("shows no-progress text instead of 0% when there is no work", () => {
    render(<ProgressBar value={null} />);
    expect(screen.getByText("no progress")).toBeInTheDocument();
  });
});
