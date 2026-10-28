export async function fetchJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error: string }> {
  try {
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, status: res.status, data: null, error: String(json.error || "failed") };
    }
    return { ok: true, status: res.status, data: json, error: "" };
  } catch {
    return { ok: false, status: 0, data: null, error: "network" };
  }
}
