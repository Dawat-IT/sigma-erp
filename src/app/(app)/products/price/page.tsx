"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, EmptyState, Field, PageHeader, TableSkeleton } from "@/components/ui";
import { formatBDT } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks";

type Product = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  purchasePrice?: number;
  sellPrice: number;
};

export default function UpdatePricePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { sell: string; purchase: string }>>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (debouncedQ) qs.set("q", debouncedQ);
    const res = await fetch(`/api/products?${qs}`);
    const json = await res.json();
    const data: Product[] = json.data || [];
    setRows(data);
    const next: Record<string, { sell: string; purchase: string }> = {};
    for (const p of data) {
      next[p._id] = {
        sell: String(p.sellPrice ?? 0),
        purchase: String(p.purchasePrice ?? 0),
      };
    }
    setDrafts(next);
    setLoading(false);
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    let ok = 0;
    let fail = 0;
    for (const p of rows) {
      const d = drafts[p._id];
      if (!d) continue;
      const sell = Number(d.sell);
      const purchase = Number(d.purchase);
      if (sell === p.sellPrice && purchase === (p.purchasePrice || 0)) continue;
      const res = await fetch(`/api/products/${p._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          nameBn: p.nameBn,
          sku: p.sku,
          sellPrice: sell,
          purchasePrice: purchase,
        }),
      });
      if (res.ok) ok += 1;
      else fail += 1;
    }
    setBanner({
      tone: fail ? "error" : "success",
      message:
        locale === "bn"
          ? `${ok}টি আপডেট, ${fail}টি ব্যর্থ`
          : `Updated ${ok}, failed ${fail}`,
    });
    setBusy(false);
    await load();
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "মূল্য আপডেট" : "Update Price"}
        subtitle={
          locale === "bn"
            ? "একাধিক পণ্যের ক্রয়/বিক্রয় মূল্য একসাথে সংরক্ষণ করুন"
            : "Bulk update purchase and sell prices"
        }
      />
      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}

      <div className="gp-card mb-4 p-3.5">
        <Field label={t("common.search")}>
          <input className="gp-input" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </div>

      {loading && !rows.length ? (
        <TableSkeleton rows={8} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <form onSubmit={saveAll}>
          <div className="gp-table-wrap overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>{t("products.name")}</th>
                  <th>{t("products.sku")}</th>
                  <th>{t("products.purchasePrice")}</th>
                  <th>{t("products.sellPrice")}</th>
                  <th>{locale === "bn" ? "বর্তমান" : "Current"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </td>
                    <td>{p.sku}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="gp-input"
                        value={drafts[p._id]?.purchase ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [p._id]: { ...d[p._id]!, purchase: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="gp-input"
                        value={drafts[p._id]?.sell ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [p._id]: { ...d[p._id]!, sell: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="text-sm text-muted">
                      {formatBDT(p.purchasePrice || 0, locale)} / {formatBDT(p.sellPrice, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="gp-btn gp-btn-primary" disabled={busy}>
              {busy ? t("app.loading") : t("common.save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
