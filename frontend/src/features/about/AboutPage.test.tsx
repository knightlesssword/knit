import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AboutPage } from "./AboutPage";

describe("about page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows description, controls, usage, version, and dev sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "ok", version: "0.1.0" }),
      }),
    );
    render(<AboutPage />);
    expect(screen.getByRole("heading", { name: "about" })).toBeInTheDocument();
    for (const name of ["controls", "usage", "version", "development"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getByText("frontend 0.1.0, backend 0.1.0.")).toBeInTheDocument();
    });
  });

  it("reports an unreachable backend instead of a version", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<AboutPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("local server unreachable");
    });
  });
});
