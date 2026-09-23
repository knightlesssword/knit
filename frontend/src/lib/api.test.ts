import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError, api, getToken, setToken } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends the bearer token when present", async () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "ok", version: "0.1.0" }));
    vi.stubGlobal("fetch", fetchMock);
    await api.health();
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer abc");
  });

  it("parses the structured error envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "user_exists", message: "already exists" } }, 409),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await api.health();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("user_exists");
      expect((err as ApiError).status).toBe(409);
    }
  });

  it("reports network failure without a status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    try {
      await api.health();
      expect.unreachable();
    } catch (err) {
      expect((err as ApiError).code).toBe("network_error");
    }
  });

  it("resolves 204 deletes without parsing a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.clients.remove(3)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/clients/3");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("posts new clients as json", async () => {
    const created = { id: 1, name: "Acme" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.clients.create({ name: "Acme" })).resolves.toEqual(created);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});
