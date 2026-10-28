"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Download } from "lucide-react";

export function DateRangeExcelBar({
  onExport,
}: {
  onExport: (from: string, to: string) => Promise<void>;
}) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function exportRange() {
    if (!from || !to) {
      setError(locale === "bn" ? "শুরু ও শেষ তারিখ নির্বাচন করুন" : "Select from and to dates");
      return;
    }
    if (from > to) {
      setError(locale === "bn" ? "শুরুর তারিখ শেষ তারিখের পরে হতে পারে না" : "From date cannot be greater than To date");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onExport(from, to);
    } catch {
      setError(locale === "bn" ? "এক্সপোর্ট ব্যর্থ হয়েছে" : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <input
        type="date"
        aria-label={locale === "bn" ? "শুরুর তারিখ" : "From date"}
        className="gp-input h-9 w-[9.75rem] min-w-0 px-2 text-sm"
        value={from}
        onChange={(e) => { setFrom(e.target.value); setError(""); }}
      />
      <input
        type="date"
        aria-label={locale === "bn" ? "শেষ তারিখ" : "To date"}
        className="gp-input h-9 w-[9.75rem] min-w-0 px-2 text-sm"
        value={to}
        onChange={(e) => { setTo(e.target.value); setError(""); }}
      />
      <button type="button" className="gp-btn gp-btn-ghost h-9 shrink-0 px-3 text-sm" disabled={busy} onClick={() => void exportRange()}>
        <Download className="h-4 w-4" />
        {busy ? (locale === "bn" ? "Export..." : "Export...") : "Excel"}
      </button>
      {error ? <span className="w-full text-xs font-semibold text-red-600 sm:w-auto">{error}</span> : null}
    </div>
  );
}

export async function downloadExcelResponse(res: Response, fallbackName: string) {
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "export_failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const header = res.headers.get("Content-Disposition") || "";
  const match = header.match(/filename="([^"]+)"/);
  a.href = url;
  a.download = match?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}
