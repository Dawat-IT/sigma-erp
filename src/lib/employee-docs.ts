const MAX_DOC_CHARS = 1_200_000;

export function isEmployeeDocUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (value.startsWith("data:image/") && value.length <= MAX_DOC_CHARS) return true;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return true;
  return false;
}

export type EmployeeCertificate = {
  title?: string;
  url: string;
  at?: Date | string;
};

export function sanitizeCertificates(raw: unknown): EmployeeCertificate[] {
  if (!Array.isArray(raw)) return [];
  const out: EmployeeCertificate[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as { title?: string; url?: string; at?: Date | string };
    const url = String(item.url || "").trim();
    if (!isEmployeeDocUrl(url)) continue;
    out.push({
      title: String(item.title || "Certificate").trim() || "Certificate",
      url,
      at: item.at ? new Date(item.at) : new Date(),
    });
    if (out.length >= 20) break;
  }
  return out;
}
