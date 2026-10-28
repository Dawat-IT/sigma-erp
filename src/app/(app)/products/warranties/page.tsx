"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, Field, PageHeader, TableSkeleton } from "@/components/ui";
import { useDebouncedValue } from "@/lib/hooks";

type Product = {
  _id: string;
  name: string;
  nameBn?: string;
  sku: string;
  brand?: string;
  warrantyMonths?: number;
  serialNo?: string;
};

export default function WarrantiesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (debouncedQ) qs.set("q", debouncedQ);
    const res = await fetch(`/api/products?${qs}`);
    const json = await res.json();
    const data: Product[] = json.data || [];
    setRows(data);
    const map: Record<string, string> = {};
    for (const p of data) map[p._id] = String(p.warrantyMonths ?? 0);
    setMonths(map);
    setLoading(false);
  }, [debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveWarranty(id: string) {
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warrantyMonths: Number(months[id] || 0) }),
      });
      if (!res.ok) throw new Error("fail");
      setMsg(locale === "bn" ? "ওয়ারেন্টি আপডেট হয়েছে" : "Warranty updated");
      await load();
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="gp-desk">
      <PageHeader
        title={locale === "bn" ? "ওয়ারেন্টি" : "Warranties"}
        subtitle={
          locale === "bn"
            ? "পণ্য অনুযায়ী ওয়ারেন্টি মাস"
            : "Warranty months per product"
        }
      />
      {msg ? (
        <p className="mb-4 rounded-xl border border-line bg-[var(--gp-primary-soft)] px-3 py-2 text-sm font-semibold text-primary">
          {msg}
        </p>
      ) : null}
      <div className="gp-card mb-4 p-3.5">
        <Field label={t("common.search")}>
          <input className="gp-input" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </div>
      {loading && !rows.length ? (
        <TableSkeleton rows={6} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
        <div className="gp-table-wrap overflow-x-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{t("products.name")}</th>
                <th>{t("products.sku")}</th>
                <th>{locale === "bn" ? "এসএল নং" : "SL No"}</th>
                <th>{locale === "bn" ? "ওয়ারেন্টি (মাস)" : "Warranty (months)"}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id}>
                  <td className="font-semibold">
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.serialNo || "—"}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="gp-input max-w-[120px]"
                      value={months[p._id] ?? "0"}
                      onChange={(e) => setMonths((m) => ({ ...m, [p._id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="gp-btn gp-btn-primary min-h-9 px-3"
                      disabled={busyId === p._id}
                      onClick={() => saveWarranty(p._id)}
                    >
                      {t("common.save")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
