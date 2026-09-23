/** Typed API client. All backend access goes through here (AGENTS.md section 14). */

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Client {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  projects?: ClientProject[];
}

export interface ClientProject {
  id: number;
  name: string;
  status: ProjectStatus;
  archived_at: string | null;
}

export type ProjectType = "fixed_price" | "hourly" | "retainer";
export type ProjectStatus = "active" | "on_hold" | "completed";
export type ProjectCurrency = "USD" | "GBP" | "INR";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  currency: ProjectCurrency;
  budget: number | null;
  hourly_rate: number | null;
  fixed_price: number | null;
  recurring_amount: number | null;
  recurring_billing_period: string | null;
  start_date: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  client_id: number;
  client_name: string;
}

export interface ProjectInput {
  name: string;
  client_id: number;
  description?: string;
  notes?: string;
  project_type: ProjectType;
  status: ProjectStatus;
  currency: ProjectCurrency;
  budget?: number | null;
  hourly_rate?: number | null;
  fixed_price?: number | null;
  recurring_amount?: number | null;
  recurring_billing_period?: string | null;
  start_date?: string | null;
  due_date?: string | null;
}

export interface ClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

const TOKEN_KEY = "knit.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError("network_error", "couldn't reach the local server", 0);
  }
  if (!res.ok) {
    let code = "request_error";
    let message = "something went wrong";
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      /* keep defaults */
    }
    throw new ApiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => apiFetch<{ status: string; version: string }>("/api/health"),
  register: (input: { name: string; email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { identifier: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  me: () => apiFetch<User>("/api/auth/me"),
  clients: {
    list: () => apiFetch<Client[]>("/api/clients"),
    get: (id: number) => apiFetch<Client>(`/api/clients/${id}`),
    create: (input: ClientInput) =>
      apiFetch<Client>("/api/clients", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: Partial<ClientInput>) =>
      apiFetch<Client>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (id: number) =>
      apiFetch<void>(`/api/clients/${id}`, { method: "DELETE" }),
  },
  projects: {
    list: (includeArchived = false) =>
      apiFetch<Project[]>(
        includeArchived ? "/api/projects?include_archived=true" : "/api/projects",
      ),
    get: (id: number) => apiFetch<Project>(`/api/projects/${id}`),
    create: (input: ProjectInput) =>
      apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
    update: (id: number, input: Partial<ProjectInput>) =>
      apiFetch<Project>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (id: number) =>
      apiFetch<Project>(`/api/projects/${id}/archive`, { method: "POST" }),
    unarchive: (id: number) =>
      apiFetch<Project>(`/api/projects/${id}/unarchive`, { method: "POST" }),
    remove: (id: number) =>
      apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" }),
  },
};
