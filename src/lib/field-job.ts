const KEY = "fieldJobId";

export function readStoredJob() {
  if (typeof window === "undefined") return "";
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      const value = store.getItem(KEY) || "";
      if (value) return value;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function writeStoredJob(id: string) {
  if (!id || typeof window === "undefined") return;
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      store.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }
}

export function jobParam(id: string | string[] | undefined) {
  return Array.isArray(id) ? id[0] || "" : id || "";
}
