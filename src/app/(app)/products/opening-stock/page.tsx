"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, EmptyState, Field, PageHeader, TableSkeleton } from "@/components/ui";
import { useDebouncedValue } from "@/lib/hooks";

type Product = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  locationQty?: number;
  stocks?: { locationId?: string; qty?: number }[];
};

type Location = { _id: string; name: string };

export default function OpeningStockPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [rows, setRows] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        setLocations(d.locations || []);
        if (d.locations?.[0]?._id) setLocationId(d.locations[0]._id);
      });
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100", locationId });
    if (debouncedQ) qs.set("q", debouncedQ);
    const res = await fetch(`/api/products?${qs}`);
    const json = await res.json();
    const data: Product[] = json.data || [];
    setRows(data);
    const next: Record<string, string> = {};
    for (const p of data) next[p._id] = String(p.locationQty ?? 0);
    setQty(next);
    setLoading(false);
  }, [debouncedQ, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!locationId) return;
    setBusy(true);
    setBanner(null);
    let ok = 0;
    for (const p of rows) {
      const newQty = Number(qty[p._id] || 0);
      if (newQty === (p.locationQty ?? 0)) continue;
      const res = await fetch(`/api/products/${p._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          nameBn: p.nameBn,
          sku: p.sku,
          stockUpdate: { locationId, qty: newQty },
        }),
      });
      if (res.ok) ok += 1;
    }
    setBanner({
      tone: "success",
      message: locale === "bn" ? `${ok}টি স্টক আপডেট` : `Updated ${ok} stock rows`,
    });
    setBusy(false);
    await load();
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "প্রারম্ভিক স্টক" : "Opening Stock"}
        subtitle={
          locale === "bn"
            ? "লোকেশন অনুযায়ী পণ্যের স্টক সেট করুন"
            : "Set product stock by location"
        }
      />
      {banner ? (
        <AlertBanner tone={banner.tone} message={banner.message} onClose={() => setBanner(null)} />
      ) : null}

      <div className="gp-card mb-4 grid gap-3 p-3.5 md:grid-cols-2">
        <Field label={t("dashboard.location")}>
          <select
            className="gp-input"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("common.search")}>
          <input className="gp-input" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </div>

      {loading && !rows.length ? (
        <TableSkeleton rows={8} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <form onSubmit={save}>
          <div className="gp-table-wrap overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>{t("products.name")}</th>
                  <th>{t("products.sku")}</th>
                  <th>{locale === "bn" ? "বর্তমান" : "Current"}</th>
                  <th>{locale === "bn" ? "নতুন স্টক" : "New qty"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </td>
                    <td>{p.sku}</td>
                    <td>{p.locationQty ?? 0}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="gp-input"
                        value={qty[p._id] ?? "0"}
                        onChange={(e) => setQty((q) => ({ ...q, [p._id]: e.target.value }))}
                      />
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
