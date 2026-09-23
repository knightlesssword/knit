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

  it("lists projects without archived by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    await api.projects.list();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects");
  });

  it("lists projects with include_archived param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    await api.projects.list(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects?include_archived=true");
  });

  it("creates, updates, archives, unarchives and deletes projects", async () => {
    const project = { id: 1, name: "Site" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(project, 201));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api.projects.create({
        name: "Site",
        client_id: 2,
        project_type: "fixed_price",
        status: "active",
        currency: "USD",
      }),
    ).resolves.toEqual(project);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");

    fetchMock.mockResolvedValue(jsonResponse(project));
    await api.projects.get(1);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/projects/1");

    await api.projects.update(1, { name: "New" });
    expect(fetchMock.mock.calls[2][1].method).toBe("PATCH");

    await api.projects.archive(1);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/projects/1/archive");
    expect(fetchMock.mock.calls[3][1].method).toBe("POST");

    await api.projects.unarchive(1);
    expect(fetchMock.mock.calls[4][0]).toBe("/api/projects/1/unarchive");

    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    await expect(api.projects.remove(1)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[5][1].method).toBe("DELETE");
  });

  it("lists, creates, updates and deletes milestones", async () => {
    const milestone = { id: 1, name: "Launch" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([milestone]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.milestones.list(2)).resolves.toEqual([milestone]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/2/milestones");

    fetchMock.mockResolvedValue(jsonResponse(milestone, 201));
    await expect(api.milestones.create(2, { name: "Launch" })).resolves.toEqual(
      milestone,
    );
    expect(fetchMock.mock.calls[1][0]).toBe("/api/projects/2/milestones");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");

    fetchMock.mockResolvedValue(jsonResponse(milestone));
    await api.milestones.get(1);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/milestones/1");

    await api.milestones.update(1, { status: "completed" });
    expect(fetchMock.mock.calls[3][0]).toBe("/api/milestones/1");
    expect(fetchMock.mock.calls[3][1].method).toBe("PATCH");

    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    await expect(api.milestones.remove(1)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[4][1].method).toBe("DELETE");
  });

  it("lists, creates, updates and deletes tasks", async () => {
    const task = { id: 1, title: "Write copy" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([task]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.tasks.listByProject(2)).resolves.toEqual([task]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/projects/2/tasks");

    await api.tasks.listAll();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/tasks");

    fetchMock.mockResolvedValue(jsonResponse(task, 201));
    await expect(api.tasks.create(2, { title: "Write copy" })).resolves.toEqual(task);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/projects/2/tasks");
    expect(fetchMock.mock.calls[2][1].method).toBe("POST");

    fetchMock.mockResolvedValue(jsonResponse(task));
    await api.tasks.get(1);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/tasks/1");

    await api.tasks.update(1, { status: "done" });
    expect(fetchMock.mock.calls[4][0]).toBe("/api/tasks/1");
    expect(fetchMock.mock.calls[4][1].method).toBe("PATCH");

    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    await expect(api.tasks.remove(1)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[5][1].method).toBe("DELETE");
  });
});
