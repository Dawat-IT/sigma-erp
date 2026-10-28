"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { AlertBanner, PageHeader } from "@/components/ui";

export function ImportPage({
  type,
  titleBn,
  titleEn,
  sample,
}: {
  type: "products" | "customers" | "suppliers";
  titleBn: string;
  titleEn: string;
  sample: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [csv, setCsv] = useState(sample);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
  }

  async function onImport() {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, csv }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ tone: "error", message: json.tip || json.error || t("common.error") });
        return;
      }
      setBanner({
        tone: "success",
        message:
          locale === "bn"
            ? `${json.created}টি যোগ হয়েছে, ${json.skipped}টি স্কিপ`
            : `Imported ${json.created}, skipped ${json.skipped}`,
      });
    } catch {
      setBanner({ tone: "error", message: t("common.error") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? titleBn : titleEn}
        subtitle={
          locale === "bn"
            ? "CSV ফাইল আপলোড করুন বা নিচে পেস্ট করুন"
            : "Upload a CSV file or paste rows below"
        }
      />
      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}

      <div className="gp-card space-y-4 p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-[#fafbfc] px-4 py-8 text-sm text-muted hover:border-primary/40">
          <Upload className="h-6 w-6 text-primary" />
          <span>{locale === "bn" ? "CSV ফাইল নির্বাচন করুন" : "Choose CSV file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
        </label>

        <textarea
          className="gp-input min-h-[200px] font-mono text-sm"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />

        <button
          type="button"
          className="gp-btn gp-btn-primary w-full"
          disabled={busy || !csv.trim()}
          onClick={onImport}
        >
          {busy ? t("app.loading") : locale === "bn" ? "ইমপোর্ট করুন" : "Import"}
        </button>
      </div>
    </div>
  );
}
