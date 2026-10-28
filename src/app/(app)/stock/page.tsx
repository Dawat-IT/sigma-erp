"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatBDT } from "@/lib/utils";

export default function StockPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<
    { _id: string; name: string; nameBn?: string; sku: string; sellPrice: number; locationQty?: number; alertQty?: number }[]
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products?limit=200")
      .then((r) => r.json())
      .then((d) => {
        setData(d.data || []);
        setError("");
      })
      .catch(() => setError(t("common.error")));
  }, [t]);

  return (
    <div className="gp-desk">
      <PageHeader title={t("stock.title")} subtitle={t("reports.drillHint")} />
      {error ? <p className="rounded-xl border border-[var(--gp-danger-border)] bg-[var(--gp-danger-soft)] px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
      {data.length === 0 ? (
        <EmptyState message={t("common.noData")} />
      ) : (
      <div className="gp-table-wrap overflow-auto">
          <table className="gp-table">
            <thead>
              <tr>
                <th>{t("products.name")}</th>
                <th>{t("products.sku")}</th>
                <th>{t("products.stock")}</th>
                <th>{t("products.alertQty")}</th>
                <th>{t("products.sellPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p._id}>
                  <td className="font-semibold">{locale === "bn" && p.nameBn ? p.nameBn : p.name}</td>
                  <td>{p.sku}</td>
                  <td className={(p.locationQty || 0) <= (p.alertQty || 0) ? "font-bold text-danger" : "font-bold"}>
                    {p.locationQty ?? 0}
                  </td>
                  <td>{p.alertQty ?? 0}</td>
                  <td>{formatBDT(p.sellPrice, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}
    </div>
  );
}
