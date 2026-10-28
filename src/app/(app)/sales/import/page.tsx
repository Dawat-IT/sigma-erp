"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { AlertBanner, PageHeader } from "@/components/ui";

/**
 * Simple sales CSV import:
 * customerName,sku,qty,unitPrice,discount
 * Creates one final sale with line items (walk-in if customer blank).
 */
export default function ImportSalesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const sample = `customerName,sku,qty,unitPrice,discount
Walk-in,ARD-UNO,2,850,0
Lab Customer,DMM-01,1,1200,50`;
  const [csv, setCsv] = useState(sample);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  async function onFile(file: File | null) {
    if (!file) return;
    setCsv(await file.text());
  }

  async function onImport() {
    setBusy(true);
    setBanner(null);
    try {
      const lines = csv
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) throw new Error("empty");

      const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
      const idx = (name: string) => headers.indexOf(name);

      const meta = await fetch("/api/meta").then((r) => r.json());
      const locationId = meta.locations?.[0]?._id;
      if (!locationId) throw new Error("no_location");

      const products = await fetch("/api/products?limit=200").then((r) => r.json());
      const bySku = new Map(
        (products.data || []).map((p: { sku: string; _id: string; name: string; sellPrice: number }) => [
          String(p.sku).toLowerCase(),
          p,
        ]),
      );

      // Group rows by customerName into one cart each
      const groups = new Map<string, { sku: string; qty: number; unitPrice: number; discount: number }[]>();
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map((c) => c.trim());
        const customerName = cols[idx("customername")] || "Walk-in";
        const sku = cols[idx("sku")] || "";
        const qty = Number(cols[idx("qty")] || 1);
        const unitPrice = Number(cols[idx("unitprice")] || 0);
        const discount = Number(cols[idx("discount")] || 0);
        const arr = groups.get(customerName) || [];
        arr.push({ sku, qty, unitPrice, discount });
        groups.set(customerName, arr);
      }

      let created = 0;
      let skipped = 0;
      for (const [customerName, items] of groups) {
        const mapped = items
          .map((it) => {
            const p = bySku.get(it.sku.toLowerCase()) as
              | { _id: string; name: string; sellPrice: number; sku: string }
              | undefined;
            if (!p) return null;
            return {
              productId: p._id,
              name: p.name,
              sku: p.sku,
              qty: it.qty,
              unitPrice: it.unitPrice || p.sellPrice,
              discount: it.discount,
            };
          })
          .filter(Boolean);

        if (!mapped.length) {
          skipped += 1;
          continue;
        }

        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            customerName,
            status: "final",
            items: mapped,
            payments: [{ method: "cash", amount: 0 }],
          }),
        });
        if (res.ok) created += 1;
        else skipped += 1;
      }

      setBanner({
        tone: "success",
        message:
          locale === "bn"
            ? `${created}টি বিক্রি তৈরি, ${skipped}টি স্কিপ`
            : `Created ${created} sales, skipped ${skipped}`,
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
        title={locale === "bn" ? "বিক্রি ইমপোর্ট" : "Import Sales"}
        subtitle={
          locale === "bn"
            ? "CSV থেকে বিক্রি তৈরি — SKU অবশ্যই ক্যাটালগে থাকতে হবে"
            : "Create sales from CSV — SKU must exist in catalog"
        }
      />
      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}
      <div className="gp-card space-y-4 p-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-[#fafbfc] px-4 py-8 text-sm text-muted">
          <Upload className="h-6 w-6 text-primary" />
          <span>{locale === "bn" ? "CSV ফাইল" : "CSV file"}</span>
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
          disabled={busy}
          onClick={onImport}
        >
          {busy ? t("app.loading") : locale === "bn" ? "ইমপোর্ট করুন" : "Import"}
        </button>
      </div>
    </div>
  );
}
