export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const BASE = "/api/v1";

function detail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) {
      const loc = Array.isArray(d[0].loc) ? d[0].loc.filter((x: unknown) => typeof x === "string" && x !== "body").join(".") : "";
      return loc ? `${loc}: ${d[0].msg}` : d[0].msg;
    }
  }
  return fallback;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: { "X-Requested-With": "IronLog", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized?.();
    throw new ApiError(res.status, detail(data, res.statusText || "Request failed"));
  }
  return data as T;
}

export const get = <T>(p: string) => api<T>("GET", p);
export const put = <T>(p: string, b?: unknown) => api<T>("PUT", p, b ?? {});
export const post = <T>(p: string, b?: unknown) => api<T>("POST", p, b ?? {});
export const del = <T = void>(p: string) => api<T>("DELETE", p);

/** Download a file from the API (used for JSON export). */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(BASE + path, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, "Export failed.");
  const cd = res.headers.get("content-disposition") || "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
